import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { exportUserData } from "@/features/privacy/service";

/** Download dos dados pessoais do usuário logado (JSON). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await rateLimit(`export:${user.id}`, { max: 5, windowSeconds: 3600 })).allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="repassa-ai-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
