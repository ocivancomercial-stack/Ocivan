import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { releaseExpiredReservations } from "@/features/orders/service";

/** Executado pelo Vercel Cron (vercel.json). Exige Authorization: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected)))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const released = await releaseExpiredReservations();
  return NextResponse.json({ released });
}
