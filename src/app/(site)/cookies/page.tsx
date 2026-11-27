import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";
import { COOKIES, UPDATED_AT } from "@/features/legal/content";

export const metadata: Metadata = { title: "Política de cookies" };

export default function Page() {
  return <LegalPage title="Política de cookies" updatedAt={UPDATED_AT} sections={COOKIES} />;
}
