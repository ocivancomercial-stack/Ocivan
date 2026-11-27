import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Verificação OTIMISTA: se não há cookie de sessão, redireciona para o login antes de renderizar.
 * A autorização real (sessão válida, papel, dono do recurso) acontece no servidor — em cada página,
 * Server Action e Route Handler (ver src/lib/session.ts).
 */
const PROTECTED = ["/perfil", "/vender", "/favoritos", "/carrinho", "/checkout", "/pedidos", "/admin", "/privacidade/meus-dados"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL("/entrar", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|simulador|_next/static|_next/image|favicon.ico|icons|uploads|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
