"use client";
import { useEffect, useRef, useState } from "react";
import { fmtMoney, fmtNum, parseNum } from "@/lib/format";
import type { SaveState } from "@/lib/projects";
import { STATUS, type Cenario, type Projeto, type Status } from "@/lib/types";

type Update = (mutate: (p: Projeto) => Projeto) => void;
export type Aba = "projeto" | "impostos" | "cenarios" | "obs";

const ABAS: { id: Aba; nome: string }[] = [
  { id: "projeto", nome: "Projeto" },
  { id: "impostos", nome: "Impostos" },
  { id: "cenarios", nome: "Cenários" },
  { id: "obs", nome: "Observações" },
];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const PRAZOS = ["", "30", "30/60", "30/60/90", "30/60/90/120", "28/56/84"];

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

/** Campo numérico em formato pt-BR: edita como texto e confirma ao sair do campo ou com Enter. */
function NumField({
  label,
  value,
  onCommit,
  money,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  money?: boolean;
  suffix?: string;
  hint?: string;
}) {
  const fmt = money ? fmtMoney : fmtNum;
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value, fmt]);
  const commit = () => {
    const n = parseNum(text);
    setText(fmt(n));
    if (n !== value) onCommit(n);
  };
  return (
    <Field label={label} hint={hint}>
      <span className="affix">
        {money && <i>R$</i>}
        <input
          inputMode="decimal"
          value={text}
          onFocus={(e) => {
            focused.current = true;
            e.target.select();
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        {suffix && <i>{suffix}</i>}
      </span>
    </Field>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            className={value === o.v ? "on" : ""}
            onClick={() => onChange(o.v)}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="track">
        <span className="thumb" />
      </span>
      {children}
    </button>
  );
}

/** Botão que pede confirmação antes de executar (evita exclusões acidentais). */
function Confirm({ label, ask, onYes, small }: { label: string; ask: string; onYes: () => void; small?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setOn(false), 5000);
    return () => clearTimeout(t);
  }, [on]);
  const sz = small ? " sm" : "";
  return on ? (
    <span className="confirm">
      {ask}
      <button type="button" className={`btn danger${sz}`} onClick={onYes}>
        Sim
      </button>
      <button type="button" className={`btn ghost${sz}`} onClick={() => setOn(false)}>
        Não
      </button>
    </span>
  ) : (
    <button type="button" className={`btn danger${sz}`} onClick={() => setOn(true)}>
      {label}
    </button>
  );
}

function PrazoField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="À vista" />
      <span className="presets">
        {PRAZOS.map((p) => (
          <button
            key={p || "vista"}
            type="button"
            className={`preset${value.trim() === p ? " on" : ""}`}
            onClick={() => onChange(p)}
          >
            {p ? p + " d" : "À vista"}
          </button>
        ))}
      </span>
    </Field>
  );
}

export function Editor({
  P,
  update,
  aba,
  setAba,
  onClose,
  onDuplicate,
  onDelete,
  saveState,
}: {
  P: Projeto;
  update: Update;
  aba: Aba;
  setAba: (a: Aba) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  saveState: SaveState;
}) {
  const set = <K extends keyof Projeto>(k: K, v: Projeto[K]) => update((p) => ({ ...p, [k]: v }));
  const setSc = (i: number, patch: Partial<Cenario>) =>
    update((p) => ({ ...p, cenarios: p.cenarios.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setCompl = (patch: Partial<Projeto["compl"]>) => update((p) => ({ ...p, compl: { ...p.compl, ...patch } }));
  const hasC = P.compl.valor > 0;
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveTxt = { idle: "Alterações são salvas automaticamente", saving: "Salvando…", saved: "Tudo salvo", error: "Não foi possível salvar" }[saveState];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-label="Editar projeto" tabIndex={-1} ref={panelRef}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Editando</div>
            <h2>{P.nome || "Projeto"}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar edição">
            ✕
          </button>
        </div>

        <div className="tabs" role="tablist">
          {ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? "on" : ""} onClick={() => setAba(a.id)}>
              {a.nome}
              {a.id === "cenarios" && <b>{P.cenarios.length}</b>}
            </button>
          ))}
        </div>

        <div className="drawer-body" key={aba}>
          {aba === "projeto" && (
            <>
              <Field label="Nome do projeto">
                <input value={P.nome} onChange={(e) => set("nome", e.target.value)} />
              </Field>
              <Field label="Cliente">
                <input value={P.cliente} onChange={(e) => set("cliente", e.target.value)} />
              </Field>
              <div className="two">
                <Field label="UF do cliente" hint="Usada no alerta de DIFAL">
                  <select value={P.ufCliente} onChange={(e) => set("ufCliente", e.target.value)}>
                    <option value="">—</option>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={P.status} onChange={(e) => set("status", e.target.value as Status)}>
                    {STATUS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="danger-zone">
                <div className="eyebrow">Outras ações</div>
                <div className="btn-row">
                  <button type="button" className="btn ghost sm" onClick={onDuplicate}>
                    Duplicar projeto
                  </button>
                  <Confirm small label="Excluir projeto" ask="Excluir definitivamente?" onYes={onDelete} />
                </div>
              </div>
            </>
          )}

          {aba === "impostos" && (
            <>
              <div className="two">
                <NumField label="ICMS" suffix="%" value={P.icms} onCommit={(n) => set("icms", n)} />
                <NumField label="Taxa financeira" suffix="%" value={P.taxaFin} onCommit={(n) => set("taxaFin", n)} hint="Só nas parcelas a prazo" />
              </div>
              <div className="two">
                <NumField label="PIS/COFINS Lucro Real" suffix="%" value={P.pisReal} onCommit={(n) => set("pisReal", n)} />
                <NumField label="PIS/COFINS Lucro Presumido" suffix="%" value={P.pisPres} onCommit={(n) => set("pisPres", n)} />
              </div>
              <Segmented
                label="Regime em uso"
                value={P.regime}
                onChange={(v) => set("regime", v)}
                options={[
                  { v: "real", t: "Lucro Real" },
                  { v: "presumido", t: "Lucro Presumido" },
                ]}
              />
              <div className="group">
                <div className="eyebrow">Item complementar</div>
                <p className="hint">Somado a todos os cenários. Deixe o valor em 0 para não usar.</p>
                <div className="two">
                  <Field label="Fornecedor">
                    <input value={P.compl.fornecedor} onChange={(e) => setCompl({ fornecedor: e.target.value })} />
                  </Field>
                  <NumField money label="Valor" value={P.compl.valor} onCommit={(n) => setCompl({ valor: n })} />
                </div>
                <Field label="Descrição">
                  <input value={P.compl.descricao} onChange={(e) => setCompl({ descricao: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {aba === "cenarios" && (
            <>
              {P.cenarios.length === 0 && <p className="hint">Nenhum cenário ainda. Adicione o primeiro abaixo.</p>}
              {P.cenarios.map((sc, i) => (
                <section className="sc-edit" key={i}>
                  <div className="sc-edit-h">
                    <span className="sc-n">{i + 1}</span>
                    <input className="sc-name" aria-label={`Nome do cenário ${i + 1}`} value={sc.nome} onChange={(e) => setSc(i, { nome: e.target.value })} />
                    <button
                      type="button"
                      className="icon-btn"
                      title="Duplicar cenário"
                      aria-label="Duplicar cenário"
                      onClick={() => update((p) => ({ ...p, cenarios: [...p.cenarios.slice(0, i + 1), { ...sc, nome: sc.nome + " (cópia)" }, ...p.cenarios.slice(i + 1)] }))}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      className="icon-btn del"
                      title="Remover cenário"
                      aria-label="Remover cenário"
                      onClick={() => update((p) => ({ ...p, cenarios: p.cenarios.filter((_, j) => j !== i) }))}
                    >
                      🗑
                    </button>
                  </div>
                  <Segmented
                    label="Modalidade"
                    value={sc.modal}
                    onChange={(v) => setSc(i, { modal: v })}
                    options={[
                      { v: "filial", t: "Via Alpha Filial" },
                      { v: "direto", t: "Direto ao cliente" },
                    ]}
                  />
                  <NumField money label="Valor dos materiais (com impostos)" value={sc.valor} onCommit={(n) => setSc(i, { valor: n })} />
                  <PrazoField label="Prazo dos materiais (dias)" value={sc.prazoMat} onChange={(v) => setSc(i, { prazoMat: v })} />
                  {hasC ? (
                    <PrazoField label={`Prazo ${P.compl.fornecedor || "do item complementar"} (dias)`} value={sc.prazoCompl} onChange={(v) => setSc(i, { prazoCompl: v })} />
                  ) : null}
                  <Switch checked={sc.credito} onChange={(v) => setSc(i, { credito: v })}>
                    Crédito em análise
                  </Switch>
                </section>
              ))}
              <button
                type="button"
                className="btn ghost add-sc"
                onClick={() =>
                  update((p) => ({
                    ...p,
                    cenarios: [...p.cenarios, { nome: `Cenário ${p.cenarios.length + 1}`, modal: "filial", valor: 0, prazoMat: "", prazoCompl: "", credito: false }],
                  }))
                }
              >
                + Adicionar cenário
              </button>
            </>
          )}

          {aba === "obs" && (
            <Field label="Observações exibidas no topo do projeto" hint="Uma por linha. Aparecem como avisos para a diretoria.">
              <textarea className="big-ta" rows={8} value={P.obs.join("\n")} onChange={(e) => set("obs", e.target.value.split("\n"))} />
            </Field>
          )}
        </div>

        <div className="drawer-foot">
          <span className={`status${saveState === "error" ? " err" : ""}`} role="status">
            {saveTxt}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            Concluir
          </button>
        </div>
      </aside>
    </>
  );
}
