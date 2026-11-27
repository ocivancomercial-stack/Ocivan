import { mocksEnabled } from "@/mocks/common";
import { meHandle } from "@/mocks/melhorenvio";

/** SIMULADOR (melhorenvio) — modelo de teste. 404 em produção ou sem MOCK_PROVIDERS=1. */
async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!mocksEnabled()) return new Response(null, { status: 404 });
  return meHandle(req, (await params).path);
}

export { handle as GET, handle as POST };
