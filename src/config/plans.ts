// Typed access to config/plans.json, the single source of truth for prices and limits.
// Never hard-code a price or a limit anywhere else in the app.
import raw from "../../config/plans.json";

export type Currency = "EGP" | "USD";
export type PlanId = "free" | "pro";

export interface PlanLimits {
  /** null = unlimited */
  projects: number | null;
  storageBytes: number;
  statsDays: number;
  customDomain: boolean;
  passwordProtection: boolean;
  footerCredit: boolean;
}

export interface ProDuration {
  months: 3 | 6 | 12;
  EGP: number;
  USD: number;
  label: string;
}

export interface PlansConfig {
  currencyByCountry: Record<string, Currency> & { default: Currency };
  plans: {
    free: { price: 0; limits: PlanLimits };
    pro: { durations: ProDuration[]; limits: PlanLimits };
  };
  uploads: {
    maxImageBytes: number;
    maxPdfBytes: number;
    maxLoopBytes: number;
    maxLoopSeconds: number;
    longVideo: string;
  };
  renewal: {
    reminderDaysBefore: number[];
    graceDays: number;
    stacking: string;
  };
}

export const plansConfig = raw as PlansConfig;

export function limitsFor(plan: PlanId): PlanLimits {
  return plansConfig.plans[plan].limits;
}

/** Cloudflare's CF-IPCountry header value -> billing currency. */
export function currencyForCountry(country: string | null | undefined): Currency {
  const c = (country ?? "").toUpperCase();
  return plansConfig.currencyByCountry[c] ?? plansConfig.currencyByCountry.default;
}

/** Price per month for a Pro duration, rounded down to a whole unit ("from 112 EGP a month"). */
export function monthlyPrice(d: ProDuration, currency: Currency): number {
  return Math.floor(d[currency] / d.months);
}

/** The cheapest monthly price across Pro durations. */
export function lowestMonthlyPrice(currency: Currency): number {
  return Math.min(...plansConfig.plans.pro.durations.map((d) => monthlyPrice(d, currency)));
}
