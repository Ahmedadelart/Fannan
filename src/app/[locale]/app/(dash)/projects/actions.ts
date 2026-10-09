"use server";

import { requireSession } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/rate-limit";
import {
  addEmbed,
  addText,
  createProject,
  cropMedia,
  deleteMedia,
  deleteProject,
  finishUpload,
  ownerOf,
  ProjectError,
  reorderMedia,
  setCover,
  startUpload,
  updateMedia,
  updateProject,
  type MediaDoc,
  type ProjectPatch,
} from "@/lib/server/projects";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ProjectError["code"] | "error" };

async function owner() {
  const { uid } = await requireSession();
  return ownerOf(uid);
}

async function attempt<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof ProjectError) return { ok: false, error: e.code };
    console.error(e);
    return { ok: false, error: "error" };
  }
}

// Navigation after these happens in the browser: a server-side redirect from an action would
// skip the host-based routing in src/proxy.ts and land on an internal path.
export async function newProject(title: string): Promise<Result<{ id: string }>> {
  return attempt(async () => ({ id: await createProject(await owner(), String(title ?? "")) }));
}

export async function saveProject(projectId: string, patch: ProjectPatch) {
  return attempt(async () => updateProject(await owner(), projectId, patch));
}

export async function removeProject(projectId: string) {
  return attempt(async () => {
    await deleteProject(await owner(), projectId);
    return {};
  });
}

export async function beginUpload(
  projectId: string,
  file: { name: string; type: string; size: number },
  replace?: string,
) {
  const { uid } = await requireSession();
  if (!rateLimit(`upload:${uid}`, 120, 60 * 60 * 1000)) return { ok: false as const, error: "error" as const };
  return attempt(async () => startUpload(await ownerOf(uid), projectId, file, replace));
}

export async function completeUpload(mediaId: string): Promise<Result<{ media: MediaDoc & { id: string } }>> {
  return attempt(async () => ({ media: await finishUpload(await owner(), mediaId) }));
}

export async function addVideoLink(projectId: string, link: string) {
  return attempt(async () => ({ media: await addEmbed(await owner(), projectId, link) }));
}

export async function addTextItem(projectId: string, init?: { title?: string; text?: string }) {
  return attempt(async () => ({ media: await addText(await owner(), projectId, init) }));
}

export async function saveMedia(
  mediaId: string,
  patch: { caption?: string; alt?: string; text?: string; title?: string; display?: Partial<MediaDoc["display"]> },
) {
  return attempt(async () => {
    await updateMedia(await owner(), mediaId, patch);
    return {};
  });
}

export async function cropItem(mediaId: string, crop: { x: number; y: number; w: number; h: number } | null) {
  return attempt(async () => ({ media: await cropMedia(await owner(), mediaId, crop) }));
}

export async function makeCover(projectId: string, mediaId: string) {
  return attempt(async () => {
    await setCover(await owner(), projectId, mediaId);
    return {};
  });
}

export async function reorder(projectId: string, order: string[]) {
  return attempt(async () => {
    await reorderMedia(await owner(), projectId, order);
    return {};
  });
}

export async function removeItem(projectId: string, mediaId: string) {
  return attempt(async () => {
    await deleteMedia(await owner(), projectId, mediaId);
    return {};
  });
}
