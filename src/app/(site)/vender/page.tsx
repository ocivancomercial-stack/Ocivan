import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/features/products/listing-form/listing-form";
import { listCatalogOptions } from "@/features/products/queries";
import { requireUser } from "@/lib/session";
import { VerifyEmailBanner } from "@/features/auth/verify-email-banner";
import { getSetting } from "@/lib/settings";
import { isListingAssistantEnabled } from "@/services/ai/listing-assistant";

export const metadata: Metadata = { title: "Vender", robots: { index: false } };

export default async function SellPage() {
  const user = await requireUser("/vender");
  const [[categories, brands], feeBps] = await Promise.all([listCatalogOptions(), getSetting("platform_fee_bps")]);
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Novo anúncio</h1>
          <p className="text-sm text-muted">Fotos, detalhes, preço e pronto. Leva poucos minutos.</p>
        </div>
        <Link href="/vender/anuncios" className="shrink-0 text-sm font-semibold text-brand hover:underline">
          Meus anúncios
        </Link>
      </div>
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
      <ListingForm categories={categories} brands={brands} feeBps={feeBps}
        aiEnabled={isListingAssistantEnabled()} defaultCity={user.city ?? "Curitiba"} />
    </div>
  );
}
