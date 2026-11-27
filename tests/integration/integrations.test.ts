import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.MOCK_PROVIDERS = "1";
process.env.MERCADOPAGO_CLIENT_ID = "1234567890";
process.env.MERCADOPAGO_CLIENT_SECRET = "mp-client-secret-teste";
process.env.MERCADOPAGO_WEBHOOK_SECRET = "mp-webhook-secret-teste";
process.env.MELHORENVIO_CLIENT_ID = "4321";
process.env.MELHORENVIO_CLIENT_SECRET = "me-client-secret-teste";

import { prisma } from "@/lib/db";
import { MemoryStorageProvider, setStorage } from "@/services/storage";
import { setPaymentProvider } from "@/services/payments";
import { MercadoPagoProvider } from "@/services/payments/mercadopago";
import { setShippingProvider } from "@/services/shipping";
import { MelhorEnvioProvider } from "@/services/shipping/melhorenvio";
import { buildMpWebhook, mpSetPaymentStatus, mpSimulatePayment } from "@/mocks/mercadopago";
import { buildMeWebhook, meAdvance, meGetOrder } from "@/mocks/melhorenvio";
import { getRecord } from "@/mocks/common";
import { createProduct } from "@/features/products/service";
import { addToCart } from "@/features/cart/service";
import { applyShippingUpdate, createOrderFromCart, generateLabel, quoteShipping } from "@/features/orders/service";
import { processPaymentNotification, refundOrder, startPayment } from "@/features/payments/service";
import { resetDatabase } from "../setup/db";
import { makeCatalog, makeUser, photo, productInput } from "../setup/fixtures";
import { createMockFetch, MOCK_BASE } from "../setup/mock-fetch";

const { impl: mockFetch, calls } = createMockFetch();
const mp = new MercadoPagoProvider({
  apiUrl: `${MOCK_BASE}/api/mock/mercadopago`, authUrl: `${MOCK_BASE}/api/mock/mercadopago/authorization`,
  clientId: process.env.MERCADOPAGO_CLIENT_ID!, clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET!, webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET!,
  appUrl: MOCK_BASE, testMode: true, isMock: true, fetchImpl: mockFetch,
});
const me = new MelhorEnvioProvider({
  apiUrl: `${MOCK_BASE}/api/mock/melhorenvio`, clientId: process.env.MELHORENVIO_CLIENT_ID!, clientSecret: process.env.MELHORENVIO_CLIENT_SECRET!,
  userAgent: "Repassa Ai Testes (teste@repassaai.dev)", isMock: true, fetchImpl: mockFetch,
});
setStorage(new MemoryStorageProvider());
setPaymentProvider(mp);
setShippingProvider(me);
const REDIRECT = `${MOCK_BASE}/api/integrations/mercadopago/callback`;

async function followAuthorize(url: string) {
  const res = await mockFetch(url, { redirect: "manual" });
  const loc = new URL(res.headers.get("location")!);
  return { code: loc.searchParams.get("code")!, state: loc.searchParams.get("state") };
}

async function connectSeller(userId: string) {
  const a = mp.authorizationUrl(REDIRECT);
  const { code, state } = await followAuthorize(a.url);
  expect(state).toBe(a.state);
  await mp.connectSeller(userId, code, a.codeVerifier, REDIRECT);
}

async function connectPlatformShipping(adminId: string) {
  const { code } = await followAuthorize(me.authorizationUrl(`${MOCK_BASE}/cb`, "s1"));
  await me.connect(code, `${MOCK_BASE}/cb`, adminId);
}

async function scenario(opts: { buyerCpf?: string | null } = {}) {
  const cat = await makeCatalog();
  const seller = await prisma.user.create({ data: { name: "Vera Vendedora", email: "v@t.dev", cpf: "52998224725", phone: "41988887777", city: "Curitiba" } });
  const buyer = await prisma.user.create({ data: { name: "Clara Compradora", email: "c@t.dev", cpf: opts.buyerCpf === undefined ? "11144477735" : opts.buyerCpf, city: "Colombo" } });
  const admin = await makeUser("adm@t.dev");
  await prisma.address.create({ data: { userId: seller.id, postalCode: "80010000", street: "Rua XV", number: "10", neighborhood: "Centro", city: "Curitiba", state: "PR", isDefault: true } });
  const address = await prisma.address.create({ data: { userId: buyer.id, postalCode: "83402000", street: "Rua B", number: "20", neighborhood: "Centro", city: "Colombo", state: "PR", isDefault: true } });
  const product = await createProduct(seller.id, productInput(cat.jaquetas.id, { price: 10000 }), [await photo()], "publish");
  await connectSeller(seller.id);
  await connectPlatformShipping(admin.id);
  await addToCart(buyer.id, product.id);
  return { seller, buyer, admin, address, product };
}

beforeAll(() => {
  // webhooks reais disparados pelos simuladores não têm servidor nos testes; os testes os entregam explicitamente.
});
beforeEach(async () => {
  await resetDatabase();
  calls.length = 0;
});
afterAll(() => prisma.$disconnect());

describe("Mercado Pago — OAuth do vendedor", () => {
  it("conecta com PKCE e guarda tokens CIFRADOS", async () => {
    const u = await makeUser("s@t.dev");
    await connectSeller(u.id);
    const acc = await prisma.sellerPaymentAccount.findUniqueOrThrow({ where: { userId: u.id } });
    expect(acc.provider).toBe("mercadopago");
    expect(acc.accessTokenEnc).not.toContain("APP_USR");
    expect(acc.isSimulated).toBe(true);
    const tokenCall = calls.find((c) => c.path.endsWith("/oauth/token"))!;
    expect(JSON.parse(tokenCall.body!)).toMatchObject({ grant_type: "authorization_code", redirect_uri: REDIRECT, test_token: true });
  });

  it("recusa code_verifier errado (PKCE)", async () => {
    const u = await makeUser("s@t.dev");
    const a = mp.authorizationUrl(REDIRECT);
    const { code } = await followAuthorize(a.url);
    await expect(mp.connectSeller(u.id, code, "verifier-errado-".repeat(4), REDIRECT)).rejects.toThrow();
  });

  it("checkout é bloqueado se o vendedor não conectou a conta", async () => {
    const cat = await makeCatalog();
    const seller = await makeUser("v@t.dev");
    const buyer = await prisma.user.create({ data: { name: "C C", email: "c@t.dev", cpf: "11144477735" } });
    const admin = await makeUser("a@t.dev");
    await prisma.address.create({ data: { userId: seller.id, postalCode: "80010000", street: "R", number: "1", neighborhood: "C", city: "Curitiba", state: "PR" } });
    const addr = await prisma.address.create({ data: { userId: buyer.id, postalCode: "80010000", street: "R", number: "1", neighborhood: "C", city: "Curitiba", state: "PR" } });
    const p = await createProduct(seller.id, productInput(cat.jaquetas.id), [await photo()], "publish");
    await connectPlatformShipping(admin.id);
    await addToCart(buyer.id, p.id);
    await expect(createOrderFromCart(buyer.id, { sellerId: seller.id, addressId: addr.id, shippingOptionId: "me-1" })).rejects.toThrow(/habilitou/);
  });
});

describe("Melhor Envio — cotação", () => {
  it("cota pela API (User-Agent, CEPs, medidas em cm, peso em kg) e descarta serviços com erro", async () => {
    const { buyer, seller, address } = await scenario();
    const options = await quoteShipping(buyer.id, seller.id, address.id);
    expect(options.map((o) => o.name)).toEqual(expect.arrayContaining(["Jadlog .Package", "Correios PAC", "Correios SEDEX"]));
    expect(options.find((o) => o.id === "me-17")).toBeUndefined(); // "Mini Envios" voltou com erro
    const call = calls.find((c) => c.path.endsWith("/shipment/calculate"))!;
    expect(call.headers.get("user-agent")).toContain("@");
    const body = JSON.parse(call.body!);
    expect(body.from.postal_code).toBe("80010000");
    expect(body.to.postal_code).toBe("83402000");
    expect(body.products[0]).toMatchObject({ width: 25, height: 5, length: 30, weight: 0.5, insurance_value: 100, quantity: 1 });
  });

  it("exige CPF do comprador para frete por transportadora", async () => {
    const { buyer, seller, address } = await scenario({ buyerCpf: null });
    await expect(createOrderFromCart(buyer.id, { sellerId: seller.id, addressId: address.id, shippingOptionId: "me-1" })).rejects.toThrow(/CPF/);
    await expect(createOrderFromCart(buyer.id, { sellerId: seller.id, addressId: address.id, shippingOptionId: "me-1", cpf: "123.456.789-00" })).rejects.toThrow(/CPF/);
    const order = await createOrderFromCart(buyer.id, { sellerId: seller.id, addressId: address.id, shippingOptionId: "me-1", cpf: "111.444.777-35" });
    expect(order.shippingServiceId).toBe("me-1");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).cpf).toBe("11144477735");
  });
});

describe("fluxo completo com as integrações reais contra os simuladores", () => {
  async function paidOrder() {
    const ctx = await scenario();
    const order = await createOrderFromCart(ctx.buyer.id, { sellerId: ctx.seller.id, addressId: ctx.address.id, shippingOptionId: "me-1" });
    const session = await startPayment(ctx.buyer.id, order.id);
    if (session.kind !== "redirect") throw new Error("esperava redirect");
    const pay = await mpSimulatePayment(session.providerPreferenceId, "approved");
    const hook = buildMpWebhook(`${MOCK_BASE}/api/webhooks/payments/mercadopago`, pay.paymentId, (await prisma.sellerPaymentAccount.findFirstOrThrow()).providerUserId as unknown as number, "payment.created");
    const verified = await mp.verifyWebhook({ headers: new Headers(hook.headers), body: hook.body, url: hook.url });
    if (!verified || verified === "ignore") throw new Error("webhook inválido");
    await processPaymentNotification(mp, verified, JSON.parse(hook.body));
    return { ...ctx, order, session, paymentId: pay.paymentId, hook };
  }

  it("preferência criada com token do vendedor, marketplace_fee = comissão e total exato", async () => {
    const { order, session } = await paidOrder();
    expect(session.kind === "redirect" && session.url).toContain("/simulador/mercadopago/checkout/");
    const pref = await getRecord<{ body: { items: { unit_price: number; quantity: number }[]; marketplace_fee: number; external_reference: string; notification_url: string } }>("mercadopago", "preference", session.kind === "redirect" ? session.providerPreferenceId : "");
    expect(pref!.body.marketplace_fee).toBe(12);
    expect(pref!.body.external_reference).toBe(order.id);
    expect(pref!.body.notification_url).toBe(`${MOCK_BASE}/api/webhooks/payments/mercadopago`);
    const total = pref!.body.items.reduce((s, i) => s + Math.round(i.unit_price * 100) * i.quantity, 0);
    expect(total).toBe(order.totalCents);
    const prefCall = calls.find((c) => c.path.endsWith("/checkout/preferences/"))!;
    expect(prefCall.headers.get("x-idempotency-key")).toBe(`pref-${order.id}`);
  });

  it("webhook assinado → consulta GET /v1/payments → pedido PAGO", async () => {
    const { order } = await paidOrder();
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(o.status).toBe("PAID");
    expect(o.payments[0]).toMatchObject({ provider: "mercadopago", status: "APPROVED", isSimulated: true });
    expect(calls.some((c) => c.method === "GET" && /\/v1\/payments\/\d+$/.test(c.path))).toBe(true);
  });

  it("assinatura adulterada, segredo errado ou timestamp antigo são recusados", async () => {
    const { hook, paymentId } = await paidOrder();
    const headers = new Headers(hook.headers);
    headers.set("x-signature", headers.get("x-signature")!.replace(/v1=.{4}/, "v1=0000"));
    expect(await mp.verifyWebhook({ headers, body: hook.body, url: hook.url })).toBeNull();
    const other = new URL(hook.url);
    other.searchParams.set("data.id", "999");
    expect(await mp.verifyWebhook({ headers: new Headers(hook.headers), body: hook.body, url: other.toString() })).toBeNull();
    const old = MercadoPagoProvider.signWebhook(process.env.MERCADOPAGO_WEBHOOK_SECRET!, String(paymentId), "req-1", Math.floor(Date.now() / 1000) - 3600);
    expect(await mp.verifyWebhook({ headers: new Headers(old), body: hook.body, url: hook.url })).toBeNull();
    const wrong = MercadoPagoProvider.signWebhook("segredo-errado", String(paymentId), "req-2");
    expect(await mp.verifyWebhook({ headers: new Headers(wrong), body: hook.body, url: hook.url })).toBeNull();
  });

  it("webhook repetido (mesmo x-request-id) é ignorado", async () => {
    const { hook } = await paidOrder();
    const v = await mp.verifyWebhook({ headers: new Headers(hook.headers), body: hook.body, url: hook.url });
    if (!v || v === "ignore") throw new Error();
    expect((await processPaymentNotification(mp, v)).duplicate).toBe(true);
  });

  it("pagamento pendente (Pix) não libera; recusado não libera", async () => {
    const ctx = await scenario();
    const order = await createOrderFromCart(ctx.buyer.id, { sellerId: ctx.seller.id, addressId: ctx.address.id, shippingOptionId: "me-1" });
    const s = await startPayment(ctx.buyer.id, order.id);
    if (s.kind !== "redirect") throw new Error();
    for (const outcome of ["pending", "rejected"] as const) {
      const pay = await mpSimulatePayment(s.providerPreferenceId, outcome);
      const acc = await prisma.sellerPaymentAccount.findFirstOrThrow();
      const hook = buildMpWebhook(`${MOCK_BASE}/x`, pay.paymentId, Number(acc.providerUserId), "payment.created");
      const v = await mp.verifyWebhook({ headers: new Headers(hook.headers), body: hook.body, url: hook.url });
      if (!v || v === "ignore") throw new Error();
      await processPaymentNotification(mp, v);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    }
  });

  it("etiqueta: carrinho → compra → geração → impressão, com CPF e endereços corretos", async () => {
    const { order, seller } = await paidOrder();
    const label = await generateLabel(seller.id, order.id);
    expect(label.labelUrl).toContain("/simulador/melhorenvio/etiqueta/");
    expect(calls.filter((c) => c.path.includes("/api/v2/me/")).map((c) => c.path.split("/api/v2/me/")[1])).toEqual(
      expect.arrayContaining(["cart", "shipment/checkout", "shipment/generate", "shipment/print"]),
    );
    const cart = JSON.parse(calls.find((c) => c.path.endsWith("/api/v2/me/cart"))!.body!);
    expect(cart).toMatchObject({ service: 1, from: { document: "52998224725", postal_code: "80010000" }, to: { document: "11144477735", postal_code: "83402000" }, options: { non_commercial: true, insurance_value: 100 } });
    await expect(generateLabel(seller.id, order.id)).rejects.toThrow(/já foi gerada/);
  });

  it("webhooks do Melhor Envio: postado → ENVIADO, entregue → ENTREGUE; assinatura inválida recusada", async () => {
    const { order, seller } = await paidOrder();
    const label = await generateLabel(seller.id, order.id);
    for (const expected of ["SHIPPED", "DELIVERED"]) {
      await meAdvance(label.providerShipmentId);
      const o = await meGetOrder(label.providerShipmentId);
      const hook = buildMeWebhook(o!, `order.${o!.status}`);
      const ev = me.verifyWebhook({ headers: new Headers(hook.headers), body: hook.body });
      expect(ev).not.toBeNull();
      await applyShippingUpdate(ev!.providerShipmentId, ev!.status, ev!.trackingCode);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(expected);
    }
    expect((await prisma.shipment.findFirstOrThrow({ where: { orderId: order.id } })).trackingCode).toMatch(/^ME\d+BR$/);
    expect(me.verifyWebhook({ headers: new Headers({ "x-me-signature": "falsa" }), body: "{}" })).toBeNull();
  });

  it("reembolso: estorno no Mercado Pago com idempotência e cancelamento da etiqueta não postada", async () => {
    const { order, seller, admin, paymentId } = await paidOrder();
    const label = await generateLabel(seller.id, order.id);
    await refundOrder(order.id, admin.id, "Teste");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
    expect((await getRecord<{ status: string }>("mercadopago", "payment", String(paymentId)))!.status).toBe("refunded");
    expect(calls.find((c) => c.path.endsWith("/refunds"))!.headers.get("x-idempotency-key")).toBe(`refund-${paymentId}`);
    expect((await meGetOrder(label.providerShipmentId))!.status).toBe("canceled");
  });

  it("chargeback informado pelo Mercado Pago abre disputa", async () => {
    const { order, paymentId } = await paidOrder();
    await mpSetPaymentStatus(paymentId, "charged_back");
    const acc = await prisma.sellerPaymentAccount.findFirstOrThrow();
    const hook = buildMpWebhook(`${MOCK_BASE}/x`, paymentId, Number(acc.providerUserId), "payment.updated");
    const v = await mp.verifyWebhook({ headers: new Headers(hook.headers), body: hook.body, url: hook.url });
    if (!v || v === "ignore") throw new Error();
    await processPaymentNotification(mp, v);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DISPUTED");
  });

  it("um vendedor não consegue consultar pagamento de outro vendedor no provedor", async () => {
    const { paymentId } = await paidOrder();
    const intruso = await makeUser("intruso@t.dev");
    await connectSeller(intruso.id);
    const acc = await prisma.sellerPaymentAccount.findUniqueOrThrow({ where: { userId: intruso.id } });
    await expect(mp.getPayment(String(paymentId), { accountRef: acc.providerUserId })).rejects.toThrow(/403/);
  });
});
