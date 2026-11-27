import Link from "next/link";
import { ProductRail } from "@/components/catalog/product-card";
import { favoritedIds, listFeaturedProducts, listRecentProducts } from "@/features/products/queries";
import { getCurrentUser } from "@/lib/session";

/** Seções de produtos da landing com dados reais do banco. */
export async function ProductSection({ title, kind }: { title: string; kind: "featured" | "recent" }) {
  const products = kind === "featured" ? await listFeaturedProducts() : await listRecentProducts();
  const user = await getCurrentUser();
  const favs = await favoritedIds(user?.id, products.map((p) => p.id));

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-extrabold md:text-2xl">{title}</h2>
        <Link href="/explorar" className="text-sm font-semibold text-brand hover:underline">Ver tudo</Link>
      </div>
      {products.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          Ainda não há anúncios publicados aqui. <Link href="/vender" className="font-semibold text-brand">Seja o primeiro a anunciar.</Link>
        </div>
      ) : (
        <ProductRail products={products} favorites={favs} />
      )}
    </section>
  );
}
