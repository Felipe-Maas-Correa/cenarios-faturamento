"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { analyse } from "@/lib/calc";
import { fmtDate, R } from "@/lib/format";
import { criarProjeto, novoProjeto, useProjects } from "@/lib/projects";
import { STATUS, type Status } from "@/lib/types";
import { ErrorNote } from "./ErrorNote";

export const STATUS_TAG: Record<Status, string> = {
  "Em análise": "warn",
  Aprovado: "good",
  Reprovado: "bad",
  Rascunho: "",
};

export function ProjectList() {
  const router = useRouter();
  const { projects, error, slow } = useProjects();
  const [q, setQ] = useState("");
  const [fs, setFs] = useState("");
  const [busy, setBusy] = useState(false);

  const ids = useMemo(() => {
    if (!projects) return [];
    const term = q.trim().toLowerCase();
    return Object.keys(projects)
      .filter((id) => {
        const p = projects[id];
        return (!term || (p.nome + " " + p.cliente).toLowerCase().includes(term)) && (!fs || p.status === fs);
      })
      .sort((a, b) => projects[b].atualizadoEm.localeCompare(projects[a].atualizadoEm));
  }, [projects, q, fs]);

  async function novo() {
    setBusy(true);
    try {
      const id = await criarProjeto(novoProjeto());
      router.push(`/projeto/${id}`);
    } catch {
      setBusy(false);
    }
  }

  async function duplicar(id: string) {
    if (!projects) return;
    setBusy(true);
    try {
      const agora = new Date().toISOString();
      const nid = await criarProjeto({
        ...projects[id],
        nome: projects[id].nome + " (cópia)",
        status: "Rascunho",
        criadoEm: agora,
        atualizadoEm: agora,
      });
      router.push(`/projeto/${nid}`);
    } catch {
      setBusy(false);
    }
  }

  const total = projects ? Object.keys(projects).length : 0;

  return (
    <main className="section" style={{ gap: 20 }}>
      <div className="title-row between">
        <h1>Cenários de Faturamento</h1>
        <button className="btn" onClick={novo} disabled={busy || !!error}>
          Novo projeto
        </button>
      </div>
      {error && <ErrorNote error={error} />}
      {slow && !projects && !error && (
        <div className="alert err" role="alert">
          <b>Sem resposta do Firestore.</b> Verifique a conexão e se o banco Firestore foi criado no console do
          Firebase (projeto {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}).
        </div>
      )}
      <div className="filters">
        <input
          type="search"
          placeholder="Buscar por projeto ou cliente"
          aria-label="Buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select aria-label="Filtrar por status" value={fs} onChange={(e) => setFs(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="plist">
        {!projects && !error && <p className="hint">Carregando projetos…</p>}
        {projects && total === 0 && (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <h2>Nenhum projeto ainda</h2>
            <p className="hint">
              Cada projeto guarda os cenários de faturamento de uma cotação: fornecedores, valores,
              impostos, taxa financeira e prazos. Clique em <b>Novo projeto</b> para cadastrar o primeiro.
            </p>
          </div>
        )}
        {projects && total > 0 && ids.length === 0 && (
          <p className="hint">Nenhum projeto encontrado com esse filtro.</p>
        )}
        {projects &&
          ids.map((id) => {
            const P = projects[id];
            const { best } = analyse(P);
            return (
              <article className="pcard" key={id}>
                <div className="tags">
                  <span className={`tag ${STATUS_TAG[P.status] || ""}`}>{P.status}</span>
                  {P.cenarios.some((s) => s.credito) && <span className="tag warn">Crédito em análise</span>}
                </div>
                <h3>
                  <Link href={`/projeto/${id}`}>{P.nome}</Link>
                </h3>
                <div className="muted" style={{ fontSize: ".84rem" }}>
                  {P.cliente || "Cliente não informado"}
                  {P.ufCliente ? " · " + P.ufCliente : ""}
                </div>
                <div className="pmeta">
                  <div>
                    <div className="eyebrow">Cenários</div>
                    <div className="v">{P.cenarios.length}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Menor valor</div>
                    <div className="v">{best ? R(best.liq) : "—"}</div>
                  </div>
                </div>
                {best && (
                  <div style={{ fontSize: ".82rem" }}>
                    <span className="muted">Melhor opção:</span> {best.sc.nome}
                  </div>
                )}
                <div className="btn-row">
                  <Link className="btn sm" href={`/projeto/${id}`}>
                    Abrir
                  </Link>
                  <button className="btn ghost sm" onClick={() => duplicar(id)} disabled={busy}>
                    Duplicar
                  </button>
                  <span className="muted" style={{ fontSize: ".76rem", marginLeft: "auto" }}>
                    Atualizado {fmtDate(P.atualizadoEm)}
                  </span>
                </div>
              </article>
            );
          })}
      </div>
    </main>
  );
}
