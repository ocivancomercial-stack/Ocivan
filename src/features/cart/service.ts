import { prisma } from "@/lib/db";
import { productCardSelect } from "@/features/products/queries";

export class CartError extends Error {}

/** Peças únicas: quantidade sempre 1. Não permite o próprio anúncio nem anúncio indisponível. */
export async function addToCart(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { sellerId: true, status: true, isSample: true } });
  if (!product || product.status !== "ACTIVE") throw new CartError("Este produto não está mais disponível.");
  if (product.isSample) throw new CartError("Anúncio de exemplo — não está à venda.");
  if (product.sellerId === userId) throw new CartError("Você não pode comprar o próprio anúncio.");
  await prisma.cartItem.upsert({ where: { userId_productId: { userId, productId } }, update: {}, create: { userId, productId, quantity: 1 } });
  return product.sellerId;
}

export async function removeFromCart(userId: string, productId: string) {
  await prisma.cartItem.deleteMany({ where: { userId, productId } });
}

/** Carrinho agrupado por vendedor (cada grupo vira um pedido separado). */
export async function getCart(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      product: { select: { ...productCardSelect, sellerId: true, shippingAvailable: true, localPickup: true, seller: { select: { name: true } } } },
    },
  });
  const groups = new Map<string, { sellerId: string; sellerName: string; items: typeof items }>();
  for (const item of items) {
    const g = groups.get(item.product.sellerId) ?? { sellerId: item.product.sellerId, sellerName: item.product.seller.name, items: [] };
    g.items.push(item);
    groups.set(item.product.sellerId, g);
  }
  return [...groups.values()];
}

export function cartCount(userId: string) {
  return prisma.cartItem.count({ where: { userId } });
}
