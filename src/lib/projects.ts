"use client";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db, diagnosticarFirestore } from "./firebase";
import type { Projeto } from "./types";

const COLECAO = "projetos";

export function novoProjeto(): Projeto {
  const agora = new Date().toISOString();
  return {
    nome: "Novo projeto",
    cliente: "",
    ufCliente: "",
    status: "Rascunho",
    icms: 0,
    pisReal: 9.25, // alíquota legal PIS/COFINS no Lucro Real (não cumulativo)
    pisPres: 3.65, // alíquota legal PIS/COFINS no Lucro Presumido (cumulativo)
    regime: "real",
    taxaFin: 0,
    compl: { fornecedor: "", descricao: "", valor: 0 },
    ded: { icms: false, pis: false, fin: false },
    obs: [],
    cenarios: [{ nome: "Cenário 1", modal: "filial", valor: 0, prazoMat: "", prazoCompl: "", credito: false }],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export function normalize(p: Partial<Projeto> | undefined): Projeto {
  const out = { ...novoProjeto(), ...(p || {}) };
  out.compl = { ...novoProjeto().compl, ...(out.compl || {}) };
  out.ded = { ...novoProjeto().ded, ...(out.ded || {}) };
  out.obs = Array.isArray(out.obs) ? out.obs : [];
  out.cenarios = Array.isArray(out.cenarios) ? out.cenarios : [];
  return out;
}

export const novoId = () => doc(collection(db, COLECAO)).id;
/** Cria sem esperar a confirmação do servidor: a escrita local já aparece na hora (e sincroniza depois). */
export const criarProjeto = (p: Projeto, id = novoId()) => {
  setDoc(doc(db, COLECAO, id), p).catch(() => {});
  return id;
};

/** Se nada chegar em 4 s, pergunta à API do Firestore o motivo (banco inexistente, regras, rede). */
export function useDiagnostico(carregando: boolean) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!carregando) {
      setMsg(null);
      return;
    }
    let vivo = true;
    const t = setTimeout(async () => {
      const d = await diagnosticarFirestore();
      if (vivo && d !== "ok") setMsg(d);
    }, 4000);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [carregando]);
  return msg;
}
export const excluirProjeto = (id: string) => deleteDoc(doc(db, COLECAO, id));

/** Lista de projetos em tempo real. `projects` é null enquanto carrega. */
export function useProjects() {
  const [projects, setProjects] = useState<Record<string, Projeto> | null>(null);
  const [error, setError] = useState<FirestoreError | null>(null);
  const diag = useDiagnostico(!projects);
  useEffect(
    () =>
      onSnapshot(
        collection(db, COLECAO),
        (snap) => {
          const m: Record<string, Projeto> = {};
          snap.docs.forEach((d) => (m[d.id] = normalize(d.data() as Partial<Projeto>)));
          setProjects(m);
          setError(null);
        },
        setError,
      ),
    [],
  );
  return { projects, error, diag };
}

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Um projeto em tempo real, com edição local e gravação automática (500 ms). */
export function useProject(id: string) {
  const [draft, setDraft] = useState<Projeto | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const ref = useRef<Projeto | null>(null);
  const dirty = useRef(false);
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deleted = useRef(false);

  const diag = useDiagnostico(!draft && !missing);

  useEffect(() => {
    // trocou de projeto: descarta o estado do anterior
    ref.current = null;
    dirty.current = false;
    deleted.current = false;
    setDraft(null);
    setMissing(false);
    return onSnapshot(
        doc(db, COLECAO, id),
        (snap) => {
          if (!snap.exists()) {
            if (!snap.metadata.fromCache) setMissing(true);
            return;
          }
          setMissing(false);
          if (dirty.current) return; // mantém a edição local ainda não gravada
          const p = normalize(snap.data() as Partial<Projeto>);
          ref.current = p;
          setDraft(p);
        },
        setError,
      );
  }, [id]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || !ref.current || deleted.current) return;
    const v = version.current;
    setSaveState("saving");
    try {
      await setDoc(doc(db, COLECAO, id), ref.current);
      if (version.current === v) dirty.current = false;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [id]);

  const update = useCallback(
    (mutate: (p: Projeto) => Projeto) => {
      if (!ref.current) return;
      const next = { ...mutate(ref.current), atualizadoEm: new Date().toISOString() };
      ref.current = next;
      dirty.current = true;
      version.current++;
      setDraft(next);
      setSaveState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
    },
    [flush],
  );

  // grava o que estiver pendente ao sair da tela
  useEffect(() => () => void flush(), [flush]);

  const remove = useCallback(() => {
    deleted.current = true;
    clearTimeout(timer.current);
    excluirProjeto(id).catch(() => {});
  }, [id]);

  return { projeto: draft, missing, error, diag, saveState, update, remove };
}
