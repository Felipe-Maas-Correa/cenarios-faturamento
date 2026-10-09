"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProjectView } from "@/components/ProjectView";

function Conteudo() {
  const id = useSearchParams().get("id");
  if (!id) return <p className="hint">Projeto não informado.</p>;
  return <ProjectView id={id} />;
}

export default function ProjetoPage() {
  return (
    <Suspense fallback={<p className="hint">Carregando projeto…</p>}>
      <Conteudo />
    </Suspense>
  );
}
