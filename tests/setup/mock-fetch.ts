import { mpHandle } from "@/mocks/mercadopago";
import { meHandle } from "@/mocks/melhorenvio";

export const MOCK_BASE = "http://localhost:3000";

/** fetch que entrega as requisições direto aos simuladores (sem servidor HTTP) e registra as chamadas. */
export function createMockFetch() {
  const calls: { method: string; path: string; headers: Headers; body?: string }[] = [];
  const impl: typeof fetch = async (input, init) => {
    const req = new Request(String(input), init);
    const url = new URL(req.url);
    calls.push({ method: req.method, path: url.pathname, headers: req.headers, body: init?.body ? String(init.body) : undefined });
    for (const [prefix, handler] of [["/api/mock/mercadopago/", mpHandle], ["/api/mock/melhorenvio/", meHandle]] as const) {
      if (url.pathname.startsWith(prefix)) return handler(req, url.pathname.slice(prefix.length).split("/").filter(Boolean));
    }
    throw new Error(`mock fetch: rota desconhecida ${url}`);
  };
  return { impl, calls };
}
