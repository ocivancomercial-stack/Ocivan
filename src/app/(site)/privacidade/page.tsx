import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";
import { PRIVACY, UPDATED_AT } from "@/features/legal/content";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Page() {
  return <LegalPage title="Política de privacidade" updatedAt={UPDATED_AT} sections={PRIVACY} />;
}
