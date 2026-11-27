import { z } from "zod";

/**
 * Validação centralizada das variáveis de ambiente.
 * Falha cedo (no boot) se algo obrigatório estiver ausente ou inseguro.
 * Variáveis documentadas em docs/VARIAVEIS_AMBIENTE.md.
 */
const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // APP_ENV distingue "production" real de previews/homologação na Vercel.
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET precisa de ao menos 32 caracteres"),
    BETTER_AUTH_URL: z.string().url(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    ENCRYPTION_KEY: z.string().min(1),
    EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
    EMAIL_FROM: z.string().default("Repassa Aí <nao-responda@repassaai.com.br>"),
    RESEND_API_KEY: z.string().optional(),
    STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default("product-images"),
    PAYMENT_PROVIDER: z.enum(["simulated", "mercadopago"]).default("simulated"),
    SHIPPING_PROVIDER: z.enum(["simulated", "melhorenvio"]).default("simulated"),
    CRON_SECRET: z.string().optional(),
    DEMO_MODE: z.enum(["", "0", "1"]).default(""),
    MOCK_PROVIDERS: z.enum(["", "0", "1"]).default(""),
    MERCADOPAGO_API_URL: z.string().url().optional(),
    MERCADOPAGO_AUTH_URL: z.string().url().optional(),
    MERCADOPAGO_CLIENT_ID: z.string().optional(),
    MERCADOPAGO_CLIENT_SECRET: z.string().optional(),
    MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
    MERCADOPAGO_TEST_MODE: z.enum(["", "0", "1"]).default(""),
    MELHORENVIO_API_URL: z.string().url().optional(),
    MELHORENVIO_CLIENT_ID: z.string().optional(),
    MELHORENVIO_CLIENT_SECRET: z.string().optional(),
    MELHORENVIO_SANDBOX: z.enum(["", "0", "1"]).default(""),
    AI_PROVIDER: z.enum(["", "anthropic"]).default(""),
    AI_MODEL: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY && env.APP_ENV === "production")
      ctx.addIssue({ code: "custom", path: ["ANTHROPIC_API_KEY"], message: "ANTHROPIC_API_KEY obrigatória com AI_PROVIDER=anthropic" });
    if (env.PAYMENT_PROVIDER === "mercadopago")
      for (const k of ["MERCADOPAGO_CLIENT_ID", "MERCADOPAGO_CLIENT_SECRET", "MERCADOPAGO_WEBHOOK_SECRET"] as const)
        if (!env[k]) ctx.addIssue({ code: "custom", path: [k], message: `${k} obrigatória com PAYMENT_PROVIDER=mercadopago` });
    if (env.SHIPPING_PROVIDER === "melhorenvio")
      for (const k of ["MELHORENVIO_CLIENT_ID", "MELHORENVIO_CLIENT_SECRET"] as const)
        if (!env[k]) ctx.addIssue({ code: "custom", path: [k], message: `${k} obrigatória com SHIPPING_PROVIDER=melhorenvio` });
    if (env.APP_ENV !== "production") return;
    // Produção: nunca simuladores nem URLs que não sejam as oficiais.
    if (env.DEMO_MODE === "1") ctx.addIssue({ code: "custom", path: ["DEMO_MODE"], message: "Modo demonstração é proibido em produção" });
    if (env.MOCK_PROVIDERS === "1") ctx.addIssue({ code: "custom", path: ["MOCK_PROVIDERS"], message: "Simuladores são proibidos em produção" });
    if (env.MERCADOPAGO_API_URL && env.MERCADOPAGO_API_URL.replace(/\/$/, "") !== "https://api.mercadopago.com")
      ctx.addIssue({ code: "custom", path: ["MERCADOPAGO_API_URL"], message: "Em produção use a API oficial do Mercado Pago" });
    if (env.MERCADOPAGO_AUTH_URL && !env.MERCADOPAGO_AUTH_URL.startsWith("https://auth.mercadopago.com"))
      ctx.addIssue({ code: "custom", path: ["MERCADOPAGO_AUTH_URL"], message: "Em produção use o OAuth oficial do Mercado Pago" });
    if (env.MERCADOPAGO_TEST_MODE === "1") ctx.addIssue({ code: "custom", path: ["MERCADOPAGO_TEST_MODE"], message: "Modo de teste do Mercado Pago em produção" });
    if (env.MELHORENVIO_SANDBOX === "1" || (env.MELHORENVIO_API_URL && env.MELHORENVIO_API_URL.replace(/\/$/, "") !== "https://melhorenvio.com.br"))
      ctx.addIssue({ code: "custom", path: ["MELHORENVIO_API_URL"], message: "Em produção use a API oficial do Melhor Envio (sem sandbox)" });
    // Em produção real, nenhuma simulação é permitida.
    if (env.PAYMENT_PROVIDER === "simulated")
      ctx.addIssue({ code: "custom", path: ["PAYMENT_PROVIDER"], message: "Pagamento simulado é proibido em produção" });
    if (env.SHIPPING_PROVIDER === "simulated")
      ctx.addIssue({ code: "custom", path: ["SHIPPING_PROVIDER"], message: "Frete simulado é proibido em produção" });
    if (env.EMAIL_PROVIDER === "console")
      ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "E-mail em console é proibido em produção" });
    if (env.STORAGE_DRIVER === "local")
      ctx.addIssue({ code: "custom", path: ["STORAGE_DRIVER"], message: "Storage local é proibido em produção" });
    if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY)
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY obrigatória" });
    if (!env.CRON_SECRET || env.CRON_SECRET.length < 32)
      ctx.addIssue({ code: "custom", path: ["CRON_SECRET"], message: "CRON_SECRET (32+ caracteres) obrigatório em produção" });
    if (/dev-only|change-me/i.test(env.BETTER_AUTH_SECRET))
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "Segredo de desenvolvimento em produção" });
  });

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;
export function env(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

/** true quando integrações simuladas podem ser usadas (nunca em produção). */
export function simulationAllowed(e: ServerEnv = env()): boolean {
  return e.APP_ENV !== "production";
}
