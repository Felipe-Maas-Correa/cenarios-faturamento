export const STATUS = ["Em análise", "Aprovado", "Reprovado", "Rascunho"] as const;
export type Status = (typeof STATUS)[number];
export type Modal = "direto" | "filial";

export interface Cenario {
  nome: string;
  modal: Modal;
  valor: number; // materiais, com impostos
  prazoMat: string; // dias separados por "/", vazio = à vista
  prazoCompl: string;
  credito: boolean;
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
  regime: "real" | "presumido";
  compl: { fornecedor: string; descricao: string; valor: number };
  ded: { icms: boolean; pis: boolean; fin: boolean };
  obs: string[];
  cenarios: Cenario[];
  criadoEm: string;
  atualizadoEm: string;
}
