import { randomInt } from "node:crypto";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getSetting } from "@/lib/settings";
import { DEFAULT_DIMENSIONS, getShippingProvider, ShippingError, type PackageItem } from "@/services/shipping";
import { getPaymentProvider } from "@/services/payments";
import { normalizeCpf } from "@/lib/cpf";
import { calculateOrderTotals } from "./pricing";
import { canTransition } from "./status";

export class OrderError extends Error {}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function orderCode() {
  return "RA-" + Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Cotação de frete para os itens de um vendedor até um endereço do comprador. */
export async function quoteShipping(buyerId: string, sellerId: string, addressId: string) {
  const [address, items, origin] = await Promise.all([
    prisma.address.findFirst({ where: { id: addressId, userId: buyerId } }),
    prisma.cartItem.findMany({
      where: { userId: buyerId, product: { sellerId } },
      select: { product: { select: { id: true, title: true, priceCents: true, city: true, weightGrams: true, localPickup: true, shippingAvailable: true, category: { select: { parent: { select: { slug: true } } } } } } },
    }),
    sellerOrigin(sellerId),
  ]);
  if (!address) throw new OrderError("Endereço inválido.");
  if (items.length === 0) throw new OrderError("Carrinho vazio para este vendedor.");
  const products = items.map((i) => i.product);
  const options = await getShippingProvider().quote({
    fromCity: products[0].city,
    fromPostalCode: origin?.postalCode,
    toCity: address.city,
    toPostalCode: address.postalCode,
    weightGrams: products.reduce((s, p) => s + p.weightGrams, 0),
    allowsLocalPickup: products.every((p) => p.localPickup),
    packages: products.map(toPackage),
  }).catch((e) => {
    if (e instanceof ShippingError) throw new OrderError(/endereço de envio/.test(e.message) ? "Este vendedor ainda não configurou o envio. Tente mais tarde." : "Não foi possível calcular o frete agora. Tente novamente.");
    throw e;
  });
  const canShip = products.every((p) => p.shippingAvailable);
  return options.filter((o) => o.kind === "local" || canShip);
}

function toPackage(p: { id: string; title: string; priceCents: number; weightGrams: number; category: { parent: { slug: string } | null } }): PackageItem {
  const dims = DEFAULT_DIMENSIONS[p.category.parent?.slug ?? "roupas"] ?? DEFAULT_DIMENSIONS.roupas;
  return { id: p.id, name: p.title, ...dims, weightGrams: p.weightGrams, valueCents: p.priceCents };
}

/** Endereço de origem do vendedor (endereço principal) — nunca exibido ao comprador. */
function sellerOrigin(sellerId: string) {
  return prisma.address.findFirst({ where: { userId: sellerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
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
  input: { sellerId: string; addressId: string; shippingOptionId: string; couponCode?: string; cpf?: string },
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

  if (getPaymentProvider().requiresSellerAccount) {
    const account = await prisma.sellerPaymentAccount.findUnique({ where: { userId: input.sellerId } });
    if (!account) throw new OrderError("Este vendedor ainda não habilitou o recebimento de pagamentos. Tente mais tarde.");
  }
  // Transportadoras exigem CPF do destinatário para emitir a etiqueta.
  if (getShippingProvider().supportsLabels && shipping.kind === "carrier") {
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: buyerId }, select: { cpf: true } });
    const cpf = buyer.cpf ?? (input.cpf ? normalizeCpf(input.cpf) : null);
    if (!cpf) throw new OrderError("Informe um CPF válido — a transportadora exige para emitir a etiqueta.");
    if (!buyer.cpf) await prisma.user.update({ where: { id: buyerId }, data: { cpf } });
  }

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


// ───────────── Etiquetas e rastreio (provedor de frete com etiquetas) ─────────────

const SHIPPING_STATUS_MAP: Record<string, "LABEL_GENERATED" | "POSTED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED" | "CANCELED"> = {
  released: "LABEL_GENERATED", generated: "LABEL_GENERATED", received: "POSTED", posted: "POSTED",
  delivered: "DELIVERED", undelivered: "RETURNED", canceled: "CANCELED", cancelled: "CANCELED", paused: "IN_TRANSIT", suspended: "IN_TRANSIT",
};

/** Vendedor gera a etiqueta do pedido pago (compra no provedor de frete pela conta da plataforma). */
export async function generateLabel(sellerId: string, orderId: string) {
  const provider = getShippingProvider();
  if (!provider.supportsLabels || !provider.createLabel) throw new OrderError("Geração de etiqueta indisponível. Informe o rastreio manualmente.");
  const order = await prisma.order.findFirst({
    where: { id: orderId, sellerId },
    include: {
      items: { include: { product: { select: { id: true, title: true, priceCents: true, weightGrams: true, category: { select: { parent: { select: { slug: true } } } } } } } },
      shipments: true, buyer: { select: { name: true, email: true, phone: true, cpf: true } }, seller: { select: { name: true, email: true, phone: true, cpf: true } },
    },
  });
  if (!order) throw new OrderError("Pedido não encontrado.");
  if (order.status !== "PAID") throw new OrderError("A etiqueta só pode ser gerada para pedidos pagos aguardando envio.");
  if (!order.shippingServiceId?.startsWith("me-")) throw new OrderError("Este pedido não usa envio por transportadora.");
  if (order.shipments.some((s) => s.labelUrl && s.status !== "CANCELED")) throw new OrderError("A etiqueta deste pedido já foi gerada.");
  if (!order.seller.cpf) throw new OrderError("Cadastre seu CPF no perfil para emitir etiquetas.");
  if (!order.buyer.cpf) throw new OrderError("O comprador não informou CPF. Contate o suporte.");
  const origin = await sellerOrigin(sellerId);
  if (!origin) throw new OrderError("Cadastre seu endereço de envio no perfil.");
  const to = order.shippingAddress as { recipient?: string | null; street: string; number: string; complement?: string | null; neighborhood: string; city: string; state: string; postalCode: string };

  const label = await provider.createLabel({
    orderCode: order.code,
    serviceId: order.shippingServiceId,
    from: { name: order.seller.name, phone: order.seller.phone, email: order.seller.email, document: order.seller.cpf, address: origin.street, number: origin.number, complement: origin.complement, district: origin.neighborhood, city: origin.city, stateAbbr: origin.state, postalCode: origin.postalCode },
    to: { name: to.recipient || order.buyer.name, phone: order.buyer.phone, email: order.buyer.email, document: order.buyer.cpf, address: to.street, number: to.number, complement: to.complement, district: to.neighborhood, city: to.city, stateAbbr: to.state, postalCode: to.postalCode },
    packages: order.items.map((i) => toPackage(i.product)),
  });
  await prisma.$transaction([
    prisma.shipment.create({
      data: {
        orderId, provider: provider.name, providerShipmentId: label.providerShipmentId, serviceName: order.shippingServiceName,
        trackingCode: label.trackingCode ?? null, labelUrl: label.labelUrl, status: "LABEL_GENERATED", shippingPriceCents: order.shippingPriceCents, isSimulated: label.isSimulated,
        events: { create: { status: "LABEL_GENERATED", description: label.isSimulated ? "Etiqueta gerada no SIMULADOR (não é etiqueta real)" : "Etiqueta gerada" } },
      },
    }),
    prisma.order.update({ where: { id: orderId }, data: { shippingStatus: "LABEL_GENERATED" } }),
  ]);
  await audit({ actorId: sellerId, action: "shipment.label", entityType: "order", entityId: orderId, metadata: { provider: provider.name, simulated: label.isSimulated } });
  return label;
}

/** Aplica atualização de status vinda do provedor de frete (webhook ou consulta). Idempotente. */
export async function applyShippingUpdate(providerShipmentId: string, providerStatus: string, trackingCode?: string | null) {
  const shipment = await prisma.shipment.findFirst({ where: { providerShipmentId }, include: { order: true } });
  if (!shipment) return "ignored" as const;
  const status = SHIPPING_STATUS_MAP[providerStatus];
  if (!status) return "ignored" as const;
  const order = shipment.order;
  if (shipment.status !== status || (trackingCode && trackingCode !== shipment.trackingCode)) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status, trackingCode: trackingCode ?? shipment.trackingCode, ...(shipment.status !== status ? { events: { create: { status, description: `Transportadora: ${providerStatus}` } } } : {}) },
    });
  }
  const now = new Date();
  if ((status === "POSTED" || status === "IN_TRANSIT") && order.status === "PAID") {
    await prisma.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "SHIPPED", shippingStatus: status, shippedAt: now } });
    await notify(order.buyerId, "Seu pedido foi postado", `Pedido ${order.code} a caminho${trackingCode ? ` — rastreio ${trackingCode}` : ""}.`, `/pedidos/${order.id}`);
  } else if (status === "DELIVERED" && ["PAID", "SHIPPED"].includes(order.status)) {
    await prisma.order.updateMany({ where: { id: order.id, status: { in: ["PAID", "SHIPPED"] } }, data: { status: "DELIVERED", shippingStatus: "DELIVERED", deliveredAt: now, ...(order.shippedAt ? {} : { shippedAt: now }) } });
    await notify(order.buyerId, "Pedido entregue", `Pedido ${order.code} entregue. Confirme o recebimento ou relate um problema.`, `/pedidos/${order.id}`);
  } else {
    await prisma.order.update({ where: { id: order.id }, data: { shippingStatus: status } });
  }
  return "updated" as const;
}

/** Consulta o rastreio no provedor (botão "Atualizar rastreio"). */
export async function refreshTracking(userId: string, orderId: string) {
  const provider = getShippingProvider();
  const order = await prisma.order.findFirst({ where: { id: orderId, OR: [{ sellerId: userId }, { buyerId: userId }] }, include: { shipments: true } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  const ids = order.shipments.filter((s) => s.provider === provider.name && s.providerShipmentId).map((s) => s.providerShipmentId!);
  if (!ids.length || !provider.track) return;
  const info = await provider.track(ids);
  for (const [id, t] of Object.entries(info)) await applyShippingUpdate(id, t.status, t.trackingCode);
}
