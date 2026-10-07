import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cleanupAnonymousDrafts } from "@/lib/server/data";

// Daily housekeeping, called by Cloud Scheduler with the CRON_SECRET header.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const removed = await cleanupAnonymousDrafts();
  return NextResponse.json({ removed });
}
