// Prepaid Pro (PRICING.md): a user is Pro until `proUntil`, plus a grace period, then Free.
// Nothing is deleted when Pro ends; the public site just shows what Free allows.
import { plansConfig, type PlanId } from "@/config/plans";

export const DAY_MS = 86_400_000;
export const GRACE_DAYS = plansConfig.renewal.graceDays;

export interface PlanFields {
  /** Set by hand for gifts and tests; `proUntil` decides for anyone who bought Pro. */
  plan?: PlanId;
  /** End of the paid period, in milliseconds. */
  proUntil?: number | null;
}

export interface ProStatus {
  plan: PlanId;
  proUntil: number | null;
  /** Whole days until Pro ends (negative once it has ended); null when there's no end date. */
  daysLeft: number | null;
  /** Ended, but still within the grace period. */
  inGrace: boolean;
}

export function proStatus(f: PlanFields, now = Date.now()): ProStatus {
  const until = f.proUntil ?? null;
  if (until === null) return { plan: f.plan === "pro" ? "pro" : "free", proUntil: null, daysLeft: null, inGrace: false };
  const daysLeft = Math.ceil((until - now) / DAY_MS);
  const graceEnd = until + GRACE_DAYS * DAY_MS;
  return {
    plan: now < graceEnd ? "pro" : "free",
    proUntil: until,
    daysLeft,
    inGrace: now >= until && now < graceEnd,
  };
}

/** Buying again while Pro is active adds the months after the current end date. */
export function extendPro(currentUntil: number | null | undefined, months: number, now = Date.now()): number {
  const from = new Date(Math.max(now, currentUntil ?? 0));
  const end = new Date(from);
  end.setUTCMonth(end.getUTCMonth() + months);
  // 31 Jan + 1 month would land in March; keep it at the end of February instead.
  if (end.getUTCDate() !== from.getUTCDate()) end.setUTCDate(0);
  return end.getTime();
}
