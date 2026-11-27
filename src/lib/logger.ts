/**
 * Logger estruturado (JSON em uma linha) — compatível com Vercel Logs e drains
 * (Datadog, Axiom, Better Stack). Nunca registre senhas, tokens ou dados de cartão.
 */
type Level = "debug" | "info" | "warn" | "error";
const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|card|cvv|cpf/i;

function redact(meta: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : v]));
}

function write(level: Level, event: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level === "debug") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...redact(meta) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (e: string, m?: Record<string, unknown>) => write("debug", e, m),
  info: (e: string, m?: Record<string, unknown>) => write("info", e, m),
  warn: (e: string, m?: Record<string, unknown>) => write("warn", e, m),
  error: (e: string, m?: Record<string, unknown>) => write("error", e, m),
};
