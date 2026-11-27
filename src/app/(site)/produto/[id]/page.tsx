import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, MapPin, PackageCheck, ShieldCheck, Star, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { Gallery } from "@/components/catalog/gallery";
import { ProductRail, SampleBadge } from "@/components/catalog/product-card";
import { CONDITION_LABEL, STATUS_LABEL } from "@/features/products/constants";
import { favoritedIds, getProductForPage, listSimilarProducts } from "@/features/products/queries";
import { ReportForm } from "@/features/products/report-form";
import { getCurrentUser } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductForPage(id, null);
  if (!product) return { title: "Produto não encontrado" };
  const description = `${formatBRL(product.priceCents)} · ${CONDITION_LABEL[product.condition]} · ${product.city}. ${product.description.slice(0, 120)}`;
  return {
    title: product.title,
    description,
    robots: product.isSample ? { index: false } : undefined,
    openGraph: { title: product.title, description, images: product.images[0] ? [product.images[0].imageUrl] : [] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const product = await getProductForPage(id, user?.id ?? null);
  if (!product) notFound();

  const similar = await listSimilarProducts({ id: product.id, categoryId: product.categoryId });
  const favs = await favoritedIds(user?.id, [product.id, ...similar.map((s) => s.id)]);

  const specs: [string, string | null | undefined][] = [
    ["Categoria", `${product.category.parent?.name} › ${product.category.name}`],
    ["Marca", product.brand?.name ?? "Sem marca / outra"],
    ["Tamanho", product.size],
    ["Cor", product.color],
    ["Estado", CONDITION_LABEL[product.condition]],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-6 md:py-10">
      <nav aria-label="Trilha" className="text-xs text-muted">
        <Link href="/" className="hover:underline">Início</Link> ›{" "}
        <Link href={`/buscar?categoria=${product.category.parent?.slug}`} className="hover:underline">{product.category.parent?.name}</Link> ›{" "}
        <Link href={`/buscar?subcategoria=${product.category.slug}`} className="hover:underline">{product.category.name}</Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <Gallery images={product.images} title={product.title} />

        <div className="space-y-6">
          {product.isSample && (
            <Alert tone="warning">
              <SampleBadge className="mr-2" /> Anúncio <strong>fictício</strong> de demonstração — não está à venda.
            </Alert>
          )}
          {product.isOwner && product.status !== "ACTIVE" && <Alert tone="info">Só você vê esta página — situação: {STATUS_LABEL[product.status]}.</Alert>}

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">{product.title}</h1>
            <p className="text-3xl font-extrabold text-brand-900">{formatBRL(product.priceCents)}</p>
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-4" /> {product.city} – PR · {product._count.favorites} {product._count.favorites === 1 ? "pessoa favoritou" : "pessoas favoritaram"}
            </p>
          </div>

          <div className="flex gap-2">
            {product.status === "SOLD" ? (
              <Button disabled className="flex-1" size="lg">Vendido</Button>
            ) : product.isOwner ? (
              <ButtonLink href={`/vender/anuncios/${product.id}/editar`} className="flex-1" size="lg">Editar anúncio</ButtonLink>
            ) : (
              <Button disabled className="flex-1" size="lg" title="Checkout disponível na Etapa 4">
                Comprar agora
              </Button>
            )}
            {!product.isOwner && <FavoriteButton productId={product.id} initial={favs.has(product.id)} withLabel />}
          </div>
          {!product.isOwner && product.status === "ACTIVE" && (
            <p className="-mt-3 text-xs text-muted">Compra pela plataforma em desenvolvimento (Etapa 4: carrinho e checkout).</p>
          )}

          <dl className="grid grid-cols-2 gap-3">
            {specs.map(([k, v]) => (
              <div key={k} className="rounded-field bg-surface p-3 shadow-card">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="text-sm font-semibold">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>

          <section className="space-y-2">
            <h2 className="font-bold">Descrição</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/85">{product.description}</p>
          </section>

          <section className="rounded-field border border-accent/40 bg-accent-50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#7a5410]"><AlertTriangle className="size-4" /> Defeitos informados</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-[#7a5410]">{product.defects || "O vendedor não informou defeitos."}</p>
          </section>

          <ul className="space-y-2 text-sm text-muted">
            {product.shippingAvailable && <li className="flex items-center gap-2"><Truck className="size-4 text-brand" /> Envio com rastreio (frete calculado no checkout)</li>}
            {product.localPickup && <li className="flex items-center gap-2"><PackageCheck className="size-4 text-brand" /> Entrega/retirada combinada em {product.city}</li>}
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /> Pagamento pela plataforma; o pedido só é liberado após confirmação do pagamento</li>
          </ul>

          <section className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
            <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-lg font-extrabold text-white">
              {product.seller.avatar ? <Image src={product.seller.avatar} alt="" fill sizes="48px" className="object-cover" /> : product.seller.name.charAt(0)}
            </span>
            <div className="text-sm">
              <p className="font-bold">{product.seller.name}</p>
              <p className="flex items-center gap-1 text-muted">
                <Star className="size-4 fill-accent text-accent" />
                {product.seller.ratingCount > 0 ? `${product.seller.rating?.toFixed(1)} (${product.seller.ratingCount} avaliações)` : "Sem avaliações ainda"} · {product.seller.soldCount} vendas
              </p>
              <p className="text-muted">{product.seller.city ?? "PR"} · no Repassa Aí desde {product.seller.createdAt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
            </div>
          </section>

          {!product.isOwner && !product.isSample && <ReportForm productId={product.id} />}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-extrabold">Produtos semelhantes</h2>
          <ProductRail products={similar} favorites={favs} />
        </section>
      )}
    </div>
  );
}
