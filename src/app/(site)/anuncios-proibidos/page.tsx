import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";
import { PROHIBITED, UPDATED_AT } from "@/features/legal/content";

export const metadata: Metadata = { title: "Política de anúncios proibidos" };

export default function Page() {
  return <LegalPage title="Política de anúncios proibidos" updatedAt={UPDATED_AT} sections={PROHIBITED} />;
}
