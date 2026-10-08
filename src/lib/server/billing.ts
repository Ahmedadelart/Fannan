import "server-only";



import { createHmac, timingSafeEqual } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { firebaseEnv } from "@/config/firebase";

import { plansConfig, proDuration, type Currency } from "@/config/plans";

import { adminDb } from "@/lib/firebase/admin";

import { DAY_MS, extendPro, GRACE_DAYS, proStatus } from "@/lib/plan";

import { getUser, type UserDoc } from "./data";

import { escapeHtml, sendEmail } from "./email";

import { forgetDomainsFor } from "./domains";

import { forgetLiveSite } from "./public";

import { sharedMap } from "./shared-memory";

import { purgeSiteCache } from "./site";



// Prepaid Pro (PRICING.md): one payment buys 3, 6 or 12 months; nothing renews by itself.

// Checkout goes through Paymob when its keys are set. Without them (local and staging only) a

// practice checkout stands in, so the whole experience can be tried without real money.

// Every successful payment, practice or real, goes through fulfilOrder().



export type Provider = "paymob" | "practice" | "gift";

export type OrderStatus = "pending" | "paid" | "failed" | "refunded";



export interface Order {

  id: string;

  uid: string;

  email: string;

  username: string;

  months: number;

  /** What the artist was shown: EGP in Egypt, USD elsewhere. Locked when the order is made. */

  currency: Currency;

  amount: number;

  /** What the card is actually charged (USD prices are charged in EGP until Paymob allows USD). */

  chargeCurrency: Currency;

  chargeCents: number;

  /** EGP per USD on the day, when a USD price was charged in EGP. */

  rate: number | null;

  offer: boolean;

  provider: Provider;

  status: OrderStatus;

  locale: "en" | "ar";

  transactionId: string | null;

  proUntilBefore: number | null;

  proUntilAfter: number | null;

  createdAt: number;

  paidAt: number | null;

  refundedAt: number | null;

  note?: string;

}



export class BillingError extends Error {

  constructor(public code: "unavailable" | "bad-plan" | "not-found" | "rate" | "provider" | "not-paid") {

    super(code);

  }

}



const orders = () => adminDb().collection("orders");

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";



/** A link into the dashboard for emails (no request to read the address from). */

export function appLink(path: string) {

  const origin = process.env.APP_ORIGIN;

  if (origin && process.env.SURFACE_SWITCHER === "true") {

    return `${origin}/__surface?to=app&next=${encodeURIComponent(path)}`;

  }

  return `${origin ?? `https://app.${ROOT_DOMAIN}`}${path}`;

}



/* ---------- which checkout ---------- */



function paymobKeys() {

  const secret = process.env.PAYMOB_SECRET_KEY;

  const publicKey = process.env.PAYMOB_PUBLIC_KEY;

  const integrations = (process.env.PAYMOB_INTEGRATION_IDS ?? "")

    .split(",")

    .map((s) => Number(s.trim()))

    .filter(Boolean);

  return secret && publicKey && integrations.length ? { secret, publicKey, integrations } : null;

}



/** Real payments when Paymob is set up; the practice checkout everywhere except production. */

export function checkoutProvider(): Exclude<Provider, "gift"> | null {

  if (paymobKeys()) return "paymob";

  return firebaseEnv() === "production" ? null : "practice";

}



/* ---------- prices ---------- */



async function offerOpen(): Promise<boolean> {

  const o = plansConfig.launchOffer;

  if (!o.enabled) return false;

  const paid = await orders().where("status", "==", "paid").where("provider", "in", ["paymob", "practice"]).count().get();

  return paid.data().count < o.firstBuyers;

}



/** Prices for the upgrade page, in the artist's currency (launch offer applied when it's on). */

export async function priceList(currency: Currency) {

  const offer = await offerOpen();

  return plansConfig.plans.pro.durations.map((d) => {

    const pay = offer && d.months === plansConfig.launchOffer.months ? proDuration(plansConfig.launchOffer.priceOfMonths) : d;

    const amount = pay?.[currency] ?? d[currency];

    return { months: d.months, amount, perMonth: Math.floor(amount / d.months), label: d.label, offer: amount !== d[currency] };

  });

}



const rateCache = sharedMap<string, { at: number; rate: number }>("usdEgp");



/** Today's EGP per USD (cached for 6 hours). */

export async function usdToEgp(): Promise<number> {

  // Automated tests use a fixed rate.

  const fixed = Number(process.env.USD_EGP_RATE);

  if (fixed > 0) return fixed;

  const hit = rateCache.get("rate");

  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.rate;

  try {

    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });

    const rate = Number(((await res.json()) as { rates?: Record<string, number> }).rates?.EGP);

    if (rate > 10 && rate < 1000) {

      rateCache.set("rate", { at: Date.now(), rate });

      return rate;

    }

  } catch {

    /* fall through */

  }

  if (hit) return hit.rate;

  const fallback = Number(process.env.USD_EGP_FALLBACK);

  if (fallback > 10) return fallback;

  throw new BillingError("rate");

}



/* ---------- checkout ---------- */



export async function startCheckout(

  uid: string,

  input: { months: number; currency: Currency; locale: "en" | "ar"; origin: string },

): Promise<{ orderId: string; url: string }> {

  const provider = checkoutProvider();

  if (!provider) throw new BillingError("unavailable");

  const price = (await priceList(input.currency)).find((p) => p.months === input.months);

  if (!price) throw new BillingError("bad-plan");

  const user = await getUser(uid);

  if (!user?.siteId || user.isAnonymous) throw new BillingError("not-found");

  const site = (await adminDb().collection("sites").doc(user.siteId).get()).data();



  let chargeCurrency: Currency = input.currency;

  let chargeCents = price.amount * 100;

  let rate: number | null = null;

  if (input.currency === "USD" && !plansConfig.payments.chargeUsd) {

    rate = await usdToEgp();

    chargeCurrency = "EGP";

    chargeCents = Math.round(price.amount * rate * 100);

  }



  const ref = orders().doc();

  const order: Omit<Order, "id"> = {

    uid,

    email: user.email ?? "",

    username: String(site?.username ?? ""),

    months: input.months,

    currency: input.currency,

    amount: price.amount,

    chargeCurrency,

    chargeCents,

    rate,

    offer: price.offer,

    provider,

    status: "pending",

    locale: input.locale,

    transactionId: null,

    proUntilBefore: null,

    proUntilAfter: null,

    createdAt: Date.now(),

    paidAt: null,

    refundedAt: null,

  };

  await ref.set(order);



  if (provider === "practice") return { orderId: ref.id, url: `/checkout/${ref.id}` };



  const keys = paymobKeys()!;

  const name = (user.displayName ?? "Fannan artist").trim().split(/\s+/);

  const res = await fetch("https://accept.paymob.com/v1/intention/", {

    method: "POST",

    headers: { Authorization: `Token ${keys.secret}`, "Content-Type": "application/json" },

    body: JSON.stringify({

      amount: chargeCents,

      currency: chargeCurrency,

      payment_methods: keys.integrations,

      items: [{ name: `Fannan Pro · ${input.months} months`, amount: chargeCents, quantity: 1 }],

      billing_data: {

        first_name: name[0] || "Fannan",

        last_name: name.slice(1).join(" ") || "Artist",

        email: user.email ?? "NA",

        phone_number: "NA",

      },

      special_reference: ref.id,

      notification_url: `${input.origin}/api/paymob/callback`,

      redirection_url: `${input.origin}/billing/return?order=${ref.id}`,

    }),

    signal: AbortSignal.timeout(15_000),

  }).catch(() => null);

  const body = (await res?.json().catch(() => null)) as { client_secret?: string; intention_order_id?: number } | null;

  if (!res?.ok || !body?.client_secret) {

    console.error("paymob intention failed", res?.status, JSON.stringify(body).slice(0, 500));

    await ref.update({ status: "failed", note: "intention failed" });

    throw new BillingError("provider");

  }

  await ref.update({ paymobOrderId: body.intention_order_id ?? null });

  return {

    orderId: ref.id,

    url: `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(keys.publicKey)}&clientSecret=${encodeURIComponent(body.client_secret)}`,

  };

}



export async function getOrder(id: string): Promise<Order | null> {

  const snap = await orders().doc(id).get();

  return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Order, "id">) } as Order) : null;

}



export async function listOrders(filter: { uid?: string; limit?: number } = {}): Promise<Order[]> {

  let q = orders().orderBy("createdAt", "desc");

  if (filter.uid) q = orders().where("uid", "==", filter.uid).orderBy("createdAt", "desc");

  const snap = await q.limit(filter.limit ?? 200).get();

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, "id">) }) as Order);

}



async function refreshSite(uid: string) {

  const user = await getUser(uid);

  if (!user?.siteId) return;

  const username = (await adminDb().collection("sites").doc(user.siteId).get()).data()?.username as string | undefined;

  if (username) {

    forgetLiveSite(username);

    forgetDomainsFor(username);

    await purgeSiteCache(username);

  }

}



/**

 * A payment went through (or didn't). Safe to call more than once for the same order: Paymob

 * retries callbacks, and the artist's return page may race the callback.

 */

export async function fulfilOrder(

  orderId: string,

  result: { success: boolean; transactionId?: string; chargeCents?: number; chargeCurrency?: string },

): Promise<Order | null> {

  const db = adminDb();

  const ref = orders().doc(orderId);

  const outcome = await db.runTransaction(async (tx) => {

    const snap = await tx.get(ref);

    const order = snap.data() as Omit<Order, "id"> | undefined;

    if (!order || order.status !== "pending") return { order, changed: false };

    // A callback that doesn't match what we asked for is never trusted.

    const matches =

      (result.chargeCents === undefined || result.chargeCents === order.chargeCents) &&

      (result.chargeCurrency === undefined || result.chargeCurrency === order.chargeCurrency);

    if (!result.success || !matches) {

      tx.update(ref, { status: "failed", transactionId: result.transactionId ?? null, note: matches ? "" : "amount mismatch" });

      return { order: { ...order, status: "failed" as const }, changed: true };

    }

    const userRef = db.collection("users").doc(order.uid);

    const user = (await tx.get(userRef)).data() as UserDoc | undefined;

    const before = user?.proUntil?.toMillis() ?? null;

    // An expired end date (even within grace) doesn't carry over: the new months start today.

    const after = extendPro(before && before > Date.now() ? before : null, order.months);

    tx.update(userRef, { proUntil: Timestamp.fromMillis(after), proReminders: {} });

    const patch = {

      status: "paid" as const,

      transactionId: result.transactionId ?? null,

      paidAt: Date.now(),

      proUntilBefore: before,

      proUntilAfter: after,

    };

    tx.update(ref, patch);

    return { order: { ...order, ...patch }, changed: true };

  });

  const order = outcome.order ? ({ id: orderId, ...outcome.order } as Order) : null;

  if (order && outcome.changed && order.status === "paid") {

    await refreshSite(order.uid);

    await sendReceipt(order).catch((e) => console.error("receipt", e));

  }

  return order;

}



/* ---------- Paymob callback ---------- */



const HMAC_FIELDS = [

  "amount_cents",

  "created_at",

  "currency",

  "error_occured",

  "has_parent_transaction",

  "id",

  "integration_id",

  "is_3d_secure",

  "is_auth",

  "is_capture",

  "is_refunded",

  "is_standalone_payment",

  "is_voided",

  "order.id",

  "owner",

  "pending",

  "source_data.pan",

  "source_data.sub_type",

  "source_data.type",

  "success",

];



/** Paymob signs the transaction callback with HMAC-SHA512 over 20 fields in a fixed order. */

export function verifyPaymobHmac(obj: Record<string, unknown>, hmac: string): boolean {

  const secret = process.env.PAYMOB_HMAC_SECRET;

  if (!secret || !hmac) return false;

  const get = (path: string) =>

    path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), obj);

  const text = HMAC_FIELDS.map((f) => {

    const v = get(f);

    return v === undefined || v === null ? "" : String(v);

  }).join("");

  const mine = createHmac("sha512", secret).update(text).digest("hex");

  const a = Buffer.from(mine);

  const b = Buffer.from(hmac.toLowerCase());

  return a.length === b.length && timingSafeEqual(a, b);

}



/* ---------- refunds, gifts and admin tools ---------- */



/** Refunds a payment and takes back the months it bought (Pro ends at once if nothing is left). */

export async function refundOrder(orderId: string, by: string): Promise<Order> {

  const order = await getOrder(orderId);

  if (!order) throw new BillingError("not-found");

  if (order.status !== "paid") throw new BillingError("not-paid");

  if (order.provider === "paymob" && order.transactionId) {

    const keys = paymobKeys();

    if (!keys) throw new BillingError("unavailable");

    const res = await fetch("https://accept.paymob.com/api/acceptance/void_refund/refund", {

      method: "POST",

      headers: { Authorization: `Token ${keys.secret}`, "Content-Type": "application/json" },

      body: JSON.stringify({ transaction_id: order.transactionId, amount_cents: order.chargeCents }),

      signal: AbortSignal.timeout(15_000),

    }).catch(() => null);

    if (!res?.ok) {

      console.error("paymob refund failed", res?.status, await res?.text().catch(() => ""));

      throw new BillingError("provider");

    }

  }

  const db = adminDb();

  await db.runTransaction(async (tx) => {

    const userRef = db.collection("users").doc(order.uid);

    const user = (await tx.get(userRef)).data() as UserDoc | undefined;

    const until = user?.proUntil?.toMillis() ?? null;

    const bought = (order.proUntilAfter ?? 0) - Math.max(order.proUntilBefore ?? 0, order.paidAt ?? 0);

    let next = until !== null ? until - Math.max(0, bought) : null;

    // Nothing left: Pro ends now, without a grace period.

    if (next !== null && next <= Date.now()) next = Date.now() - GRACE_DAYS * DAY_MS - 1000;

    tx.update(userRef, { proUntil: next === null ? null : Timestamp.fromMillis(next) });

    tx.update(orders().doc(orderId), { status: "refunded", refundedAt: Date.now(), refundedBy: by });

  });

  await refreshSite(order.uid);

  return (await getOrder(orderId))!;

}



/** Pro as a gift (beta artists, launch offer). Stacks like a purchase and shows in the payments list. */

export async function grantPro(uid: string, months: number, by: string, note = "") {

  const db = adminDb();

  const user = await getUser(uid);

  if (!user) throw new BillingError("not-found");

  const before = user.proUntil?.toMillis() ?? null;

  const after = extendPro(before && before > Date.now() ? before : null, months);

  const site = user.siteId ? (await db.collection("sites").doc(user.siteId).get()).data() : undefined;

  await db.collection("users").doc(uid).update({ proUntil: Timestamp.fromMillis(after), proReminders: {} });

  await orders().add({

    uid,

    email: user.email ?? "",

    username: site?.username ?? "",

    months,

    currency: "USD",

    amount: 0,

    chargeCurrency: "USD",

    chargeCents: 0,

    rate: null,

    offer: false,

    provider: "gift",

    status: "paid",

    locale: user.locale,

    transactionId: null,

    proUntilBefore: before,

    proUntilAfter: after,

    createdAt: Date.now(),

    paidAt: Date.now(),

    refundedAt: null,

    note: note || `Given by ${by}`,

  } satisfies Omit<Order, "id">);

  await refreshSite(uid);

  return after;

}



/** For trying reminders and the move to Free without waiting (admin page). */

export async function setProUntil(uid: string, until: number | null) {

  await adminDb()

    .collection("users")

    .doc(uid)

    .update({ proUntil: until === null ? null : Timestamp.fromMillis(until), proReminders: {} });

  await refreshSite(uid);

}



/* ---------- emails ---------- */



const money = (amount: number, currency: Currency, ar: boolean) =>

  currency === "EGP"

    ? `${new Intl.NumberFormat(ar ? "ar-EG" : "en").format(amount)} ${ar ? "جنيه" : "EGP"}`

    : `$${amount}`;

const day = (ms: number, ar: boolean) =>

  new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { dateStyle: "long", timeZone: "Africa/Cairo" }).format(ms);



async function sendReceipt(order: Order) {

  if (!order.email) return;

  const ar = order.locale === "ar";

  const paid = money(order.amount, order.currency, ar);

  const charged =

    order.chargeCurrency !== order.currency ? money(Math.round(order.chargeCents / 100), order.chargeCurrency, ar) : null;

  const until = day(order.proUntilAfter!, ar);

  const lines = ar

    ? [

        `شكرًا! اشتراكك في فنان Pro لمدة ${order.months} أشهر مفعّل.`,

        `المبلغ: ${paid}${charged ? ` (خُصم ${charged})` : ""}`,

        `Pro فعّال حتى ${until}. لا شيء يتجدد تلقائيًا، وسنذكّرك قبل انتهائه.`,

        `رقم الطلب: ${order.id}`,

      ]

    : [

        `Thank you! Your ${order.months} months of Fannan Pro are on.`,

        `Amount: ${paid}${charged ? ` (charged as ${charged})` : ""}`,

        `Pro runs until ${until}. Nothing renews automatically; we'll remind you before it ends.`,

        `Order: ${order.id}`,

      ];

  await sendEmail({

    to: order.email,

    subject: ar ? "إيصال فنان Pro" : "Your Fannan Pro receipt",

    text: lines.join("\n\n"),

    html: lines.map((l) => `<p${ar ? ' dir="rtl"' : ""}>${escapeHtml(l)}</p>`).join(""),

  });

}



type ReminderKey = "d14" | "d3" | "d0" | "free";



/** Which reminder (if any) is due for this end date today. */

export function reminderDue(f: { proUntil: number; sent: Record<string, boolean> }, now = Date.now()): ReminderKey | null {

  const s = proStatus({ proUntil: f.proUntil }, now);

  if (s.plan === "free") return f.sent.free ? null : "free";

  if (s.daysLeft !== null && s.daysLeft <= 0) return f.sent.d0 ? null : "d0";

  if (s.daysLeft !== null && s.daysLeft <= 3) return f.sent.d3 || f.sent.d0 ? null : "d3";

  if (s.daysLeft !== null && s.daysLeft <= 14) return f.sent.d14 || f.sent.d3 || f.sent.d0 ? null : "d14";

  return null;

}



function reminderEmail(key: ReminderKey, user: UserDoc, until: number) {

  const ar = user.locale === "ar";

  const link = appLink("/upgrade");

  const end = day(until, ar);

  const graceEnd = day(until + GRACE_DAYS * DAY_MS, ar);

  const t = {

    d14: ar

      ? [`ينتهي فنان Pro في ${end}`, `بقي أسبوعان على انتهاء Pro. أضف وقتًا بضغطة واحدة؛ يُضاف بعد تاريخ الانتهاء الحالي فلا تخسر يومًا.`]

      : [`Your Fannan Pro ends on ${end}`, `Two weeks left. Add more time in one click; it's added after your current end date, so you don't lose a day.`],

    d3: ar

      ? [`بقي ٣ أيام على Pro`, `ينتهي Pro في ${end}. أضف وقتًا ليبقى نطاقك وكل مشاريعك كما هي.`]

      : [`3 days of Pro left`, `Pro ends on ${end}. Add more time to keep your domain and all your projects as they are.`],

    d0: ar

      ? [`انتهى Pro اليوم`, `لديك مهلة حتى ${graceEnd}، ثم ينتقل موقعك إلى الباقة المجانية. لن يُحذف شيء.`]

      : [`Your Pro ended today`, `You have until ${graceEnd} before your site moves to Free. Nothing will be deleted.`],

    free: ar

      ? [`موقعك الآن على الباقة المجانية`, `أخفينا ما لا تشمله المجانية (المشاريع بعد الثمانية الأحدث، الصفحات المحمية، النطاق الخاص). لم يُحذف شيء، ويعود كل ذلك عندما تعود إلى Pro.`]

      : [`Your site is on Free now`, `We've hidden what Free doesn't include (projects beyond your newest 8, password pages, your own domain). Nothing was deleted, and it all comes back when you return to Pro.`],

  }[key];

  const cta = ar ? "أضف وقتًا" : "Add more time";

  return {

    to: user.email!,

    subject: t[0],

    text: `${t[1]}\n\n${cta}: ${link}`,

    html: `<div${ar ? ' dir="rtl"' : ""}><p>${escapeHtml(t[1])}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#141414;color:#fff;text-decoration:none;font-weight:600">${cta}</a></p></div>`,

  };

}



/** Daily: reminder emails at 14, 3 and 0 days, and a note when the site moves to Free. */

export async function runProReminders(now = Date.now()): Promise<number> {

  const db = adminDb();

  const snap = await db

    .collection("users")

    // Each email goes once per period (proReminders), so a wide window just catches missed days.
    .where("proUntil", ">=", Timestamp.fromMillis(now - (GRACE_DAYS + 30) * DAY_MS))

    .where("proUntil", "<=", Timestamp.fromMillis(now + 15 * DAY_MS))

    .get();

  let sent = 0;

  for (const d of snap.docs) {

    const user = d.data() as UserDoc;

    const until = user.proUntil?.toMillis();

    if (!until || !user.email) continue;

    const key = reminderDue({ proUntil: until, sent: user.proReminders ?? {} }, now);

    if (!key) continue;

    await d.ref.update({ [`proReminders.${key}`]: true });

    await sendEmail(reminderEmail(key, user, until));

    if (key === "free") await refreshSite(d.id);

    sent += 1;

  }

  return sent;

}

