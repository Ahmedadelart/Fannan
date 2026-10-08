"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { currencyForCountry } from "@/config/plans";
import { BillingError, checkoutProvider, fulfilOrder, getOrder, startCheckout } from "@/lib/server/billing";
import { rateLimit } from "@/lib/server/rate-limit";
import { requireSession } from "@/lib/server/session";
import { requestOrigin } from "@/lib/surface";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Starts a Pro purchase. The browser then goes to `url` (Paymob, or the practice checkout). */
export async function buyPro(months: number): Promise<Result<{ url: string }>> {
  const session = await requireSession();
  if (session.isAnonymous) return { ok: false, error: "anonymous" };
  if (!rateLimit(`checkout:${session.uid}`, 20, 60 * 60_000)) return { ok: false, error: "slow-down" };
  const h = await headers();
  try {
    const { url } = await startCheckout(session.uid, {
      months: Number(months),
      // The currency follows the visitor's country and is locked into the order from here on.
      currency: currencyForCountry(h.get("cf-ipcountry")),
      locale: (await getLocale()) === "ar" ? "ar" : "en",
      origin: requestOrigin(h),
    });
    return { ok: true, url };
  } catch (e) {
    if (e instanceof BillingError) return { ok: false, error: e.code };
    console.error(e);
    return { ok: false, error: "error" };
  }
}

/** The practice checkout's Pay / Decline buttons (never available in production). */
export async function practicePay(orderId: string, success: boolean): Promise<Result> {
  const { uid } = await requireSession();
  if (checkoutProvider() !== "practice") return { ok: false, error: "unavailable" };
  const order = await getOrder(String(orderId));
  if (!order || order.uid !== uid || order.provider !== "practice") return { ok: false, error: "not-found" };
  await fulfilOrder(order.id, {
    success: !!success,
    transactionId: `practice-${Date.now()}`,
    chargeCents: order.chargeCents,
    chargeCurrency: order.chargeCurrency,
  });
  return { ok: true };
}
