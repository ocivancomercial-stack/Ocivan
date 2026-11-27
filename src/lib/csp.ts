/**
 * Content-Security-Policy por requisição, com nonce para scripts (sem 'unsafe-inline' em script-src).
 * O Next.js aplica o nonce automaticamente aos próprios scripts quando encontra este cabeçalho na requisição.
 * style-src mantém 'unsafe-inline' porque atributos style (next/image, safe-area) não aceitam nonce.
 */
export function buildCsp(nonce: string, env = process.env) {
  const isDev = env.NODE_ENV !== "production";
  const supabase = env.SUPABASE_URL ? new URL(env.SUPABASE_URL).hostname : null;
  const https = env.NEXT_PUBLIC_APP_URL?.startsWith("https:");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase ? ` https://${supabase}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}${supabase ? ` https://${supabase}` : ""}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // Checkout Pro redireciona para o Mercado Pago (navegação, não formulário); 'self' basta para os forms.
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
