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
import { db } from "./firebase";
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
export const criarProjeto = async (p: Projeto, id = novoId()) => {
  await setDoc(doc(db, COLECAO, id), p);
  return id;
};
export const excluirProjeto = (id: string) => deleteDoc(doc(db, COLECAO, id));

/** Lista de projetos em tempo real. `projects` é null enquanto carrega. */
export function useProjects() {
  const [projects, setProjects] = useState<Record<string, Projeto> | null>(null);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (projects) return;
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [projects]);
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
  return { projects, error, slow };
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

  useEffect(
    () =>
      onSnapshot(
        doc(db, COLECAO, id),
        (snap) => {
          if (!snap.exists()) {
            setMissing(true);
            return;
          }
          setMissing(false);
          if (dirty.current) return; // mantém a edição local ainda não gravada
          const p = normalize(snap.data() as Partial<Projeto>);
          ref.current = p;
          setDraft(p);
        },
        setError,
      ),
    [id],
  );

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

  const remove = useCallback(async () => {
    deleted.current = true;
    clearTimeout(timer.current);
    await excluirProjeto(id);
  }, [id]);

  return { projeto: draft, missing, error, saveState, update, remove };
}
