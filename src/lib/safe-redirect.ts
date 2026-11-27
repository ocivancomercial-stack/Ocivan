/** Aceita apenas caminhos internos (evita open redirect: "//evil.com", "https://evil.com", "/\\evil"). */
export function safeRedirectPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next;
}
