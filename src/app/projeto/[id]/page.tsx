"use client";
import { useParams } from "next/navigation";
import { ProjectView } from "@/components/ProjectView";

export default function ProjetoPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectView id={id} />;
}
