import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/catalog/category-grid";
import { ProductRail } from "@/components/catalog/product-card";
import { SearchBox } from "@/components/layout/search-box";
import { ButtonLink } from "@/components/ui/button";
import { listRootCategories } from "@/features/catalog/queries";
import { favoritedIds, listFeaturedProducts, listNearbyProducts, listRecentProducts, listSuggestedProducts, type ProductCardData } from "@/features/products/queries";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Explorar produtos" };

function Section({ title, href, products, favorites }: { title: string; href: string; products: ProductCardData[]; favorites: Set<string> }) {
  if (products.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-extrabold md:text-2xl">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-brand hover:underline">Ver tudo</Link>
      </div>
      <ProductRail products={products} favorites={favorites} />
    </section>
  );
}

export default async function ExplorePage() {
  const user = await getCurrentUser();
  const city = user?.city ?? "Curitiba";
  const [categories, nearby, recent, featured, suggested] = await Promise.all([
    listRootCategories(),
    listNearbyProducts(city),
    listRecentProducts(),
    listFeaturedProducts(),
    listSuggestedProducts(user?.id ?? null),
  ]);
  const favs = await favoritedIds(user?.id, [...nearby, ...recent, ...featured, ...suggested].map((p) => p.id));
  const empty = nearby.length + recent.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 md:py-10">
      <SearchBox size="lg" className="md:hidden" />
      <CategoryGrid categories={categories} />
      {empty && (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          Ainda não há anúncios publicados. <Link href="/vender" className="font-semibold text-brand">Seja o primeiro a anunciar.</Link>
        </div>
      )}
      <Section title={`Perto de você · ${city}`} href={`/buscar?perto=${encodeURIComponent(city)}&distancia=25`} products={nearby} favorites={favs} />
      <Section title="Recém-anunciados" href="/buscar?ordem=recentes" products={recent} favorites={favs} />
      <Section title="Em destaque" href="/buscar" products={featured} favorites={favs} />
      <section className="flex flex-col items-start gap-3 rounded-card bg-brand-900 p-6 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-extrabold">Desapegue também</h2>
          <p className="text-sm text-white/70">Anunciar é grátis. Você só paga a comissão quando vende.</p>
        </div>
        <ButtonLink href="/vender" variant="accent">Anunciar agora</ButtonLink>
      </section>
      <Section title={user ? "Sugestões para você" : "Mais desejados"} href="/buscar" products={suggested} favorites={favs} />
    </div>
  );
}
