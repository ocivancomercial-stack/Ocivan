import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import type { CheckoutSession, PaymentProvider, ProviderPayment, WebhookNotification } from "./index";

/**
 * Integração Mercado Pago Marketplace (Checkout Pro + OAuth).
 *
 * Fontes oficiais consultadas (nov/2026):
 *  - Webhooks: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *  - OAuth:    https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation
 *  - SDK oficial `mercadopago` 3.6.2 (endpoints, campos e validação HMAC do x-signature):
 *      POST /checkout/preferences/ · GET /v1/payments/{id} · POST /v1/payments/{id}/refunds
 *      POST /oauth/token (grant_type authorization_code | refresh_token)
 *      https://auth.mercadopago.com/authorization (response_type=code, platform_id=mp)
 *
 * Modelo: a preferência é criada com o access token do VENDEDOR (obtido via OAuth) e
 * `marketplace_fee` = comissão da plataforma. O Mercado Pago credita o vendedor e repassa a comissão
 * ao marketplace conforme as regras da conta (confirmar na homologação comercial).
 */
export type MercadoPagoConfig = {
  apiUrl: string; // https://api.mercadopago.com (ou o simulador)
  authUrl: string; // https://auth.mercadopago.com/authorization (ou o simulador)
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  appUrl: string;
  platformAccessToken?: string;
  testMode: boolean; // usa sandbox_init_point e test_token=true
  isMock: boolean;
  fetchImpl?: typeof fetch;
};

const STATUS_MAP: Record<string, PaymentStatus> = {
  pending: "PENDING",
  in_process: "PENDING",
  authorized: "AUTHORIZED",
  approved: "APPROVED",
  in_mediation: "IN_MEDIATION",
  rejected: "REJECTED",
  cancelled: "CANCELED",
  refunded: "REFUNDED",
  charged_back: "CHARGED_BACK",
};

export class MercadoPagoError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";
  readonly isSimulated: boolean;
  /** Pagamentos exigem que o vendedor tenha conectado a conta Mercado Pago. */
  readonly requiresSellerAccount = true;

  constructor(private cfg: MercadoPagoConfig) {
    this.isSimulated = cfg.isMock;
  }

  static fromEnv(): MercadoPagoProvider {
    const e = process.env;
    const required = ["MERCADOPAGO_CLIENT_ID", "MERCADOPAGO_CLIENT_SECRET", "MERCADOPAGO_WEBHOOK_SECRET"] as const;
    const missing = required.filter((k) => !e[k]);
    if (missing.length) throw new Error(`Mercado Pago sem configuração: ${missing.join(", ")}`);
    const apiUrl = (e.MERCADOPAGO_API_URL || "https://api.mercadopago.com").replace(/\/$/, "");
    return new MercadoPagoProvider({
      apiUrl,
      authUrl: e.MERCADOPAGO_AUTH_URL || "https://auth.mercadopago.com/authorization",
      clientId: e.MERCADOPAGO_CLIENT_ID!,
      clientSecret: e.MERCADOPAGO_CLIENT_SECRET!,
      webhookSecret: e.MERCADOPAGO_WEBHOOK_SECRET!,
      platformAccessToken: e.MERCADOPAGO_ACCESS_TOKEN || undefined,
      appUrl: (e.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
      testMode: e.MERCADOPAGO_TEST_MODE === "1",
      isMock: !apiUrl.startsWith("https://api.mercadopago.com"),
    });
  }

  private get fetch() {
    return this.cfg.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: { method?: string; token: string; body?: unknown; idempotencyKey?: string }): Promise<T> {
    const res = await this.fetch(`${this.cfg.apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${init.token}`,
        "Content-Type": "application/json",
        ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    if (!res.ok) {
      logger.error("mercadopago.http_error", { path: path.replace(/\d{6,}/g, ":id"), status: res.status });
      throw new MercadoPagoError(`Mercado Pago respondeu ${res.status}`, res.status);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  // ───────────── OAuth (conta do vendedor) ─────────────

  /** URL de autorização com state e PKCE (S256). Guarde `state` e `codeVerifier` em cookie httpOnly. */
  authorizationUrl(redirectUri: string) {
    const state = randomBytes(16).toString("hex");
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const url = new URL(this.cfg.authUrl);
    url.search = new URLSearchParams({
      client_id: this.cfg.clientId,
      response_type: "code",
      platform_id: "mp",
      state,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();
    return { url: url.toString(), state, codeVerifier };
  }

  private async tokenRequest(body: Record<string, string | boolean>) {
    const res = await this.fetch(`${this.cfg.apiUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.cfg.platformAccessToken ? { Authorization: `Bearer ${this.cfg.platformAccessToken}` } : {}) },
      body: JSON.stringify({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, ...body }),
    });
    if (!res.ok) throw new MercadoPagoError(`Falha na autorização do Mercado Pago (${res.status})`, res.status);
    return (await res.json()) as { access_token: string; refresh_token?: string; public_key?: string; user_id: number; expires_in?: number };
  }

  /** Troca o code pelo token e salva a conta do vendedor (tokens cifrados). */
  async connectSeller(userId: string, code: string, codeVerifier: string, redirectUri: string) {
    const t = await this.tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      ...(this.cfg.testMode ? { test_token: true } : {}),
    });
    const data = {
      provider: this.name,
      providerUserId: String(t.user_id),
      accessTokenEnc: encryptSecret(t.access_token),
      refreshTokenEnc: t.refresh_token ? encryptSecret(t.refresh_token) : null,
      publicKey: t.public_key ?? null,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
      isSimulated: this.isSimulated,
    };
    await prisma.sellerPaymentAccount.upsert({ where: { userId }, update: data, create: { ...data, userId } });
    return t.user_id;
  }

  /** Access token do vendedor, renovado automaticamente se estiver perto de expirar. */
  private async sellerToken(where: { userId?: string; providerUserId?: string }): Promise<string> {
    const acc = where.userId
      ? await prisma.sellerPaymentAccount.findUnique({ where: { userId: where.userId } })
      : await prisma.sellerPaymentAccount.findFirst({ where: { provider: this.name, providerUserId: where.providerUserId } });
    if (!acc || acc.provider !== this.name) throw new MercadoPagoError("Vendedor sem conta Mercado Pago conectada");
    const soon = Date.now() + 7 * 86400_000;
    if (acc.expiresAt && acc.expiresAt.getTime() < soon && acc.refreshTokenEnc) {
      const t = await this.tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(acc.refreshTokenEnc) });
      await prisma.sellerPaymentAccount.update({
        where: { id: acc.id },
        data: {
          accessTokenEnc: encryptSecret(t.access_token),
          refreshTokenEnc: t.refresh_token ? encryptSecret(t.refresh_token) : acc.refreshTokenEnc,
          expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : acc.expiresAt,
        },
      });
      return t.access_token;
    }
    return decryptSecret(acc.accessTokenEnc);
  }

  // ───────────── Checkout ─────────────

  async createCheckout(order: { id: string; code: string; totalCents: number; platformFeeCents: number; sellerId: string; title: string }): Promise<CheckoutSession> {
    const full = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, buyer: { select: { email: true, name: true } } } });
    const token = await this.sellerToken({ userId: order.sellerId });
    const base = this.cfg.appUrl;
    const items = full.items.map((i) => ({ id: i.productId, title: i.productTitleSnapshot.slice(0, 120), quantity: i.quantity, unit_price: i.unitPriceCents / 100, currency_id: "BRL" }));
    if (full.shippingPriceCents > 0) items.push({ id: "frete", title: `Frete — ${full.shippingServiceName ?? "envio"}`, quantity: 1, unit_price: full.shippingPriceCents / 100, currency_id: "BRL" });
    // Desconto (cupom) é abatido proporcionalmente no primeiro item para o total bater exatamente.
    if (full.discountCents > 0) items[0].unit_price = Math.round(items[0].unit_price * 100 - full.discountCents) / 100;

    const pref = await this.request<{ id: string; init_point?: string; sandbox_init_point?: string }>("/checkout/preferences/", {
      method: "POST",
      token,
      idempotencyKey: `pref-${order.id}`,
      body: {
        items,
        payer: { email: full.buyer.email },
        external_reference: order.id,
        marketplace_fee: order.platformFeeCents / 100,
        notification_url: `${base}/api/webhooks/payments/mercadopago`,
        back_urls: { success: `${base}/pedidos/${order.id}`, pending: `${base}/pedidos/${order.id}`, failure: `${base}/pedidos/${order.id}` },
        auto_return: "approved",
        binary_mode: false,
        expires: Boolean(full.expiresAt),
        ...(full.expiresAt ? { expiration_date_to: full.expiresAt.toISOString() } : {}),
        statement_descriptor: "REPASSAAI",
      },
    });
    const url = this.cfg.testMode ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point;
    if (!url) throw new MercadoPagoError("Preferência sem URL de pagamento");
    return { kind: "redirect", url, providerPreferenceId: pref.id };
  }

  // ───────────── Consulta (fonte da verdade) ─────────────

  async getPayment(providerPaymentId: string, hint?: { accountRef?: string }): Promise<ProviderPayment | null> {
    if (!/^\d{1,20}$/.test(providerPaymentId)) return null;
    let token: string;
    if (hint?.accountRef) token = await this.sellerToken({ providerUserId: hint.accountRef });
    else {
      const known = await prisma.payment.findFirst({ where: { provider: this.name, providerPaymentId }, select: { order: { select: { sellerId: true } } } });
      if (!known) throw new MercadoPagoError("Pagamento sem conta associada");
      token = await this.sellerToken({ userId: known.order.sellerId });
    }
    const p = await this.request<{ id: number; status: string; status_detail?: string; transaction_amount: number; external_reference?: string }>(
      `/v1/payments/${providerPaymentId}`,
      { token },
    );
    const status = STATUS_MAP[p.status];
    if (!status) logger.warn("mercadopago.unknown_status", { status: p.status });
    return {
      providerPaymentId: String(p.id),
      externalRef: p.external_reference ?? "",
      status: status ?? "PENDING",
      statusDetail: p.status_detail,
      amountCents: Math.round(p.transaction_amount * 100),
      raw: { id: p.id, status: p.status, status_detail: p.status_detail, transaction_amount: p.transaction_amount },
    };
  }

  // ───────────── Webhook ─────────────

  /**
   * Valida `x-signature` (ts=...,v1=...) recalculando HMAC-SHA256 do manifest
   * "id:{data.id};request-id:{x-request-id};ts:{ts};" com a assinatura secreta da aplicação.
   * Rejeita timestamps com mais de 5 minutos de diferença (anti-replay).
   */
  async verifyWebhook({ headers, body, url }: { headers: Headers; body: string; url: string }): Promise<WebhookNotification | "ignore" | null> {
    const xSignature = headers.get("x-signature") ?? "";
    const xRequestId = headers.get("x-request-id")?.trim() || undefined;
    const query = new URL(url).searchParams;
    const dataIdRaw = query.get("data.id") ?? undefined;
    const parts = Object.fromEntries(
      xSignature.split(",").map((p) => {
        const i = p.indexOf("=");
        return [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()];
      }),
    );
    if (!parts.ts || !/^\d+$/.test(parts.ts) || !parts.v1) return null;
    const dataId = dataIdRaw?.trim() || undefined; // igual ao SDK oficial: apenas trim
    const manifest = [dataId && `id:${dataId}`, xRequestId && `request-id:${xRequestId}`, `ts:${parts.ts}`].filter(Boolean).join(";") + ";";
    const expected = createHmac("sha256", this.cfg.webhookSecret).update(manifest).digest("hex");
    if (expected.length !== parts.v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))) return null;
    const tsSeconds = Number(parts.ts) > 1e12 ? Number(parts.ts) / 1000 : Number(parts.ts);
    if (Math.abs(Date.now() / 1000 - tsSeconds) > 300) return null;

    let payload: { type?: string; action?: string; user_id?: number | string; data?: { id?: string | number } };
    try {
      payload = JSON.parse(body);
    } catch {
      return null;
    }
    const type = payload.type ?? query.get("type");
    if (type !== "payment") return "ignore";
    const paymentId = String(payload.data?.id ?? dataIdRaw ?? "");
    if (!paymentId || (dataIdRaw && dataIdRaw !== paymentId)) return null;
    return {
      providerPaymentId: paymentId,
      eventKey: xRequestId ?? `${paymentId}:${parts.ts}:${payload.action ?? ""}`,
      accountRef: payload.user_id !== undefined ? String(payload.user_id) : undefined,
    };
  }

  // ───────────── Reembolso ─────────────

  async refund(providerPaymentId: string) {
    try {
      const known = await prisma.payment.findFirst({ where: { provider: this.name, providerPaymentId }, select: { order: { select: { sellerId: true } } } });
      if (!known) return { ok: false };
      const token = await this.sellerToken({ userId: known.order.sellerId });
      await this.request(`/v1/payments/${providerPaymentId}/refunds`, { method: "POST", token, body: {}, idempotencyKey: `refund-${providerPaymentId}` });
      return { ok: true };
    } catch (e) {
      logger.error("mercadopago.refund_failed", { error: String(e) });
      return { ok: false };
    }
  }

  /** Usado só pelos testes/simulador para gerar um webhook assinado corretamente. */
  static signWebhook(secret: string, dataId: string, requestId: string, ts = Math.floor(Date.now() / 1000)) {
    const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
    return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId };
  }
}

export const newRequestId = () => randomUUID();
