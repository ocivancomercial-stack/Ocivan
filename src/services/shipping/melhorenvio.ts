import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { findCity } from "@/lib/regions";
import {
  ShippingError, localPickupOption, type LabelInput, type LabelResult, type ShippingOption, type ShippingProvider,
  type ShippingQuoteInput, type ShippingWebhookEvent, type TrackingInfo,
} from "./index";

/**
 * Integração Melhor Envio (API v2).
 *
 * Fontes oficiais consultadas (nov/2026) — https://docs.melhorenvio.com.br (OpenAPI das páginas de referência):
 *  POST /api/v2/me/shipment/calculate · POST /api/v2/me/cart · POST /api/v2/me/shipment/checkout
 *  POST /api/v2/me/shipment/generate · POST /api/v2/me/shipment/print · POST /api/v2/me/shipment/tracking
 *  POST /api/v2/me/shipment/cancel (reason_id "2") · POST /oauth/token
 *  Cabeçalho User-Agent obrigatório (nome da aplicação + e-mail de contato).
 *  Webhook: cabeçalho X-ME-Signature = HMAC-SHA256 (base64) do corpo com o secret do aplicativo.
 *  Token: access_token 30 dias, refresh_token 45 dias.
 *
 * Modelo: a PLATAFORMA tem uma conta Melhor Envio (conectada no admin) que compra as etiquetas
 * com saldo da carteira; o frete é pago pelo comprador no pedido.
 */
export type MelhorEnvioConfig = {
  apiUrl: string; // https://sandbox.melhorenvio.com.br | https://melhorenvio.com.br | simulador
  clientId: string;
  clientSecret: string;
  userAgent: string;
  isMock: boolean;
  staticToken?: string; // alternativa ao OAuth (token pessoal gerado no painel)
  fetchImpl?: typeof fetch;
};

export const MELHORENVIO_SCOPES = ["shipping-calculate", "cart-write", "shipping-checkout", "shipping-generate", "shipping-print", "shipping-tracking", "shipping-cancel"];

export class MelhorEnvioError extends ShippingError {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const reais = (cents: number) => Math.round(cents) / 100;

export class MelhorEnvioProvider implements ShippingProvider {
  readonly name = "melhorenvio";
  readonly isSimulated: boolean;
  readonly supportsLabels = true;

  constructor(private cfg: MelhorEnvioConfig) {
    this.isSimulated = cfg.isMock;
  }

  static fromEnv() {
    const e = process.env;
    if (!e.MELHORENVIO_CLIENT_ID || !e.MELHORENVIO_CLIENT_SECRET) throw new Error("Melhor Envio sem configuração: MELHORENVIO_CLIENT_ID, MELHORENVIO_CLIENT_SECRET");
    const apiUrl = (e.MELHORENVIO_API_URL || (e.MELHORENVIO_SANDBOX === "1" ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br")).replace(/\/$/, "");
    return new MelhorEnvioProvider({
      apiUrl,
      clientId: e.MELHORENVIO_CLIENT_ID,
      clientSecret: e.MELHORENVIO_CLIENT_SECRET,
      userAgent: e.MELHORENVIO_USER_AGENT || "Repassa Ai (suporte@repassaai.com.br)",
      staticToken: e.MELHORENVIO_TOKEN || undefined,
      isMock: !/^https:\/\/(sandbox\.)?melhorenvio\.com\.br$/.test(apiUrl),
    });
  }

  private get fetch() {
    return this.cfg.fetchImpl ?? fetch;
  }

  // ───────────── OAuth (conta da plataforma) ─────────────

  authorizationUrl(redirectUri: string, state: string) {
    const q = new URLSearchParams({ client_id: this.cfg.clientId, redirect_uri: redirectUri, response_type: "code", state, scope: MELHORENVIO_SCOPES.join(" ") });
    return `${this.cfg.apiUrl}/oauth/authorize?${q}`;
  }

  private async tokenRequest(body: Record<string, string | number>) {
    const res = await this.fetch(`${this.cfg.apiUrl}/oauth/token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": this.cfg.userAgent },
      body: JSON.stringify({ client_id: Number(this.cfg.clientId) || this.cfg.clientId, client_secret: this.cfg.clientSecret, ...body }),
    });
    if (!res.ok) throw new MelhorEnvioError(`Falha na autorização do Melhor Envio (${res.status})`, res.status);
    return (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  }

  async connect(code: string, redirectUri: string, adminId: string) {
    const t = await this.tokenRequest({ grant_type: "authorization_code", redirect_uri: redirectUri, code });
    const data = {
      accessTokenEnc: encryptSecret(t.access_token),
      refreshTokenEnc: t.refresh_token ? encryptSecret(t.refresh_token) : null,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
      scope: MELHORENVIO_SCOPES.join(" "),
      connectedById: adminId,
    };
    await prisma.integrationCredential.upsert({ where: { provider: this.name }, update: data, create: { provider: this.name, ...data } });
  }

  private async token(): Promise<string> {
    if (this.cfg.staticToken) return this.cfg.staticToken;
    const cred = await prisma.integrationCredential.findUnique({ where: { provider: this.name } });
    if (!cred) throw new MelhorEnvioError("Conta Melhor Envio da plataforma não conectada (Admin › Integrações)");
    if (cred.expiresAt && cred.expiresAt.getTime() < Date.now() + 5 * 86400_000 && cred.refreshTokenEnc) {
      const t = await this.tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(cred.refreshTokenEnc) });
      await prisma.integrationCredential.update({
        where: { provider: this.name },
        data: { accessTokenEnc: encryptSecret(t.access_token), refreshTokenEnc: t.refresh_token ? encryptSecret(t.refresh_token) : cred.refreshTokenEnc, expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : cred.expiresAt },
      });
      return t.access_token;
    }
    return decryptSecret(cred.accessTokenEnc);
  }

  private async api<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetch(`${this.cfg.apiUrl}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${await this.token()}`, "User-Agent": this.cfg.userAgent },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      logger.error("melhorenvio.http_error", { path, status: res.status, body: text.slice(0, 300) });
      throw new MelhorEnvioError(`Melhor Envio respondeu ${res.status}`, res.status);
    }
    return JSON.parse(text) as T;
  }

  // ───────────── Cotação ─────────────

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    if (!/^\d{8}$/.test(input.toPostalCode)) throw new MelhorEnvioError("CEP inválido");
    if (!input.fromPostalCode) throw new MelhorEnvioError("O vendedor ainda não cadastrou o endereço de envio.");
    const res = await this.api<Array<{ id: number; name: string; price?: string; custom_price?: string; delivery_time?: number; custom_delivery_time?: number; error?: string; company?: { name?: string } }>>(
      "/api/v2/me/shipment/calculate",
      {
        from: { postal_code: input.fromPostalCode },
        to: { postal_code: input.toPostalCode },
        products: input.packages.map((p) => ({
          id: p.id, width: p.widthCm, height: p.heightCm, length: p.lengthCm, weight: p.weightGrams / 1000, insurance_value: reais(p.valueCents), quantity: 1,
        })),
        options: { receipt: false, own_hand: false },
      },
    );
    const options: ShippingOption[] = res
      .filter((s) => !s.error && (s.custom_price ?? s.price))
      .map((s) => ({
        id: `me-${s.id}`,
        name: [s.company?.name, s.name].filter(Boolean).join(" "),
        priceCents: Math.round(Number(s.custom_price ?? s.price) * 100),
        estimatedDays: s.custom_delivery_time ?? s.delivery_time ?? 10,
        isSimulated: this.isSimulated,
        kind: "carrier" as const,
      }))
      .sort((a, b) => a.priceCents - b.priceCents);
    if (input.allowsLocalPickup && findCity(input.toCity)) options.unshift(localPickupOption());
    return options;
  }

  // ───────────── Etiqueta: carrinho → compra → geração → impressão ─────────────

  async createLabel(input: LabelInput): Promise<LabelResult> {
    const service = Number(input.serviceId.replace(/^me-/, ""));
    if (!Number.isInteger(service)) throw new MelhorEnvioError("Serviço de frete inválido para etiqueta");
    const party = (p: LabelInput["from"]) => ({
      name: p.name, phone: p.phone ?? undefined, email: p.email ?? undefined, document: p.document,
      address: p.address, complement: p.complement ?? undefined, number: p.number, district: p.district,
      city: p.city, country_id: "BR", postal_code: p.postalCode, state_abbr: p.stateAbbr,
    });
    const value = input.packages.reduce((s, p) => s + p.valueCents, 0);
    const volume = {
      width: Math.max(...input.packages.map((p) => p.widthCm)),
      length: Math.max(...input.packages.map((p) => p.lengthCm)),
      height: input.packages.reduce((s, p) => s + p.heightCm, 0),
      weight: input.packages.reduce((s, p) => s + p.weightGrams, 0) / 1000,
    };
    const cart = await this.api<{ id: string; protocol?: string }>("/api/v2/me/cart", {
      service,
      from: party(input.from),
      to: party(input.to),
      products: input.packages.map((p) => ({ name: p.name.slice(0, 100), quantity: "1", unitary_value: reais(p.valueCents).toFixed(2) })),
      volumes: [volume],
      options: {
        insurance_value: reais(value), receipt: false, own_hand: false, reverse: false,
        non_commercial: true, // venda entre pessoas físicas: declaração de conteúdo (sem nota fiscal)
        platform: "Repassa Aí",
        tags: [{ tag: input.orderCode }],
      },
    });
    await this.api("/api/v2/me/shipment/checkout", { orders: [cart.id] });
    await this.api("/api/v2/me/shipment/generate", { orders: [cart.id] });
    const print = await this.api<{ url: string }>("/api/v2/me/shipment/print", { mode: "public", orders: [cart.id] });
    const tracking = await this.track([cart.id]).catch(() => ({}) as Record<string, TrackingInfo>);
    return { providerShipmentId: cart.id, protocol: cart.protocol, labelUrl: print.url, trackingCode: tracking[cart.id]?.trackingCode ?? null, isSimulated: this.isSimulated };
  }

  async track(ids: string[]): Promise<Record<string, TrackingInfo>> {
    const res = await this.api<Record<string, { status: string; tracking?: string | null; melhorenvio_tracking?: string | null }>>("/api/v2/me/shipment/tracking", { orders: ids });
    return Object.fromEntries(Object.entries(res).map(([id, t]) => [id, { status: t.status, trackingCode: t.tracking ?? t.melhorenvio_tracking ?? null }]));
  }

  async cancelLabel(id: string, reason: string) {
    try {
      await this.api("/api/v2/me/shipment/cancel", { order: { id, reason_id: "2", description: reason.slice(0, 200) } });
      return { ok: true };
    } catch (e) {
      logger.warn("melhorenvio.cancel_failed", { error: String(e) });
      return { ok: false };
    }
  }

  // ───────────── Webhook ─────────────

  verifyWebhook({ headers, body }: { headers: Headers; body: string }): ShippingWebhookEvent | null {
    const signature = headers.get("x-me-signature") ?? "";
    const expected = createHmac("sha256", this.cfg.clientSecret).update(body).digest("base64");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
      const p = JSON.parse(body) as { event?: string; data?: { id?: string; status?: string; tracking?: string | null } };
      if (!p.event?.startsWith("order.") || !p.data?.id || !p.data.status) return null;
      return { eventKey: `${p.data.id}:${p.event}:${p.data.status}`, providerShipmentId: p.data.id, status: p.data.status, trackingCode: p.data.tracking ?? null };
    } catch {
      return null;
    }
  }

  static sign(secret: string, body: string) {
    return createHmac("sha256", secret).update(body).digest("base64");
  }
}
