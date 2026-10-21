export const STATUS = ["Em análise", "Aprovado", "Reprovado", "Rascunho"] as const;
export type Status = (typeof STATUS)[number];
export type Modal = "direto" | "filial";
/** Quem arca com o DIFAL no faturamento direto: pendente = ainda não definido. */
export type DifalStatus = "pendente" | "cliente" | "nos";

export interface Cenario {
  nome: string;
  modal: Modal;
  valor: number; // materiais, com impostos
  /**
   * Condição de pagamento. Vazio = à vista. Dias separados por "/": "30/60/90" (parcelas iguais).
   * Com percentuais: "0:15/30:15/56:70" = 15% à vista, 15% em 30 dias e 70% em 56 dias.
   */
  prazoMat: string;
  prazoCompl: string;
  credito: boolean;
  difal?: DifalStatus; // só vale para faturamento direto; ausente = pendente
  difalPct?: number; // alíquota do DIFAL (%) quando fica por nossa conta
}

export interface Projeto {
  nome: string;
  cliente: string;
  ufCliente: string;
  status: Status;
  icms: number;
  pisReal: number;
  pisPres: number;
  taxaFin: number;
  /** custo de capital (% ao mês) para trazer as parcelas a valor presente; 0 = usa a taxa financeira */
  custoCapital?: number;
  regime: "real" | "presumido";
  compl: { fornecedor: string; descricao: string; valor: number };
  ded: { icms: boolean; pis: boolean; fin: boolean };
  obs: string[];
  cenarios: Cenario[];
  criadoEm: string;
  atualizadoEm: string;
}
