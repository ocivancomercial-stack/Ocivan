import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildCsp } from "@/lib/csp";

/**
 * 1. Gera um nonce por requisição e aplica a CSP (requisição + resposta).
 * 2. Verificação OTIMISTA de login: sem cookie de sessão, redireciona para /entrar.
 *    A autorização real (sessão válida, papel, dono do recurso) acontece no servidor
 *    em cada página, Server Action e Route Handler (src/lib/session.ts).
 */
const PROTECTED = ["/perfil", "/vender", "/favoritos", "/carrinho", "/checkout", "/pedidos", "/admin", "/privacidade/meus-dados"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !getSessionCookie(request)) {
    const url = new URL("/entrar", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|icons|uploads|sw.js|manifest.webmanifest|icon.svg|apple-icon.png|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
