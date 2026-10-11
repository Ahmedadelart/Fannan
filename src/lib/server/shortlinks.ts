import "server-only";

import { randomInt } from "node:crypto";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { limitsFor } from "@/config/plans";
import { checkUsername } from "@/config/usernames";
import { adminDb } from "@/lib/firebase/admin";
import { getSite } from "./data";
import { ProjectError, type Owner } from "./projects";

// Short links (round 9): fannan.net/l/{code} opens a page on the artist's site, e.g. the link page.
// Free gets a few random codes; Pro chooses the words. The code is the document id, so it's unique.

const col = () => adminDb().collection("shortlinks");

export interface ShortLink {
  code: string;
  path: string;
  custom: boolean;
  clicks: number;
}

// No look-alike letters or digits (0/o, 1/l/i).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const randomCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const cleanPath = (p: unknown) => {
  const s = typeof p === "string" ? p.trim() : "";
  return /^\/[a-z0-9-]{0,60}$/.test(s) ? s : "/";
};

export async function listShortLinks(o: Owner): Promise<ShortLink[]> {
  const snap = await col().where("siteId", "==", o.siteId).get();
  return snap.docs
    .map((d) => ({ d, at: (d.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0 }))
    .sort((a, b) => b.at - a.at)
    .map(({ d }) => ({ code: d.id, path: d.data().path, custom: !!d.data().custom, clicks: d.data().clicks ?? 0 }));
}

export async function createShortLink(o: Owner, input: { path: string; code?: string }): Promise<ShortLink> {
  const limits = limitsFor(o.plan);
  if (limits.shortLinks !== null) {
    const count = (await col().where("siteId", "==", o.siteId).count().get()).data().count;
    if (count >= limits.shortLinks) throw new ProjectError("limit");
  }
  const path = cleanPath(input.path);
  const wanted = (input.code ?? "").trim().toLowerCase();
  if (wanted) {
    if (!limits.customShortLinks) throw new ProjectError("pro-only");
    // Same rules as usernames: letters, numbers and hyphens, nothing reserved or rude.
    if (checkUsername(wanted)) throw new ProjectError("bad-link");
    try {
      await col().doc(wanted).create({ siteId: o.siteId, uid: o.uid, path, custom: true, clicks: 0, createdAt: FieldValue.serverTimestamp() });
    } catch {
      throw new ProjectError("slug-taken");
    }
    return { code: wanted, path, custom: true, clicks: 0 };
  }
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    try {
      await col().doc(code).create({ siteId: o.siteId, uid: o.uid, path, custom: false, clicks: 0, createdAt: FieldValue.serverTimestamp() });
      return { code, path, custom: false, clicks: 0 };
    } catch {
      /* taken: try another */
    }
  }
  throw new ProjectError("slug-taken");
}

export async function updateShortLink(o: Owner, code: string, path: string) {
  const ref = col().doc(String(code).slice(0, 40));
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.siteId !== o.siteId) throw new ProjectError("not-found");
  await ref.update({ path: cleanPath(path) });
}

export async function deleteShortLink(o: Owner, code: string) {
  const ref = col().doc(String(code).slice(0, 40));
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.siteId !== o.siteId) throw new ProjectError("not-found");
  await ref.delete();
}

/** Where a short link goes: the artist's current address (it follows username changes) plus the page. */
export async function resolveShortLink(code: string): Promise<{ username: string; path: string } | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(code)) return null;
  const ref = col().doc(code);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const { siteId, path } = snap.data() as { siteId: string; path: string };
  const site = await getSite(siteId);
  if (!site) return null;
  void ref.update({ clicks: FieldValue.increment(1) }).catch(() => {});
  return { username: site.username, path: cleanPath(path) };
}
