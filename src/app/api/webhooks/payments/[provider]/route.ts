import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getPaymentProvider } from "@/services/payments";
import { processPaymentNotification } from "@/features/payments/service";

/**
 * Webhook de pagamentos. Fluxo: verifica assinatura → registra evento (idempotente) →
 * consulta o provedor → atualiza o pedido. Responde 200 rápido para eventos já vistos.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  const provider = getPaymentProvider();
  if (provider.name !== name) return NextResponse.json({ error: "provider" }, { status: 404 });

  const body = await req.text();
  if (body.length > 64_000) return NextResponse.json({ error: "payload" }, { status: 413 });
  const verified = await provider.verifyWebhook({ headers: req.headers, body });
  if (!verified) {
    logger.warn("payment.webhook_invalid_signature", { provider: name });
    return NextResponse.json({ error: "signature" }, { status: 401 });
  }
  try {
    let payload: unknown = {};
    try {
      payload = JSON.parse(body);
    } catch {}
    const result = await processPaymentNotification(provider, verified, payload as object);
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch {
    // 500 → o provedor reenviará a notificação depois.
    return NextResponse.json({ error: "processing" }, { status: 500 });
  }
}
