import { prisma } from "@/lib/db";
import { PUBLIC_STATUSES } from "@/features/products/status";
import { productCardSelect } from "@/features/products/queries";

/** Alterna o favorito. Só permite favoritar anúncios visíveis publicamente. Retorna o novo estado. */
export async function toggleFavorite(userId: string, productId: string): Promise<boolean> {
  const existing = await prisma.favorite.findUnique({ where: { userId_productId: { userId, productId } } });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return false;
  }
  const product = await prisma.product.findFirst({ where: { id: productId, status: { in: PUBLIC_STATUSES } }, select: { id: true } });
  if (!product) throw new Error("Anúncio indisponível");
  // upsert: idempotente sob duplo clique / requisições concorrentes.
  await prisma.favorite.upsert({ where: { userId_productId: { userId, productId } }, update: {}, create: { userId, productId } });
  return true;
}

export function listFavorites(userId: string) {
  return prisma.favorite.findMany({
    where: { userId, product: { status: { not: "REMOVED" } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, product: { select: productCardSelect } },
  });
}
