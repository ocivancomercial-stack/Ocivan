import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { CONDITION_LABEL } from "@/features/products/constants";
import type { ProductCardData } from "@/features/products/queries";
import { formatBRL } from "@/lib/utils";
import { FavoriteButton } from "./favorite-button";

export function SampleBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-900 ${className}`} title="Anúncio fictício de demonstração">
      Exemplo
    </span>
  );
}

export function ProductCard({ product, favorited, priority = false }: { product: ProductCardData; favorited: boolean; priority?: boolean }) {
  const image = product.images[0]?.imageUrl;
  return (
    <article className="group relative">
      <Link href={`/produto/${product.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-brand-50">
          {image ? (
            <Image
              src={image}
              alt={product.title}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center text-xs text-muted">Sem foto</div>
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {product.isSample && <SampleBadge />}
            {product.status === "SOLD" && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase text-white">Vendido</span>}
            {product.status === "RESERVED" && <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Reservado</span>}
          </div>
        </div>
        <div className="mt-2 space-y-0.5 px-0.5">
          <p className="text-base font-extrabold">{formatBRL(product.priceCents)}</p>
          <h3 className="line-clamp-1 text-sm text-ink">{product.title}</h3>
          <p className="line-clamp-1 text-xs text-muted">
            {[product.brand?.name, product.size && `Tam. ${product.size}`, CONDITION_LABEL[product.condition]].filter(Boolean).join(" · ")}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3" /> {product.city}
          </p>
        </div>
      </Link>
      <FavoriteButton productId={product.id} initial={favorited} className="absolute right-2 top-2" />
    </article>
  );
}

export function ProductGrid({ products, favorites, emptyText }: { products: ProductCardData[]; favorites: Set<string>; emptyText?: React.ReactNode }) {
  if (products.length === 0)
    return <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">{emptyText ?? "Nenhum produto encontrado."}</div>;
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} favorited={favorites.has(p.id)} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}

/** Carrossel horizontal no celular, grade no desktop. */
export function ProductRail({ products, favorites }: { products: ProductCardData[]; favorites: Set<string> }) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-5">
      {products.map((p) => (
        <li key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-auto">
          <ProductCard product={p} favorited={favorites.has(p.id)} />
        </li>
      ))}
    </ul>
  );
}
