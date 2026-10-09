"use client";
import { useEffect, useRef, useState } from "react";
import { fmtMoney, fmtNum, parseNum } from "@/lib/format";
import type { Cenario, Projeto } from "@/lib/types";

type Update = (mutate: (p: Projeto) => Projeto) => void;

function Field({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <label className="field">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}

/** Campo numérico em formato pt-BR: edita como texto e confirma ao sair do campo. */
function NumField({
  label,
  value,
  onCommit,
  money,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  money?: boolean;
}) {
  const fmt = money ? fmtMoney : fmtNum;
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value, fmt]);
  return (
    <label className="field">
      {label}
      <input
        inputMode="decimal"
        value={text}
        onFocus={() => (focused.current = true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          focused.current = false;
          const n = parseNum(text);
          setText(fmt(n));
          if (n !== value) onCommit(n);
        }}
      />
    </label>
  );
}

export function Editor({
  P,
  update,
  onDuplicate,
  onDelete,

}: {
  P: Projeto;
  update: Update;
  onDuplicate: () => void;
  onDelete: () => void;

}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const set = <K extends keyof Projeto>(k: K, v: Projeto[K]) => update((p) => ({ ...p, [k]: v }));
  const setSc = (i: number, patch: Partial<Cenario>) =>
    update((p) => ({ ...p, cenarios: p.cenarios.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  return (
    <details className="edit">
      <summary>Editar projeto, valores, impostos e condições</summary>
      <fieldset className="edit-body" style={{ border: 0, margin: 0, minWidth: 0 }}>
        <p className="hint">
          Tudo é salvo automaticamente. Valores aceitam o formato 1.964.721,24. Prazos: dias separados por
          barra (ex.: 30/60/90/120); deixe vazio para à vista.
        </p>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Projeto</div>
          <div className="grid-form">
            <Field label="Nome do projeto" value={P.nome} onChange={(v) => set("nome", v)} />
            <Field label="Cliente" value={P.cliente} onChange={(v) => set("cliente", v)} />
            <Field
              label="UF do cliente"
              value={P.ufCliente}
              onChange={(v) => set("ufCliente", v.toUpperCase())}
              maxLength={2}
            />
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Impostos e taxa financeira</div>
          <div className="grid-form">
            <NumField label="ICMS (%)" value={P.icms} onCommit={(n) => set("icms", n)} />
            <NumField label="PIS/COFINS Lucro Real (%)" value={P.pisReal} onCommit={(n) => set("pisReal", n)} />
            <NumField label="PIS/COFINS Lucro Presumido (%)" value={P.pisPres} onCommit={(n) => set("pisPres", n)} />
            <NumField label="Taxa financeira (%)" value={P.taxaFin} onCommit={(n) => set("taxaFin", n)} />
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Item complementar (somado a todos os cenários; valor 0 desativa)
          </div>
          <div className="grid-form">
            <Field
              label="Fornecedor"
              value={P.compl.fornecedor}
              onChange={(v) => update((p) => ({ ...p, compl: { ...p.compl, fornecedor: v } }))}
            />
            <Field
              label="Descrição"
              value={P.compl.descricao}
              onChange={(v) => update((p) => ({ ...p, compl: { ...p.compl, descricao: v } }))}
            />
            <NumField
              money
              label="Valor (R$)"
              value={P.compl.valor}
              onCommit={(n) => update((p) => ({ ...p, compl: { ...p.compl, valor: n } }))}
            />
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Cenários</div>
          <div style={{ display: "grid", gap: 12 }}>
            {P.cenarios.map((sc, i) => (
              <div className="sc-edit" key={i}>
                <div className="sc-edit-h">
                  <b>Cenário {i + 1}</b>
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => update((p) => ({ ...p, cenarios: p.cenarios.filter((_, j) => j !== i) }))}
                  >
                    Remover
                  </button>
                </div>
                <div className="grid-form">
                  <Field label="Nome" value={sc.nome} onChange={(v) => setSc(i, { nome: v })} />
                  <label className="field">
                    Modalidade
                    <select value={sc.modal} onChange={(e) => setSc(i, { modal: e.target.value as Cenario["modal"] })}>
                      <option value="direto">Direto ao cliente</option>
                      <option value="filial">Via Alpha Filial</option>
                    </select>
                  </label>
                  <NumField money label="Valor materiais (R$)" value={sc.valor} onCommit={(n) => setSc(i, { valor: n })} />
                  <Field
                    label="Prazo materiais (dias)"
                    value={sc.prazoMat}
                    onChange={(v) => setSc(i, { prazoMat: v })}
                    placeholder="à vista"
                  />
                  <Field
                    label="Prazo item complementar (dias)"
                    value={sc.prazoCompl}
                    onChange={(v) => setSc(i, { prazoCompl: v })}
                    placeholder="à vista"
                  />
                  <label className="field chk">
                    <input type="checkbox" checked={sc.credito} onChange={(e) => setSc(i, { credito: e.target.checked })} />
                    Crédito em análise
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                update((p) => ({
                  ...p,
                  cenarios: [
                    ...p.cenarios,
                    { nome: "Novo cenário", modal: "filial", valor: 0, prazoMat: "", prazoCompl: "", credito: false },
                  ],
                }))
              }
            >
              Adicionar cenário
            </button>
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Observações exibidas no topo (uma por linha)</div>
          <textarea
            className="big-ta"
            value={P.obs.join("\n")}
            onChange={(e) => set("obs", e.target.value.split("\n"))}
          />
        </div>

        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={onDuplicate}>
            Duplicar este projeto
          </button>
          {!confirmDel ? (
            <button type="button" className="btn danger" onClick={() => setConfirmDel(true)}>
              Excluir projeto
            </button>
          ) : (
            <span>
              Excluir definitivamente?{" "}
              <button type="button" className="btn danger sm" onClick={onDelete}>
                Sim, excluir
              </button>{" "}
              <button type="button" className="btn ghost sm" onClick={() => setConfirmDel(false)}>
                Cancelar
              </button>
            </span>
          )}
        </div>
      </fieldset>
    </details>
  );
}
