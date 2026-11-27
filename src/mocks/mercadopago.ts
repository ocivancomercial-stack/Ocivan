import { randomInt } from "node:crypto";
import { MercadoPagoProvider } from "@/services/payments/mercadopago";
import { appUrl, bearer, getRecord, json, putRecord, s256, uuid } from "./common";

/**
 * SIMULADOR do Mercado Pago (modelo de teste). Reproduz os formatos usados pela integração real:
 * OAuth (authorization + /oauth/token com PKCE), POST /checkout/preferences/, GET /v1/payments/{id},
 * POST /v1/payments/{id}/refunds e webhooks assinados com x-signature (HMAC-SHA256 do manifest).
 * Não movimenta dinheiro.
 */
const P = "mercadopago";
type Token = { userId: number; clientId: string };
type Pref = { id: string; collectorId: number; body: { items: { unit_price: number; quantity: number; title: string }[]; external_reference: string; marketplace_fee?: number; notification_url?: string; back_urls?: { success?: string; failure?: string } } };
type Payment = { id: number; status: string; status_detail: string; transaction_amount: number; external_reference: string; collector_id: number; marketplace_fee?: number; preference_id: string };

export async function mpHandle(req: Request, path: string[]): Promise<Response> {
  const route = `${req.method} /${path.join("/")}`;
  const url = new URL(req.url);

  if (route === "GET /authorization") {
    // Tela de consentimento simulada: aprova automaticamente e devolve o code ao redirect_uri.
    const q = url.searchParams;
    if (q.get("response_type") !== "code" || q.get("platform_id") !== "mp" || !q.get("client_id") || !q.get("redirect_uri")) return json({ message: "invalid authorization request" }, 400);
    const code = `TG-mock-${uuid()}`;
    await putRecord(P, "code", code, { clientId: q.get("client_id"), redirectUri: q.get("redirect_uri"), challenge: q.get("code_challenge"), used: false });
    const back = new URL(q.get("redirect_uri")!);
    back.searchParams.set("code", code);
    if (q.get("state")) back.searchParams.set("state", q.get("state")!);
    return Response.redirect(back.toString(), 302);
  }

  if (route === "POST /oauth/token") {
    const b = (await req.json()) as Record<string, string>;
    if (b.client_secret !== process.env.MERCADOPAGO_CLIENT_SECRET || String(b.client_id) !== process.env.MERCADOPAGO_CLIENT_ID) return json({ message: "invalid client" }, 401);
    let userId: number;
    if (b.grant_type === "authorization_code") {
      const code = await getRecord<{ clientId: string; redirectUri: string; challenge?: string; used: boolean }>(P, "code", b.code);
      if (!code || code.used || code.redirectUri !== b.redirect_uri) return json({ message: "invalid_grant" }, 400);
      if (code.challenge && s256(b.code_verifier ?? "") !== code.challenge) return json({ message: "invalid code_verifier" }, 400);
      await putRecord(P, "code", b.code, { ...code, used: true });
      userId = 100000000 + randomInt(899999999);
    } else if (b.grant_type === "refresh_token") {
      const rt = await getRecord<Token>(P, "refresh", b.refresh_token);
      if (!rt) return json({ message: "invalid_grant" }, 400);
      userId = rt.userId;
    } else return json({ message: "unsupported_grant_type" }, 400);
    const access = `APP_USR-mock-${uuid()}`;
    const refresh = `TG-mock-refresh-${uuid()}`;
    await putRecord(P, "token", access, { userId, clientId: b.client_id });
    await putRecord(P, "refresh", refresh, { userId, clientId: b.client_id });
    return json({ access_token: access, token_type: "Bearer", expires_in: 15552000, scope: "offline_access read write", user_id: userId, refresh_token: refresh, public_key: `APP_USR-mock-pk-${userId}`, live_mode: false });
  }

  const token = await getRecord<Token>(P, "token", bearer(req));
  if (!token) return json({ message: "invalid access token" }, 401);

  if (route === "POST /checkout/preferences") {
    const body = (await req.json()) as Pref["body"];
    if (!Array.isArray(body.items) || body.items.length === 0 || !body.external_reference) return json({ message: "items and external_reference required" }, 400);
    if (body.items.some((i) => typeof i.unit_price !== "number" || i.unit_price <= 0 || !i.title)) return json({ message: "invalid items" }, 400);
    const id = `${token.userId}-${uuid()}`;
    await putRecord(P, "preference", id, { id, collectorId: token.userId, body });
    const init = `${appUrl()}/simulador/mercadopago/checkout/${id}`;
    return json({ id, init_point: init, sandbox_init_point: init, collector_id: token.userId, external_reference: body.external_reference, marketplace_fee: body.marketplace_fee }, 201);
  }

  const payMatch = path[0] === "v1" && path[1] === "payments" && /^\d+$/.test(path[2] ?? "");
  if (payMatch) {
    const pay = await getRecord<Payment>(P, "payment", path[2]);
    if (!pay) return json({ message: "Payment not found" }, 404);
    if (pay.collector_id !== token.userId) return json({ message: "forbidden" }, 403); // só o vendedor dono consulta
    if (req.method === "GET" && path.length === 3) return json(pay);
    if (req.method === "POST" && path[3] === "refunds") {
      const key = req.headers.get("x-idempotency-key");
      if (!key) return json({ message: "X-Idempotency-Key required" }, 400);
      if (!["approved", "authorized"].includes(pay.status) && pay.status !== "refunded") return json({ message: "Payment cannot be refunded" }, 400);
      const refund = (await getRecord<object>(P, "refund", key)) ?? { id: randomInt(1e9), payment_id: pay.id, amount: pay.transaction_amount, status: "approved" };
      await putRecord(P, "refund", key, refund);
      await putRecord(P, "payment", String(pay.id), { ...pay, status: "refunded", status_detail: "refunded" });
      return json(refund, 201);
    }
  }
  return json({ message: `not found: ${route}` }, 404);
}

/** Ação do "comprador" na tela simulada de pagamento: cria o pagamento e dispara o webhook assinado. */
export async function mpSimulatePayment(preferenceId: string, outcome: "approved" | "pending" | "rejected") {
  const pref = await getRecord<Pref>(P, "preference", preferenceId);
  if (!pref) throw new Error("Preferência não encontrada");
  const amount = Math.round(pref.body.items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100) / 100;
  const id = 1_000_000_000 + randomInt(999_999_999);
  const payment: Payment = {
    id, status: outcome, status_detail: outcome === "approved" ? "accredited" : outcome === "pending" ? "pending_waiting_payment" : "cc_rejected_other_reason",
    transaction_amount: amount, external_reference: pref.body.external_reference, collector_id: pref.collectorId, marketplace_fee: pref.body.marketplace_fee, preference_id: pref.id,
  };
  await putRecord(P, "payment", String(id), payment);
  await mpSendWebhook(pref, id, "payment.created");
  return { paymentId: id, redirect: outcome === "rejected" ? pref.body.back_urls?.failure : pref.body.back_urls?.success };
}

/** Muda o estado de um pagamento no simulador (ex.: chargeback) e notifica. */
export async function mpSetPaymentStatus(paymentId: number, status: string) {
  const pay = await getRecord<Payment>(P, "payment", String(paymentId));
  if (!pay) throw new Error("Pagamento não encontrado");
  await putRecord(P, "payment", String(paymentId), { ...pay, status });
  const pref = await getRecord<Pref>(P, "preference", pay.preference_id);
  if (pref) await mpSendWebhook(pref, paymentId, "payment.updated");
}

export function buildMpWebhook(notificationUrl: string, paymentId: number, collectorId: number, action: string) {
  const requestId = uuid();
  const url = new URL(notificationUrl);
  url.searchParams.set("data.id", String(paymentId));
  url.searchParams.set("type", "payment");
  const body = JSON.stringify({ id: randomInt(1e9), live_mode: false, type: "payment", date_created: new Date().toISOString(), user_id: collectorId, api_version: "v1", action, data: { id: String(paymentId) } });
  const headers = { "content-type": "application/json", ...MercadoPagoProvider.signWebhook(process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "", String(paymentId), requestId) };
  return { url: url.toString(), body, headers };
}

async function mpSendWebhook(pref: Pref, paymentId: number, action: string) {
  if (!pref.body.notification_url) return;
  const hook = buildMpWebhook(pref.body.notification_url, paymentId, pref.collectorId, action);
  await fetch(hook.url, { method: "POST", headers: hook.headers, body: hook.body }).catch(() => undefined);
}

export async function mpGetPreference(id: string) {
  return getRecord<Pref>(P, "preference", id);
}
