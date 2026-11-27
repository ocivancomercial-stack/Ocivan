/** Modo demonstração: atalhos para testar sem e-mail real. Nunca ativo em produção (src/lib/env.ts). */
export function demoMode() {
  return process.env.DEMO_MODE === "1" && process.env.APP_ENV !== "production";
}
