import { prisma } from "@/lib/db";

/** Categorias de primeiro nível ativas (Roupas, Tênis, Sapatos, Bolsas). */
export function listRootCategories() {
  return prisma.category.findMany({
    where: { parentId: null, active: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true, slug: true },
  });
}
