import { describe, expect, it } from "vitest";
import { parseEnv, simulationAllowed } from "@/lib/env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(40),
  BETTER_AUTH_URL: "https://repassaai.com.br",
  NEXT_PUBLIC_APP_URL: "https://repassaai.com.br",
  ENCRYPTION_KEY: "k",
};

describe("variáveis de ambiente", () => {
  it("aceita configuração de desenvolvimento com simulações", () => {
    const env = parseEnv({ ...base, APP_ENV: "development" });
    expect(env.PAYMENT_PROVIDER).toBe("simulated");
    expect(simulationAllowed(env)).toBe(true);
  });

  it("PROÍBE pagamento/frete simulado em produção", () => {
    expect(() => parseEnv({ ...base, APP_ENV: "production" })).toThrow(/Pagamento simulado é proibido/);
  });

  it("aceita produção com integrações reais", () => {
    const env = parseEnv({
      ...base,
      APP_ENV: "production",
      PAYMENT_PROVIDER: "mercadopago",
      SHIPPING_PROVIDER: "melhorenvio",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_x",
      STORAGE_DRIVER: "supabase",
      CRON_SECRET: "c".repeat(40),
    });
    expect(simulationAllowed(env)).toBe(false);
  });

  it("recusa segredo de desenvolvimento em produção", () => {
    expect(() =>
      parseEnv({ ...base, BETTER_AUTH_SECRET: "dev-only-secret-change-me-0123456789abcdef", APP_ENV: "production", PAYMENT_PROVIDER: "mercadopago", SHIPPING_PROVIDER: "melhorenvio", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "x", STORAGE_DRIVER: "supabase" }),
    ).toThrow(/Segredo de desenvolvimento/);
  });

  it("exige CRON_SECRET em produção", () => {
    expect(() =>
      parseEnv({ ...base, APP_ENV: "production", PAYMENT_PROVIDER: "mercadopago", SHIPPING_PROVIDER: "melhorenvio", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "x", STORAGE_DRIVER: "supabase" }),
    ).toThrow(/CRON_SECRET/);
  });

  it("exige segredo de autenticação forte", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "curto" })).toThrow(/32 caracteres/);
  });
});
