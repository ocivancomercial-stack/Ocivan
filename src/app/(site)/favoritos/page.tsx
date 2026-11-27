import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/catalog/product-card";
import { listFavorites } from "@/features/favorites/service";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false } };

export default async function FavoritesPage() {
  const user = await requireUser("/favoritos");
  const favorites = await listFavorites(user.id);
  const products = favorites.map((f) => f.product);
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Favoritos</h1>
      <ProductGrid
        products={products}
        favorites={new Set(products.map((p) => p.id))}
        emptyText={<>Você ainda não favoritou nada. Toque no coração dos produtos que gostar. <Link href="/explorar" className="font-semibold text-brand">Explorar</Link></>}
      />
    </div>
  );
}
