import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { saveOAuthState } from "@/lib/oauth-state";
import { getPaymentProvider } from "@/services/payments";
import { MercadoPagoProvider } from "@/services/payments/mercadopago";

/** Vendedor inicia a conexão da conta Mercado Pago (OAuth + PKCE). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/entrar?next=/perfil/recebimentos", req.url));
  const provider = getPaymentProvider();
  if (!(provider instanceof MercadoPagoProvider)) return NextResponse.redirect(new URL("/perfil/recebimentos", req.url));
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/mercadopago/callback`;
  const { url, state, codeVerifier } = provider.authorizationUrl(redirectUri);
  await saveOAuthState({ provider: "mercadopago", state, codeVerifier, userId: user.id });
  return NextResponse.redirect(url);
}
