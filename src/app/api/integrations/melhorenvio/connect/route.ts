import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { saveOAuthState } from "@/lib/oauth-state";
import { getShippingProvider } from "@/services/shipping";
import { MelhorEnvioProvider } from "@/services/shipping/melhorenvio";

/** Admin conecta a conta Melhor Envio da PLATAFORMA. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new NextResponse(null, { status: 404 });
  const provider = getShippingProvider();
  if (!(provider instanceof MelhorEnvioProvider)) return NextResponse.redirect(new URL("/admin/integracoes", req.url));
  const state = randomBytes(16).toString("hex");
  await saveOAuthState({ provider: "melhorenvio", state, userId: user.id });
  return NextResponse.redirect(provider.authorizationUrl(`${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/melhorenvio/callback`, state));
}
