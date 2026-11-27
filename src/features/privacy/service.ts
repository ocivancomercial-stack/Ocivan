import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getStorage } from "@/services/storage";

export class PrivacyError extends Error {}

const OPEN_ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "DISPUTED"] as const;

/**
 * Exportação dos dados pessoais do titular (LGPD art. 18, II e V — acesso e portabilidade).
 * Inclui apenas dados do próprio usuário; de terceiros, só o mínimo do pedido (código, valores).
 * Nunca inclui hash de senha, tokens ou segredos.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerified: true, phone: true, cpf: true, city: true, state: true, avatar: true, role: true, termsAcceptedAt: true, createdAt: true, updatedAt: true },
  });
  const [addresses, products, favorites, purchases, sales, reviewsWritten, reviewsReceived, reports, notifications, sessions, dataRequests, paymentAccount] = await Promise.all([
    prisma.address.findMany({ where: { userId }, omit: { userId: true } }),
    prisma.product.findMany({ where: { sellerId: userId }, select: { id: true, title: true, description: true, defects: true, size: true, color: true, condition: true, priceCents: true, status: true, city: true, createdAt: true, publishedAt: true, soldAt: true, images: { select: { imageUrl: true } } } }),
    prisma.favorite.findMany({ where: { userId }, select: { productId: true, createdAt: true } }),
    prisma.order.findMany({ where: { buyerId: userId }, select: { code: true, status: true, subtotalCents: true, shippingPriceCents: true, discountCents: true, totalCents: true, shippingAddress: true, shippingServiceName: true, createdAt: true, paidAt: true, items: { select: { productTitleSnapshot: true, unitPriceCents: true } } } }),
    prisma.order.findMany({ where: { sellerId: userId }, select: { code: true, status: true, subtotalCents: true, platformFeeCents: true, createdAt: true, paidAt: true, items: { select: { productTitleSnapshot: true, unitPriceCents: true } } } }),
    prisma.review.findMany({ where: { reviewerId: userId }, select: { rating: true, comment: true, createdAt: true } }),
    prisma.review.findMany({ where: { reviewedUserId: userId }, select: { rating: true, comment: true, createdAt: true } }),
    prisma.report.findMany({ where: { reporterId: userId }, select: { productId: true, reason: true, description: true, status: true, createdAt: true } }),
    prisma.notification.findMany({ where: { userId }, select: { title: true, message: true, createdAt: true, readAt: true } }),
    prisma.session.findMany({ where: { userId }, select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } }),
    prisma.dataRequest.findMany({ where: { userId }, select: { type: true, status: true, createdAt: true, resolvedAt: true } }),
    prisma.sellerPaymentAccount.findUnique({ where: { userId }, select: { provider: true, providerUserId: true, createdAt: true } }),
  ]);
  await prisma.dataRequest.create({ data: { userId, type: "ACCESS", status: "DONE", resolvedAt: new Date(), details: "Exportação automática pelo titular" } });
  await audit({ actorId: userId, action: "privacy.export", entityType: "user", entityId: userId });
  return {
    exportedAt: new Date().toISOString(),
    notice: "Dados pessoais mantidos pelo Repassa Aí sobre você (LGPD art. 18). Senhas e tokens não são exportados.",
    user, addresses, products, favorites, purchases, sales, reviewsWritten, reviewsReceived, reports, notifications, sessions, dataRequests, paymentAccount,
  };
}

/**
 * Exclusão de conta (LGPD art. 18, VI) por ANONIMIZAÇÃO:
 *  - remove dados de contato, CPF, endereços, foto, favoritos, carrinho, notificações, sessões, senha e contas conectadas;
 *  - remove anúncios não vendidos (e suas fotos);
 *  - mantém pedidos concluídos sem identificação direta, pelo prazo das obrigações legais (fiscais/consumidor).
 * Recusada se houver pedido em andamento (como comprador ou vendedor).
 */
export async function deleteAccount(userId: string) {
  const open = await prisma.order.count({ where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: [...OPEN_ORDER_STATUSES] } } });
  if (open > 0) throw new PrivacyError("Você tem pedidos em andamento. Conclua ou cancele-os antes de excluir a conta.");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, avatar: true } });
  const removable = await prisma.product.findMany({ where: { sellerId: userId, status: { notIn: ["SOLD", "RESERVED"] } }, select: { id: true, images: { select: { storageKey: true } } } });
  const keys = removable.flatMap((p) => p.images.map((i) => i.storageKey));

  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: { in: removable.map((p) => p.id) } } });
    await tx.product.updateMany({ where: { id: { in: removable.map((p) => p.id) } }, data: { status: "REMOVED", isFeatured: false, description: "Anúncio removido.", defects: null } });
    await tx.favorite.deleteMany({ where: { userId } });
    await tx.cartItem.deleteMany({ where: { userId } });
    await tx.address.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.sellerPaymentAccount.deleteMany({ where: { userId } });
    await tx.verification.deleteMany({ where: { identifier: { contains: user.email } } });
    await tx.user.update({
      where: { id: userId },
      data: { name: "Conta excluída", email: `excluido-${userId}@removido.invalid`, emailVerified: false, phone: null, cpf: null, avatar: null, city: null, status: "DELETED" },
    });
    await tx.dataRequest.create({ data: { userId, type: "DELETION", status: "DONE", resolvedAt: new Date(), details: "Exclusão solicitada pelo titular (anonimização)" } });
  });
  const avatarKey = user.avatar?.match(/avatars\/[a-f0-9-]+\.webp$/)?.[0];
  await getStorage().remove([...keys, ...(avatarKey ? [avatarKey] : [])]);
  await audit({ actorId: null, action: "privacy.account_deleted", entityType: "user", entityId: userId, metadata: { removedProducts: removable.length } });
}
