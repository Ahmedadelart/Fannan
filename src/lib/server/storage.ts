import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile, open } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { getStorage } from "firebase-admin/storage";
import { firebaseEnv } from "@/config/firebase";
import { adminDb } from "@/lib/firebase/admin";

// Where uploaded files live.
//  - Cloud: a private Google Cloud Storage bucket (MEDIA_BUCKET). Browsers upload with short-lived
//    signed links; nothing in the bucket is public.
//  - Local development and tests: a folder (.local-storage/), with the same signed-link shape.

const LOCAL = firebaseEnv() === "emulator";
export const BUCKET = process.env.MEDIA_BUCKET ?? (LOCAL ? "local" : "");
export const LOCAL_ROOT = join(process.cwd(), ".local-storage");
const LOCAL_SECRET = "local-dev-only";

function bucket() {
  adminDb(); // makes sure the Firebase app is initialised
  return getStorage().bucket(BUCKET);
}

function localPath(path: string) {
  const full = normalize(join(LOCAL_ROOT, BUCKET, path));
  if (!full.startsWith(join(LOCAL_ROOT, BUCKET))) throw new Error("bad-path");
  return full;
}

export function localSignature(op: "put" | "get", path: string, exp: number, type = "") {
  return createHmac("sha256", LOCAL_SECRET).update(`${op}\n${path}\n${exp}\n${type}`).digest("base64url");
}

export function checkLocalSignature(op: "put" | "get", path: string, exp: number, sig: string, type = "") {
  if (!LOCAL || exp < Date.now()) return false;
  const want = Buffer.from(localSignature(op, path, exp, type));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** A link the browser can PUT one file to, valid for 15 minutes, locked to this content type. */
export async function signedUploadUrl(path: string, contentType: string): Promise<string> {
  const exp = Date.now() + 15 * 60 * 1000;
  if (LOCAL) {
    const qs = new URLSearchParams({ path, exp: String(exp), type: contentType });
    qs.set("sig", localSignature("put", path, exp, contentType));
    return `/api/dev-storage?${qs}`;
  }
  const [url] = await bucket().file(path).getSignedUrl({ version: "v4", action: "write", expires: exp, contentType });
  return url;
}

export async function objectSize(path: string): Promise<number | null> {
  try {
    if (LOCAL) return (await stat(localPath(path))).size;
    const [meta] = await bucket().file(path).getMetadata();
    return Number(meta.size);
  } catch {
    return null;
  }
}

/** First bytes of a file, to check what it really is (not what its name says). */
export async function readHead(path: string, bytes = 512): Promise<Buffer> {
  if (LOCAL) {
    const fh = await open(localPath(path), "r");
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await fh.read(buf, 0, bytes, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }
  const [buf] = await bucket()
    .file(path)
    .download({ start: 0, end: bytes - 1 });
  return buf;
}

export async function writeLocal(path: string, data: Buffer) {
  const full = localPath(path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** Streams a stored file (used by the owner-only media route). */
export async function readStream(path: string): Promise<{ stream: ReadableStream; size: number } | null> {
  try {
    if (LOCAL) {
      const full = localPath(path);
      const { size } = await stat(full);
      return { stream: Readable.toWeb(createReadStream(full)) as ReadableStream, size };
    }
    const file = bucket().file(path);
    const [meta] = await file.getMetadata();
    return { stream: Readable.toWeb(file.createReadStream()) as ReadableStream, size: Number(meta.size) };
  } catch {
    return null;
  }
}

export async function deleteObject(path: string) {
  if (LOCAL) return rm(localPath(path), { force: true });
  await bucket()
    .file(path)
    .delete({ ignoreNotFound: true })
    .catch(() => {});
}

export async function deletePrefix(prefix: string) {
  if (!prefix.endsWith("/")) prefix += "/";
  if (LOCAL) return rm(localPath(prefix), { recursive: true, force: true });
  await bucket()
    .deleteFiles({ prefix, force: true })
    .catch(() => {});
}
