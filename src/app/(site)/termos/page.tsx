import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";
import { TERMS, UPDATED_AT } from "@/features/legal/content";

export const metadata: Metadata = { title: "Termos de uso" };

export default function Page() {
  return <LegalPage title="Termos de uso" updatedAt={UPDATED_AT} sections={TERMS} />;
}
