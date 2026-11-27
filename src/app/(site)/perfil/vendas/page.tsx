import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Painel do vendedor" };

export default async function Page() {
  await requireUser("/perfil/vendas");
  return <UnderConstruction title="Painel do vendedor" stage={4} description="Anúncios, pedidos recebidos, vendas e repasses informados pelo provedor." />;
}
