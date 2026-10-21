const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const R = (n: number) => BRL.format(n || 0);
export const PCT = (n: number) =>
  (+n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
export const fmtMoney = (n: number) =>
  (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n: number) => (+n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
export const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
};

export function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/[R$\s%]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}


export interface ParcelaPct {
  dia: number;
  pct: number; // fração do total (0 a 1)
  explicito: boolean; // o percentual foi digitado ("30:15")
}

/**
 * Condição de pagamento -> parcelas.
 *  ""            = à vista
 *  "30/60/90"    = 3 parcelas iguais
 *  "0:15/30:15/56:70" = 15% à vista, 15% em 30 dias, 70% em 56 dias
 *  tokens sem percentual dividem igualmente o que sobrar.
 */
export function parseParcelas(s: string): ParcelaPct[] {
  const aVista: ParcelaPct[] = [{ dia: 0, pct: 1, explicito: false }];
  const txt = String(s || "").trim();
  if (!txt) return aVista;
  const toks: { dia: number; pct: number | null }[] = [];
  for (const t of txt.split(/[\/;,\s]+/).filter(Boolean)) {
    const m = t.match(/^(\d+)(?:[:@](\d+(?:[.,]\d+)?)%?)?$/);
    if (!m) continue;
    toks.push({ dia: parseInt(m[1], 10), pct: m[2] != null ? parseFloat(m[2].replace(",", ".")) / 100 : null });
  }
  if (!toks.length) return aVista;
  const fixo = toks.reduce((a, t) => a + (t.pct ?? 0), 0);
  const livres = toks.filter((t) => t.pct === null).length;
  let out: ParcelaPct[];
  if (livres) {
    const resto = Math.max(0, 1 - fixo) / livres;
    out = toks.map((t) => ({ dia: t.dia, pct: t.pct ?? resto, explicito: t.pct !== null }));
  } else {
    const total = fixo || 1; // percentuais que não somam 100 são ajustados proporcionalmente
    out = toks.map((t) => ({ dia: t.dia, pct: (t.pct as number) / total, explicito: true }));
  }
  return out.sort((a, b) => a.dia - b.dia);
}

/** dias de vencimento maiores que zero (compatível com o formato antigo) */
export const parsePrazo = (s: string) => parseParcelas(s).filter((p) => p.dia > 0).map((p) => p.dia);

const pctTxt = (f: number) => `${Math.round(f * 1000) / 10}%`.replace(".", ",");

export const prazoTxt = (s: string) => {
  const p = parseParcelas(s);
  if (p.length === 1 && p[0].dia === 0) return "À vista";
  if (p.some((x) => x.explicito)) return p.map((x) => `${pctTxt(x.pct)} ${x.dia ? x.dia + "d" : "à vista"}`).join(" · ");
  const dias = p.filter((x) => x.dia > 0).map((x) => x.dia);
  return (p.some((x) => x.dia === 0) ? "Entrada + " : "") + dias.join("/") + " dias";
};
