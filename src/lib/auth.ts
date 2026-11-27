import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { passwordProblems, signUpSchema } from "@/schemas/auth";
import { getEmailProvider } from "@/services/email";
import { resetPasswordEmail } from "@/services/email/templates";

/**
 * Autenticação com Better Auth (https://better-auth.com):
 *  - e-mail + senha (hash scrypt), sessões persistidas no banco (revogáveis);
 *  - cookies httpOnly, SameSite=Lax, Secure em produção;
 *  - proteção CSRF por verificação de Origin (trustedOrigins);
 *  - rate limiting persistido no PostgreSQL.
 */
export const auth = betterAuth({
  appName: "Repassa Aí",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  user: {
    fields: { image: "avatar" },
    additionalFields: {
      phone: { type: "string", required: false },
      city: { type: "string", required: false },
      state: { type: "string", required: false, defaultValue: "PR", input: false },
      // input:false → o cliente nunca consegue definir o próprio papel.
      role: { type: "string", required: false, defaultValue: "USER", input: false },
      status: { type: "string", required: false, defaultValue: "ACTIVE", input: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias ("manter conectado")
    updateAge: 60 * 60 * 24, // renova a validade 1x/dia em uso
    freshAge: 60 * 15, // operações sensíveis exigem login nos últimos 15 min
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    async sendResetPassword({ user, url }) {
      const message = resetPasswordEmail(user.name, url);
      await getEmailProvider().send({ to: user.email, ...message });
    },
    async onPasswordReset({ user }) {
      await audit({ actorId: user.id, action: "auth.password_reset", entityType: "user", entityId: user.id });
    },
  },

  rateLimit: {
    enabled: process.env.NODE_ENV !== "test" || process.env.RATE_LIMIT_IN_TESTS === "1",
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 10, max: 3 },
      "/reset-password": { window: 60 * 10, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    // Mantém a verificação de Origin/CSRF ativa em TODOS os ambientes (o padrão desativa em testes).
    disableOriginCheck: false,
    database: { generateId: false }, // IDs gerados pelo banco (cuid via Prisma)
  },

  hooks: {
    // Valida o cadastro no servidor mesmo se alguém chamar a API diretamente.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const parsed = signUpSchema.safeParse({ ...ctx.body, confirmPassword: ctx.body?.confirmPassword ?? ctx.body?.password });
        if (!parsed.success) {
          throw new APIError("BAD_REQUEST", { message: parsed.error.issues[0]?.message ?? "Dados inválidos" });
        }
        return { context: { ...ctx, body: { ...ctx.body, ...pick(parsed.data) } } };
      }
      if (ctx.path === "/reset-password" || ctx.path === "/change-password") {
        const pwd = ctx.body?.newPassword as string | undefined;
        const problems = pwd ? passwordProblems(pwd) : ["Senha inválida"];
        if (problems.length) throw new APIError("BAD_REQUEST", { message: problems[0] });
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        // Só chega aqui depois do hook acima validar o aceite dos termos.
        before: async (user) => ({ data: { ...user, termsAcceptedAt: new Date(), role: "USER", status: "ACTIVE" } }),
        after: async (user) => {
          logger.info("auth.user_created", { userId: user.id });
          await audit({ actorId: user.id, action: "auth.sign_up", entityType: "user", entityId: user.id });
        },
      },
    },
    session: {
      create: {
        // Bloqueia login de contas suspensas ou excluídas.
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } });
          if (!user || user.status !== "ACTIVE") {
            throw new APIError("FORBIDDEN", { message: "Conta indisponível. Fale com o suporte." });
          }
        },
      },
    },
  },

  plugins: [nextCookies()], // deve ser o último plugin
});

function pick(data: { name: string; email: string; phone: string; city: string }) {
  return { name: data.name, email: data.email, phone: data.phone, city: data.city };
}

export type AuthSession = typeof auth.$Infer.Session;
