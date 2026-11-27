import type { Metadata } from "next";
import { UnderConstruction } from "@/components/layout/under-construction";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Favoritos" };

export default async function Page() {
  await requireUser("/favoritos");
  return <UnderConstruction title="Favoritos" stage={3} description="Lista dos produtos que você favoritou." />;
}
