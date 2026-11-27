import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";
import { REFUND, UPDATED_AT } from "@/features/legal/content";

export const metadata: Metadata = { title: "Política de reembolso e cancelamento" };

export default function Page() {
  return <LegalPage title="Política de reembolso e cancelamento" updatedAt={UPDATED_AT} sections={REFUND} />;
}
