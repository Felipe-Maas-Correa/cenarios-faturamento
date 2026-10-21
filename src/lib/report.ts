import { analyse, type Resultado } from "./calc";
import { PCT, parseNum, prazoTxt, R } from "./format";
import type { Projeto } from "./types";

export interface Motivo {
  texto: string;
  ressalva: boolean;
}

const dias = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "dia" : "dias"}`;
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/**
 * Parecer da análise: por que a proposta recomendada é a recomendada, o que ficou pendente
 * e como ela se compara às demais (preço, prazo e custo efetivo). Usado na tela, no PDF e no Excel.
 */
export function motivosMelhor(P: Projeto): Motivo[] {
  const A = analyse(P);
  const x = A.recomendada;
  if (!x || !A.comparavel) return [];
  const out: Motivo[] = [];
  const add = (texto: string, ressalva = false) => out.push({ texto, ressalva });
  const outros = A.sorted.filter((o) => o !== x && o.bruto > 0);
  const taxa = (A.taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const semPend = x.pendencias.length === 0;

  add(
    `Menor custo efetivo ${semPend ? "entre as propostas sem pendências" : "entre as propostas"}: ${R(x.vp)} (valor presente, custo de capital de ${taxa}% ao mês).`,
  );
  const seg = outros[0];
  if (seg) {
    const d = seg.vp - x.vp;
    if (d > 0.005) add(`${R(d)} (${pct(d / seg.vp)}) mais barata que a 2ª colocada, ${seg.sc.nome}.`);
    else add(`Empata em custo efetivo com ${seg.sc.nome}.`);
  }
  add(
    x.prazoMedio > 0.5
      ? `Pagamento em prazo médio de ${dias(x.prazoMedio)} (${prazoTxt(x.sc.prazoMat)}).`
      : "Materiais à vista, sem custo financeiro embutido.",
  );
  if (x.sc.modal === "filial") add("Faturamento via Alpha Filial, sem risco de DIFAL.");
  if (x.difalStatus === "cliente") add("DIFAL por conta do cliente: não entra no nosso custo.");
  if (x.difalStatus === "nos") add(`DIFAL por nossa conta: ${R(x.difal)} já somados ao custo.`);
  if (x.sc.credito) add("Depende da aprovação de crédito: não confirmar antes da liberação formal.", true);
  if (x.difalStatus === "pendente") add("DIFAL ainda não definido: informe quem arca com ele antes de fechar.", true);

  const b = A.best;
  if (b && b !== x) {
    const d = x.vp - b.vp;
    add(
      `A proposta de menor custo é ${b.sc.nome} (${R(b.vp)}, ${R(d)} mais barata), mas está com pendências: ${b.pendencias.join(" e ")}. Resolvidas, ela passa a ser a recomendada.`,
      true,
    );
  }
  const mp = A.melhorPrazo;
  if (mp && mp !== x && mp.prazoMedio - x.prazoMedio >= 1) {
    const d = mp.vp - x.vp;
    add(
      `Maior prazo de pagamento: ${mp.sc.nome} (média de ${dias(mp.prazoMedio)}). Em valor presente ela ${d > 0 ? `custa ${R(d)} a mais` : `custa ${R(-d)} a menos`} que a recomendada.`,
    );
  }
  return out;
}

export interface LinhaRanking {
  pos: number;
  nome: string;
  r: Resultado;
  selos: string[];
  difalTxt: string;
  dif: number; // custo efetivo acima da melhor (R$)
  difPct: number;
  barra: number; // 0 a 1, para a barra de comparação
}

/** Ranking pelo custo efetivo, com selos de melhor preço, melhor prazo e recomendada. */
export function ranking(P: Projeto): LinhaRanking[] {
  const A = analyse(P);
  const validos = A.sorted.filter((x) => x.bruto > 0);
  if (!validos.length) return [];
  const menor = validos[0].vp;
  const maior = validos[validos.length - 1].vp;
  return validos.map((r, i) => {
    const selos: string[] = [];
    if (A.comparavel && r === A.recomendada) selos.push("Recomendada");
    if (A.comparavel && r === A.melhorPreco) selos.push("Melhor preço");
    if (A.comparavel && r === A.melhorPrazo && r.prazoMedio > 0.5) selos.push("Melhor prazo");
    const difalTxt =
      r.difalStatus === null ? "—" : r.difalStatus === "pendente" ? "Não definido" : r.difalStatus === "cliente" ? "Do cliente" : R(r.difal);
    return {
      pos: i + 1,
      nome: r.sc.nome,
      r,
      selos,
      difalTxt,
      dif: r.vp - menor,
      difPct: menor > 0 ? (r.vp - menor) / menor : 0,
      barra: maior > menor ? (r.vp - menor) / (maior - menor) : 0,
    };
  });
}

export function descricaoValores(P: Projeto): string {
  const ded = [P.ded.icms && "ICMS", P.ded.pis && "PIS/COFINS", P.ded.fin && "taxa financeira"].filter(Boolean);
  return ded.length ? `Valores sem ${ded.join(", ")}` : "Valores brutos, com impostos e taxa financeira inclusos";
}

export interface Aviso {
  tipo: "warn" | "info";
  texto: string;
}

/** Cenários de faturamento direto que ainda não têm o DIFAL definido. */
export function difalPendentes(P: Projeto): string[] {
  return analyse(P)
    .res.filter((x) => x.difalStatus === "pendente")
    .map((x) => x.sc.nome);
}

export function avisos(P: Projeto): Aviso[] {
  const { res } = analyse(P);
  const out: Aviso[] = [];
  const dif = difalPendentes(P);
  const cred = res.filter((x) => x.sc.credito).map((x) => x.sc.nome);
  if (dif.length)
    out.push({
      tipo: "warn",
      texto: `DIFAL não definido${P.ufCliente ? ` (cliente em ${P.ufCliente})` : ""}: ${dif.join("; ")}. Em faturamento direto, informe se o DIFAL fica por conta do cliente ou por nossa conta; enquanto isso a proposta não é recomendada.`,
    });
  if (cred.length)
    out.push({ tipo: "warn", texto: `Crédito em análise: ${cred.join("; ")} dependem da aprovação de crédito do fornecedor.` });
  P.obs.filter((o) => o.trim()).forEach((o) => out.push({ tipo: "info", texto: o.trim() }));
  return out;
}

export interface LinhaCrono {
  nome: string;
  item: "Materiais" | string;
  parcelas: Record<number, number>;
  total: number;
}

/** Cronograma: uma linha por cenário e por parte (materiais / item complementar), respeitando os percentuais. */
export function cronograma(P: Projeto) {
  const { res } = analyse(P);
  const hasC = parseNum(P.compl.valor) > 0;
  const cn = P.compl.fornecedor || "Item complementar";
  const set = new Set<number>([0]);
  res.forEach((x) => {
    x.parcMat.forEach((p) => set.add(p.dia));
    x.parcCompl.forEach((p) => set.add(p.dia));
  });
  const cols = [...set].sort((a, b) => a - b);
  const linha = (nome: string, item: string, parc: { dia: number; valor: number }[], total: number): LinhaCrono => {
    const parcelas: Record<number, number> = {};
    parc.forEach((p) => (parcelas[p.dia] = (parcelas[p.dia] ?? 0) + p.valor));
    return { nome, item, parcelas, total };
  };
  const linhas: LinhaCrono[] = [];
  res.forEach((x, i) => {
    const nome = `${i + 1}. ${x.sc.nome}`;
    linhas.push(linha(nome, "Materiais", x.parcMat, x.mat));
    if (hasC) linhas.push(linha(nome, cn, x.parcCompl, x.C));
  });
  return { cols, linhas, hasC, cn };
}

export const rotuloDia = (d: number) => (d ? `D+${d}` : "D0");

export function nomeArquivo(P: Projeto, ext: string) {
  const base = (P.nome || "Projeto").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `Cenarios de Faturamento - ${base}.${ext}`;
}

export function dataHora(d = new Date()) {
  return d.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

export function pendencias(r: Resultado): string {
  return r.pendencias.join(" · ");
}

export { PCT, prazoTxt, R };
