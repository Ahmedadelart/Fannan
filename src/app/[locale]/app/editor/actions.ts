"use server";

import { adminDb } from "@/lib/firebase/admin";
import { ownerOf, ProjectError } from "@/lib/server/projects";
import { publish, saveDraft, setPagePassword } from "@/lib/server/site";
import { requireSession } from "@/lib/server/session";

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
