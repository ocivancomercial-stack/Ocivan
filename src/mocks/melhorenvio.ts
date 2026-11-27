import { randomInt } from "node:crypto";
import { MelhorEnvioProvider } from "@/services/shipping/melhorenvio";
import { appUrl, bearer, getRecord, json, putRecord, uuid } from "./common";

/**
 * SIMULADOR do Melhor Envio (modelo de teste). Reproduz os formatos da API v2 usados pela integração:
 * /oauth/authorize, /oauth/token, calculate, cart, checkout, generate, print, tracking, cancel,
 * e webhooks order.* assinados com X-ME-Signature. Etiquetas geradas NÃO são válidas.
 */
const P = "melhorenvio";
type Order = { id: string; protocol: string; status: string; service: number; tracking: string | null; body: Record<string, unknown> };

const SERVICES = [
  { id: 1, name: "PAC", company: "Correios", base: 1890, perKg: 450, days: 7 },
  { id: 2, name: "SEDEX", company: "Correios", base: 2690, perKg: 800, days: 2 },
  { id: 3, name: ".Package", company: "Jadlog", base: 1690, perKg: 500, days: 5 },
];

function requireUA(req: Request) {
  return !!req.headers.get("user-agent")?.includes("@");
}

export async function meHandle(req: Request, path: string[]): Promise<Response> {
  const route = `${req.method} /${path.join("/")}`;
  const url = new URL(req.url);

  if (route === "GET /oauth/authorize") {
    const q = url.searchParams;
    if (q.get("response_type") !== "code" || !q.get("client_id") || !q.get("redirect_uri")) return json({ error: "invalid_request" }, 400);
    const code = `mock-${uuid()}`;
    await putRecord(P, "code", code, { redirectUri: q.get("redirect_uri"), scope: q.get("scope"), used: false });
    const back = new URL(q.get("redirect_uri")!);
    back.searchParams.set("code", code);
    if (q.get("state")) back.searchParams.set("state", q.get("state")!);
    return Response.redirect(back.toString(), 302);
  }

  if (!requireUA(req)) return json({ message: "User-Agent com nome da aplicação e e-mail é obrigatório" }, 400);

  if (route === "POST /oauth/token") {
    const b = (await req.json()) as Record<string, string>;
    if (String(b.client_id) !== process.env.MELHORENVIO_CLIENT_ID || b.client_secret !== process.env.MELHORENVIO_CLIENT_SECRET) return json({ error: "invalid_client", message: "Client invalid" }, 401);
    if (b.grant_type === "authorization_code") {
      const code = await getRecord<{ redirectUri: string; used: boolean }>(P, "code", b.code);
      if (!code || code.used || code.redirectUri !== b.redirect_uri) return json({ error: "invalid_grant" }, 400);
      await putRecord(P, "code", b.code, { ...code, used: true });
    } else if (b.grant_type === "refresh_token") {
      if (!(await getRecord(P, "refresh", b.refresh_token))) return json({ error: "invalid_grant" }, 400);
    } else return json({ error: "unsupported_grant_type" }, 400);
    const access = `mock.${uuid()}`;
    const refresh = `mock-refresh-${uuid()}`;
    await putRecord(P, "token", access, {});
    await putRecord(P, "refresh", refresh, {});
    return json({ token_type: "Bearer", expires_in: 2592000, access_token: access, refresh_token: refresh });
  }

  if (!(await getRecord(P, "token", bearer(req)))) return json({ message: "Unauthenticated." }, 401);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (route === "POST /api/v2/me/shipment/calculate") {
    const from = (body.from as { postal_code?: string })?.postal_code;
    const to = (body.to as { postal_code?: string })?.postal_code;
    const products = body.products as { weight: number; width: number; height: number; length: number; quantity: number }[];
    if (!from || !to || !Array.isArray(products) || !products.length) return json({ message: "The given data was invalid." }, 422);
    const kg = products.reduce((s, p) => s + p.weight * (p.quantity ?? 1), 0);
    const far = Math.abs(Number(from.slice(0, 3)) - Number(to.slice(0, 3))) > 20;
    return json([
      ...SERVICES.map((s) => {
        const price = (s.base + Math.ceil(kg) * s.perKg + (far ? 1500 : 0)) / 100;
        const days = s.days + (far ? 3 : 0);
        return { id: s.id, name: s.name, price: price.toFixed(2), custom_price: price.toFixed(2), discount: "0.00", currency: "R$", delivery_time: days, custom_delivery_time: days, company: { id: s.id, name: s.company } };
      }),
      { id: 17, name: "Mini Envios", error: "Dimensões do objeto ultrapassam o limite da transportadora.", company: { id: 1, name: "Correios" } },
    ]);
  }

  if (route === "POST /api/v2/me/cart") {
    const missing = ["service", "from", "to", "products", "volumes"].filter((k) => !body[k]);
    const docs = ["from", "to"].filter((k) => !(body[k] as { document?: string })?.document);
    if (missing.length || docs.length) return json({ message: "The given data was invalid.", errors: { fields: [...missing, ...docs.map((d) => `${d}.document`)] } }, 422);
    const id = uuid();
    const order: Order = { id, protocol: `ORD-${Date.now()}`, status: "pending", service: Number(body.service), tracking: null, body };
    await putRecord(P, "order", id, order);
    return json({ id, protocol: order.protocol, service_id: order.service, status: "pending" }, 201);
  }

  const orders = (body.orders as string[]) ?? [];
  const load = async (id: string) => getRecord<Order>(P, "order", id);
  const transition = async (from: string[], to: string) => {
    for (const id of orders) {
      const o = await load(id);
      if (!o || !from.includes(o.status)) return json({ message: `Etiqueta ${id} em status inválido` }, 422);
      await putRecord(P, "order", id, { ...o, status: to });
      await meSendWebhook({ ...o, status: to }, `order.${to}`);
    }
    return null;
  };

  if (route === "POST /api/v2/me/shipment/checkout") {
    const err = await transition(["pending"], "released");
    return err ?? json({ purchase: { id: uuid(), status: "paid", orders: orders.map((id) => ({ id, status: "released" })) } });
  }
  if (route === "POST /api/v2/me/shipment/generate") {
    const err = await transition(["released"], "generated");
    return err ?? json(Object.fromEntries(orders.map((id) => [id, { status: true, message: "Envio gerado com sucesso" }])));
  }
  if (route === "POST /api/v2/me/shipment/print") {
    if (!orders.length) return json({ message: "orders obrigatório" }, 422);
    return json({ url: `${appUrl()}/simulador/melhorenvio/etiqueta/${orders[0]}` });
  }
  if (route === "POST /api/v2/me/shipment/tracking") {
    const out: Record<string, unknown> = {};
    for (const id of orders) {
      const o = await load(id);
      if (o) out[id] = { id, protocol: o.protocol, status: o.status, tracking: o.tracking, melhorenvio_tracking: o.tracking };
    }
    return json(out);
  }
  if (route === "POST /api/v2/me/shipment/cancel") {
    const order = body.order as { id?: string; reason_id?: string } | undefined;
    const o = order?.id ? await load(order.id) : null;
    if (!o || order?.reason_id !== "2") return json({ message: "The given data was invalid." }, 422);
    if (!["pending", "released", "generated"].includes(o.status)) return json({ message: "Etiqueta não pode ser cancelada" }, 422);
    await putRecord(P, "order", o.id, { ...o, status: "canceled" });
    await meSendWebhook({ ...o, status: "canceled" }, "order.cancelled");
    return json({ [o.id]: { canceled: true } });
  }
  return json({ message: `not found: ${route}` }, 404);
}

/** Avança a etiqueta como a transportadora faria (postado → entregue) e notifica por webhook assinado. */
export async function meAdvance(orderId: string) {
  const o = await getRecord<Order>(P, "order", orderId);
  if (!o) throw new Error("Etiqueta não encontrada no simulador");
  const next = o.status === "generated" ? "posted" : o.status === "posted" ? "delivered" : null;
  if (!next) throw new Error(`Nada a avançar (status ${o.status})`);
  const updated = { ...o, status: next, tracking: o.tracking ?? `ME${randomInt(1e8, 9e8)}BR` };
  await putRecord(P, "order", orderId, updated);
  await meSendWebhook(updated, `order.${next}`);
  return next;
}

export function buildMeWebhook(o: Order, event: string) {
  const body = JSON.stringify({
    event,
    data: { id: o.id, protocol: o.protocol, status: o.status, tracking: o.tracking, self_tracking: null, user_id: "mock", tags: [], created_at: new Date().toISOString(), tracking_url: null },
  });
  return { body, headers: { "content-type": "application/json", "user-agent": "Melhor Envio Webhooks/1.0", "x-me-signature": MelhorEnvioProvider.sign(process.env.MELHORENVIO_CLIENT_SECRET ?? "", body) } };
}

async function meSendWebhook(o: Order, event: string) {
  const hook = buildMeWebhook(o, event);
  await fetch(`${appUrl()}/api/webhooks/shipping/melhorenvio`, { method: "POST", headers: hook.headers, body: hook.body }).catch(() => undefined);
}

export async function meGetOrder(id: string) {
  return getRecord<Order>(P, "order", id);
}
