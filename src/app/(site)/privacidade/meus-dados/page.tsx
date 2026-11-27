import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Meus dados (LGPD)" };

export default async function Page() {
  await requireUser("/privacidade/meus-dados");
  return <UnderConstruction title="Meus dados (LGPD)" stage={6} description="Solicitação de acesso, correção e exclusão de dados pessoais." />;
}
