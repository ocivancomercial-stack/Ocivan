import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Vender" };

export default async function Page() {
  await requireUser("/vender");
  return <UnderConstruction title="Vender" stage={3} description="Fluxo de anúncio em etapas: fotos, dados, preço, revisão e publicação." />;
}
