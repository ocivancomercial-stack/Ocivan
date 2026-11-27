import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { consumeOAuthState } from "@/lib/oauth-state";
import { getCurrentUser } from "@/lib/session";
import { getShippingProvider } from "@/services/shipping";
import { MelhorEnvioProvider } from "@/services/shipping/melhorenvio";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (s: string) => NextResponse.redirect(new URL(`/admin/integracoes?status=${s}`, req.url));
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new NextResponse(null, { status: 404 });
  const saved = await consumeOAuthState("melhorenvio", url.searchParams.get("state"), user.id);
  const code = url.searchParams.get("code");
  const provider = getShippingProvider();
  if (!saved || !code || !(provider instanceof MelhorEnvioProvider)) return back("erro");
  try {
    await provider.connect(code, `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/melhorenvio/callback`, user.id);
    await audit({ actorId: user.id, action: "admin.integration.connect", entityType: "integration", entityId: "melhorenvio" });
    return back("conectado");
  } catch (e) {
    logger.error("melhorenvio.connect_failed", { error: String(e) });
    return back("erro");
  }
}
