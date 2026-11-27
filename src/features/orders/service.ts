import { randomInt } from "node:crypto";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getSetting } from "@/lib/settings";
import { getShippingProvider } from "@/services/shipping";
import { calculateOrderTotals } from "./pricing";
import { canTransition } from "./status";

export class OrderError extends Error {}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function orderCode() {
  return "RA-" + Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Cotação de frete para os itens de um vendedor até um endereço do comprador. */
export async function quoteShipping(buyerId: string, sellerId: string, addressId: string) {
  const [address, items] = await Promise.all([
    prisma.address.findFirst({ where: { id: addressId, userId: buyerId } }),
    prisma.cartItem.findMany({ where: { userId: buyerId, product: { sellerId } }, select: { product: { select: { city: true, weightGrams: true, localPickup: true, shippingAvailable: true } } } }),
  ]);
  if (!address) throw new OrderError("Endereço inválido.");
  if (items.length === 0) throw new OrderError("Carrinho vazio para este vendedor.");
  const products = items.map((i) => i.product);
  const options = await getShippingProvider().quote({
    fromCity: products[0].city,
    toCity: address.city,
    toPostalCode: address.postalCode,
    weightGrams: products.reduce((s, p) => s + p.weightGrams, 0),
    allowsLocalPickup: products.every((p) => p.localPickup),
  });
  const canShip = products.every((p) => p.shippingAvailable);
  return options.filter((o) => o.kind === "local" || canShip);
}

/** Libera reservas vencidas: pedido cancelado, peça volta a ficar ativa. Idempotente. */
export async function releaseExpiredReservations(now = new Date()) {
  const expired = await prisma.order.findMany({ where: { status: "PENDING_PAYMENT", expiresAt: { lt: now } }, select: { id: true } });
  for (const { id } of expired) await cancelPendingOrder(id, "Prazo de pagamento expirou", null);
  return expired.length;
}

async function cancelPendingOrder(orderId: string, reason: string, actorId: string | null) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELED", paymentStatus: "CANCELED", canceledAt: new Date(), cancelReason: reason },
    });
    if (count === 0) return; // já mudou de estado (ex.: pagamento aprovado) — nada a fazer
    const reservations = await tx.productReservation.findMany({ where: { orderId, status: "ACTIVE" }, select: { id: true, productId: true } });
    await tx.productReservation.updateMany({ where: { orderId, status: "ACTIVE" }, data: { status: actorId ? "RELEASED" : "EXPIRED" } });
    await tx.product.updateMany({ where: { id: { in: reservations.map((r) => r.productId) }, status: "RESERVED" }, data: { status: "ACTIVE" } });
  });
  await audit({ actorId, action: "order.cancel_pending", entityType: "order", entityId: orderId, metadata: { reason } });
}

/**
 * Cria o pedido a partir do carrinho de UM vendedor, reservando as peças.
 * Em uma transação com bloqueio de linha (SELECT … FOR UPDATE):
 *  - confirma que todas as peças estão ATIVAS (nunca vende anúncio vendido/reservado);
 *  - recalcula frete e valores no servidor (não confia em valores do navegador);
 *  - cria reservas (índice único parcial impede reserva dupla) e marca as peças como RESERVADAS.
 */
export async function createOrderFromCart(
  buyerId: string,
  input: { sellerId: string; addressId: string; shippingOptionId: string; couponCode?: string },
) {
  await releaseExpiredReservations();
  const [address, options, feeBps, minutes] = await Promise.all([
    prisma.address.findFirst({ where: { id: input.addressId, userId: buyerId } }),
    quoteShipping(buyerId, input.sellerId, input.addressId),
    getSetting("platform_fee_bps"),
    getSetting("reservation_minutes"),
  ]);
  if (!address) throw new OrderError("Endereço inválido.");
  const shipping = options.find((o) => o.id === input.shippingOptionId);
  if (!shipping) throw new OrderError("Escolha uma forma de entrega válida.");

  const coupon = input.couponCode
    ? await prisma.coupon.findFirst({
        where: { code: input.couponCode.trim().toUpperCase(), active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      })
    : null;
  if (input.couponCode && !coupon) throw new OrderError("Cupom inválido ou expirado.");
  if (coupon?.maxUses != null && coupon.usedCount >= coupon.maxUses) throw new OrderError("Cupom esgotado.");

  const expiresAt = new Date(Date.now() + minutes * 60_000);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cartItem.findMany({ where: { userId: buyerId, product: { sellerId: input.sellerId } }, select: { productId: true } });
      if (cart.length === 0) throw new OrderError("Carrinho vazio para este vendedor.");
      const ids = cart.map((c) => c.productId);

      // Bloqueia as linhas dos produtos até o fim da transação (corrida entre dois compradores).
      await tx.$queryRaw`SELECT id FROM "products" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, priceCents: true, status: true, sellerId: true, isSample: true, images: { take: 1, orderBy: { position: "asc" }, select: { imageUrl: true } } },
      });
      const unavailable = products.filter((p) => p.status !== "ACTIVE" || p.isSample || p.sellerId !== input.sellerId || p.sellerId === buyerId);
      if (unavailable.length || products.length !== ids.length)
        throw new OrderError(`Indisponível: ${unavailable.map((p) => p.title).join(", ") || "item removido"}. Remova do carrinho para continuar.`);

      const totals = calculateOrderTotals({
        itemPricesCents: products.map((p) => p.priceCents),
        shippingCents: shipping.priceCents,
        feeBps,
        coupon,
      });

      let created;
      for (let attempt = 0; ; attempt++) {
        try {
          created = await tx.order.create({
            data: {
              code: orderCode(),
              buyerId,
              sellerId: input.sellerId,
              addressId: address.id,
              shippingAddress: {
                recipient: address.recipient, postalCode: address.postalCode, street: address.street, number: address.number,
                complement: address.complement, neighborhood: address.neighborhood, city: address.city, state: address.state,
              },
              subtotalCents: totals.subtotalCents,
              shippingPriceCents: totals.shippingPriceCents,
              discountCents: totals.discountCents,
              platformFeeCents: totals.platformFeeCents,
              platformFeeBps: totals.platformFeeBps,
              totalCents: totals.totalCents,
              couponId: totals.discountCents > 0 ? coupon?.id : null,
              shippingServiceId: shipping.id,
              shippingServiceName: shipping.name,
              expiresAt,
              items: {
                create: products.map((p) => ({
                  productId: p.id, productTitleSnapshot: p.title, productImageSnapshot: p.images[0]?.imageUrl, unitPriceCents: p.priceCents, quantity: 1,
                })),
              },
            },
          });
          break;
        } catch (e) {
          if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target).includes("code")) continue;
          throw e;
        }
      }

      await tx.productReservation.createMany({ data: ids.map((productId) => ({ productId, userId: buyerId, orderId: created.id, expiresAt })) });
      await tx.product.updateMany({ where: { id: { in: ids } }, data: { status: "RESERVED" } });
      await tx.cartItem.deleteMany({ where: { userId: buyerId, productId: { in: ids } } });
      if (created.couponId) await tx.coupon.update({ where: { id: created.couponId }, data: { usedCount: { increment: 1 } } });
      return created;
    });
    await audit({ actorId: buyerId, action: "order.create", entityType: "order", entityId: order.id, metadata: { total: order.totalCents } });
    return order;
  } catch (e) {
    // Violação do índice único de reserva ativa = outra pessoa reservou no mesmo instante.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new OrderError("Alguém acabou de reservar este produto. Tente outro.");
    throw e;
  }
}

/** Pedido visível apenas para comprador, vendedor ou admin. */
export async function getOrderForUser(orderId: string, user: { id: string; role: string }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      shipments: { include: { events: { orderBy: { occurredAt: "desc" } } }, orderBy: { createdAt: "desc" } },
      reviews: true,
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
    },
  });
  if (!order) return null;
  const role = order.buyerId === user.id ? "buyer" : order.sellerId === user.id ? "seller" : user.role === "ADMIN" ? "admin" : null;
  if (!role) return null;
  return { order, role } as const;
}

async function transition(orderId: string, from: OrderStatus[], to: OrderStatus, data: Prisma.OrderUpdateManyMutationInput = {}) {
  for (const f of from) if (!canTransition(f, to)) throw new Error(`Transição inválida ${f}→${to}`);
  const { count } = await prisma.order.updateMany({ where: { id: orderId, status: { in: from } }, data: { status: to, ...data } });
  if (count === 0) throw new OrderError("O pedido mudou de situação. Atualize a página.");
}

export async function cancelOrderByBuyer(buyerId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, buyerId } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  if (order.status === "PENDING_PAYMENT") return cancelPendingOrder(orderId, "Cancelado pelo comprador", buyerId);
  if (order.status === "PAID") {
    const { refundOrder } = await import("@/features/payments/service");
    return refundOrder(orderId, buyerId, "Cancelado pelo comprador antes do envio");
  }
  throw new OrderError("Depois do envio, use \"Tenho um problema\" para abrir uma disputa.");
}

/** Vendedor informa o envio (código de rastreio). Etiqueta automática: Etapa 5. */
export async function markShipped(sellerId: string, orderId: string, trackingCode: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, sellerId } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  const code = trackingCode.trim().toUpperCase();
  const isLocal = order.shippingServiceId === "local-pickup";
  if (!isLocal && !/^[A-Z0-9-]{8,30}$/.test(code)) throw new OrderError("Informe um código de rastreio válido.");
  await transition(orderId, ["PAID"], "SHIPPED", { shippingStatus: isLocal ? "IN_TRANSIT" : "POSTED", shippedAt: new Date() });
  await prisma.shipment.create({
    data: {
      orderId, provider: "manual", serviceName: order.shippingServiceName, trackingCode: isLocal ? null : code,
      status: isLocal ? "IN_TRANSIT" : "POSTED", shippingPriceCents: order.shippingPriceCents,
      events: { create: { status: isLocal ? "IN_TRANSIT" : "POSTED", description: isLocal ? "Entrega combinada iniciada pelo vendedor" : "Postado pelo vendedor" } },
    },
  });
  await notify(order.buyerId, "Seu pedido foi enviado", `Pedido ${order.code} a caminho${isLocal ? "" : ` — rastreio ${code}`}.`, `/pedidos/${orderId}`);
  await audit({ actorId: sellerId, action: "order.ship", entityType: "order", entityId: orderId });
}

/** Comprador confirma o recebimento → pedido concluído. */
export async function confirmReceipt(buyerId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, buyerId } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  const now = new Date();
  if (order.status === "SHIPPED") await transition(orderId, ["SHIPPED"], "DELIVERED", { shippingStatus: "DELIVERED", deliveredAt: now });
  await transition(orderId, ["DELIVERED"], "COMPLETED", { completedAt: now });
  await prisma.shipment.updateMany({ where: { orderId }, data: { status: "DELIVERED" } });
  await notify(order.sellerId, "Venda concluída", `O comprador confirmou o recebimento do pedido ${order.code}.`, `/pedidos/${orderId}`);
  await audit({ actorId: buyerId, action: "order.complete", entityType: "order", entityId: orderId });
}

export async function openDispute(buyerId: string, orderId: string, reason: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, buyerId } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  if (reason.trim().length < 10) throw new OrderError("Descreva o problema com pelo menos 10 caracteres.");
  await transition(orderId, ["PAID", "SHIPPED", "DELIVERED"], "DISPUTED");
  await prisma.dispute.create({ data: { orderId, openedById: buyerId, reason: reason.trim().slice(0, 1000) } });
  await notify(order.sellerId, "Disputa aberta", `O comprador relatou um problema no pedido ${order.code}.`, `/pedidos/${orderId}`);
  await audit({ actorId: buyerId, action: "order.dispute", entityType: "order", entityId: orderId });
}

/** Avaliação após pedido concluído. Comprador avalia vendedor e vice-versa; uma por pessoa por pedido. */
export async function createReview(userId: string, orderId: string, rating: number, comment?: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new OrderError("Nota de 1 a 5.");
  const order = await prisma.order.findFirst({ where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  if (order.status !== "COMPLETED") throw new OrderError("Avaliação disponível após a conclusão do pedido.");
  const reviewedUserId = order.buyerId === userId ? order.sellerId : order.buyerId;
  try {
    await prisma.review.create({ data: { orderId, reviewerId: userId, reviewedUserId, rating, comment: comment?.trim().slice(0, 500) || null } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new OrderError("Você já avaliou este pedido.");
    throw e;
  }
}
