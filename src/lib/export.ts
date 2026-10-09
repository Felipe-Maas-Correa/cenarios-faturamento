/**
 * Exportação do projeto em PDF e Excel. As bibliotecas são carregadas só quando o botão é clicado.
 * Identidade Alpha: vermelho #ED1C24 e preto #231F20.
 */
import { analyse } from "./calc";
import { PCT, R, fmtMoney, parseNum, prazoTxt } from "./format";
import { avisos, cronograma, dataHora, descricaoValores, motivosMelhor, nomeArquivo, pendencias, rotuloDia } from "./report";
import type { Projeto } from "./types";

type RGB = [number, number, number];
const RED: RGB = [237, 28, 36];
const INK: RGB = [35, 31, 32];
const GREY: RGB = [98, 94, 96];
const LINE: RGB = [220, 220, 222];
const SOFT: RGB = [246, 246, 247];
const GOOD: RGB = [30, 122, 76];
const GOOD_SOFT: RGB = [225, 242, 232];
const WARN: RGB = [154, 93, 0];
const WARN_SOFT: RGB = [251, 239, 217];
const TONE: Record<string, RGB> = { "Em análise": [226, 154, 0], Aprovado: GOOD, Reprovado: [200, 20, 27], Rascunho: [138, 134, 136] };

/** Logo oficial (SVG) rasterizado em PNG para caber no PDF/Excel. */
async function logoPng(largura = 1000): Promise<{ dataUrl: string; w: number; h: number }> {
  const svg = await fetch("/logo-alpha.svg").then((r) => r.text());
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await new Promise<HTMLImageElement>((ok, err) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => err(new Error("logo"));
      i.src = url;
    });
    const h = Math.round((largura * 92.89) / 425.2);
    const c = document.createElement("canvas");
    c.width = largura;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, largura, h);
    return { dataUrl: c.toDataURL("image/png"), w: largura, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function baixar(blob: Blob, nome: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ===================================================================== PDF */
export async function exportarPdf(P: Projeto) {
  const [{ jsPDF }, autoTableMod, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), logoPng()]);
  const autoTable = autoTableMod.default;
  const A = analyse(P);
  const cr = cronograma(P);
  const hasC = parseNum(P.compl.valor) > 0;
  const cn = P.compl.fornecedor || "Item complementar";
  const pisRate = P.regime === "real" ? P.pisReal : P.pisPres;
  const gerado = dataHora();

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  const topBar = () => {
    fill(RED);
    doc.rect(0, 0, W, 6, "F");
  };

  /* ---- cabeçalho da primeira página ---- */
  topBar();
  const lw = 150;
  doc.addImage(logo.dataUrl, "PNG", M, 22, lw, (lw * logo.h) / logo.w, undefined, "FAST");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  ink(GREY);
  doc.text("ANÁLISE PARA APROVAÇÃO DA DIRETORIA", W - M, 36, { align: "right", charSpace: 1 });
  doc.setFont("helvetica", "normal");
  doc.text(gerado, W - M, 50, { align: "right" });
  stroke(LINE);
  doc.line(M, 72, W - M, 72);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  ink(RED);
  doc.text("CENÁRIOS DE FATURAMENTO", M, 96, { charSpace: 1.2 });
  doc.setFontSize(24);
  ink(INK);
  const titulo = doc.splitTextToSize(P.nome || "Projeto", W - 2 * M - 130) as string[];
  doc.text(titulo[0], M, 124);
  // etiqueta de status
  const tone = TONE[P.status] ?? GREY;
  doc.setFontSize(9);
  const sw = doc.getTextWidth(P.status) + 28;
  fill(tone);
  doc.roundedRect(W - M - sw, 104, sw, 22, 11, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(P.status, W - M - sw / 2, 118, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  ink(GREY);
  const sub = [P.cliente && `Cliente: ${P.cliente}${P.ufCliente ? ` (${P.ufCliente})` : ""}`, descricaoValores(P), hasC && `${cn} incluído em todos os cenários`]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(doc.splitTextToSize(sub, W - 2 * M) as string[], M, 144);

  /* ---- cartões de parâmetros ---- */
  const cards: { t: string; v: string; d: string }[] = [
    { t: "ICMS", v: PCT(P.icms), d: P.ded.icms ? "Retirado dos valores" : "Incluso nos valores" },
    { t: `PIS/COFINS · ${P.regime === "real" ? "LUCRO REAL" : "LUCRO PRESUMIDO"}`, v: PCT(pisRate), d: P.ded.pis ? "Retirado dos valores" : "Incluso nos valores" },
    { t: "TAXA FINANCEIRA", v: PCT(P.taxaFin), d: (P.ded.fin ? "Retirada" : "Inclusa") + "; só nas parcelas a prazo" },
    { t: hasC ? cn.toUpperCase() : "ITEM COMPLEMENTAR", v: hasC ? R(parseNum(P.compl.valor)) : "—", d: hasC ? P.compl.descricao || "Somado a todos os cenários" : "Não utilizado" },
  ];
  const gap = 12;
  const cw = (W - 2 * M - gap * 3) / 4;
  let y = 164;
  cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    fill(SOFT);
    stroke(LINE);
    doc.roundedRect(x, y, cw, 58, 6, 6, "FD");
    fill(RED);
    doc.rect(x, y + 10, 3, 38, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    ink(GREY);
    doc.text(doc.splitTextToSize(c.t, cw - 24)[0], x + 14, y + 18, { charSpace: 0.6 });
    doc.setFontSize(15);
    ink(INK);
    doc.text(c.v, x + 14, y + 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    ink(GREY);
    doc.text(doc.splitTextToSize(c.d, cw - 24)[0], x + 14, y + 51);
  });
  y += 58 + 18;

  /* ---- melhor opção ---- */
  const motivos = motivosMelhor(P);
  if (A.best && motivos.length) {
    const linhas: string[][] = motivos.map((m) => doc.splitTextToSize(`•  ${m.ressalva ? "Ressalva: " : ""}${m.texto}`, W - 2 * M - 40) as string[]);
    const hLinhas = linhas.reduce((s, l) => s + l.length * 12, 0);
    const bh = 54 + hLinhas;
    if (y + bh > H - 60) {
      doc.addPage();
      topBar();
      y = 36;
    }
    fill(GOOD_SOFT);
    doc.roundedRect(M, y, W - 2 * M, bh, 6, 6, "F");
    fill(GOOD);
    doc.rect(M, y, 4, bh, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    ink(GOOD);
    doc.text("MELHOR OPÇÃO", M + 18, y + 18, { charSpace: 1 });
    doc.setFontSize(14);
    ink(INK);
    doc.text(A.best.sc.nome, M + 18, y + 38);
    doc.setFontSize(18);
    ink(GOOD);
    doc.text(R(A.best.liq), W - M - 16, y + 38, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    ink(INK);
    let ly = y + 58;
    linhas.forEach((l) => {
      doc.text(l, M + 18, ly);
      ly += l.length * 12;
    });
    y += bh + 16;
  }

  /* ---- avisos ---- */
  for (const a of avisos(P)) {
    const l = doc.splitTextToSize(a.texto, W - 2 * M - 34) as string[];
    const bh = 14 + l.length * 12;
    if (y + bh > H - 50) {
      doc.addPage();
      topBar();
      y = 36;
    }
    const warn = a.tipo === "warn";
    fill(warn ? WARN_SOFT : SOFT);
    doc.rect(M, y, W - 2 * M, bh, "F");
    fill(warn ? WARN : INK);
    doc.rect(M, y, 3, bh, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    ink(INK);
    doc.text(l, M + 14, y + 15);
    y += bh + 6;
  }

  /* ---- comparativo ---- */
  const titulo2 = (t: string) => {
    if (y > H - 130) {
      doc.addPage();
      topBar();
      y = 36;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    ink(INK);
    doc.text(t, M, y + 14);
    fill(RED);
    doc.rect(M, y + 20, 28, 3, "F");
    y += 34;
  };
  y += 10;
  titulo2("Comparativo");

  const head = ["Cenário", "Modalidade", "Materiais", ...(hasC ? ["Item compl."] : []), "Total bruto", "ICMS", "PIS/COFINS", "Taxa fin.", "Valor líquido", "Cond. materiais", ...(hasC ? ["Cond. item compl."] : [])];
  const dedCols = new Set<number>();
  const base = 2 + 1 + (hasC ? 1 : 0) + 1; // índice da coluna ICMS (materiais=2, [item compl.], total bruto, ICMS)
  const liqIdx = base + 3;
  if (P.ded.icms) dedCols.add(base);
  if (P.ded.pis) dedCols.add(base + 1);
  if (P.ded.fin) dedCols.add(base + 2);
  const bestIdx = A.best && A.res.length > 1 && A.best.liq > 0 ? A.res.indexOf(A.best) : -1;
  const body = A.res.map((x, i) => {
    const pend = pendencias(x);
    return [
      `${i + 1}. ${x.sc.nome}`,
      (x.sc.modal === "direto" ? "Direto ao cliente" : "Via Alpha Filial") + (pend ? `\n${pend}` : ""),
      fmtMoney(x.mat),
      ...(hasC ? [fmtMoney(x.C)] : []),
      fmtMoney(x.bruto),
      fmtMoney(x.icms),
      fmtMoney(x.pis),
      x.fin ? fmtMoney(x.fin) : "—",
      fmtMoney(x.liq),
      prazoTxt(x.sc.prazoMat),
      ...(hasC ? [prazoTxt(x.sc.prazoCompl)] : []),
    ];
  });
  const right = (n: number) => ({ halign: "right" as const, cellWidth: n });
  // larguras fixas (~756 pt de 762 úteis): os valores nunca quebram em duas linhas
  const larg = hasC ? [108, 88, 66, 60, 66, 54, 58, 50, 68, 68, 70] : [150, 100, 76, 76, 62, 66, 60, 78, 88];
  const colStyles: Record<number, object> = {};
  larg.forEach((w, c) => (colStyles[c] = { cellWidth: w, halign: c >= 2 ? "right" : "left" }));
  void right;
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    theme: "plain",
    margin: { left: M, right: M, top: 40, bottom: 44 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 7, bottom: 7, left: 6, right: 6 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.6 }, valign: "middle" },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, lineWidth: 0 },
    columnStyles: colStyles,
    didParseCell: (d) => {
      if (d.section !== "body") {
        if (d.section === "head" && dedCols.has(d.column.index)) d.cell.styles.fillColor = RED;
        return;
      }
      if (d.row.index === bestIdx) {
        d.cell.styles.fillColor = GOOD_SOFT;
      }
      if (dedCols.has(d.column.index)) d.cell.styles.textColor = [200, 20, 27];
      if (d.column.index === liqIdx) d.cell.styles.fontStyle = "bold"; // valor líquido
    },
    didDrawPage: () => topBar(),
  });
  type WithTable = { lastAutoTable: { finalY: number } };
  y = (doc as unknown as WithTable).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ink(GREY);
  doc.text(
    "Valores em R$." +
      (hasC ? ` Item compl. = ${cn}.` : "") +
      (dedCols.size
        ? " Colunas em vermelho foram retiradas do valor líquido (total bruto menos as deduções selecionadas)."
        : " Valor líquido = total bruto (impostos e taxa financeira inclusos nos valores)."),
    M,
    y + 6,
  );
  y += 24;

  /* ---- cronograma ---- */
  titulo2("Cronograma de pagamentos (valores em R$)");
  autoTable(doc, {
    startY: y,
    head: [["Cenário", "Item", ...cr.cols.map(rotuloDia), "Total"]],
    body: cr.linhas.map((l) => [l.nome, l.item, ...cr.cols.map((d) => (l.parcelas[d] ? fmtMoney(l.parcelas[d]) : "—")), fmtMoney(l.total)]),
    theme: "plain",
    margin: { left: M, right: M, top: 40, bottom: 44 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.6 }, valign: "middle" },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, lineWidth: 0 },
    columnStyles: Object.fromEntries([...Array(cr.cols.length + 1).keys()].map((i) => [i + 2, { halign: "right" }])),
    didParseCell: (d) => {
      if (d.section !== "body") return;
      if (d.column.index === 1) d.cell.styles.textColor = d.row.raw && (d.row.raw as string[])[1] === "Materiais" ? RED : INK;
      if (d.column.index === cr.cols.length + 2) d.cell.styles.fontStyle = "bold";
    },
    didDrawPage: () => topBar(),
  });

  /* ---- rodapé em todas as páginas ---- */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    stroke(LINE);
    doc.line(M, H - 30, W - M, H - 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    ink(GREY);
    doc.text("Alpha Automação de Sistemas Elétricos  ·  Cenários de Faturamento", M, H - 17);
    doc.text(`Página ${p} de ${total}`, W - M, H - 17, { align: "right" });
  }

  doc.save(nomeArquivo(P, "pdf"));
}

/* =================================================================== EXCEL */
export async function exportarExcel(P: Projeto) {
  const [ExcelMod, logo] = await Promise.all([import("exceljs"), logoPng()]);
  const ExcelJS = (ExcelMod as unknown as { default?: typeof import("exceljs") }).default ?? ExcelMod;
  const A = analyse(P);
  const cr = cronograma(P);
  const hasC = parseNum(P.compl.valor) > 0;
  const cn = P.compl.fornecedor || "Item complementar";
  const n = A.res.length;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Alpha Automação de Sistemas Elétricos";
  wb.created = new Date();
  const img = wb.addImage({ base64: logo.dataUrl, extension: "png" });

  const C_RED = "FFED1C24";
  const C_INK = "FF231F20";
  const C_SOFT = "FFF6F6F7";
  const C_LINE = "FFDCDCDE";
  const C_GOOD = "FFE1F2E8";
  const C_WARN = "FFFBEFD9";
  const C_EDIT = "FFFDEAEA";
  const BRL = '"R$" #,##0.00';
  const font = (o: object = {}) => ({ name: "Calibri", size: 11, color: { argb: C_INK }, ...o });
  const border = (argb = C_LINE) => ({ top: { style: "thin" as const, color: { argb } }, bottom: { style: "thin" as const, color: { argb } }, left: { style: "thin" as const, color: { argb } }, right: { style: "thin" as const, color: { argb } } });
  const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

  const setup = (ws: import("exceljs").Worksheet) => {
    ws.properties.tabColor = { argb: C_RED };
    ws.views = [{ showGridLines: false, state: "normal" }];
    ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter = { oddFooter: '&L&"Calibri,Bold"Alpha Automação de Sistemas Elétricos&C&"Calibri"Cenários de Faturamento&R&"Calibri"Página &P de &N' };
  };
  const band = (ws: import("exceljs").Worksheet, cols: number) => {
    ws.getRow(1).height = 8;
    for (let c = 1; c <= cols; c++) ws.getRow(1).getCell(c).fill = solid(C_RED);
  };
  const secao = (ws: import("exceljs").Worksheet, row: number, texto: string, c1: number, c2: number) => {
    ws.mergeCells(row, c1, row, c2);
    const c = ws.getCell(row, c1);
    c.value = texto;
    c.font = font({ bold: true, size: 10, color: { argb: "FFFFFFFF" } });
    c.fill = solid(C_INK);
    c.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(row).height = 22;
  };

  /* ---------------- Resumo ---------------- */
  const rs = wb.addWorksheet("Resumo");
  setup(rs);
  rs.columns = [{ width: 3 }, { width: 36 }, { width: 28 }, { width: 62 }, { width: 3 }];
  band(rs, 5);
  rs.addImage(img, { tl: { col: 1, row: 1.2 }, ext: { width: 210, height: (210 * logo.h) / logo.w } });
  [2, 3, 4].forEach((r) => (rs.getRow(r).height = 17));
  rs.mergeCells("B6:D6");
  rs.getCell("B6").value = P.nome || "Projeto";
  rs.getCell("B6").font = font({ bold: true, size: 22 });
  rs.getRow(6).height = 34;
  rs.mergeCells("B7:D7");
  rs.getCell("B7").value = [P.cliente && `Cliente: ${P.cliente}${P.ufCliente ? ` (${P.ufCliente})` : ""}`, `Status: ${P.status}`].filter(Boolean).join("   ·   ");
  rs.getCell("B7").font = font({ size: 11, color: { argb: "FF625E60" } });
  rs.mergeCells("B8:D8");
  rs.getCell("B8").value = `${descricaoValores(P)}   ·   Gerado em ${dataHora()}`;
  rs.getCell("B8").font = font({ size: 10, color: { argb: "FF625E60" } });

  secao(rs, 10, "PARÂMETROS DE CÁLCULO", 2, 4);
  const param = (row: number, rotulo: string, valor: string | number | { formula: string; result: number }, fmt: string | null, nota: string, editavel = true) => {
    rs.getCell(row, 2).value = rotulo;
    rs.getCell(row, 2).font = font({ bold: true });
    const c = rs.getCell(row, 3);
    c.value = valor as never;
    if (fmt) c.numFmt = fmt;
    c.font = font({ bold: true, color: { argb: editavel ? C_INK : "FF625E60" } });
    c.alignment = { horizontal: "right", vertical: "middle" };
    c.border = border();
    if (editavel) c.fill = solid(C_EDIT);
    else c.fill = solid(C_SOFT);
    const d = rs.getCell(row, 4);
    d.value = nota;
    d.font = font({ size: 10, color: { argb: "FF625E60" } });
    d.alignment = { vertical: "middle", indent: 1, wrapText: true };
    rs.getRow(row).height = 21;
  };
  const pisAplicado = P.regime === "real" ? P.pisReal : P.pisPres;
  const regimeTxt = P.regime === "real" ? "Lucro Real" : "Lucro Presumido";
  param(11, "ICMS", P.icms / 100, "0.00%", "Percentual sobre o total bruto de cada cenário");
  param(12, "PIS/COFINS · Lucro Real", P.pisReal / 100, "0.00%", "Alíquota do regime não cumulativo");
  param(13, "PIS/COFINS · Lucro Presumido", P.pisPres / 100, "0.00%", "Alíquota do regime cumulativo");
  param(14, "Regime em uso", regimeTxt, null, "Escolha na lista: define qual alíquota de PIS/COFINS é usada");
  rs.getCell("C14").dataValidation = { type: "list", allowBlank: false, formulae: ['"Lucro Real,Lucro Presumido"'] };
  param(15, "PIS/COFINS aplicado", { formula: 'IF(C14="Lucro Real",C12,C13)', result: pisAplicado / 100 }, "0.00%", "Calculado automaticamente a partir do regime", false);
  param(16, "Taxa financeira", P.taxaFin / 100, "0.00%", "Aplicada só às partes pagas a prazo (à vista = sem taxa)");
  const simNao = (b: boolean) => (b ? "Sim" : "Não");
  param(17, "Retirar ICMS do valor líquido", simNao(P.ded.icms), null, "Sim = o ICMS é descontado do valor líquido");
  param(18, "Retirar PIS/COFINS do valor líquido", simNao(P.ded.pis), null, "Sim = o PIS/COFINS é descontado do valor líquido");
  param(19, "Retirar taxa financeira do valor líquido", simNao(P.ded.fin), null, "Sim = a taxa financeira é descontada do valor líquido");
  ["C17", "C18", "C19"].forEach((a) => (rs.getCell(a).dataValidation = { type: "list", allowBlank: false, formulae: ['"Sim,Não"'] }));

  secao(rs, 21, "ITEM COMPLEMENTAR (somado a todos os cenários)", 2, 4);
  param(22, "Fornecedor", P.compl.fornecedor || "—", null, "");
  rs.getCell("C22").alignment = { horizontal: "left", indent: 1 };
  param(23, "Descrição", P.compl.descricao || "—", null, "");
  rs.getCell("C23").alignment = { horizontal: "left", indent: 1, wrapText: true };
  param(24, "Valor", parseNum(P.compl.valor), BRL, "Valor 0 desativa o item complementar");

  let r = 26;
  const motivos = motivosMelhor(P);
  const first = 6;
  const last = first + n - 1;
  if (A.best && motivos.length) {
    secao(rs, r++, "MELHOR OPÇÃO", 2, 4);
    rs.getCell(r, 2).value = "Cenário";
    rs.getCell(r, 2).font = font({ bold: true });
    const c1 = rs.getCell(r, 3);
    rs.mergeCells(r, 3, r, 4);
    c1.value = { formula: `INDEX(Comparativo!$B$${first}:$B$${last},MATCH(MIN(Comparativo!$J$${first}:$J$${last}),Comparativo!$J$${first}:$J$${last},0))`, result: A.best.sc.nome };
    c1.font = font({ bold: true, size: 13, color: { argb: "FF1E7A4C" } });
    c1.fill = solid(C_GOOD);
    c1.alignment = { indent: 1, vertical: "middle" };
    rs.getRow(r).height = 24;
    r++;
    rs.getCell(r, 2).value = "Menor valor líquido";
    rs.getCell(r, 2).font = font({ bold: true });
    const c2 = rs.getCell(r, 3);
    c2.value = { formula: `MIN(Comparativo!$J$${first}:$J$${last})`, result: A.best.liq };
    c2.numFmt = BRL;
    c2.font = font({ bold: true, size: 13, color: { argb: "FF1E7A4C" } });
    c2.fill = solid(C_GOOD);
    c2.alignment = { horizontal: "right", vertical: "middle" };
    rs.getRow(r).height = 24;
    r++;
    motivos.forEach((m) => {
      rs.mergeCells(r, 2, r, 4);
      const c = rs.getCell(r, 2);
      c.value = `•  ${m.ressalva ? "Ressalva: " : ""}${m.texto}`;
      c.font = font({ size: 10.5, bold: m.ressalva });
      c.alignment = { wrapText: true, vertical: "middle", indent: 1 };
      rs.getRow(r).height = 18;
      r++;
    });
    r++;
  }
  const av = avisos(P);
  if (av.length) {
    secao(rs, r++, "AVISOS E OBSERVAÇÕES", 2, 4);
    av.forEach((a) => {
      rs.mergeCells(r, 2, r, 4);
      const c = rs.getCell(r, 2);
      c.value = a.texto;
      c.font = font({ size: 10.5 });
      c.fill = solid(a.tipo === "warn" ? C_WARN : C_SOFT);
      c.alignment = { wrapText: true, vertical: "middle", indent: 1 };
      rs.getRow(r).height = Math.max(20, Math.ceil(a.texto.length / 105) * 16 + 6);
      r++;
    });
    r++;
  }
  rs.mergeCells(r, 2, r, 4);
  rs.getCell(r, 2).value = "Dica: altere as células com fundo rosa (alíquotas, regime, deduções, valores) e a aba Comparativo recalcula sozinha.";
  rs.getCell(r, 2).font = font({ size: 9.5, italic: true, color: { argb: "FF625E60" } });

  /* ---------------- Comparativo ---------------- */
  const cp = wb.addWorksheet("Comparativo");
  setup(cp);
  cp.columns = [
    { width: 5 }, { width: 36 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 19 }, { width: 18 }, { width: 18 }, { width: 11 }, { width: 28 },
  ];
  band(cp, 14);
  cp.mergeCells("A2:N2");
  cp.getCell("A2").value = "Comparativo de cenários";
  cp.getCell("A2").font = font({ bold: true, size: 18 });
  cp.getRow(2).height = 30;
  cp.mergeCells("A3:N3");
  cp.getCell("A3").value = `${P.nome || "Projeto"}${P.cliente ? "  ·  " + P.cliente : ""}${P.ufCliente ? " (" + P.ufCliente + ")" : ""}   |   ${descricaoValores(P)}`;
  cp.getCell("A3").font = font({ size: 10.5, color: { argb: "FF625E60" } });
  const heads = ["#", "Cenário", "Modalidade", "Materiais", cn, "Total bruto", "ICMS", "PIS/COFINS", "Taxa financeira", "Valor líquido", "Cond. materiais", `Cond. ${cn}`, "Crédito", "Pendências"];
  const hr = cp.getRow(5);
  hr.height = 28;
  heads.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = font({ bold: true, size: 10, color: { argb: "FFFFFFFF" } });
    c.fill = solid(C_INK);
    c.alignment = { horizontal: i >= 3 && i <= 9 ? "right" : "left", vertical: "middle", wrapText: true, indent: 1 };
  });
  const T = "Resumo!";
  A.res.forEach((x, i) => {
    const row = first + i;
    const rr = cp.getRow(row);
    rr.height = 22;
    const pendTxt = pendencias(x);
    const taxa = P.taxaFin / 100;
    const finV = (x.pMat.length ? x.mat * taxa : 0) + (x.C && x.pCompl.length ? x.C * taxa : 0);
    const bruto = x.mat + x.C;
    const icmsV = (bruto * P.icms) / 100;
    const pisV = (bruto * pisAplicado) / 100;
    let liq = bruto;
    if (P.ded.icms) liq -= icmsV;
    if (P.ded.pis) liq -= pisV;
    if (P.ded.fin) liq -= finV;
    const vals: (string | number | { formula: string; result: number })[] = [
      i + 1,
      x.sc.nome,
      x.sc.modal === "direto" ? "Direto ao cliente" : "Via Alpha Filial",
      x.mat,
      { formula: `${T}$C$24`, result: x.C },
      { formula: `D${row}+E${row}`, result: bruto },
      { formula: `F${row}*${T}$C$11`, result: icmsV },
      { formula: `F${row}*${T}$C$15`, result: pisV },
      { formula: `IF(K${row}<>"À vista",D${row}*${T}$C$16,0)+IF(AND(E${row}>0,L${row}<>"À vista"),E${row}*${T}$C$16,0)`, result: finV },
      { formula: `F${row}-IF(${T}$C$17="Sim",G${row},0)-IF(${T}$C$18="Sim",H${row},0)-IF(${T}$C$19="Sim",I${row},0)`, result: liq },
      prazoTxt(x.sc.prazoMat),
      prazoTxt(x.sc.prazoCompl),
      x.sc.credito ? "Em análise" : "—",
      pendTxt || "—",
    ];
    vals.forEach((v, k) => {
      const c = rr.getCell(k + 1);
      c.value = v as never;
      c.font = font({ size: 10.5, bold: k === 9 || k === 1 });
      c.border = border();
      c.alignment = { vertical: "middle", horizontal: k >= 3 && k <= 9 ? "right" : "left", indent: k >= 3 && k <= 9 ? 1 : 1 };
      if (k >= 3 && k <= 9) c.numFmt = BRL;
      if (k === 0) c.alignment = { vertical: "middle", horizontal: "center" };
    });
    // colunas que são retiradas do valor líquido ficam em vermelho
    if (P.ded.icms) rr.getCell(7).font = font({ size: 10.5, color: { argb: C_RED } });
    if (P.ded.pis) rr.getCell(8).font = font({ size: 10.5, color: { argb: C_RED } });
    if (P.ded.fin) rr.getCell(9).font = font({ size: 10.5, color: { argb: C_RED } });
    if (x.sc.credito || x.sc.modal === "direto") rr.getCell(14).font = font({ size: 10.5, bold: true, color: { argb: "FF9A5D00" } });
    if (i % 2 === 1) for (let k = 1; k <= 14; k++) if (!rr.getCell(k).fill || (rr.getCell(k).fill as { type?: string }).type !== "pattern") rr.getCell(k).fill = solid("FFFBFBFB");
  });
  if (!hasC) {
    cp.getColumn(5).hidden = true;
    cp.getColumn(12).hidden = true;
  }
  if (n > 1) {
    cp.addConditionalFormatting({
      ref: `A${first}:N${last}`,
      rules: [{ type: "expression", formulae: [`$J${first}=MIN($J$${first}:$J$${last})`], priority: 1, style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: C_GOOD } }, font: { bold: true, color: { argb: "FF17653E" } } } }],
    });
    const tr = cp.getRow(last + 2);
    tr.height = 24;
    cp.mergeCells(last + 2, 1, last + 2, 9);
    const lab = tr.getCell(1);
    lab.value = "Menor valor líquido entre os cenários";
    lab.font = font({ bold: true });
    lab.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    const tv = tr.getCell(10);
    tv.value = { formula: `MIN(J${first}:J${last})`, result: A.best?.liq ?? 0 };
    tv.numFmt = BRL;
    tv.font = font({ bold: true, size: 12, color: { argb: "FF17653E" } });
    tv.fill = solid(C_GOOD);
    tv.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    tv.border = border();
  }
  cp.views = [{ showGridLines: false, state: "frozen", xSplit: 2, ySplit: 5 }];
  cp.pageSetup.printTitlesRow = "5:5";

  /* ---------------- Cronograma ---------------- */
  const cg = wb.addWorksheet("Cronograma");
  setup(cg);
  const nCols = 2 + cr.cols.length + 1;
  cg.columns = [{ width: 38 }, { width: 22 }, ...cr.cols.map(() => ({ width: 17 })), { width: 19 }];
  band(cg, nCols);
  cg.mergeCells(2, 1, 2, nCols);
  cg.getCell("A2").value = "Cronograma de pagamentos";
  cg.getCell("A2").font = font({ bold: true, size: 18 });
  cg.getRow(2).height = 30;
  cg.mergeCells(3, 1, 3, nCols);
  cg.getCell("A3").value = `${P.nome || "Projeto"}   |   Parcelas iguais nos prazos informados (D0 = à vista)`;
  cg.getCell("A3").font = font({ size: 10.5, color: { argb: "FF625E60" } });
  const ch = cg.getRow(5);
  ch.height = 28;
  ["Cenário", "Item", ...cr.cols.map(rotuloDia), "Total"].forEach((h, i) => {
    const c = ch.getCell(i + 1);
    c.value = h;
    c.font = font({ bold: true, size: 10, color: { argb: "FFFFFFFF" } });
    c.fill = solid(C_INK);
    c.alignment = { horizontal: i >= 2 ? "right" : "left", vertical: "middle", indent: 1 };
  });
  cr.linhas.forEach((l, i) => {
    const row = 6 + i;
    const rr = cg.getRow(row);
    rr.height = 21;
    const mat = l.item === "Materiais";
    const vals: (string | number | { formula: string; result: number } | null)[] = [l.nome, l.item, ...cr.cols.map((d) => (l.parcelas[d] ? l.parcelas[d] : null))];
    vals.push({ formula: `SUM(C${row}:${String.fromCharCode(64 + 2 + cr.cols.length)}${row})`, result: l.total });
    vals.forEach((v, k) => {
      const c = rr.getCell(k + 1);
      c.value = (v ?? "—") as never;
      c.border = border();
      c.font = font({ size: 10.5, bold: k === 0 || k === vals.length - 1, color: { argb: k === 1 ? (mat ? C_RED : C_INK) : C_INK } });
      c.alignment = { vertical: "middle", horizontal: k >= 2 ? "right" : "left", indent: 1 };
      if (k >= 2 && v !== null) c.numFmt = BRL;
      if (k >= 2 && v === null) c.font = font({ size: 10.5, color: { argb: "FFB5B2B3" } });
      if (k === vals.length - 1) c.fill = solid(C_SOFT);
    });
    if (cr.hasC ? i % 2 === 1 : false) rr.getCell(1).fill = solid("FFFBFBFB");
  });
  cg.views = [{ showGridLines: false, state: "frozen", xSplit: 2, ySplit: 5 }];

  const buf = await wb.xlsx.writeBuffer();
  baixar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nomeArquivo(P, "xlsx"));
}
