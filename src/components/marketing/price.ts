import "server-only";

import { headers } from "next/headers";
import { getFormatter } from "next-intl/server";
import { currencyForCountry, proDuration } from "@/config/plans";
import type { Locale } from "@/i18n/locales";

/** The money line for a visitor's country, straight from config/plans.json. */
export async function priceCopy(locale: Locale) {
  const currency = currencyForCountry((await headers()).get("cf-ipcountry"));
  const format = await getFormatter();
  const m = (n: number) =>
    currency === "EGP" ? (locale === "ar" ? `${format.number(n)} ج.م` : `${format.number(n)} EGP`) : `$${format.number(n)}`;
  const d3 = proDuration(3)!;
  const d6 = proDuration(6)!;
  const d12 = proDuration(12)!;
  return {
    currency,
    free: m(0),
    monthly: m(Math.floor(d12[currency] / 12)),
    p3: m(d3[currency]),
    p6: m(d6[currency]),
    egpFrom: `${format.number(Math.floor(d12.EGP / 12))}`,
  };
}
