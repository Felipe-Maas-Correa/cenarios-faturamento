"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fmtMoney, fmtNum, parseNum, prazoTxt } from "@/lib/format";
import type { SaveState } from "@/lib/projects";
import { STATUS, type Cenario, type Projeto, type Status } from "@/lib/types";
import { Icon, SegControl, Select, STATUS_OPTS } from "./ui";

type Update = (mutate: (p: Projeto) => Projeto) => void;
export type Aba = "projeto" | "impostos" | "cenarios" | "obs";

const ABAS: { id: Aba; nome: string }[] = [
  { id: "projeto", nome: "Projeto" },
  { id: "impostos", nome: "Impostos" },
  { id: "cenarios", nome: "Cenários" },
  { id: "obs", nome: "Observações" },
];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const PRAZOS: { v: string; t: string; dica?: string }[] = [
  { v: "", t: "À vista" },
  { v: "30", t: "30 d" },
  { v: "30/60", t: "30/60 d" },
  { v: "30/60/90", t: "30/60/90 d" },
  { v: "30/60/90/120", t: "30/60/90/120 d" },
  { v: "28/56/84", t: "28/56/84 d" },
  { v: "0:15/30:15/56:70", t: "15% + 15% + 70%", dica: "15% à vista, 15% em 30 dias e 70% em 56 dias" },
  { v: "0:30/30:70", t: "30% + 70%", dica: "30% à vista e 70% em 30 dias" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Seção do painel: título, descrição curta e o conteúdo. */
function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="sec">
      <header>
        <h3>{title}</h3>
        {desc && <p>{desc}</p>}
      </header>
      {children}
    </section>
  );
}

/**
 * Máscara pt-BR ao digitar: agrupa milhares com ponto (10000 vira 10.000) e aceita decimais depois da vírgula.
 */
function mascara(raw: string, maxDec: number): string {
  const s = raw.replace(/[^\d,]/g, "");
  const i = s.indexOf(",");
  const inteiro = (i < 0 ? s : s.slice(0, i)).replace(/^0+(?=\d)/, "");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (i < 0) return agrupado;
  return (agrupado || "0") + "," + s.slice(i + 1).replace(/,/g, "").slice(0, maxDec);
}

/** posição do cursor depois da máscara: mantém a mesma quantidade de dígitos/vírgula à esquerda */
function posCursor(texto: string, significativos: number): number {
  if (significativos <= 0) return 0;
  let n = 0;
  for (let k = 0; k < texto.length; k++) {
    if (/[\d,]/.test(texto[k])) n++;
    if (n === significativos) return k + 1;
  }
  return texto.length;
}

/**
 * Máscara de dinheiro estilo "app de banco": os dígitos entram pelos centavos e empurram para a esquerda
 * (2 vira 0,02; 25 vira 0,25; 2500 vira 25,00; 2500000 vira 25.000,00).
 */
function mascaraCentavos(raw: string): { texto: string; valor: number } {
  const digitos = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13);
  const valor = digitos ? parseInt(digitos, 10) / 100 : 0;
  return { texto: fmtMoney(valor), valor };
}

/** cursor depois da máscara de centavos: mantém a mesma quantidade de dígitos à direita */
function posCursorDireita(texto: string, digitosADireita: number): number {
  let n = 0;
  for (let k = texto.length - 1; k >= 0; k--) {
    if (/\d/.test(texto[k])) n++;
    if (n > digitosADireita) return k + 1;
  }
  return 0;
}

/** Entrada numérica em formato pt-BR: edita como texto e confirma ao sair do campo ou com Enter. */
function NumInput({
  value,
  onCommit,
  money,
  suffix,
  label,
}: {
  value: number;
  onCommit: (n: number) => void;
  money?: boolean;
  suffix?: string;
  label: string;
}) {
  const fmt = money ? fmtMoney : fmtNum;
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value, fmt]);
  useLayoutEffect(() => {
    if (cursor.current !== null && ref.current) {
      ref.current.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  }, [text]);
  const commit = () => {
    const n = parseNum(text);
    setText(fmt(n));
    if (n !== value) onCommit(n);
  };
  return (
    <span className="affix">
      {money && <i>R$</i>}
      <input
        ref={ref}
        aria-label={label}
        inputMode="decimal"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const pos = e.target.selectionStart ?? raw.length;
          let next: string;
          let n: number;
          if (money) {
            const m = mascaraCentavos(raw);
            next = m.texto;
            n = m.valor;
            cursor.current = posCursorDireita(next, raw.slice(pos).replace(/\D/g, "").length);
          } else {
            next = mascara(raw, 4);
            n = parseNum(next);
            cursor.current = posCursor(next, raw.slice(0, pos).replace(/[^\d,]/g, "").length);
          }
          setText(next);
          if (n !== value) onCommit(n); // atualiza os cálculos enquanto digita
        }}
        onBlur={() => {
          focused.current = false;
          commit();
        }}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {suffix && <i>{suffix}</i>}
    </span>
  );
}

function NumField({ label, ...rest }: { label: string } & Omit<React.ComponentProps<typeof NumInput>, "label">) {
  return (
    <div className="field">
      <span>{label}</span>
      <NumInput label={label} {...rest} />
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
function Confirm({ label, ask, onYes }: { label: string; ask: string; onYes: () => void }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setOn(false), 5000);
    return () => clearTimeout(t);
  }, [on]);
  return on ? (
    <span className="confirm">
      {ask}
      <button type="button" className="btn danger sm" onClick={onYes}>
        Sim, excluir
      </button>
      <button type="button" className="btn ghost sm" onClick={() => setOn(false)}>
        Cancelar
      </button>
    </span>
  ) : (
    <button type="button" className="btn danger sm" onClick={() => setOn(true)}>
      <Icon name="trash" size={15} /> {label}
    </button>
  );
}

function PrazoField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="À vista" aria-label={label} />
      <span className="presets">
        {PRAZOS.map((p) => (
          <button key={p.v || "vista"} type="button" title={p.dica} className={`preset${value.trim() === p.v ? " on" : ""}`} onClick={() => onChange(p.v)}>
            {p.t}
          </button>
        ))}
      </span>
      <small className="hint prazo-prev">
        {value.trim() ? <>Entendido como: <b>{prazoTxt(value)}</b>. </> : null}
        Dias separados por barra; para entrada e saldo use dias:% (ex.: 0:15/30:15/56:70).
      </small>
    </div>
  );
}

/** Cartão de regime: escolhe o regime e edita a alíquota no mesmo lugar. */
function RegimeCard({
  active,
  title,
  desc,
  rate,
  onSelect,
  onRate,
}: {
  active: boolean;
  title: string;
  desc: string;
  rate: number;
  onSelect: () => void;
  onRate: (n: number) => void;
}) {
  return (
    <div
      className={`rcard${active ? " on" : ""}`}
      role="radio"
      aria-checked={active}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="rcard-h">
        <Icon name={active ? "check" : "dot"} size={22} className="rcard-i" />
        <div>
          <b>{title}</b>
          <small>{desc}</small>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <NumInput label={`Alíquota PIS/COFINS ${title}`} suffix="%" value={rate} onCommit={onRate} />
      </div>
    </div>
  );
}

export function Editor({
  P,
  update,
  aba,
  setAba,
  onClose,
  fechando,
  onDuplicate,
  onDelete,
  saveState,
}: {
  P: Projeto;
  update: Update;
  aba: Aba;
  setAba: (a: Aba) => void;
  onClose: () => void;
  fechando: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  saveState: SaveState;
}) {
  const set = <K extends keyof Projeto>(k: K, v: Projeto[K]) => update((p) => ({ ...p, [k]: v }));
  const setSc = (i: number, patch: Partial<Cenario>) =>
    update((p) => ({ ...p, cenarios: p.cenarios.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const setCompl = (patch: Partial<Projeto["compl"]>) => update((p) => ({ ...p, compl: { ...p.compl, ...patch } }));
  const hasC = P.compl.valor > 0;
  const ufInvalida = P.ufCliente.length === 2 && !UFS.includes(P.ufCliente);
  const panelRef = useRef<HTMLElement>(null);

  // onClose muda a cada render do pai: guarda em ref para não refazer o efeito (que roubava o foco a cada tecla)
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && closeRef.current();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus(); // só ao abrir
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  if (typeof document === "undefined") return null;
  // portal: o painel precisa ficar acima do cabeçalho, fora do contexto de empilhamento da página
  return createPortal(
    <>
      <div className={`drawer-backdrop${fechando ? " is-closing" : ""}`} onClick={onClose} aria-hidden />
      <aside className={`drawer${fechando ? " is-closing" : ""}`} role="dialog" aria-label="Editar projeto" tabIndex={-1} ref={panelRef}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Editando</div>
            <h2>{P.nome || "Projeto"}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar edição" title="Fechar (Esc)">
            <Icon name="close" size={20} />
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
              <Section title="Identificação">
                <Field label="Nome do projeto">
                  <input value={P.nome} onChange={(e) => set("nome", e.target.value)} />
                </Field>
                <Field label="Cliente">
                  <input value={P.cliente} onChange={(e) => set("cliente", e.target.value)} />
                </Field>
                <div className="two">
                  <Field label="UF do cliente">
                    <input
                      value={P.ufCliente}
                      onChange={(e) => set("ufCliente", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                      maxLength={2}
                      placeholder="Ex.: MT"
                      autoComplete="off"
                      aria-invalid={ufInvalida}
                      className="uf-input"
                    />
                  </Field>
                  <div className="field">
                    <span>Status</span>
                    <Select label="Status" value={P.status} options={STATUS_OPTS} onChange={(v) => set("status", v as Status)} />
                  </div>
                </div>
                <p className={`hint${ufInvalida ? " err" : ""}`}>{ufInvalida ? "UF inválida. Use a sigla de um estado, como MT, RS ou SP." : "A UF do cliente aparece nos textos sobre DIFAL dos cenários de faturamento direto."}</p>
              </Section>
              <Section title="Outras ações">
                <div className="btn-row">
                  <button type="button" className="btn ghost sm" onClick={onDuplicate}>
                    <Icon name="copy" size={15} /> Duplicar projeto
                  </button>
                  <Confirm label="Excluir projeto" ask="Excluir definitivamente?" onYes={onDelete} />
                </div>
              </Section>
            </>
          )}

          {aba === "impostos" && (
            <>
              <Section title="Tributos e taxas" desc="Percentuais aplicados sobre o total bruto de cada cenário. A taxa financeira incide só nas parcelas a prazo.">
                <div className="two">
                  <NumField label="ICMS" suffix="%" value={P.icms} onCommit={(n) => set("icms", n)} />
                  <NumField label="Taxa financeira" suffix="%" value={P.taxaFin} onCommit={(n) => set("taxaFin", n)} />
                </div>
                <div className="two">
                  <NumField label="Custo de capital (ao mês)" suffix="%" value={P.custoCapital ?? 0} onCommit={(n) => set("custoCapital", n)} />
                </div>
                <p className="hint">O custo de capital traz as parcelas a valor presente na análise das propostas (quanto o prazo vale). Com 0, usa a taxa financeira.</p>
              </Section>
              <Section title="PIS/COFINS" desc="Escolha o regime da empresa. A alíquota do regime selecionado é a usada nos cálculos.">
                <div className="two rcards" role="radiogroup" aria-label="Regime de PIS/COFINS">
                  <RegimeCard
                    active={P.regime === "real"}
                    title="Lucro Real"
                    desc="Não cumulativo"
                    rate={P.pisReal}
                    onSelect={() => set("regime", "real")}
                    onRate={(n) => set("pisReal", n)}
                  />
                  <RegimeCard
                    active={P.regime === "presumido"}
                    title="Lucro Presumido"
                    desc="Cumulativo"
                    rate={P.pisPres}
                    onSelect={() => set("regime", "presumido")}
                    onRate={(n) => set("pisPres", n)}
                  />
                </div>
              </Section>
              <Section title="Item complementar" desc="Somado a todos os cenários. Deixe o valor em 0 para não usar.">
                <div className="two">
                  <Field label="Fornecedor">
                    <input value={P.compl.fornecedor} onChange={(e) => setCompl({ fornecedor: e.target.value })} />
                  </Field>
                  <NumField money label="Valor" value={P.compl.valor} onCommit={(n) => setCompl({ valor: n })} />
                </div>
                <Field label="Descrição">
                  <input value={P.compl.descricao} onChange={(e) => setCompl({ descricao: e.target.value })} />
                </Field>
              </Section>
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
                      <Icon name="copy" size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn del"
                      title="Remover cenário"
                      aria-label="Remover cenário"
                      onClick={() => update((p) => ({ ...p, cenarios: p.cenarios.filter((_, j) => j !== i) }))}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                  <div className="field">
                    <span>Modalidade</span>
                    <SegControl
                      label="Modalidade"
                      value={sc.modal}
                      onChange={(v) => setSc(i, { modal: v })}
                      options={[
                        { v: "filial", t: "Via Alpha Filial" },
                        { v: "direto", t: "Direto ao cliente" },
                      ]}
                    />
                  </div>
                  <NumField money label="Valor dos materiais (com impostos)" value={sc.valor} onCommit={(n) => setSc(i, { valor: n })} />
                  <PrazoField label="Condição de pagamento dos materiais" value={sc.prazoMat} onChange={(v) => setSc(i, { prazoMat: v })} />
                  {hasC && (
                    <PrazoField label={`Condição de pagamento ${P.compl.fornecedor || "do item complementar"}`} value={sc.prazoCompl} onChange={(v) => setSc(i, { prazoCompl: v })} />
                  )}
                  {sc.modal === "direto" && (
                    <div className={`difal-box${(sc.difal ?? "pendente") === "pendente" ? " pend" : ""}`}>
                      <div className="field">
                        <span>DIFAL (diferencial de alíquota)</span>
                        <SegControl
                          label="DIFAL"
                          value={sc.difal ?? "pendente"}
                          onChange={(v) => setSc(i, { difal: v })}
                          options={[
                            { v: "pendente", t: "Não definido" },
                            { v: "cliente", t: "Do cliente" },
                            { v: "nos", t: "Por nossa conta" },
                          ]}
                        />
                      </div>
                      {sc.difal === "nos" && (
                        <NumField label="Alíquota do DIFAL (sobre o total bruto)" suffix="%" value={sc.difalPct ?? 0} onCommit={(n) => setSc(i, { difalPct: n })} />
                      )}
                      <small className={`hint${(sc.difal ?? "pendente") === "pendente" ? " err" : ""}`}>
                        {(sc.difal ?? "pendente") === "pendente"
                          ? "Defina quem arca com o DIFAL. Enquanto estiver como não definido, esta proposta não é recomendada e a ferramenta mostra um alerta."
                          : sc.difal === "cliente"
                            ? "O DIFAL fica com o cliente e não entra no nosso custo."
                            : "O valor do DIFAL é somado ao custo desta proposta."}
                      </small>
                    </div>
                  )}
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
                <Icon name="plus" size={18} /> Adicionar cenário
              </button>
            </>
          )}

          {aba === "obs" && (
            <Section title="Observações" desc="Uma por linha. Aparecem como avisos no topo do projeto, para a diretoria.">
              <textarea className="big-ta" aria-label="Observações" rows={8} value={P.obs.join("\n")} onChange={(e) => set("obs", e.target.value.split("\n"))} />
            </Section>
          )}
        </div>

        <div className="drawer-foot">
          <span className="status err" role="alert" hidden={saveState !== "error"}>
            Não foi possível salvar. Verifique a conexão.
          </span>
          <button type="button" className="btn" onClick={onClose}>
            <Icon name="check" size={16} /> Concluir
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}
