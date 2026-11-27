import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Verificação de saúde para monitoramento externo (UptimeRobot, Better Stack…). Não expõe segredos. */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "ok", latencyMs: Date.now() - started, env: process.env.APP_ENV ?? "development", version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
