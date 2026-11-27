import { describe, expect, it } from "vitest";
import { maskCpf, normalizeCpf } from "@/lib/cpf";
import { parseEnv } from "@/lib/env";

describe("CPF", () => {
  it.each(["529.982.247-25", "52998224725", "111.444.777-35"])("aceita %s", (c) => expect(normalizeCpf(c)).toMatch(/^\d{11}$/));
  it.each(["123.456.789-00", "111.111.111-11", "1234", ""])("recusa %s", (c) => expect(normalizeCpf(c)).toBeNull());
  it("mascara", () => expect(maskCpf("52998224725")).toBe("***.982.247-**"));
});

describe("produção não aceita simuladores", () => {
  const prod = {
    DATABASE_URL: "postgresql://u:p@h:5432/d", BETTER_AUTH_SECRET: "x".repeat(40), BETTER_AUTH_URL: "https://a.com", NEXT_PUBLIC_APP_URL: "https://a.com",
    ENCRYPTION_KEY: "k", APP_ENV: "production", PAYMENT_PROVIDER: "mercadopago", SHIPPING_PROVIDER: "melhorenvio", EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "x", STORAGE_DRIVER: "supabase", CRON_SECRET: "c".repeat(40), MERCADOPAGO_CLIENT_ID: "1", MERCADOPAGO_CLIENT_SECRET: "s",
    MERCADOPAGO_WEBHOOK_SECRET: "w", MELHORENVIO_CLIENT_ID: "1", MELHORENVIO_CLIENT_SECRET: "s",
  };
  it("configuração oficial é aceita", () => expect(() => parseEnv(prod)).not.toThrow());
  it.each([
    [{ MOCK_PROVIDERS: "1" }, /Simuladores/],
    [{ DEMO_MODE: "1" }, /Modo demonstração/],
    [{ MERCADOPAGO_API_URL: "http://localhost:3000/api/mock/mercadopago" }, /API oficial do Mercado Pago/],
    [{ MELHORENVIO_SANDBOX: "1" }, /sem sandbox/],
    [{ MERCADOPAGO_TEST_MODE: "1" }, /Modo de teste/],
    [{ MERCADOPAGO_WEBHOOK_SECRET: undefined }, /MERCADOPAGO_WEBHOOK_SECRET/],
  ])("recusa %o", (extra, msg) => expect(() => parseEnv({ ...prod, ...extra } as Record<string, string | undefined>)).toThrow(msg));
});
