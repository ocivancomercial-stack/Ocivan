import type { Instrumentation } from "next";

/**
 * Monitoramento de erros do servidor (docs: app/api-reference/file-conventions/instrumentation).
 * Registra em log estruturado (Vercel Logs / drains) e, se ERROR_ALERT_WEBHOOK_URL estiver definido,
 * envia um alerta resumido (ex.: Slack, Discord, Better Stack). Nunca envia cabeçalhos, cookies ou corpo.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  const path = request.path.split("?")[0];
  const event = { ts: new Date().toISOString(), level: "error", event: "server.request_error", message: message.slice(0, 500), digest, method: request.method, path, routeType: context.routeType, routePath: context.routePath };
  console.error(JSON.stringify(event));
  const hook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `[Repassa Aí ${process.env.APP_ENV ?? ""}] ${request.method} ${path} — ${message.slice(0, 200)} (digest ${digest ?? "-"})` }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // alerta é melhor esforço
    }
  }
};
