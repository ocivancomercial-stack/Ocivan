import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getShippingProvider } from "@/services/shipping";
import { applyShippingUpdate } from "@/features/orders/service";

/** Webhook do provedor de frete: assinatura → idempotência → atualização do envio/pedido. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = getShippingProvider();
  if (provider.name !== (await params).provider || !provider.verifyWebhook) return NextResponse.json({ error: "provider" }, { status: 404 });
  const body = await req.text();
  if (body.length > 64_000) return NextResponse.json({ error: "payload" }, { status: 413 });
  const event = provider.verifyWebhook({ headers: req.headers, body });
  if (!event) {
    logger.warn("shipping.webhook_invalid_signature", { provider: provider.name });
    return NextResponse.json({ error: "signature" }, { status: 401 });
  }
  try {
    await prisma.webhookEvent.create({ data: { provider: provider.name, eventKey: event.eventKey, resourceId: event.providerShipmentId, type: event.status, payload: JSON.parse(body) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
    throw e;
  }
  try {
    const result = await applyShippingUpdate(event.providerShipmentId, event.status, event.trackingCode);
    await prisma.webhookEvent.update({ where: { provider_eventKey: { provider: provider.name, eventKey: event.eventKey } }, data: { status: result === "ignored" ? "IGNORED" : "PROCESSED", processedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { provider_eventKey: { provider: provider.name, eventKey: event.eventKey } }, data: { status: "FAILED", error: String(error).slice(0, 500) } });
    return NextResponse.json({ error: "processing" }, { status: 500 });
  }
}
