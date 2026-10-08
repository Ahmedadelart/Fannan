import "server-only";

import { createHmac } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

// Privacy-friendly visit counting for artist sites: no cookies, no IP addresses stored.
// A visitor is a daily-rotating hash of (site, IP, browser); it can't be reversed or linked
// across days. One Firestore document per site per day: stats/{siteId}_{YYYYMMDD}.

const SECRET = process.env.SITE_SIGNING_SECRET ?? "local-dev-only-secret";
const MAX_SECONDS = 30 * 60;

export const BOT_RE =
  /bot|crawl|spider|slurp|preview|fetch|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|java\/|go-http|axios|node-fetch|monitor|uptime/i;

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, "");

const docId = (siteId: string, day: string) => `${siteId}_${day}`;

export function visitorHash(siteId: string, ip: string, ua: string, day = dayKey()) {
  return createHmac("sha256", SECRET).update(`${day}:${siteId}:${ip}:${ua}`).digest("base64url").slice(0, 12);
}

/** "l.instagram.com" → "instagram.com", "www.google.com.eg" → "google". Empty = direct. */
export function referrerName(ref: string, ownHost: string): string {
  let host = "";
  try {
    host = new URL(ref).hostname.toLowerCase().replace(/^(www|m|l|lm|mobile)\./, "");
  } catch {
    return "direct";
  }
  if (!host || host === ownHost.toLowerCase().replace(/^www\./, "")) return "direct";
  if (/^google\./.test(host) || host.endsWith(".google.com")) return "google";
  if (host.endsWith("fannan.net")) return "fannan";
  if (host === "t.co" || host === "x.com" || host === "twitter.com") return "x.com";
  if (host.endsWith("facebook.com") || host === "fb.com") return "facebook.com";
  if (host.endsWith("linkedin.com") || host === "lnkd.in") return "linkedin.com";
  if (host.endsWith("whatsapp.com") || host === "wa.me") return "whatsapp";
  return host.slice(0, 60);
}

// Firestore map keys can't contain dots or slashes.
const key = (s: string) => s.replace(/[./\s]/g, "_").slice(0, 80);

/** `set` (unlike `update`) takes "a.b" keys literally, so turn them into nested objects. */
function nest(flat: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    const [head, ...rest] = k.split(".");
    if (!rest.length) out[head] = v;
    else ((out[head] ??= {}) as Record<string, unknown>)[rest.join(".")] = v;
  }
  return out;
}

export async function recordView(input: {
  siteId: string;
  ip: string;
  ua: string;
  projectId: string | null;
  referrer: string;
  country: string | null;
}) {
  const day = dayKey();
  const ref = adminDb().collection("stats").doc(docId(input.siteId, day));
  const hash = visitorHash(input.siteId, input.ip, input.ua, day);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const seen = !!(snap.data()?.v as Record<string, boolean> | undefined)?.[hash];
    const update: Record<string, unknown> = {
      siteId: input.siteId,
      day,
      views: FieldValue.increment(1),
    };
    if (input.projectId) update[`byProject.${key(input.projectId)}`] = FieldValue.increment(1);
    if (!seen) {
      update.visitors = FieldValue.increment(1);
      update[`v.${hash}`] = true;
      update[`referrers.${key(input.referrer)}`] = FieldValue.increment(1);
      if (input.country && /^[A-Z]{2}$/.test(input.country) && input.country !== "XX" && input.country !== "T1") {
        update[`countries.${input.country}`] = FieldValue.increment(1);
      }
    }
    if (snap.exists) tx.update(ref, update);
    else tx.set(ref, nest(update), { merge: true });
  });
}

export async function recordTime(siteId: string, seconds: number) {
  const s = Math.round(Math.min(MAX_SECONDS, Math.max(0, seconds)));
  if (!s) return;
  await adminDb()
    .collection("stats")
    .doc(docId(siteId, dayKey()))
    .set({ siteId, day: dayKey(), timeTotal: FieldValue.increment(s), timeCount: FieldValue.increment(1) }, { merge: true });
}

/* ---------- reading ---------- */

export interface DayStats {
  day: string;
  visitors: number;
  views: number;
  published: boolean;
}

export interface Totals {
  visitors: number;
  views: number;
  projectViews: number;
  avgSeconds: number;
}

export interface StatsReport {
  days: DayStats[];
  totals: Totals;
  previous: Totals;
  byProject: Record<string, number>;
  referrers: Record<string, number>;
  countries: Record<string, number>;
}

type Doc = {
  visitors?: number;
  views?: number;
  timeTotal?: number;
  timeCount?: number;
  byProject?: Record<string, number>;
  referrers?: Record<string, number>;
  countries?: Record<string, number>;
};

function sum(docs: Doc[]): Totals {
  const t = docs.reduce<{ visitors: number; views: number; projectViews: number; time: number; timed: number }>(
    (a, d) => ({
      visitors: a.visitors + (d.visitors ?? 0),
      views: a.views + (d.views ?? 0),
      projectViews: a.projectViews + Object.values(d.byProject ?? {}).reduce((x, y) => x + y, 0),
      time: a.time + (d.timeTotal ?? 0),
      timed: a.timed + (d.timeCount ?? 0),
    }),
    { visitors: 0, views: 0, projectViews: 0, time: 0, timed: 0 },
  );
  return { visitors: t.visitors, views: t.views, projectViews: t.projectViews, avgSeconds: t.timed ? Math.round(t.time / t.timed) : 0 };
}

function merge(docs: Doc[], field: "byProject" | "referrers" | "countries") {
  const out: Record<string, number> = {};
  for (const d of docs) for (const [k, v] of Object.entries(d[field] ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

export async function statsReport(siteId: string, range: number, publishDays: string[] = []): Promise<StatsReport> {
  const today = new Date();
  const dayList = (offset: number) =>
    Array.from({ length: range }, (_, i) => dayKey(new Date(today.getTime() - (offset + range - 1 - i) * 86_400_000)));
  const current = dayList(0);
  const previous = dayList(range);
  const col = adminDb().collection("stats");
  const snaps = await adminDb().getAll(...[...current, ...previous].map((d) => col.doc(docId(siteId, d))));
  const byDay = new Map(snaps.filter((s) => s.exists).map((s) => [s.id.split("_").pop()!, s.data() as Doc]));
  const cur = current.map((d) => byDay.get(d) ?? {});
  const prev = previous.map((d) => byDay.get(d) ?? {});
  const published = new Set(publishDays);
  return {
    days: current.map((d, i) => ({ day: d, visitors: cur[i].visitors ?? 0, views: cur[i].views ?? 0, published: published.has(d) })),
    totals: sum(cur),
    previous: sum(prev),
    byProject: merge(cur, "byProject"),
    referrers: merge(cur, "referrers"),
    countries: merge(cur, "countries"),
  };
}
