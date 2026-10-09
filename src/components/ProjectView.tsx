"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PCT } from "@/lib/format";
import { criarProjeto, useProject } from "@/lib/projects";
import { STATUS, type Status } from "@/lib/types";
import { Editor, type Aba } from "./Editor";
import { Icon, SegControl } from "./ui";
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

  if (error) return <main className="section"><ErrorNote error={error} /><Link className="btn ghost sm" href="/"><Icon name="left" size={12} /> Todos os projetos</Link></main>;
  if (missing)
    return (
      <main className="section">
        <div className="empty">
          <h2>Projeto não encontrado</h2>
          <p className="hint">Ele pode ter sido excluído.</p>
          <Link className="btn" href="/"><Icon name="left" size={12} /> Todos os projetos</Link>
        </div>
      </main>
    );
  if (!P)
    return (
      <main className="section">
        <div className="skel l2" style={{ width: "40%", height: 36 }} />
        <div className="skel l4" />
        <div className="cards" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div className="card" key={i}>
              <div className="skel l1" />
              <div className="skel l2" />
              <div className="skel l4" />
            </div>
          ))}
        </div>
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
          <Link className="btn ghost sm" href="/"><Icon name="left" size={12} className="arrow" /> Todos os projetos</Link>
          <span className={`status${saveState === "error" ? " err" : ""}`} role="status">{saveTxt}</span>
        </div>

        <div className="proj-head">
          <div style={{ minWidth: 0 }}>
            <h1 data-anim="line"><span>{P.nome}</span></h1>
            <div className="muted" style={{ fontSize: ".88rem" }}>{sub}</div>
          </div>
          <div className="proj-actions">
            <label className="status-pick" data-status={P.status}>
              <span className="sdot" />
              <select aria-label="Status do projeto" value={P.status} onChange={(e) => update((p) => ({ ...p, status: e.target.value as Status }))}>
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <button className="btn" onClick={() => editar("projeto")}><Icon name="edit" size={16} /> Editar projeto</button>
          </div>
        </div>

        <div className="toolbar">
          <div className="tb-group">
            <span className="tb-label">Retirar dos valores</span>
            <div className="tb-items" role="group" aria-label="Retirar dos valores">
              <button className="toggle" aria-pressed={P.ded.icms} onClick={() => toggle("icms")}>
                <Icon name={P.ded.icms ? "check" : "dot"} size={18} /> ICMS <b>{PCT(P.icms)}</b>
              </button>
              <button className="toggle" aria-pressed={P.ded.pis} onClick={() => toggle("pis")}>
                <Icon name={P.ded.pis ? "check" : "dot"} size={18} /> PIS/COFINS <b>{PCT(P.regime === "real" ? P.pisReal : P.pisPres)}</b>
              </button>
              <button className="toggle" aria-pressed={P.ded.fin} onClick={() => toggle("fin")}>
                <Icon name={P.ded.fin ? "check" : "dot"} size={18} /> Taxa financeira <b>{PCT(P.taxaFin)}</b>
              </button>
            </div>
          </div>
          <div className="tb-group">
            <span className="tb-label">Regime PIS/COFINS</span>
            <SegControl
              label="Regime de PIS/COFINS"
              value={P.regime}
              onChange={(v) => update((p) => ({ ...p, regime: v }))}
              options={[{ v: "real", t: "Lucro Real" }, { v: "presumido", t: "Lucro Presumido" }]}
            />
          </div>
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
