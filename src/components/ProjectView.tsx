"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PCT } from "@/lib/format";
import { criarProjeto, useProject } from "@/lib/projects";
import { STATUS, type Status } from "@/lib/types";
import { Editor, type Aba } from "./Editor";
import { ErrorNote } from "./ErrorNote";
import { Alerts, Results } from "./Results";

export function ProjectView({ id, abrirEditor = false }: { id: string; abrirEditor?: boolean }) {
  const router = useRouter();
  const { projeto: P, missing, error, diag, saveState, update, remove } = useProject(id);
  const [editando, setEditando] = useState(abrirEditor);
  const [aba, setAba] = useState<Aba>(abrirEditor ? "projeto" : "cenarios");
  const editar = (a: Aba) => {
    setAba(a);
    setEditando(true);
  };

  if (error) return <main className="section"><ErrorNote error={error} /><Link className="btn ghost sm" href="/">← Todos os projetos</Link></main>;
  if (missing)
    return (
      <main className="section">
        <div className="empty">
          <h2>Projeto não encontrado</h2>
          <p className="hint">Ele pode ter sido excluído.</p>
          <Link className="btn" href="/">← Todos os projetos</Link>
        </div>
      </main>
    );
  if (!P)
    return (
      <main className="section">
        <p className="hint">Carregando projeto…</p>
        {diag && (
          <div className="alert err" role="alert">
            <b>Não foi possível carregar.</b> {diag}
          </div>
        )}
      </main>
    );

  const hasC = P.compl.valor > 0;
  const cn = P.compl.fornecedor || "Item complementar";
  const ded = [P.ded.icms && "ICMS", P.ded.pis && "PIS/COFINS", P.ded.fin && "taxa financeira"].filter(Boolean);
  const sub = [
    P.cliente && `Cliente: ${P.cliente}${P.ufCliente ? ` (${P.ufCliente})` : ""}`,
    ded.length ? `Valores sem ${ded.join(", ")}` : "Valores brutos, com impostos e taxa financeira inclusos",
    hasC && `${cn} incluído em todos os cenários`,
  ]
    .filter(Boolean)
    .join(" · ");

  const toggle = (k: "icms" | "pis" | "fin") => update((p) => ({ ...p, ded: { ...p.ded, [k]: !p.ded[k] } }));

  function duplicar() {
    if (!P) return;
    const agora = new Date().toISOString();
    const nid = criarProjeto({ ...P, nome: P.nome + " (cópia)", status: "Rascunho", criadoEm: agora, atualizadoEm: agora });
    router.push(`/projeto?id=${nid}`);
  }
  function excluir() {
    remove();
    router.push("/");
  }

  const saveTxt = { idle: "", saving: "Salvando…", saved: "Salvo", error: "Não foi possível salvar. Tente de novo em instantes." }[saveState];

  return (
    <main className={`section${editando ? " com-painel" : ""}`} style={{ gap: 28 }}>
      <header>
        <div className="btn-row">
          <Link className="btn ghost sm" href="/">← Todos os projetos</Link>
          <span className={`status${saveState === "error" ? " err" : ""}`} role="status">{saveTxt}</span>
        </div>
        <div className="title-row between">
          <div style={{ minWidth: 0 }}>
            <h1>{P.nome}</h1>
            <div className="muted" style={{ fontSize: ".88rem" }}>{sub}</div>
          </div>
          <div className="btn-row">
            <label className="field" style={{ minWidth: 150 }}>
              Status
              <select value={P.status} onChange={(e) => update((p) => ({ ...p, status: e.target.value as Status }))}>
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <button className="btn" style={{ alignSelf: "end" }} onClick={() => editar("projeto")}>✎ Editar projeto</button>
          </div>
        </div>
        <div className="controls" role="group" aria-label="Retirar dos valores">
          <span className="lbl">Retirar dos valores:</span>
          <button className="chip" aria-pressed={P.ded.icms} onClick={() => toggle("icms")}>
            <span className="dot" />ICMS {PCT(P.icms)}
          </button>
          <button className="chip" aria-pressed={P.ded.pis} onClick={() => toggle("pis")}>
            <span className="dot" />PIS/COFINS {PCT(P.regime === "real" ? P.pisReal : P.pisPres)}
          </button>
          <select
            aria-label="Regime de PIS/COFINS"
            value={P.regime}
            onChange={(e) => update((p) => ({ ...p, regime: e.target.value as "real" | "presumido" }))}
          >
            <option value="real">Lucro Real</option>
            <option value="presumido">Lucro Presumido</option>
          </select>
          <button className="chip" aria-pressed={P.ded.fin} onClick={() => toggle("fin")}>
            <span className="dot" />Taxa financeira {PCT(P.taxaFin)}
          </button>
        </div>
        <Alerts P={P} />
      </header>

      <Results P={P} onEditar={editar} />
      {editando && (
        <Editor P={P} update={update} aba={aba} setAba={setAba} saveState={saveState} onClose={() => setEditando(false)} onDuplicate={duplicar} onDelete={excluir} />
      )}
    </main>
  );
}
