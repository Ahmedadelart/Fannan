import "server-only";

import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { checkUsername, normalizeUsername, type UsernameProblem } from "@/config/usernames";
import type { Locale } from "@/i18n/locales";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { generateStarter } from "@/lib/site/starter";
import type { LayoutId, PageDraft, SiteDraft } from "@/lib/site/types";

// All reads and writes go through the server (firebase-admin). Browser access to Firestore
// stays blocked by firestore.rules.

const HOLD_FROM_HOMEPAGE_MS = 30 * 60 * 1000; // 30 minutes (ONBOARDING.md step 1)
const ANONYMOUS_HOLD_MS = 7 * 24 * 60 * 60 * 1000; // anonymous drafts live 7 days
const CLAIM_TOKEN_MS = 24 * 60 * 60 * 1000;

export interface Onboarding {
  step: number;
  name?: string;
  discipline?: string;
  layout?: LayoutId;
  username?: string;
}

export interface UserDoc {
  displayName?: string;
  email?: string;
  locale: Locale;
  plan: "free" | "pro";
  isAnonymous: boolean;
  onboarding?: Onboarding;
  siteId?: string;
  checklistDismissed?: boolean;
  createdAt?: Timestamp;
}

export interface SiteDoc {
  ownerUid: string;
  username: string;
  language: Locale;
  title: string;
  tagline: string;
  layout: LayoutId;
  theme: SiteDraft["theme"];
  available: { on: boolean; types: string[] };
  publishedVersion: number | null;
  sharedAt?: Timestamp | null;
  aboutWritten?: boolean;
  createdAt?: Timestamp;
}

const db = () => adminDb();
const users = () => db().collection("users");
const usernames = () => db().collection("usernames");
const sites = () => db().collection("sites");

/* ---------- users ---------- */

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await users().doc(uid).get();
  return snap.exists ? (snap.data() as UserDoc) : null;
}

export async function ensureUser(uid: string, init: { locale: Locale; isAnonymous: boolean; email?: string }) {
  const ref = users().doc(uid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        locale: init.locale,
        plan: "free",
        isAnonymous: init.isAnonymous,
        ...(init.email ? { email: init.email } : {}),
        onboarding: { step: 1 },
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      const patch: Partial<UserDoc> = { isAnonymous: init.isAnonymous };
      if (init.email) patch.email = init.email;
      tx.update(ref, patch);
    }
  });
}

export async function saveOnboarding(uid: string, patch: Partial<Onboarding>) {
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) update[`onboarding.${k}`] = v;
  if (patch.name) update.displayName = patch.name.trim();
  await users().doc(uid).set({}, { merge: true });
  await users().doc(uid).update(update);
}

export async function setUserLocale(uid: string, locale: Locale) {
  await users().doc(uid).set({ locale }, { merge: true });
}

export async function dismissChecklist(uid: string) {
  await users().doc(uid).set({ checklistDismissed: true }, { merge: true });
}

/* ---------- usernames ---------- */

interface UsernameDoc {
  uid: string;
  status: "held" | "claimed";
  expiresAt?: Timestamp | null;
  siteId?: string;
}

export type Availability = { ok: true } | { ok: false; reason: UsernameProblem | "taken" };

function freeFor(doc: UsernameDoc | undefined, uid: string | null): boolean {
  if (!doc) return true;
  if (uid && doc.uid === uid) return true;
  return doc.status === "held" && !!doc.expiresAt && doc.expiresAt.toMillis() < Date.now();
}

export async function usernameAvailability(input: string, uid: string | null): Promise<Availability> {
  const name = normalizeUsername(input);
  const problem = checkUsername(name);
  if (problem) return { ok: false, reason: problem };
  const snap = await usernames().doc(name).get();
  return freeFor(snap.data() as UsernameDoc | undefined, uid) ? { ok: true } : { ok: false, reason: "taken" };
}

/** Hold a name for a little while (homepage claim box → sign-up step 1). */
export async function holdUsername(input: string, uid: string): Promise<Availability> {
  const name = normalizeUsername(input);
  const problem = checkUsername(name);
  if (problem) return { ok: false, reason: problem };
  const ref = usernames().doc(name);
  return db().runTransaction(async (tx) => {
    const doc = (await tx.get(ref)).data() as UsernameDoc | undefined;
    if (!freeFor(doc, uid)) return { ok: false, reason: "taken" } as const;
    if (doc?.uid === uid && doc.status === "claimed") return { ok: true } as const;
    tx.set(ref, { uid, status: "held", expiresAt: Timestamp.fromMillis(Date.now() + HOLD_FROM_HOMEPAGE_MS) });
    return { ok: true } as const;
  });
}

async function releaseOtherNames(tx: Transaction, uid: string, keep: string) {
  const mine = await tx.get(usernames().where("uid", "==", uid));
  for (const d of mine.docs) if (d.id !== keep) tx.delete(d.ref);
}

/**
 * Sign-up step 5: claim the name and create (or refresh) the starter site from the answers.
 * Anonymous people hold the name for 7 days; it becomes permanent once they save with email/Google.
 */
export async function claimUsernameAndCreateSite(
  uid: string,
  input: string,
  answers: { name: string; discipline: string; layout: LayoutId; language: Locale },
  isAnonymous: boolean,
): Promise<Availability & { siteId?: string }> {
  const name = normalizeUsername(input);
  const problem = checkUsername(name);
  if (problem) return { ok: false, reason: problem };

  const draft = generateStarter(answers);
  const nameRef = usernames().doc(name);
  const userRef = users().doc(uid);

  return db().runTransaction(async (tx) => {
    const nameDoc = (await tx.get(nameRef)).data() as UsernameDoc | undefined;
    if (!freeFor(nameDoc, uid)) return { ok: false, reason: "taken" } as const;
    const user = (await tx.get(userRef)).data() as UserDoc | undefined;
    await releaseOtherNames(tx, uid, name);

    const siteRef = user?.siteId ? sites().doc(user.siteId) : sites().doc();
    const site: SiteDoc = {
      ownerUid: uid,
      username: name,
      language: answers.language,
      title: draft.title,
      tagline: draft.tagline,
      layout: draft.layout,
      theme: draft.theme,
      available: { on: false, types: [] },
      publishedVersion: null,
    };
    tx.set(siteRef, { ...site, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    draft.pages.forEach((p, order) => tx.set(siteRef.collection("pages").doc(p.id), { ...p, order }));

    tx.set(nameRef, {
      uid,
      siteId: siteRef.id,
      status: isAnonymous ? "held" : "claimed",
      expiresAt: isAnonymous ? Timestamp.fromMillis(Date.now() + ANONYMOUS_HOLD_MS) : null,
    });
    tx.set(
      userRef,
      {
        siteId: siteRef.id,
        displayName: answers.name.trim(),
        onboarding: { ...(user?.onboarding ?? {}), ...answers, username: name, step: 6 },
      },
      { merge: true },
    );
    return { ok: true, siteId: siteRef.id } as const;
  });
}

/* ---------- sites ---------- */

export async function getSite(siteId: string): Promise<(SiteDoc & { id: string }) | null> {
  const snap = await sites().doc(siteId).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as SiteDoc) } : null;
}

export async function getSiteDraft(siteId: string): Promise<SiteDraft | null> {
  const site = await getSite(siteId);
  if (!site) return null;
  const pages = await sites().doc(siteId).collection("pages").orderBy("order").get();
  return {
    layout: site.layout,
    language: site.language,
    title: site.title,
    tagline: site.tagline,
    theme: site.theme,
    pages: pages.docs.map((d) => {
      const p = d.data() as PageDraft & { order?: number };
      delete p.order;
      return p as PageDraft;
    }),
  };
}

export async function countProjects(siteId: string): Promise<number> {
  const agg = await sites().doc(siteId).collection("projects").count().get();
  return agg.data().count;
}

async function ownedSiteRef(uid: string) {
  const user = await getUser(uid);
  if (!user?.siteId) throw new Error("no-site");
  const ref = sites().doc(user.siteId);
  const site = (await ref.get()).data() as SiteDoc | undefined;
  if (site?.ownerUid !== uid) throw new Error("not-owner");
  return ref;
}

const WORK_TYPES = ["freelance", "full-time", "remote", "part-time", "commissions"];

export async function setAvailability(uid: string, on: boolean, types: string[]) {
  const ref = await ownedSiteRef(uid);
  await ref.update({ available: { on, types: types.filter((t) => WORK_TYPES.includes(t)) } });
}

export async function markShared(uid: string) {
  const ref = await ownedSiteRef(uid);
  await ref.update({ sharedAt: FieldValue.serverTimestamp() });
}

/* ---------- moving an anonymous draft to a real account ---------- */

/** Made just before a magic link is sent or the Google popup opens; the token rides along. */
export async function createClaim(anonUid: string, email?: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db()
    .collection("claims")
    .doc(token)
    .set({
      anonUid,
      email: email?.toLowerCase() ?? null,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + CLAIM_TOKEN_MS),
      used: false,
    });
  return token;
}

/**
 * After sign-in: if the new account has no site yet, it takes over the anonymous draft
 * (same browser, another device, email or Google). Accounts that already have a site keep it,
 * and the anonymous draft is cleared.
 */
export async function finishClaim(token: string | null, uid: string, email: string | undefined, locale: Locale) {
  await ensureUser(uid, { locale, isAnonymous: false, email });
  if (!token) return { moved: false };

  const claimRef = db().collection("claims").doc(token);
  const claim = (await claimRef.get()).data() as
    { anonUid: string; email: string | null; expiresAt: Timestamp; used: boolean } | undefined;
  if (!claim || claim.used || claim.expiresAt.toMillis() < Date.now()) return { moved: false };
  if (claim.email && claim.email !== email?.toLowerCase()) return { moved: false };
  if (claim.anonUid === uid) {
    await claimRef.update({ used: true });
    await makeNamesPermanent(uid);
    return { moved: false };
  }

  const anonUid = claim.anonUid;
  const result = await db().runTransaction(async (tx) => {
    const [anonUser, newUser] = await Promise.all([
      tx.get(users().doc(anonUid)).then((s) => s.data() as UserDoc | undefined),
      tx.get(users().doc(uid)).then((s) => s.data() as UserDoc | undefined),
    ]);
    const anonNames = await tx.get(usernames().where("uid", "==", anonUid));
    tx.update(claimRef, { used: true });

    if (!anonUser?.siteId || newUser?.siteId) {
      // Nothing to move, or they already have a site: drop the anonymous draft's name holds.
      anonNames.docs.forEach((d) => tx.delete(d.ref));
      return { moved: false, dropSite: anonUser?.siteId };
    }
    tx.update(sites().doc(anonUser.siteId), { ownerUid: uid });
    anonNames.docs.forEach((d) => tx.update(d.ref, { uid, status: "claimed", expiresAt: null }));
    tx.set(
      users().doc(uid),
      {
        siteId: anonUser.siteId,
        displayName: anonUser.displayName ?? newUser?.displayName ?? null,
        onboarding: anonUser.onboarding ?? { step: 6 },
        locale: anonUser.locale ?? locale,
      },
      { merge: true },
    );
    tx.delete(users().doc(anonUid));
    return { moved: true, dropSite: undefined };
  });

  if (result.dropSite) await deleteSite(result.dropSite);
  await adminAuth()
    .deleteUser(anonUid)
    .catch(() => {});
  await makeNamesPermanent(uid);
  return { moved: result.moved };
}

/** Same-browser upgrade (or after a move): the held name becomes permanent. */
export async function makeNamesPermanent(uid: string) {
  const mine = await usernames().where("uid", "==", uid).get();
  const batch = db().batch();
  mine.docs.forEach((d) => batch.update(d.ref, { status: "claimed", expiresAt: null }));
  batch.set(users().doc(uid), { isAnonymous: false }, { merge: true });
  await batch.commit();
}

async function deleteSite(siteId: string) {
  await db().recursiveDelete(sites().doc(siteId));
}

/* ---------- housekeeping ---------- */

/** Anonymous drafts that were never saved are deleted after 7 days (ONBOARDING.md). */
export async function cleanupAnonymousDrafts(): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - ANONYMOUS_HOLD_MS);
  const stale = await users().where("isAnonymous", "==", true).where("createdAt", "<", cutoff).limit(200).get();
  for (const d of stale.docs) {
    const u = d.data() as UserDoc;
    if (u.siteId) await deleteSite(u.siteId);
    const names = await usernames().where("uid", "==", d.id).get();
    await Promise.all(names.docs.map((n) => n.ref.delete()));
    await d.ref.delete();
    await adminAuth()
      .deleteUser(d.id)
      .catch(() => {});
  }
  return stale.size;
}

/* ---------- sign-up funnel (anonymous: no names, no emails, no ids) ---------- */

export async function logOnboardingEvent(event: {
  step: number;
  action: "view" | "complete";
  ms?: number;
  layout?: string;
  discipline?: string;
  method?: "email" | "google";
  locale: Locale;
}) {
  await db()
    .collection("onboardingEvents")
    .add({ ...event, at: FieldValue.serverTimestamp() });
}
