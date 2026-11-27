import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Simuladores de provedores só existem fora de produção e com MOCK_PROVIDERS=1. */
export function mocksEnabled() {
  return process.env.MOCK_PROVIDERS === "1" && process.env.APP_ENV !== "production";
}

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function putRecord(provider: string, kind: string, id: string, data: object) {
  await prisma.mockProviderRecord.upsert({
    where: { id: `${provider}:${kind}:${id}` },
    update: { data: data as Prisma.InputJsonValue },
    create: { id: `${provider}:${kind}:${id}`, provider, kind, data: data as Prisma.InputJsonValue },
  });
}

export async function getRecord<T>(provider: string, kind: string, id: string): Promise<T | null> {
  const r = await prisma.mockProviderRecord.findUnique({ where: { id: `${provider}:${kind}:${id}` } });
  return (r?.data as T) ?? null;
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const s256 = (v: string) => createHash("sha256").update(v).digest("base64url");
export const uuid = () => randomUUID();
export const bearer = (req: Request) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
