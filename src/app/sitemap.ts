import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const revalidate = 3600;

/** Sitemap: páginas públicas + anúncios ativos reais (exemplos fictícios ficam de fora). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE", isSample: false }, select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 45000 }),
    prisma.category.findMany({ where: { active: true }, select: { slug: true, parentId: true } }),
  ]);
  const staticPages = ["", "/explorar", "/buscar", "/termos", "/privacidade", "/cookies", "/reembolso", "/anuncios-proibidos", "/suporte"];
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.5 })),
    ...categories.map((c) => ({ url: `${base}/buscar?${c.parentId ? "subcategoria" : "categoria"}=${c.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/produto/${p.id}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
