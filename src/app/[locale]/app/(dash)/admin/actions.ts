"use server";

import { requireAdmin, setSuspended } from "@/lib/server/admin";
import { BillingError, grantPro, refundOrder, runProReminders, setProUntil } from "@/lib/server/billing";
import { cleanupAnonymousDrafts, cleanupDeletedAccounts } from "@/lib/server/data";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function attempt<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof BillingError) return { ok: false, error: e.code };
    if (e instanceof Error && e.message === "not-admin") return { ok: false, error: "not-admin" };
    console.error(e);
    return { ok: false, error: "error" };
  }
}

export async function adminGivePro(uid: string, months: number, note: string) {
  return attempt(async () => {
    const admin = await requireAdmin();
    const m = Math.floor(Number(months));
    if (!(m >= 1 && m <= 36)) throw new BillingError("bad-plan");
    return { until: await grantPro(String(uid), m, admin.email ?? "admin", String(note ?? "").slice(0, 200)) };
  });
}

/** For trying reminders and the move to Free: set when Pro ends (empty date = no end date). */
export async function adminSetProUntil(uid: string, isoDate: string) {
  return attempt(async () => {
    await requireAdmin();
    const ms = isoDate ? Date.parse(isoDate) : NaN;
    await setProUntil(String(uid), Number.isFinite(ms) ? ms : null);
    return {};
  });
}

export async function adminRefund(orderId: string) {
  return attempt(async () => {
    const admin = await requireAdmin();
    await refundOrder(String(orderId), admin.email ?? "admin");
    return {};
  });
}

export async function adminSuspend(uid: string, suspended: boolean) {
  return attempt(async () => {
    await requireAdmin();
    await setSuspended(String(uid), !!suspended);
    return {};
  });
}

/** Runs the daily jobs now (reminder emails, move to Free, cleanups) instead of waiting for tonight. */
export async function adminRunDaily() {
  return attempt(async () => {
    await requireAdmin();
    const [reminders, removed, deleted] = await Promise.all([
      runProReminders(),
      cleanupAnonymousDrafts(),
      cleanupDeletedAccounts(),
    ]);
    return { reminders, removed, deleted };
  });
}
