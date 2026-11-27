import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { ListingForm } from "@/features/products/listing-form/listing-form";
import { listCatalogOptions } from "@/features/products/queries";
import { canOwner } from "@/features/products/status";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { isListingAssistantEnabled } from "@/services/ai/listing-assistant";

export const metadata: Metadata = { title: "Editar anúncio", robots: { index: false } };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/vender/anuncios/${id}/editar`);
  // Filtra pelo dono: anúncio de outra pessoa → 404 (não revela existência).
  const product = await prisma.product.findFirst({ where: { id, sellerId: user.id }, include: { images: { orderBy: { position: "asc" } } } });
  if (!product) notFound();

  if (!canOwner("edit", product.status))
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Alert tone="warning">Este anúncio está {product.status === "SOLD" ? "vendido" : "indisponível"} e não pode mais ser editado.</Alert>
      </div>
    );

  const [[categories, brands], feeBps, moderation] = await Promise.all([listCatalogOptions(), getSetting("platform_fee_bps"), getSetting("listing_moderation")]);
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-extrabold">Editar anúncio</h1>
      {moderation === "manual" && product.status === "ACTIVE" && <Alert tone="info">Alterações em anúncios ativos passam por nova revisão antes de voltar ao ar.</Alert>}
      <ListingForm
        categories={categories}
        brands={brands}
        feeBps={feeBps}
        aiEnabled={isListingAssistantEnabled()}
        defaultCity={product.city}
        productId={product.id}
        productStatus={product.status}
        initialPhotos={product.images.map((i) => ({ kind: "existing" as const, id: i.id, url: i.imageUrl }))}
        initial={{
          title: product.title, categoryId: product.categoryId, brandId: product.brandId ?? "", size: product.size ?? "", color: product.color ?? "",
          condition: product.condition, description: product.description, defects: product.defects ?? "",
          price: (product.priceCents / 100).toFixed(2).replace(".", ","), city: product.city,
          shippingAvailable: product.shippingAvailable, localPickup: product.localPickup,
        }}
      />
    </div>
  );
}
