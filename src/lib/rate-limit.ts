import { prisma } from "@/lib/db";

/**
 * Rate limiting de janela fixa persistido no PostgreSQL (funciona em ambiente serverless,
 * onde memória não é compartilhada entre instâncias). Usa a mesma tabela do Better Auth
 * com prefixo próprio nas chaves.
 */
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function rateLimit(
  key: string,
  { max, windowSeconds }: { max: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const fullKey = `app:${key}`;

  // Operação atômica: reinicia a janela se expirou, senão incrementa.
  const rows = await prisma.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "rate_limits" ("id", "key", "count", "lastRequest")
    VALUES (${crypto.randomUUID()}, ${fullKey}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limits"."lastRequest" < ${BigInt(now - windowMs)} THEN 1 ELSE "rate_limits"."count" + 1 END,
      "lastRequest" = CASE WHEN "rate_limits"."lastRequest" < ${BigInt(now - windowMs)} THEN ${BigInt(now)} ELSE "rate_limits"."lastRequest" END
    RETURNING "count", "lastRequest"
  `;
  const { count, lastRequest } = rows[0];
  const retryAfterSeconds = Math.max(0, Math.ceil((Number(lastRequest) + windowMs - now) / 1000));
  return { allowed: count <= max, remaining: Math.max(0, max - count), retryAfterSeconds };
}
