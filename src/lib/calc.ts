import { parseNum, parseParcelas } from "./format";
import type { Cenario, DifalStatus, Projeto } from "./types";

export interface Parcela {
  dia: number;
  valor: number;
}

export interface Resultado {
  sc: Cenario;
  mat: number;
  C: number;
  bruto: number;
  fin: number;
  icms: number;
  pis: number;
  pisRate: number;
  difal: number; // custo do DIFAL quando fica por nossa conta
  difalStatus: DifalStatus | null; // null = não é faturamento direto
  liq: number; // valor líquido nominal (deduções escolhidas + DIFAL)
  pMat: number[];
  pCompl: number[];
  parcMat: Parcela[];
  parcCompl: Parcela[];
  prazoMedio: number; // dias, ponderado pelo valor de cada parcela
  vp: number; // custo efetivo: valor líquido trazido a valor presente
  pendencias: string[];
}

/** taxa mensal usada para trazer as parcelas a valor presente (custo de capital; se vazio, a taxa financeira) */
export function taxaMensal(P: Projeto): number {
  const cc = parseNum(P.custoCapital);
  return (cc > 0 ? cc : parseNum(P.taxaFin)) / 100;
}

export function calc(P: Projeto, sc: Cenario): Resultado {
  const C = parseNum(P.compl.valor);
  const mat = parseNum(sc.valor);
  const parcMat: Parcela[] = parseParcelas(sc.prazoMat).map((p) => ({ dia: p.dia, valor: mat * p.pct }));
  const parcCompl: Parcela[] = C > 0 ? parseParcelas(sc.prazoCompl).map((p) => ({ dia: p.dia, valor: C * p.pct })) : [];
  const bruto = mat + C;
  const r = parseNum(P.taxaFin) / 100;
  const aPrazo = [...parcMat, ...parcCompl].filter((p) => p.dia > 0).reduce((s, p) => s + p.valor, 0);
  const fin = aPrazo * r;
  const icms = (bruto * parseNum(P.icms)) / 100;
  const pisRate = parseNum(P.regime === "real" ? P.pisReal : P.pisPres);
  const pis = (bruto * pisRate) / 100;

  const direto = sc.modal === "direto";
  const difalStatus: DifalStatus | null = direto ? (sc.difal ?? "pendente") : null;
  const difal = difalStatus === "nos" ? (bruto * parseNum(sc.difalPct)) / 100 : 0;

  let base = bruto;
  if (P.ded.icms) base -= icms;
  if (P.ded.pis) base -= pis;
  if (P.ded.fin) base -= fin;
  const liq = base + difal;

  const todas = [...parcMat, ...parcCompl];
  const prazoMedio = bruto > 0 ? todas.reduce((s, p) => s + p.dia * p.valor, 0) / bruto : 0;
  const i = taxaMensal(P);
  const vpBruto = todas.reduce((s, p) => s + p.valor / Math.pow(1 + i, p.dia / 30), 0);
  const fator = bruto > 0 ? vpBruto / bruto : 1;
  const vp = base * fator + difal; // o DIFAL é pago na emissão (dia 0)

  const pendencias: string[] = [];
  if (sc.credito) pendencias.push("Crédito em análise");
  if (difalStatus === "pendente") pendencias.push("DIFAL não definido");

  const dias = (l: Parcela[]) => [...new Set(l.filter((p) => p.dia > 0).map((p) => p.dia))];
  return { sc, mat, C, bruto, fin, icms, pis, pisRate, difal, difalStatus, liq, pMat: dias(parcMat), pCompl: dias(parcCompl), parcMat, parcCompl, prazoMedio, vp, pendencias };
}

export function analyse(P: Projeto) {
  const res = P.cenarios.map((sc) => calc(P, sc));
  const validos = res.filter((x) => x.bruto > 0);
  // ranking pelo custo efetivo (menor é melhor); cenários ainda sem valor ficam por último
  const sorted = [...validos].sort((a, b) => a.vp - b.vp).concat(res.filter((x) => x.bruto <= 0));
  const best = validos.length ? sorted[0] : undefined; // menor custo efetivo, com ou sem pendências
  const bestClean = sorted.find((x) => x.bruto > 0 && x.pendencias.length === 0); // menor custo sem pendências
  const recomendada = bestClean ?? best; // sem opção limpa, a de menor custo (com as ressalvas)
  const por = (f: (x: (typeof validos)[number]) => number, dir: 1 | -1) =>
    validos.length ? [...validos].sort((a, b) => dir * (f(a) - f(b)))[0] : undefined;
  return {
    res,
    sorted,
    best,
    bestClean,
    recomendada,
    melhorPreco: por((x) => x.bruto, 1),
    menorLiquido: por((x) => x.liq, 1),
    melhorPrazo: por((x) => x.prazoMedio, -1),
    taxa: taxaMensal(P),
    comparavel: validos.length > 1,
  };
}
