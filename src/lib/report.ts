import { analyse, type Resultado } from "./calc";
import { PCT, parseNum, prazoTxt, R } from "./format";
import type { Projeto } from "./types";

export interface Motivo {
  texto: string;
  ressalva: boolean;
}

/** Frases de "Por que é a melhor opção" (usadas na tela, no PDF e no Excel). */
export function motivosMelhor(P: Projeto): Motivo[] {
  const { res, sorted, best, bestClean } = analyse(P);
  if (!best || res.length < 2 || best.liq <= 0) return [];
  const x = best;
  const second = sorted[1];
  const cn = P.compl.fornecedor || "Item complementar";
  const hasC = parseNum(P.compl.valor) > 0;
  const out: Motivo[] = [];
  const add = (texto: string, ressalva = false) => out.push({ texto, ressalva });
  if (second) add(`Valor ${R(second.liq - x.liq)} menor que o 2º colocado (${second.sc.nome}).`);
  add(
    x.pMat.length
      ? `Materiais com prazo de ${x.pMat.join("/")} dias, preservando o caixa.`
      : "Materiais à vista, sem custo financeiro embutido.",
  );
  if (hasC) add(x.pCompl.length ? `${cn} parcelado em ${x.pCompl.join("/")} dias.` : `${cn} à vista.`);
  if (x.sc.modal === "filial") add("Faturamento via Alpha Filial, sem risco de DIFAL no faturamento direto.");
  if (x.sc.credito) add("Depende da aprovação de crédito.", true);
  if (x.sc.modal === "direto")
    add(`Confirmar DIFAL${P.ufCliente ? ` do ${P.ufCliente}` : ""}, que pode elevar o custo final.`, true);
  if (bestClean && bestClean !== x) add(`Melhor opção sem pendências: ${bestClean.sc.nome} (${R(bestClean.liq)}).`);
  return out;
}

export function descricaoValores(P: Projeto): string {
  const ded = [P.ded.icms && "ICMS", P.ded.pis && "PIS/COFINS", P.ded.fin && "taxa financeira"].filter(Boolean);
  return ded.length ? `Valores sem ${ded.join(", ")}` : "Valores brutos, com impostos e taxa financeira inclusos";
}

export interface Aviso {
  tipo: "warn" | "info";
  texto: string;
}

export function avisos(P: Projeto): Aviso[] {
  const { res } = analyse(P);
  const out: Aviso[] = [];
  const cred = res.filter((x) => x.sc.credito).map((x) => x.sc.nome);
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

/** Cronograma: uma linha por cenário e por parte (materiais / item complementar), parcelas iguais. */
export function cronograma(P: Projeto) {
  const { res } = analyse(P);
  const hasC = parseNum(P.compl.valor) > 0;
  const cn = P.compl.fornecedor || "Item complementar";
  const dias = new Set<number>([0]);
  res.forEach((x) => {
    x.pMat.forEach((d) => dias.add(d));
    if (hasC) x.pCompl.forEach((d) => dias.add(d));
  });
  const cols = [...dias].sort((a, b) => a - b);
  const parte = (nome: string, item: string, valor: number, prazos: number[]): LinhaCrono => {
    const parcelas: Record<number, number> = {};
    if (prazos.length) prazos.forEach((d) => (parcelas[d] = (parcelas[d] ?? 0) + valor / prazos.length));
    else parcelas[0] = valor;
    return { nome, item, parcelas, total: valor };
  };
  const linhas: LinhaCrono[] = [];
  res.forEach((x, i) => {
    const nome = `${i + 1}. ${x.sc.nome}`;
    linhas.push(parte(nome, "Materiais", x.mat, x.pMat));
    if (hasC) linhas.push(parte(nome, cn, x.C, x.pCompl));
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
  return [r.sc.credito && "Crédito em análise", r.sc.modal === "direto" && "Verificar DIFAL"].filter(Boolean).join(" · ");
}

export { PCT, prazoTxt, R };
