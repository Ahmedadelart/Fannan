// One file into a project (or the site library, "_library"): ask for an upload address, send the
// file straight to storage, then let the server check and process it. Used by the guided setup.

import { beginUpload, completeUpload } from "@/app/[locale]/app/(dash)/projects/actions";
import type { MediaDoc } from "@/lib/server/projects";

export const UPLOAD_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
};

export const IMAGE_ACCEPT = Object.keys(UPLOAD_TYPES)
  .map((e) => `.${e}`)
  .concat(Object.values(UPLOAD_TYPES))
  .join(",");

export type Uploaded = MediaDoc & { id: string };

export async function uploadFile(
  projectId: string,
  file: File,
): Promise<{ ok: true; media: Uploaded } | { ok: false; error: string }> {
  const type = UPLOAD_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
  const start = await beginUpload(projectId, { name: file.name, type, size: file.size }).catch(() => null);
  if (!start) return { ok: false, error: "error" };
  if (!start.ok) return { ok: false, error: start.error };
  const put = await fetch(start.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": start.contentType },
    body: file,
  }).catch(() => null);
  if (!put?.ok) return { ok: false, error: "error" };
  const done = await completeUpload(start.mediaId).catch(() => null);
  if (!done) return { ok: false, error: "error" };
  if (!done.ok) return { ok: false, error: done.error };
  return { ok: true, media: done.media };
}
