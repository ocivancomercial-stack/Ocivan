import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SearchFilters } from "@/schemas/product";
import { buildTsQuery, citiesWithin, reaisToCents } from "./search";
import { LISTED_STATUSES, PUBLIC_STATUSES } from "./status";

export const PAGE_SIZE = 24;

/** Campos expostos publicamente em cards — sem dados pessoais do vendedor. */
export const productCardSelect = {
  id: true,
  title: true,
  priceCents: true,
  size: true,
  condition: true,
  city: true,
  status: true,
  isSample: true,
  createdAt: true,
  brand: { select: { name: true } },
  images: { select: { imageUrl: true }, orderBy: { position: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

async function matchingIdsForText(q: string | undefined): Promise<string[] | null> {
  const tsq = buildTsQuery(q);
  if (!tsq) return null;
  const like = `%${q!.trim().slice(0, 60).replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  // Consulta parametrizada (template tag do Prisma) — sem concatenação de SQL.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p."id"
    FROM "products" p
    LEFT JOIN "brands" b ON b."id" = p."brandId"
    WHERE p."status" = 'ACTIVE'
      AND (
        product_search_vector(p."title", p."description") @@ to_tsquery('portuguese', immutable_unaccent(${tsq}))
        OR immutable_unaccent(b."name") ILIKE immutable_unaccent(${like})
      )
    ORDER BY ts_rank(product_search_vector(p."title", p."description"), to_tsquery('portuguese', immutable_unaccent(${tsq}))) DESC
    LIMIT 2000`;
  return rows.map((r) => r.id);
}

/** Busca real no banco, combinando texto, filtros, distância, ordenação e paginação. */
export async function searchProducts(filters: SearchFilters, { viewerCity }: { viewerCity?: string | null } = {}) {
  const where: Prisma.ProductWhereInput = { status: { in: LISTED_STATUSES } };
  const and: Prisma.ProductWhereInput[] = [];

  const ids = await matchingIdsForText(filters.q);
  if (ids) and.push({ id: { in: ids } });

  if (filters.subcategoria) and.push({ category: { slug: filters.subcategoria } });
  else if (filters.categoria) and.push({ category: { parent: { slug: filters.categoria } } });
  if (filters.marca) and.push({ brand: { slug: filters.marca } });
  if (filters.tamanho) and.push({ size: { equals: filters.tamanho, mode: "insensitive" } });
  if (filters.estado) and.push({ condition: filters.estado });

  const min = reaisToCents(filters.precoMin);
  const max = reaisToCents(filters.precoMax);
  if (min !== undefined || max !== undefined) and.push({ priceCents: { gte: min, lte: max } });

  if (filters.cidade) and.push({ city: filters.cidade });
  const origin = filters.perto ?? viewerCity ?? undefined;
  if (filters.distancia && origin) and.push({ city: { in: citiesWithin(origin, filters.distancia) } });

  if (and.length) where.AND = and;

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    filters.ordem === "menor-preco"
      ? [{ priceCents: "asc" }, { id: "asc" }]
      : filters.ordem === "maior-preco"
        ? [{ priceCents: "desc" }, { id: "asc" }]
        : [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }];

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy, skip: (filters.pagina - 1) * PAGE_SIZE, take: PAGE_SIZE, select: productCardSelect }),
  ]);
  return { items, total, page: filters.pagina, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function listRecentProducts(take = 8) {
  return prisma.product.findMany({
    where: { status: { in: LISTED_STATUSES } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
    select: productCardSelect,
  });
}

export function listFeaturedProducts(take = 8) {
  return prisma.product.findMany({
    where: { status: { in: LISTED_STATUSES }, isFeatured: true },
    orderBy: { publishedAt: "desc" },
    take,
    select: productCardSelect,
  });
}

export function listNearbyProducts(city: string, take = 8, km = 25) {
  return prisma.product.findMany({
    where: { status: { in: LISTED_STATUSES }, city: { in: citiesWithin(city, km) } },
    orderBy: { publishedAt: "desc" },
    take,
    select: productCardSelect,
  });
}

/**
 * Sugestões personalizadas: categorias e tamanhos dos favoritos do usuário.
 * Sem histórico, mostra os mais favoritados.
 */
export async function listSuggestedProducts(userId: string | null, take = 8) {
  if (userId) {
    const favs = await prisma.favorite.findMany({
      where: { userId },
      select: { productId: true, product: { select: { categoryId: true } } },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    const categoryIds = [...new Set(favs.map((f) => f.product.categoryId))];
    if (categoryIds.length) {
      const items = await prisma.product.findMany({
        where: {
          status: { in: LISTED_STATUSES },
          categoryId: { in: categoryIds },
          sellerId: { not: userId },
          id: { notIn: favs.map((f) => f.productId) },
        },
        orderBy: { publishedAt: "desc" },
        take,
        select: productCardSelect,
      });
      if (items.length) return items;
    }
  }
  return prisma.product.findMany({
    where: { status: { in: LISTED_STATUSES }, ...(userId ? { sellerId: { not: userId } } : {}) },
    orderBy: [{ favorites: { _count: "desc" } }, { publishedAt: "desc" }],
    take,
    select: productCardSelect,
  });
}

/** Página pública do produto. Rascunhos/pausados/removidos só aparecem para o dono. */
export async function getProductForPage(id: string, viewerId: string | null) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      ...productCardSelect,
      description: true,
      defects: true,
      color: true,
      shippingAvailable: true,
      localPickup: true,
      sellerId: true,
      categoryId: true,
      images: { select: { id: true, imageUrl: true, width: true, height: true }, orderBy: { position: "asc" } },
      category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      // Dados PÚBLICOS do vendedor apenas: nome, avatar, cidade, data de cadastro.
      seller: { select: { id: true, name: true, avatar: true, city: true, createdAt: true } },
      _count: { select: { favorites: true } },
    },
  });
  if (!product) return null;
  if (product.status === "RESERVED") {
    // Libera reservas vencidas sob demanda (o cron do plano gratuito da Vercel roda só 1x/dia).
    const { releaseExpiredReservations } = await import("@/features/orders/service");
    if ((await releaseExpiredReservations()) > 0) return getProductForPage(id, viewerId);
  }
  const isOwner = viewerId === product.sellerId;
  if (!PUBLIC_STATUSES.includes(product.status) && !isOwner) return null;

  const [rating, sold] = await Promise.all([
    prisma.review.aggregate({ where: { reviewedUserId: product.sellerId }, _avg: { rating: true }, _count: true }),
    prisma.product.count({ where: { sellerId: product.sellerId, status: "SOLD" } }),
  ]);
  const { sellerId: _s, ...rest } = product;
  void _s;
  return {
    ...rest,
    isOwner,
    seller: {
      ...product.seller,
      name: publicName(product.seller.name),
      rating: rating._avg.rating,
      ratingCount: rating._count,
      soldCount: sold,
    },
  };
}

/** "Maria Souza Lima" → "Maria S." — não expõe o nome completo publicamente. */
export function publicName(full: string) {
  const [first, ...rest] = full.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first;
}

export function listSimilarProducts(product: { id: string; categoryId: string }, take = 8) {
  return prisma.product.findMany({
    where: { status: { in: LISTED_STATUSES }, categoryId: product.categoryId, id: { not: product.id } },
    orderBy: { publishedAt: "desc" },
    take,
    select: productCardSelect,
  });
}

/** IDs favoritados pelo usuário dentre os informados (para pintar o coração nos cards). */
export async function favoritedIds(userId: string | null | undefined, productIds: string[]): Promise<Set<string>> {
  if (!userId || productIds.length === 0) return new Set();
  const rows = await prisma.favorite.findMany({ where: { userId, productId: { in: productIds } }, select: { productId: true } });
  return new Set(rows.map((r) => r.productId));
}

export function listCatalogOptions() {
  return Promise.all([
    prisma.category.findMany({
      where: { parentId: null, active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true, children: { where: { active: true }, orderBy: { position: "asc" }, select: { id: true, name: true, slug: true } } },
    }),
    prisma.brand.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
}
