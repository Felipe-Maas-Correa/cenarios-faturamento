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

export const parsePrazo = (s: string) =>
  String(s || "")
    .split(/[\/;,\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => n > 0);

export const prazoTxt = (s: string) => {
  const p = parsePrazo(s);
  return p.length ? p.join("/") + " dias" : "À vista";
};
