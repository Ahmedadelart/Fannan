import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { limitsFor } from "@/config/plans";
import { checkUsername, normalizeUsername } from "@/config/usernames";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Locale } from "@/i18n/locales";
import { SOCIAL_NETWORKS } from "@/lib/site/blocks";
import type { Availability } from "./data";
import { scryptHash } from "./passwords";
import { ProjectError, type Owner } from "./projects";
import { forgetLiveSite } from "./public";
import { purgeSiteCache } from "./site";

// Site settings that apply straight away, without publishing again (Settings.dc.html):
// privacy, contact routing and form fields, social links, CV, search & sharing, integrations.

export interface SiteSettings {
  privacy: { indexable: boolean; searchable: boolean; protectImages: boolean };
  hasSitePassword: boolean;
  contact: { email: boolean; projectType: boolean; budget: boolean; deadline: boolean; customQuestion: string };
  social: Array<{ network: string; url: string }>;
  cvMediaId: string | null;
  seo: { title: string; description: string; shareImageId: string | null };
  integrations: { gaId: string; pixelId: string };
}

export const defaultSettings: SiteSettings = {
  privacy: { indexable: true, searchable: true, protectImages: false },
  hasSitePassword: false,
  contact: { email: true, projectType: false, budget: false, deadline: false, customQuestion: "" },
  social: [],
  cvMediaId: null,
  seo: { title: "", description: "", shareImageId: null },
  integrations: { gaId: "", pixelId: "" },
};

type Raw = Partial<Omit<SiteSettings, "hasSitePassword">> & { passwordHash?: string | null };

export function settingsFrom(site: Raw): SiteSettings {
  return {
    privacy: { ...defaultSettings.privacy, ...(site.privacy ?? {}) },
    hasSitePassword: !!site.passwordHash,
    contact: { ...defaultSettings.contact, ...(site.contact ?? {}) },
    social: site.social ?? [],
    cvMediaId: site.cvMediaId ?? null,
    seo: { ...defaultSettings.seo, ...(site.seo ?? {}) },
    integrations: { ...defaultSettings.integrations, ...(site.integrations ?? {}) },
  };
}

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max) : "";
const id = (v: unknown) => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : null);
const httpUrl = (v: unknown) => {
  const s = str(v, 300);
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
};

async function refresh(o: Owner) {
  forgetLiveSite(o.site.username);
  await purgeSiteCache(o.site.username);
}

export async function saveSettings(o: Owner, raw: Partial<SiteSettings>) {
  const u: Record<string, unknown> = {};
  if (raw.privacy) {
    u.privacy = {
      indexable: !!raw.privacy.indexable,
      searchable: !!raw.privacy.searchable,
      protectImages: !!raw.privacy.protectImages,
    };
  }
  if (raw.contact) {
    u.contact = {
      email: !!raw.contact.email,
      projectType: !!raw.contact.projectType,
      budget: !!raw.contact.budget,
      deadline: !!raw.contact.deadline,
      customQuestion: str(raw.contact.customQuestion, 160),
    };
  }
  if (raw.social) {
    u.social = raw.social
      .slice(0, 12)
      .map((l) => ({ network: SOCIAL_NETWORKS.includes(l.network) ? l.network : "website", url: httpUrl(l.url) }))
      .filter((l) => l.url);
  }
  if (raw.cvMediaId !== undefined) u.cvMediaId = id(raw.cvMediaId);
  if (raw.seo) {
    u.seo = { title: str(raw.seo.title, 120), description: str(raw.seo.description, 300), shareImageId: id(raw.seo.shareImageId) };
  }
  if (raw.integrations) {
    const ga = str(raw.integrations.gaId, 20).toUpperCase();
    const px = str(raw.integrations.pixelId, 20);
    u.integrations = { gaId: /^G-[A-Z0-9]{4,16}$/.test(ga) ? ga : "", pixelId: /^\d{6,20}$/.test(px) ? px : "" };
  }
  if (Object.keys(u).length) await adminDb().collection("sites").doc(o.siteId).update(u);
  await refresh(o);
}

/** Site language and favicon belong to the draft: they change the live site on the next publish. */
export async function saveSiteBasics(o: Owner, raw: { language?: string; faviconMediaId?: string | null }) {
  const u: Record<string, unknown> = { draftUpdatedAt: FieldValue.serverTimestamp() };
  if (raw.language === "en" || raw.language === "ar") u.language = raw.language;
  if (raw.faviconMediaId !== undefined) {
    const mid = id(raw.faviconMediaId);
    if (mid) {
      const m = (await adminDb().collection("sites").doc(o.siteId).collection("media").doc(mid).get()).data();
      if (m?.type !== "image" || m.status !== "ready") throw new ProjectError("not-found");
    }
    u["theme.faviconMediaId"] = mid;
  }
  await adminDb().collection("sites").doc(o.siteId).update(u);
}

/** Whole-site password (Pro). Empty removes it. */
export async function setSitePassword(o: Owner, password: string) {
  if (!limitsFor(o.plan).passwordProtection) throw new ProjectError("pro-only");
  await adminDb()
    .collection("sites")
    .doc(o.siteId)
    .update({ passwordHash: password ? await scryptHash(password.slice(0, 200)) : null });
  await refresh(o);
}

/* ---------- username change, with a 30-day redirect from the old address ---------- */

const REDIRECT_DAYS = 30;

export async function changeUsername(o: Owner, input: string): Promise<Availability & { username?: string }> {
  const name = normalizeUsername(input);
  const problem = checkUsername(name);
  if (problem) return { ok: false, reason: problem };
  const old = o.site.username;
  if (name === old) return { ok: true, username: name };
  const db = adminDb();
  const result = await db.runTransaction(async (tx) => {
    const ref = db.collection("usernames").doc(name);
    const doc = (await tx.get(ref)).data() as
      | { uid: string; status: string; expiresAt?: Timestamp | null }
      | undefined;
    const free = !doc || doc.uid === o.uid || (doc.status !== "claimed" && !!doc.expiresAt && doc.expiresAt.toMillis() < Date.now());
    if (!free) return { ok: false as const, reason: "taken" as const };
    tx.set(ref, { uid: o.uid, siteId: o.siteId, status: "claimed", expiresAt: null });
    tx.set(db.collection("usernames").doc(old), {
      uid: o.uid,
      status: "redirect",
      redirectTo: name,
      expiresAt: Timestamp.fromMillis(Date.now() + REDIRECT_DAYS * 86_400_000),
    });
    tx.update(db.collection("sites").doc(o.siteId), { username: name });
    tx.set(db.collection("users").doc(o.uid), { onboarding: { username: name } }, { merge: true });
    return { ok: true as const, username: name };
  });
  if (result.ok) {
    forgetLiveSite(old);
    forgetLiveSite(name);
    await purgeSiteCache(old);
    await purgeSiteCache(name);
  }
  return result;
}

/** If this name now points elsewhere (changed username), where to send visitors. */
export async function usernameRedirect(username: string): Promise<string | null> {
  const doc = (await adminDb().collection("usernames").doc(username).get()).data() as
    | { status?: string; redirectTo?: string; expiresAt?: Timestamp | null }
    | undefined;
  if (doc?.status !== "redirect" || !doc.redirectTo) return null;
  if (doc.expiresAt && doc.expiresAt.toMillis() < Date.now()) return null;
  return doc.redirectTo;
}

/* ---------- messages (the inbox) ---------- */

export interface Message {
  id: string;
  name: string;
  email: string;
  body: string;
  fields: Record<string, string>;
  page: string;
  read: boolean;
  createdAt: number;
}

export async function listMessages(siteId: string, limit = 200): Promise<Message[]> {
  const snap = await adminDb()
    .collection("messages")
    .where("siteId", "==", siteId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const m = d.data();
    return {
      id: d.id,
      name: m.name ?? "",
      email: m.email ?? "",
      body: m.body ?? "",
      fields: m.fields ?? {},
      page: m.page ?? "",
      read: !!m.read,
      createdAt: (m.createdAt as Timestamp | undefined)?.toMillis() ?? 0,
    };
  });
}

export async function countUnread(siteId: string): Promise<number> {
  const agg = await adminDb().collection("messages").where("siteId", "==", siteId).where("read", "==", false).count().get();
  return agg.data().count;
}

/** Messages in the last `days` and in the period before it (for the stats page). */
export async function messagesInPeriod(siteId: string, days: number) {
  const now = Date.now();
  const span = days * 86_400_000;
  const [current, previous] = await Promise.all([
    countMessagesBetween(siteId, now - span, now),
    countMessagesBetween(siteId, now - 2 * span, now - span),
  ]);
  return { current, previous };
}

async function countMessagesBetween(siteId: string, from: number, to: number): Promise<number> {
  const agg = await adminDb()
    .collection("messages")
    .where("siteId", "==", siteId)
    .where("createdAt", ">=", Timestamp.fromMillis(from))
    .where("createdAt", "<", Timestamp.fromMillis(to))
    .count()
    .get();
  return agg.data().count;
}

async function ownMessage(o: Owner, messageId: string) {
  const ref = adminDb().collection("messages").doc(messageId);
  const m = (await ref.get()).data();
  if (!m || m.siteId !== o.siteId) throw new ProjectError("not-found");
  return ref;
}

export async function markMessage(o: Owner, messageId: string, read: boolean) {
  await (await ownMessage(o, messageId)).update({ read });
}

export async function deleteMessage(o: Owner, messageId: string) {
  await (await ownMessage(o, messageId)).delete();
}

/* ---------- account ---------- */

const GRACE_DAYS = 14;

/** Takes the site offline straight away; everything is deleted after 14 days unless cancelled. */
export async function requestDeletion(o: Owner) {
  const at = Timestamp.fromMillis(Date.now() + GRACE_DAYS * 86_400_000);
  const db = adminDb();
  await db.collection("users").doc(o.uid).set({ deletion: { requestedAt: FieldValue.serverTimestamp(), at } }, { merge: true });
  await db.collection("sites").doc(o.siteId).update({ suspended: true, suspendedReason: "deleting" });
  await refresh(o);
  await adminAuth().revokeRefreshTokens(o.uid);
  return at.toMillis();
}

export async function cancelDeletion(o: Owner) {
  const db = adminDb();
  await db.collection("users").doc(o.uid).update({ deletion: FieldValue.delete() });
  await db.collection("sites").doc(o.siteId).update({ suspended: false, suspendedReason: FieldValue.delete() });
  await refresh(o);
}

export async function setAccountLocale(uid: string, locale: Locale) {
  await adminDb().collection("users").doc(uid).set({ locale }, { merge: true });
}
