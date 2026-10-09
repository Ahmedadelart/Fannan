"use server";

import { buildGuide, markGuideOffered, restoreBackup, saveGuideState } from "@/lib/server/guide";
import { loadProject, ownerOf, ProjectError } from "@/lib/server/projects";
import { requireSession } from "@/lib/server/session";
import type { GuideAnswers } from "@/lib/site/guide";

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

export async function saveGuide(step: number, answers: GuideAnswers) {
  return attempt(async () => {
    const { uid } = await requireSession();
    await saveGuideState(uid, step, answers);
    return {};
  });
}

/** "Guide me" or "I'll design it myself": either way the choice screen isn't shown again. */
export async function chooseStart() {
  const { uid } = await requireSession();
  await markGuideOffered(uid);
}

export async function buildSite(answers: GuideAnswers) {
  return attempt(async () => {
    const { uid } = await requireSession();
    await buildGuide(await ownerOf(uid), answers);
    return {};
  });
}

export async function bringBack(id: string) {
  return attempt(async () => {
    const { uid } = await requireSession();
    await restoreBackup(await ownerOf(uid), id);
    return {};
  });
}

/** A project's pictures and parts, for "Inside each project". */
export async function projectItems(projectId: string) {
  return attempt(async () => {
    const { uid } = await requireSession();
    const { media, project } = await loadProject(await ownerOf(uid), projectId);
    return { media, coverId: project.coverMediaId, description: project.description };
  });
}
