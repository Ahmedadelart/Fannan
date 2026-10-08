import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runProReminders } from "@/lib/server/billing";
import { cleanupAnonymousDrafts, cleanupDeletedAccounts } from "@/lib/server/data";

// Daily housekeeping, called by Cloud Scheduler with the CRON_SECRET header: old anonymous drafts,
// accounts past their deletion date, and Pro reminder emails (14, 3, 0 days; moved to Free).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const removed = await cleanupAnonymousDrafts();
  const deleted = await cleanupDeletedAccounts();
  const reminders = await runProReminders();
  return NextResponse.json({ removed, deleted, reminders });
}
