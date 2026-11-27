import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";

export const metadata: Metadata = { title: "Explorar produtos" };

export default async function Page() {
  return <UnderConstruction title="Explorar produtos" stage={3} description="Vitrine com produtos próximos, recém-anunciados, destaques e sugestões." />;
}
