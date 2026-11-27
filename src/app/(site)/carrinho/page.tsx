import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Carrinho" };

export default async function Page() {
  await requireUser("/carrinho");
  return <UnderConstruction title="Carrinho" stage={4} description="Carrinho e checkout com reserva temporária do anúncio." />;
}
