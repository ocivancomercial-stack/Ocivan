import { mocksEnabled } from "@/mocks/common";
import { mpHandle } from "@/mocks/mercadopago";

/** SIMULADOR (mercadopago) — modelo de teste. 404 em produção ou sem MOCK_PROVIDERS=1. */
async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!mocksEnabled()) return new Response(null, { status: 404 });
  return mpHandle(req, (await params).path);
}

export { handle as GET, handle as POST };
