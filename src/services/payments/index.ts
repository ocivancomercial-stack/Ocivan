import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Estado do pagamento segundo o PROVEDOR — a única fonte de verdade para liberar um pedido. */
export type ProviderPayment = {
  providerPaymentId: string;
  externalRef: string; // id do pedido
  status: PaymentStatus;
  statusDetail?: string;
  amountCents: number;
  raw?: unknown;
};

export type WebhookNotification = { providerPaymentId: string; eventKey: string; accountRef?: string };

export type CheckoutSession =
  | { kind: "redirect"; url: string; providerPreferenceId: string }
  | { kind: "simulated"; providerPaymentId: string };

export interface PaymentProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  /** true quando o vendedor precisa conectar a própria conta no provedor para receber. */
  readonly requiresSellerAccount?: boolean;
  createCheckout(order: { id: string; code: string; totalCents: number; platformFeeCents: number; sellerId: string; title: string }): Promise<CheckoutSession>;
  /** `accountRef`: conta (vendedor) dona do pagamento no provedor, quando conhecida (ex.: user_id do webhook). */
  getPayment(providerPaymentId: string, hint?: { accountRef?: string }): Promise<ProviderPayment | null>;
  /**
   * Valida a autenticidade do webhook. Retorna o id do pagamento, uma chave única do evento
   * e (opcional) a conta dona do pagamento. `null` = inválido; `"ignore"` = evento autêntico que não nos interessa.
   */
  verifyWebhook(req: { headers: Headers; body: string; url: string }): Promise<WebhookNotification | "ignore" | null>;
  refund(providerPaymentId: string): Promise<{ ok: boolean }>;
}

/**
 * Provedor de pagamento SIMULADO (desenvolvimento/homologação).
 * Guarda o "estado do provedor" em `simulated_payments`. Nunca disponível com APP_ENV=production.
 * Webhooks assinados com HMAC-SHA256 — exercita o mesmo caminho de verificação do provedor real.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";
  readonly isSimulated = true;
  constructor(private secret = process.env.BETTER_AUTH_SECRET ?? "dev") {}

  async createCheckout(order: { id: string; totalCents: number }): Promise<CheckoutSession> {
    const existing = await prisma.simulatedPayment.findFirst({ where: { externalRef: order.id, status: "PENDING" } });
    const sp = existing ?? (await prisma.simulatedPayment.create({ data: { externalRef: order.id, amountCents: order.totalCents } }));
    return { kind: "simulated", providerPaymentId: sp.id };
  }

  async getPayment(id: string): Promise<ProviderPayment | null> {
    const sp = await prisma.simulatedPayment.findUnique({ where: { id } });
    return sp && { providerPaymentId: sp.id, externalRef: sp.externalRef, status: sp.status, amountCents: sp.amountCents, raw: { simulated: true } };
  }

  sign(body: string) {
    return createHmac("sha256", this.secret).update(body).digest("hex");
  }

  async verifyWebhook({ headers, body }: { headers: Headers; body: string; url: string }) {
    const signature = headers.get("x-simulated-signature") ?? "";
    const expected = this.sign(body);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(body) as { paymentId?: string; eventId?: string };
    if (!parsed.paymentId || !parsed.eventId) return null;
    return { providerPaymentId: parsed.paymentId, eventKey: parsed.eventId };
  }

  async refund(id: string) {
    await prisma.simulatedPayment.update({ where: { id }, data: { status: "REFUNDED" } });
    return { ok: true };
  }

  /** Apenas para o painel de simulação: muda o estado "no provedor". */
  async setStatus(id: string, status: PaymentStatus) {
    await prisma.simulatedPayment.update({ where: { id }, data: { status } });
  }
}

let provider: PaymentProvider | undefined;
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  if (process.env.PAYMENT_PROVIDER === "mercadopago") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MercadoPagoProvider } = require("./mercadopago") as typeof import("./mercadopago");
    const mp = MercadoPagoProvider.fromEnv();
    provider = mp;
    return mp;
  }
  if (process.env.APP_ENV === "production") throw new Error("Pagamento simulado é proibido em produção");
  provider = new SimulatedPaymentProvider();
  return provider;
}
export function setPaymentProvider(p: PaymentProvider) {
  provider = p;
}
