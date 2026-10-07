import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import type { SiteDoc } from "./data";
import { readPublished, type PublishedSite } from "./site";

// Everything the public renderer reads: username → site → published snapshot.
// One small in-memory cache per server instance; Cloudflare caches pages in front of it.

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: (PublishedSite & { siteId: string; ownerUid: string }) | null }>();

export type LiveSite = PublishedSite & { siteId: string; ownerUid: string };

export async function liveSite(username: string): Promise<LiveSite | null> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const db = adminDb();
  const name = (await db.collection("usernames").doc(key).get()).data() as
    { siteId?: string; status?: string } | undefined;
  let value: LiveSite | null = null;
  if (name?.siteId) {
    const site = (await db.collection("sites").doc(name.siteId).get()).data() as
      (SiteDoc & { suspended?: boolean }) | undefined;
    if (site?.publishedVersion && !site.suspended) {
      const snap = await readPublished(name.siteId, site.publishedVersion);
      if (snap) value = { ...snap, available: site.available, siteId: name.siteId, ownerUid: site.ownerUid };
    }
  }
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  return value;
}

/** Called after publish so this instance shows the new version at once. */
export function forgetLiveSite(username: string) {
  cache.delete(username.toLowerCase());
}

/* ---------- signed access for password-protected pages and projects ---------- */

const SECRET = process.env.SITE_SIGNING_SECRET ?? "local-dev-only-secret";

function sign(value: string) {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Cookie value that proves the visitor typed the password for this page/project (30 days). */
export function accessCookieValue(siteId: string, scope: string, version: number) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return `${exp}.${sign(`access:${siteId}:${scope}:${version}:${exp}`)}`;
}

export function checkAccessCookie(value: string | undefined, siteId: string, scope: string, version: number) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, sign(`access:${siteId}:${scope}:${version}:${exp}`));
}

export const accessCookieName = (scope: string) => `fp_${scope.replace(/[^a-zA-Z0-9]/g, "")}`;

/** Media of a protected project/page is served through a short-lived token (1 hour). */
export function mediaToken(siteId: string, scope: string) {
  const exp = Date.now() + 60 * 60 * 1000;
  return `${scope}.${exp}.${sign(`media:${siteId}:${scope}:${exp}`)}`;
}

export function checkMediaToken(token: string, siteId: string): string | null {
  const [scope, exp, sig] = token.split(".");
  if (!scope || !exp || !sig || Number(exp) < Date.now()) return null;
  return same(sig, sign(`media:${siteId}:${scope}:${exp}`)) ? scope : null;
}

/** Which media ids sit behind a password, by scope (project id or page id). */
export function protectedMedia(site: PublishedSite): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of site.projects) {
    if (p.visibility === "password" && p.passwordHash) p.mediaIds.forEach((id) => map.set(id, p.id));
  }
  return map;
}
