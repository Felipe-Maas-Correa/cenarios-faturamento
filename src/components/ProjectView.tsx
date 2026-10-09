"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PCT } from "@/lib/format";
import { criarProjeto, useProject } from "@/lib/projects";
import { STATUS, type Status } from "@/lib/types";
import { Editor } from "./Editor";
import { ErrorNote } from "./ErrorNote";
import { Alerts, Results } from "./Results";

export function ProjectView({ id }: { id: string }) {
  const router = useRouter();
  const { projeto: P, missing, error, saveState, update, remove } = useProject(id);

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
  if (!P) return <main className="section"><p className="hint">Carregando projeto…</p></main>;

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

  async function duplicar() {
    if (!P) return;
    const agora = new Date().toISOString();
    const nid = await criarProjeto({ ...P, nome: P.nome + " (cópia)", status: "Rascunho", criadoEm: agora, atualizadoEm: agora });
    router.push(`/projeto/${nid}`);
  }
  async function excluir() {
    await remove();
    router.push("/");
  }

  const saveTxt = { idle: "", saving: "Salvando…", saved: "Salvo", error: "Não foi possível salvar. Tente de novo em instantes." }[saveState];

  return (
    <main className="section" style={{ gap: 28 }}>
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
          <label className="field" style={{ minWidth: 160 }}>
            Status
            <select value={P.status} onChange={(e) => update((p) => ({ ...p, status: e.target.value as Status }))}>
              {STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
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

      <Results P={P} />
      <Editor P={P} update={update} onDuplicate={duplicar} onDelete={excluir} />
    </main>
  );
}
