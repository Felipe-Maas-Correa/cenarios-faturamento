import { parseNum, parsePrazo } from "./format";
import type { Cenario, Projeto } from "./types";

export interface Resultado {
  sc: Cenario;
  mat: number;
  C: number;
  bruto: number;
  fin: number;
  icms: number;
  pis: number;
  pisRate: number;
  liq: number;
  pMat: number[];
  pCompl: number[];
}

export function calc(P: Projeto, sc: Cenario): Resultado {
  const C = parseNum(P.compl.valor);
  const mat = parseNum(sc.valor);
  const pMat = parsePrazo(sc.prazoMat);
  const pCompl = parsePrazo(sc.prazoCompl);
  const bruto = mat + C;
  const r = parseNum(P.taxaFin) / 100;
  const fin = (pMat.length ? mat * r : 0) + (C && pCompl.length ? C * r : 0);
  const icms = (bruto * parseNum(P.icms)) / 100;
  const pisRate = parseNum(P.regime === "real" ? P.pisReal : P.pisPres);
  const pis = (bruto * pisRate) / 100;
  let liq = bruto;
  if (P.ded.icms) liq -= icms;
  if (P.ded.pis) liq -= pis;
  if (P.ded.fin) liq -= fin;
  return { sc, mat, C, bruto, fin, icms, pis, pisRate, liq, pMat, pCompl };
}

export function analyse(P: Projeto) {
  const res = P.cenarios.map((sc) => calc(P, sc));
  const sorted = [...res].sort((a, b) => a.liq - b.liq);
  return {
    res,
    sorted,
    best: sorted[0] as Resultado | undefined,
    bestClean: sorted.find((x) => !x.sc.credito && x.sc.modal !== "direto"),
  };
}
