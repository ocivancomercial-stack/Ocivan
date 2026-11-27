import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { MemoryStorageProvider, setStorage } from "@/services/storage";
import { SimulatedPaymentProvider, setPaymentProvider } from "@/services/payments";
import { createProduct } from "@/features/products/service";
import { addToCart, CartError } from "@/features/cart/service";
import { cancelOrderByBuyer, confirmReceipt, createOrderFromCart, createReview, getOrderForUser, markShipped, OrderError, releaseExpiredReservations } from "@/features/orders/service";
import { processPaymentNotification, startPayment } from "@/features/payments/service";
import { resetDatabase } from "../setup/db";
import { makeCatalog, makeUser, photo, productInput } from "../setup/fixtures";

setStorage(new MemoryStorageProvider());
const pay = new SimulatedPaymentProvider("segredo-teste");
setPaymentProvider(pay);

let seq = 0;
const notifyPayment = (paymentId: string) => processPaymentNotification(pay, { providerPaymentId: paymentId, eventKey: `evt-${++seq}` });

async function setup() {
  const cat = await makeCatalog();
  const seller = await makeUser("vendedor@t.dev");
  const buyer = await makeUser("comprador@t.dev");
  const address = await prisma.address.create({
    data: { userId: buyer.id, postalCode: "80010000", street: "Rua A", number: "1", neighborhood: "Centro", city: "Curitiba", state: "PR", isDefault: true },
  });
  const product = await createProduct(seller.id, productInput(cat.jaquetas.id, { price: 10000 }), [await photo()], "publish");
  return { cat, seller, buyer, address, product };
}

async function checkout(buyerId: string, sellerId: string, addressId: string) {
  return createOrderFromCart(buyerId, { sellerId, addressId, shippingOptionId: "sim-economico" });
}

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe("carrinho", () => {
  it("não permite comprar o próprio anúncio nem anúncio de exemplo", async () => {
    const { seller, product } = await setup();
    await expect(addToCart(seller.id, product.id)).rejects.toThrow(CartError);
    await prisma.product.update({ where: { id: product.id }, data: { isSample: true } });
    const other = await makeUser("x@t.dev");
    await expect(addToCart(other.id, product.id)).rejects.toThrow(/exemplo/);
  });
});

describe("checkout e reserva", () => {
  it("cria pedido com frete calculado no servidor, comissão de 12% e reserva a peça", async () => {
    const { seller, buyer, address, product } = await setup();
    await addToCart(buyer.id, product.id);
    const order = await checkout(buyer.id, seller.id, address.id);
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.subtotalCents).toBe(10000);
    expect(order.platformFeeCents).toBe(1200);
    expect(order.shippingPriceCents).toBeGreaterThan(0);
    expect(order.totalCents).toBe(10000 + order.shippingPriceCents);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe("RESERVED");
    expect(await prisma.productReservation.count({ where: { productId: product.id, status: "ACTIVE" } })).toBe(1);
    expect(await prisma.cartItem.count({ where: { userId: buyer.id } })).toBe(0);
  });

  it("recusa opção de frete inventada pelo navegador", async () => {
    const { seller, buyer, address, product } = await setup();
    await addToCart(buyer.id, product.id);
    await expect(createOrderFromCart(buyer.id, { sellerId: seller.id, addressId: address.id, shippingOptionId: "frete-gratis-hack" })).rejects.toThrow(OrderError);
  });

  it("recusa endereço de outra pessoa", async () => {
    const { seller, buyer, product } = await setup();
    const other = await makeUser("o@t.dev");
    const foreign = await prisma.address.create({ data: { userId: other.id, postalCode: "80010000", street: "B", number: "2", neighborhood: "C", city: "Curitiba", state: "PR" } });
    await addToCart(buyer.id, product.id);
    await expect(checkout(buyer.id, seller.id, foreign.id)).rejects.toThrow(/Endereço/);
  });

  it("dois compradores ao mesmo tempo: só um consegue reservar", async () => {
    const { seller, buyer, address, product } = await setup();
    const buyer2 = await makeUser("c2@t.dev");
    const address2 = await prisma.address.create({ data: { userId: buyer2.id, postalCode: "80010000", street: "B", number: "2", neighborhood: "C", city: "Curitiba", state: "PR" } });
    await addToCart(buyer.id, product.id);
    await addToCart(buyer2.id, product.id);
    const results = await Promise.allSettled([checkout(buyer.id, seller.id, address.id), checkout(buyer2.id, seller.id, address2.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("anúncio reservado/vendido não pode ser comprado novamente", async () => {
    const { seller, buyer, address, product } = await setup();
    const buyer2 = await makeUser("c2@t.dev");
    await addToCart(buyer.id, product.id);
    await addToCart(buyer2.id, product.id);
    await checkout(buyer.id, seller.id, address.id);
    await expect(addToCart(makeUserId(), product.id)).rejects.toThrow();
    const address2 = await prisma.address.create({ data: { userId: buyer2.id, postalCode: "80010000", street: "B", number: "2", neighborhood: "C", city: "Curitiba", state: "PR" } });
    await expect(checkout(buyer2.id, seller.id, address2.id)).rejects.toThrow(/Indisponível/);
  });

  it("reserva expirada libera a peça e cancela o pedido", async () => {
    const { seller, buyer, address, product } = await setup();
    await addToCart(buyer.id, product.id);
    const order = await checkout(buyer.id, seller.id, address.id);
    await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await releaseExpiredReservations()).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe("ACTIVE");
    expect(await prisma.productReservation.count({ where: { status: "ACTIVE" } })).toBe(0);
  });

  it("usa o prazo de reserva configurado", async () => {
    await prisma.platformSetting.create({ data: { key: "reservation_minutes", value: 30 } });
    const { seller, buyer, address, product } = await setup();
    await addToCart(buyer.id, product.id);
    const before = Date.now();
    const order = await checkout(buyer.id, seller.id, address.id);
    const minutes = (order.expiresAt!.getTime() - before) / 60000;
    expect(minutes).toBeGreaterThan(29.9);
    expect(minutes).toBeLessThan(30.1);
  });
});

function makeUserId() {
  return "inexistente";
}

describe("pagamento e webhooks", () => {
  async function pendingOrder() {
    const ctx = await setup();
    await addToCart(ctx.buyer.id, ctx.product.id);
    const order = await checkout(ctx.buyer.id, ctx.seller.id, ctx.address.id);
    const session = await startPayment(ctx.buyer.id, order.id, pay);
    if (session.kind !== "simulated") throw new Error();
    return { ...ctx, order, paymentId: session.providerPaymentId };
  }

  it("pagamento PENDENTE não libera o pedido", async () => {
    const { order, paymentId } = await pendingOrder();
    await notifyPayment(paymentId);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("PENDING_PAYMENT");
    expect(o.paymentStatus).toBe("PENDING");
  });

  it("aprovado no provedor → pedido pago, peça vendida, vendedor notificado", async () => {
    const { order, paymentId, product, seller } = await pendingOrder();
    await pay.setStatus(paymentId, "APPROVED");
    expect((await notifyPayment(paymentId)).result).toBe("paid");
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(o.status).toBe("PAID");
    expect(o.payments).toHaveLength(1);
    expect(o.payments[0]).toMatchObject({ status: "APPROVED", sellerAmountCents: 8800, isSimulated: true });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe("SOLD");
    expect(await prisma.notification.count({ where: { userId: seller.id } })).toBe(1);
  });

  it("webhook duplicado não duplica pagamento nem notificação", async () => {
    const { order, paymentId, seller } = await pendingOrder();
    await pay.setStatus(paymentId, "APPROVED");
    await processPaymentNotification(pay, { providerPaymentId: paymentId, eventKey: "evt-fixo" });
    const again = await processPaymentNotification(pay, { providerPaymentId: paymentId, eventKey: "evt-fixo" });
    expect(again.duplicate).toBe(true);
    await notifyPayment(paymentId); // mesmo pagamento, evento diferente: idempotente pelo estado do pedido
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: seller.id } })).toBe(1);
    expect(await prisma.webhookEvent.count()).toBe(2);
  });

  it("valor divergente no provedor nunca libera o pedido", async () => {
    const { order, paymentId } = await pendingOrder();
    await prisma.simulatedPayment.update({ where: { id: paymentId }, data: { status: "APPROVED", amountCents: 100 } });
    expect((await notifyPayment(paymentId)).result).toBe("ignored");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("assinatura de webhook inválida é recusada", async () => {
    const body = JSON.stringify({ paymentId: "x", eventId: "y" });
    expect(await pay.verifyWebhook({ headers: new Headers({ "x-simulated-signature": "falsa" }), body, url: "http://x" })).toBeNull();
    expect(await pay.verifyWebhook({ headers: new Headers({ "x-simulated-signature": pay.sign(body) }), body, url: "http://x" })).toEqual({ providerPaymentId: "x", eventKey: "y" });
  });

  it("pagamento aprovado após expiração é estornado automaticamente", async () => {
    const { order, paymentId } = await pendingOrder();
    await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await releaseExpiredReservations();
    await pay.setStatus(paymentId, "APPROVED");
    expect((await notifyPayment(paymentId)).result).toBe("refunded");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
    expect((await prisma.simulatedPayment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("REFUNDED");
  });

  it("chargeback coloca o pedido em disputa", async () => {
    const { order, paymentId } = await pendingOrder();
    await pay.setStatus(paymentId, "APPROVED");
    await notifyPayment(paymentId);
    await pay.setStatus(paymentId, "CHARGED_BACK");
    await notifyPayment(paymentId);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DISPUTED");
  });

  it("fluxo completo: envio, recebimento, avaliação; cancelamento após pago reembolsa e reativa a peça", async () => {
    const { order, paymentId, seller, buyer } = await pendingOrder();
    await pay.setStatus(paymentId, "APPROVED");
    await notifyPayment(paymentId);
    await expect(markShipped(buyer.id, order.id, "AA123456789BR")).rejects.toThrow(); // comprador não envia
    await markShipped(seller.id, order.id, "AA123456789BR");
    await expect(createReview(buyer.id, order.id, 5)).rejects.toThrow(/conclusão/);
    await confirmReceipt(buyer.id, order.id);
    await createReview(buyer.id, order.id, 5, "Ótimo!");
    await expect(createReview(buyer.id, order.id, 4)).rejects.toThrow(/já avaliou/);
    expect((await prisma.review.findFirstOrThrow()).reviewedUserId).toBe(seller.id);

    const second = await pendingOrder2(seller.id);
    await cancelOrderByBuyer(second.buyerId, second.orderId);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: second.orderId } })).status).toBe("REFUNDED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: second.productId } })).status).toBe("ACTIVE");
  });
});

async function pendingOrder2(sellerId: string) {
  const cat = await prisma.category.findFirstOrThrow({ where: { slug: "roupas-jaquetas" } });
  const buyer = await makeUser(`c${Date.now()}@t.dev`);
  const address = await prisma.address.create({ data: { userId: buyer.id, postalCode: "80010000", street: "B", number: "2", neighborhood: "C", city: "Curitiba", state: "PR" } });
  const product = await createProduct(sellerId, productInput(cat.id), [await photo()], "publish");
  await addToCart(buyer.id, product.id);
  const order = await createOrderFromCart(buyer.id, { sellerId, addressId: address.id, shippingOptionId: "sim-economico" });
  const s = await startPayment(buyer.id, order.id, pay);
  if (s.kind !== "simulated") throw new Error();
  await pay.setStatus(s.providerPaymentId, "APPROVED");
  await processPaymentNotification(pay, { providerPaymentId: s.providerPaymentId, eventKey: `x-${Date.now()}` });
  return { buyerId: buyer.id, orderId: order.id, productId: product.id };
}

describe("acesso a pedidos", () => {
  it("comprador não vê pedido de outro comprador; vendedor não vê pedido de outro vendedor", async () => {
    const { seller, buyer, address, product } = await setup();
    await addToCart(buyer.id, product.id);
    const order = await checkout(buyer.id, seller.id, address.id);
    const stranger = await makeUser("s@t.dev");
    const otherSeller = await makeUser("os@t.dev");
    expect(await getOrderForUser(order.id, { id: stranger.id, role: "USER" })).toBeNull();
    expect(await getOrderForUser(order.id, { id: otherSeller.id, role: "USER" })).toBeNull();
    expect((await getOrderForUser(order.id, { id: buyer.id, role: "USER" }))?.role).toBe("buyer");
    expect((await getOrderForUser(order.id, { id: seller.id, role: "USER" }))?.role).toBe("seller");
    expect((await getOrderForUser(order.id, { id: stranger.id, role: "ADMIN" }))?.role).toBe("admin");
    await expect(startPayment(stranger.id, order.id, pay)).rejects.toThrow(/não encontrado/);
    await expect(cancelOrderByBuyer(stranger.id, order.id)).rejects.toThrow(/não encontrado/);
  });
});
