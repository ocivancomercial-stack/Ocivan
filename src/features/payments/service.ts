import { Prisma, type PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { getPaymentProvider, type PaymentProvider, type ProviderPayment } from "@/services/payments";
import { OrderError } from "@/features/orders/service";

/** Inicia (ou retoma) o pagamento de um pedido pendente do próprio comprador. */
export async function startPayment(buyerId: string, orderId: string, provider: PaymentProvider = getPaymentProvider()) {
  const order = await prisma.order.findFirst({ where: { id: orderId, buyerId }, include: { items: { take: 1 } } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  if (order.status !== "PENDING_PAYMENT") throw new OrderError("Este pedido não está aguardando pagamento.");
  if (order.expiresAt && order.expiresAt < new Date()) throw new OrderError("O prazo de pagamento expirou.");

  const session = await provider.createCheckout({
    id: order.id, code: order.code, totalCents: order.totalCents, platformFeeCents: order.platformFeeCents, sellerId: order.sellerId,
    title: order.items[0]?.productTitleSnapshot ?? `Pedido ${order.code}`,
  });
  const providerPaymentId = session.kind === "simulated" ? session.providerPaymentId : null;
  const existing = await prisma.payment.findFirst({ where: { orderId, provider: provider.name, status: "PENDING" } });
  if (!existing) {
    await prisma.payment.create({
      data: {
        orderId, provider: provider.name, providerPaymentId, providerPreferenceId: session.kind === "redirect" ? session.providerPreferenceId : null,
        status: "PENDING", amountCents: order.totalCents, platformFeeCents: order.platformFeeCents,
        sellerAmountCents: order.subtotalCents - order.platformFeeCents, isSimulated: provider.isSimulated,
      },
    });
  }
  return session;
}

/**
 * Processa uma notificação de pagamento (webhook).
 *  1. Registra o evento com chave única → evento duplicado é ignorado (idempotência).
 *  2. CONSULTA O PROVEDOR para obter o estado real (nunca confia no corpo do webhook nem no navegador).
 *  3. Confere valor e pedido; atualiza pagamento e pedido em transação.
 */
export async function processPaymentNotification(
  provider: PaymentProvider,
  notification: { providerPaymentId: string; eventKey: string; accountRef?: string },
  payload: Prisma.InputJsonValue = {},
) {
  try {
    await prisma.webhookEvent.create({
      data: { provider: provider.name, eventKey: notification.eventKey, resourceId: notification.providerPaymentId, payload },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { duplicate: true as const };
    throw e;
  }

  try {
    const remote = await provider.getPayment(notification.providerPaymentId, { accountRef: notification.accountRef });
    if (!remote) throw new Error("Pagamento não encontrado no provedor");
    const result = await applyProviderPayment(provider, remote);
    await prisma.webhookEvent.update({
      where: { provider_eventKey: { provider: provider.name, eventKey: notification.eventKey } },
      data: { status: result === "ignored" ? "IGNORED" : "PROCESSED", processedAt: new Date(), type: remote.status },
    });
    return { duplicate: false as const, result };
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { provider_eventKey: { provider: provider.name, eventKey: notification.eventKey } },
      data: { status: "FAILED", error: String(error).slice(0, 500) },
    });
    logger.error("payment.webhook_failed", { provider: provider.name, error: String(error) });
    throw error;
  }
}

async function applyProviderPayment(provider: PaymentProvider, remote: ProviderPayment) {
  const order = await prisma.order.findUnique({ where: { id: remote.externalRef } });
  if (!order) return "ignored" as const;

  // Valor divergente do pedido: nunca libera (proteção contra adulteração).
  if (remote.status === "APPROVED" && remote.amountCents !== order.totalCents) {
    logger.error("payment.amount_mismatch", { orderId: order.id, expected: order.totalCents, got: remote.amountCents });
    await audit({ action: "payment.amount_mismatch", entityType: "order", entityId: order.id, metadata: { expected: order.totalCents, got: remote.amountCents } });
    return "ignored" as const;
  }

  const payment = await upsertPayment(provider, order, remote);

  if (remote.status === "APPROVED") return onApproved(provider, order.id, payment.id, remote);
  if (remote.status === "REJECTED" || remote.status === "CANCELED") {
    await prisma.order.updateMany({ where: { id: order.id, status: "PENDING_PAYMENT" }, data: { paymentStatus: remote.status } });
    return "updated" as const;
  }
  if (remote.status === "REFUNDED" || remote.status === "CHARGED_BACK") {
    await prisma.order.updateMany({ where: { id: order.id }, data: { paymentStatus: remote.status } });
    if (remote.status === "CHARGED_BACK") {
      await prisma.order.updateMany({ where: { id: order.id, status: { in: ["PAID", "SHIPPED", "DELIVERED", "COMPLETED"] } }, data: { status: "DISPUTED" } });
      await audit({ action: "payment.chargeback", entityType: "order", entityId: order.id });
    }
    return "updated" as const;
  }
  // PENDING / AUTHORIZED / IN_MEDIATION: registra, mas NÃO libera o pedido.
  await prisma.order.updateMany({ where: { id: order.id, status: "PENDING_PAYMENT" }, data: { paymentStatus: remote.status } });
  return "updated" as const;
}

async function upsertPayment(provider: PaymentProvider, order: { id: string; totalCents: number; platformFeeCents: number; subtotalCents: number }, remote: ProviderPayment) {
  const data = {
    status: remote.status as PaymentStatus,
    statusDetail: remote.statusDetail ?? null,
    rawLastPayload: (remote.raw ?? {}) as Prisma.InputJsonValue,
    ...(remote.status === "APPROVED" ? { approvedAt: new Date() } : {}),
  };
  const existing =
    (await prisma.payment.findUnique({ where: { provider_providerPaymentId: { provider: provider.name, providerPaymentId: remote.providerPaymentId } } })) ??
    (await prisma.payment.findFirst({ where: { orderId: order.id, provider: provider.name, providerPaymentId: null } }));
  if (existing) return prisma.payment.update({ where: { id: existing.id }, data: { ...data, providerPaymentId: remote.providerPaymentId } });
  return prisma.payment.create({
    data: {
      ...data, orderId: order.id, provider: provider.name, providerPaymentId: remote.providerPaymentId, amountCents: remote.amountCents,
      platformFeeCents: order.platformFeeCents, sellerAmountCents: order.subtotalCents - order.platformFeeCents, isSimulated: provider.isSimulated,
    },
  });
}

async function onApproved(provider: PaymentProvider, orderId: string, paymentId: string, remote: ProviderPayment) {
  const outcome = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status !== "PENDING_PAYMENT") return order.status === "CANCELED" ? ("late" as const) : ("already" as const);
    const now = new Date();
    await tx.order.update({ where: { id: orderId }, data: { status: "PAID", paymentStatus: "APPROVED", paidAt: now } });
    const productIds = order.items.map((i) => i.productId);
    await tx.productReservation.updateMany({ where: { orderId, status: "ACTIVE" }, data: { status: "CONVERTED" } });
    await tx.product.updateMany({ where: { id: { in: productIds } }, data: { status: "SOLD", soldAt: now } });
    await tx.cartItem.deleteMany({ where: { productId: { in: productIds } } });
    return "paid" as const;
  });

  if (outcome === "paid") {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await notify(order.sellerId, "Você vendeu! 🎉", `Pedido ${order.code} pago. Prepare o envio.`, `/pedidos/${orderId}`);
    await notify(order.buyerId, "Pagamento confirmado", `Pedido ${order.code} confirmado. Avisaremos quando for enviado.`, `/pedidos/${orderId}`);
    await audit({ action: "payment.approved", entityType: "order", entityId: orderId, metadata: { paymentId } });
    return "paid" as const;
  }
  if (outcome === "late") {
    // Pagamento aprovado depois que o pedido expirou: a peça pode ter sido vendida a outra pessoa → reembolso automático.
    const refund = await provider.refund(remote.providerPaymentId);
    if (refund.ok) {
      await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
      await prisma.order.update({ where: { id: orderId }, data: { status: "REFUNDED", paymentStatus: "REFUNDED" } });
    }
    await audit({ action: "payment.late_auto_refund", entityType: "order", entityId: orderId, metadata: { ok: refund.ok } });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await notify(order.buyerId, "Pagamento estornado", `O pedido ${order.code} havia expirado; o valor será devolvido.`, `/pedidos/${orderId}`);
    return "refunded" as const;
  }
  return "ignored" as const;
}

/** Reembolso de pedido PAGO ainda não enviado (cancelamento pelo comprador ou admin). Peças voltam à venda. */
export async function refundOrder(orderId: string, actorId: string, reason: string, provider: PaymentProvider = getPaymentProvider()) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, payments: { where: { status: "APPROVED" } } } });
  if (!order || !["PAID", "DISPUTED"].includes(order.status)) throw new OrderError("Este pedido não pode ser reembolsado agora.");
  const payment = order.payments[0];
  if (!payment?.providerPaymentId) throw new OrderError("Pagamento aprovado não encontrado.");
  const res = await provider.refund(payment.providerPaymentId);
  if (!res.ok) throw new OrderError("O provedor recusou o reembolso. Tente novamente ou contate o suporte.");
  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } }),
    prisma.order.update({ where: { id: orderId }, data: { status: "REFUNDED", paymentStatus: "REFUNDED", canceledAt: new Date(), cancelReason: reason } }),
    prisma.product.updateMany({ where: { id: { in: order.items.map((i) => i.productId) }, status: "SOLD" }, data: { status: "ACTIVE", soldAt: null } }),
  ]);
  // Etiqueta comprada e ainda não postada: cancela no provedor de frete (melhor esforço).
  const { getShippingProvider } = await import("@/services/shipping");
  const shipping = getShippingProvider();
  const labels = await prisma.shipment.findMany({ where: { orderId, provider: shipping.name, status: "LABEL_GENERATED", providerShipmentId: { not: null } } });
  for (const l of labels) {
    const r = shipping.cancelLabel ? await shipping.cancelLabel(l.providerShipmentId!, `Pedido ${order.code} cancelado`) : { ok: false };
    await prisma.shipment.update({ where: { id: l.id }, data: { status: r.ok ? "CANCELED" : l.status, events: { create: { status: r.ok ? "CANCELED" : l.status, description: r.ok ? "Etiqueta cancelada" : "Falha ao cancelar etiqueta — verificar manualmente" } } } });
  }
  await notify(order.sellerId, "Pedido cancelado e reembolsado", `Pedido ${order.code}: ${reason}. O anúncio voltou a ficar ativo.`, `/pedidos/${orderId}`);
  await notify(order.buyerId, "Reembolso solicitado", `Pedido ${order.code}: o estorno segue os prazos do meio de pagamento.`, `/pedidos/${orderId}`);
  await audit({ actorId, action: "order.refund", entityType: "order", entityId: orderId, metadata: { reason } });
}
