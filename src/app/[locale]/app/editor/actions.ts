"use server";

import { adminDb } from "@/lib/firebase/admin";
import { ownerOf, ProjectError } from "@/lib/server/projects";
import { publish, saveDraft, setPagePassword } from "@/lib/server/site";
import { requireSession } from "@/lib/server/session";
import { createShortLink, deleteShortLink, listShortLinks, updateShortLink } from "@/lib/server/shortlinks";
import { linkClicks } from "@/lib/server/stats";
import { limitsFor } from "@/config/plans";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function attempt<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof ProjectError) return { ok: false, error: e.code };
    console.error(e);
    return { ok: false, error: "error" };
  }
}

async function owner() {
  const { uid } = await requireSession();
  return ownerOf(uid);
}

export async function saveSiteDraft(draft: unknown) {
  return attempt(async () => saveDraft(await owner(), draft));
}

export async function publishSite() {
  return attempt(async () => publish(await owner()));
}

export async function savePagePassword(pageId: string, password: string) {
  return attempt(async () => {
    await setPagePassword(await owner(), pageId, String(password ?? ""));
    return {};
  });
}

export async function editorTipsSeen() {
  const { uid } = await requireSession();
  await adminDb().collection("users").doc(uid).set({ editorTipsSeen: true }, { merge: true });
}

/* ---------- link page: short links and click stats (round 9) ---------- */

export async function shortLinks() {
  return attempt(async () => ({ links: await listShortLinks(await owner()) }));
}

export async function newShortLink(path: string, code?: string) {
  return attempt(async () => ({ link: await createShortLink(await owner(), { path, code }) }));
}

export async function moveShortLink(code: string, path: string) {
  return attempt(async () => {
    await updateShortLink(await owner(), code, path);
    return {};
  });
}

export async function removeShortLink(code: string) {
  return attempt(async () => {
    await deleteShortLink(await owner(), code);
    return {};
  });
}

/** Clicks per link over the last 30 days; Pro only. */
export async function clicksPerLink() {
  return attempt(async () => {
    const o = await owner();
    if (!limitsFor(o.plan).linkStats) throw new ProjectError("pro-only");
    return { clicks: await linkClicks(o.siteId, 30) };
  });
}
