import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/catalog/product-card";
import { SearchBox } from "@/components/layout/search-box";
import { buttonClasses } from "@/components/ui/button";
import { favoritedIds, listCatalogOptions, searchProducts } from "@/features/products/queries";
import { SearchFiltersForm } from "@/features/products/search-filters";
import { getCurrentUser } from "@/lib/session";
import { searchParamsSchema } from "@/schemas/product";

export const metadata: Metadata = { title: "Buscar" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]));
  const filters = searchParamsSchema.parse(raw);
  const user = await getCurrentUser();
  const [[categories, brands], result] = await Promise.all([listCatalogOptions(), searchProducts(filters, { viewerCity: user?.city })]);
  const favs = await favoritedIds(user?.id, result.items.map((p) => p.id));

  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries(raw).filter(([, v]) => v !== undefined) as [string, string][]);
    params.set("pagina", String(page));
    return `/buscar?${params}`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <SearchBox defaultValue={filters.q} className="md:hidden" />
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-extrabold md:text-2xl">{filters.q ? <>Resultados para “{filters.q}”</> : "Todos os produtos"}</h1>
        <p className="shrink-0 text-sm text-muted">{result.total} {result.total === 1 ? "produto" : "produtos"}</p>
      </div>
      <SearchFiltersForm filters={filters} categories={categories} brands={brands} viewerCity={user?.city} />
      <ProductGrid
        products={result.items}
        favorites={favs}
        emptyText={<>Nada encontrado com esses filtros. Tente remover alguns ou <Link href="/buscar" className="font-semibold text-brand">ver todos os produtos</Link>.</>}
      />
      {result.pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Paginação">
          {result.page > 1 && <Link href={pageHref(result.page - 1)} className={buttonClasses("outline", "sm")}>Anterior</Link>}
          <span className="text-sm text-muted">Página {result.page} de {result.pages}</span>
          {result.page < result.pages && <Link href={pageHref(result.page + 1)} className={buttonClasses("outline", "sm")}>Próxima</Link>}
        </nav>
      )}
    </div>
  );
}
