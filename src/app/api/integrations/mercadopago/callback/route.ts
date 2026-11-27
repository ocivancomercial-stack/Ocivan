import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { consumeOAuthState } from "@/lib/oauth-state";
import { getCurrentUser } from "@/lib/session";
import { getPaymentProvider } from "@/services/payments";
import { MercadoPagoProvider } from "@/services/payments/mercadopago";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (s: string) => NextResponse.redirect(new URL(`/perfil/recebimentos?status=${s}`, req.url));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", req.url));
  const saved = await consumeOAuthState("mercadopago", url.searchParams.get("state"), user.id);
  const code = url.searchParams.get("code");
  const provider = getPaymentProvider();
  if (!saved || !code || !(provider instanceof MercadoPagoProvider)) return back("erro");
  try {
    await provider.connectSeller(user.id, code, saved.codeVerifier ?? "", `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/mercadopago/callback`);
    await audit({ actorId: user.id, action: "payments.account_connected", entityType: "user", entityId: user.id, metadata: { provider: "mercadopago" } });
    return back("conectado");
  } catch (e) {
    logger.error("mercadopago.connect_failed", { error: String(e) });
    return back("erro");
  }
}
