"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { disciplineById } from "@/config/disciplines";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import {
  claimUsernameAndCreateSite,
  createClaim,
  dismissChecklist,
  finishClaim,
  getUser,
  holdUsername,
  logOnboardingEvent,
  markShared,
  saveOnboarding,
  setAvailability,
  setUserLocale,
  type Availability,
} from "@/lib/server/data";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, getSession, isHttps, requireSession } from "@/lib/server/session";
import { layoutIds } from "@/lib/site/starter";
import type { LayoutId } from "@/lib/site/types";

const clean = (s: unknown, max: number) =>
  typeof s === "string"
    ? s
        .replace(/[\u0000-\u001f\u007f<>]/g, "")
        .trim()
        .slice(0, max)
    : undefined;

async function currentLocale(): Promise<Locale> {
  const l = await getLocale();
  return isLocale(l) ? l : "en";
}

/* ---------- sign-up ---------- */

export async function saveStep(input: { step: number; name?: string; discipline?: string; layout?: string }) {
  const { uid } = await requireSession();
  const layout = layoutIds.includes(input.layout as LayoutId) ? (input.layout as LayoutId) : undefined;
  await saveOnboarding(uid, {
    step: Math.max(1, Math.min(6, Math.floor(input.step))),
    name: clean(input.name, 80),
    discipline: clean(input.discipline, 80),
    layout,
  });
}

export async function holdName(name: string): Promise<Availability> {
  const { uid } = await requireSession();
  if (!rateLimit(`hold:${await clientIp()}`, 20, 60_000)) return { ok: false, reason: "taken" };
  return holdUsername(String(name), uid);
}

export async function claimName(name: string): Promise<Availability> {
  const session = await requireSession();
  if (!rateLimit(`claim:${await clientIp()}`, 15, 60_000)) return { ok: false, reason: "taken" };
  const user = await getUser(session.uid);
  const o = user?.onboarding;
  if (!o?.name || !o.discipline || !o.layout) return { ok: false, reason: "too-short" };
  return claimUsernameAndCreateSite(
    session.uid,
    String(name),
    { name: o.name, discipline: o.discipline, layout: o.layout, language: user?.locale ?? (await currentLocale()) },
    session.isAnonymous,
  );
}

/** Called right before sending a magic link or opening Google, while still anonymous. */
export async function prepareClaim(email?: string): Promise<string | null> {
  const session = await getSession();
  if (!session?.isAnonymous) return null;
  if (!rateLimit(`claimtoken:${await clientIp()}`, 10, 60_000)) return null;
  return createClaim(session.uid, clean(email, 200));
}

/** Called after the browser signed in for real and refreshed the session cookie. */
export async function completeSignIn(token: string | null): Promise<{ moved: boolean; hasSite: boolean }> {
  const session = await requireSession();
  if (session.isAnonymous) return { moved: false, hasSite: false };
  const res = await finishClaim(token, session.uid, session.email, await currentLocale());
  const user = await getUser(session.uid);
  // The account's language follows them to every device.
  if (user?.locale) await setLocaleCookie(user.locale);
  return { moved: res.moved, hasSite: !!user?.siteId };
}

export async function logStep(event: {
  step: number;
  action: "view" | "complete";
  ms?: number;
  layout?: string;
  discipline?: string;
  method?: "email" | "google";
}) {
  if (!rateLimit(`log:${await clientIp()}`, 120, 60_000)) return;
  await logOnboardingEvent({
    step: Math.floor(event.step),
    action: event.action === "complete" ? "complete" : "view",
    ...(event.ms ? { ms: Math.min(Math.round(event.ms), 3_600_000) } : {}),
    ...(event.layout && layoutIds.includes(event.layout as LayoutId) ? { layout: event.layout } : {}),
    // Only known disciplines are logged: free text could contain personal details.
    ...(event.discipline && disciplineById(event.discipline) ? { discipline: event.discipline } : {}),
    ...(event.method === "email" || event.method === "google" ? { method: event.method } : {}),
    locale: await currentLocale(),
  });
}

/* ---------- language ---------- */

async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: await isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  const session = await getSession();
  if (session) await setUserLocale(session.uid, locale);
}

/* ---------- dashboard ---------- */

export async function setAvailable(on: boolean, types: string[]) {
  const { uid } = await requireSession();
  await setAvailability(uid, Boolean(on), Array.isArray(types) ? types.map(String).slice(0, 10) : []);
  refresh();
}

export async function hideChecklist() {
  const { uid } = await requireSession();
  await dismissChecklist(uid);
  refresh();
}

export async function linkShared() {
  const { uid } = await requireSession();
  await markShared(uid);
  refresh();
}
