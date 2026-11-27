import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";

export const metadata: Metadata = { title: "Buscar" };

export default async function Page() {
  return <UnderConstruction title="Buscar" stage={3} description="Busca no banco de dados com filtros de categoria, marca, tamanho, estado, preço, cidade e distância." />;
}
