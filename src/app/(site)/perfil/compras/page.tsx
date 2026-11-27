import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Minhas compras" };

export default async function Page() {
  await requireUser("/perfil/compras");
  return <UnderConstruction title="Minhas compras" stage={4} description="Histórico e acompanhamento dos seus pedidos." />;
}
