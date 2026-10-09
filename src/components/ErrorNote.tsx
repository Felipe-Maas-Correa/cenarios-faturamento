import type { FirestoreError } from "firebase/firestore";

export function ErrorNote({ error }: { error: FirestoreError }) {
  const negado = error.code === "permission-denied";
  return (
    <div className="alert err" role="alert">
      <b>{negado ? "Acesso negado pelo Firestore." : "Falha na conexão com o Firestore."}</b>{" "}
      {negado
        ? "Ajuste as regras de segurança do banco no console do Firebase para permitir leitura e escrita na coleção “projetos”."
        : error.message}
    </div>
  );
}
