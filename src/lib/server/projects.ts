import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { FieldValue, type DocumentReference, type Timestamp } from "firebase-admin/firestore";
import { limitsFor, plansConfig } from "@/config/plans";
import { slugify } from "@/config/usernames";
import { adminDb } from "@/lib/firebase/admin";
import { getUser, type SiteDoc } from "./data";
import { processMedia, type ProcessKind, type ProcessResult, type Variants } from "./processor";
import { deleteObject, deletePrefix, objectSize, readHead, signedUploadUrl } from "./storage";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/* ---------- shapes ---------- */

export type Visibility = "public" | "password" | "hidden";
export type MediaType = "image" | "gif" | "svg" | "loop" | "pdf" | "embed" | "text";
export type MediaStatus = "uploading" | "processing" | "ready" | "failed";

export interface ProjectDoc {
  title: string;
  slug: string;
  category: string;
  year: string;
  role: string;
  client: string;
  studio: string;
  team: string;
  tags: string[];
  description: string;
  visibility: Visibility;
  passwordHash: string | null;
  coverMediaId: string | null;
  media: string[];
  seo: { title: string; description: string };
  arabic: boolean;
  ar: { title: string; role: string; description: string };
  mature: boolean;
  publishedAt: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MediaDoc {
  projectId: string;
  type: MediaType;
  status: MediaStatus;
  error?: string | null;
  fileName?: string;
  contentType?: string;
  sizeBytes: number;
  original?: string | null;
  gen: number;
  width?: number;
  height?: number;
  variants?: Variants | null;
  poster?: Variants | null;
  loop?: string | null;
  duration?: number | null;
  pages?: number | null;
  caption: string;
  alt: string;
  crop?: { x: number; y: number; w: number; h: number } | null;
  display: { fullWidth: boolean; lightbox: boolean; autoplay: boolean };
  embed?: { provider: "youtube" | "vimeo"; id: string; url: string; poster: string | null; title: string } | null;
  text?: string;
  createdAt?: Timestamp;
}

export class ProjectError extends Error {
  constructor(
    public code:
      | "limit"
      | "storage-full"
      | "bad-type"
      | "too-big"
      | "too-long"
      | "unreadable"
      | "not-found"
      | "slug-taken"
      | "bad-link"
      | "pro-only",
  ) {
    super(code);
  }
}

/* ---------- references and ownership ---------- */

const db = () => adminDb();
const siteRef = (siteId: string) => db().collection("sites").doc(siteId);
const projectsCol = (siteId: string) => siteRef(siteId).collection("projects");
const mediaCol = (siteId: string) => siteRef(siteId).collection("media");

export interface Owner {
  uid: string;
  siteId: string;
  site: SiteDoc;
  plan: "free" | "pro";
}

export async function ownerOf(uid: string): Promise<Owner> {
  const user = await getUser(uid);
  if (!user?.siteId) throw new ProjectError("not-found");
  const snap = await siteRef(user.siteId).get();
  const site = snap.data() as SiteDoc | undefined;
  if (!site || site.ownerUid !== uid) throw new ProjectError("not-found");
  return { uid, siteId: user.siteId, site, plan: user.plan ?? "free" };
}

async function getProjectRef(o: Owner, projectId: string) {
  const ref = projectsCol(o.siteId).doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) throw new ProjectError("not-found");
  return { ref, project: snap.data() as ProjectDoc };
}

async function getMediaRef(o: Owner, mediaId: string) {
  const ref = mediaCol(o.siteId).doc(mediaId);
  const snap = await ref.get();
  if (!snap.exists) throw new ProjectError("not-found");
  return { ref, media: snap.data() as MediaDoc };
}

/* ---------- reading ---------- */

export interface ProjectSummary {
  id: string;
  title: string;
  category: string;
  role: string;
  visibility: Visibility;
  published: boolean;
  items: number;
  cover: MediaDoc | null;
}

export async function listProjects(siteId: string): Promise<ProjectSummary[]> {
  const snaps = await projectsCol(siteId).orderBy("createdAt", "desc").get();
  const projects = snaps.docs.map((d) => ({ id: d.id, ...(d.data() as ProjectDoc) }));
  const coverIds = projects.map((p) => p.coverMediaId ?? p.media[0]).filter(Boolean) as string[];
  const covers = coverIds.length ? await db().getAll(...coverIds.map((id) => mediaCol(siteId).doc(id))) : [];
  const byId = new Map(covers.filter((c) => c.exists).map((c) => [c.id, c.data() as MediaDoc]));
  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    role: p.role,
    visibility: p.visibility,
    published: !!p.publishedAt,
    items: p.media.length,
    cover: byId.get(p.coverMediaId ?? p.media[0] ?? "") ?? null,
  }));
}

export type ProjectForEditor = Omit<ProjectDoc, "passwordHash" | "createdAt" | "updatedAt" | "publishedAt"> & {
  id: string;
  hasPassword: boolean;
};

export async function loadProject(
  o: Owner,
  projectId: string,
): Promise<{ project: ProjectForEditor; media: Array<MediaDoc & { id: string }> }> {
  const { project } = await getProjectRef(o, projectId);
  const docs = project.media.length ? await db().getAll(...project.media.map((id) => mediaCol(o.siteId).doc(id))) : [];
  const media = docs
    .filter((d) => d.exists)
    .map((d) => {
      const m = d.data() as MediaDoc;
      delete m.createdAt;
      return { id: d.id, ...m };
    });
  const { passwordHash, createdAt: _c, updatedAt: _u, publishedAt: _p, ...rest } = project;
  void _c;
  void _u;
  void _p;
  return { project: { id: projectId, ...rest, hasPassword: !!passwordHash }, media };
}

/* ---------- projects ---------- */

export async function createProject(o: Owner, title: string): Promise<string> {
  const limit = limitsFor(o.plan).projects;
  if (limit !== null) {
    const count = (await projectsCol(o.siteId).count().get()).data().count;
    if (count >= limit) throw new ProjectError("limit");
  }
  const clean = title.trim().slice(0, 120) || "Untitled project";
  const ref = projectsCol(o.siteId).doc();
  const project: ProjectDoc = {
    title: clean,
    slug: await uniqueSlug(o.siteId, slugify(clean) || "project", ref.id),
    category: "",
    year: String(new Date().getFullYear()),
    role: "",
    client: "",
    studio: "",
    team: "",
    tags: [],
    description: "",
    visibility: "public",
    passwordHash: null,
    coverMediaId: null,
    media: [],
    seo: { title: "", description: "" },
    arabic: false,
    ar: { title: "", role: "", description: "" },
    mature: false,
    publishedAt: null,
  };
  await ref.set({ ...project, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}

// Page addresses a project can't take.
const RESERVED_SLUGS = new Set(["about", "contact", "work", "projects", "p", "api", "sitemap", "robots"]);

async function uniqueSlug(siteId: string, base: string, selfId: string): Promise<string> {
  let slug = RESERVED_SLUGS.has(base) ? `${base}-project` : base;
  for (let n = 2; n < 100; n++) {
    const clash = await projectsCol(siteId).where("slug", "==", slug).limit(2).get();
    if (clash.docs.every((d) => d.id === selfId)) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

const text = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/[<>]/g, "")
        .slice(0, max)
    : undefined;

export interface ProjectPatch {
  title?: string;
  slug?: string;
  category?: string;
  year?: string;
  role?: string;
  client?: string;
  studio?: string;
  team?: string;
  tags?: string;
  description?: string;
  visibility?: Visibility;
  password?: string;
  seoTitle?: string;
  seoDescription?: string;
  arabic?: boolean;
  arTitle?: string;
  arRole?: string;
  arDescription?: string;
  mature?: boolean;
}

export async function updateProject(o: Owner, projectId: string, patch: ProjectPatch): Promise<{ slug: string }> {
  const { ref, project } = await getProjectRef(o, projectId);
  const u: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  const simple = ["title", "category", "role", "client", "studio", "team"] as const;
  for (const k of simple) if (patch[k] !== undefined) u[k] = text(patch[k], 160)?.trim() ?? "";
  if (patch.year !== undefined) u.year = (text(patch.year, 9) ?? "").replace(/[^0-9–\- ]/g, "");
  if (patch.description !== undefined) u.description = text(patch.description, 4000) ?? "";
  if (patch.tags !== undefined) {
    u.tags = (text(patch.tags, 400) ?? "")
      .split(/[,،]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (patch.seoTitle !== undefined) u["seo.title"] = text(patch.seoTitle, 120) ?? "";
  if (patch.seoDescription !== undefined) u["seo.description"] = text(patch.seoDescription, 300) ?? "";
  if (patch.arabic !== undefined) u.arabic = !!patch.arabic;
  if (patch.arTitle !== undefined) u["ar.title"] = text(patch.arTitle, 160) ?? "";
  if (patch.arRole !== undefined) u["ar.role"] = text(patch.arRole, 160) ?? "";
  if (patch.arDescription !== undefined) u["ar.description"] = text(patch.arDescription, 4000) ?? "";
  if (patch.mature !== undefined) u.mature = !!patch.mature;

  if (patch.visibility !== undefined && ["public", "password", "hidden"].includes(patch.visibility)) {
    if (patch.visibility === "password" && !limitsFor(o.plan).passwordProtection) throw new ProjectError("pro-only");
    u.visibility = patch.visibility;
  }
  if (patch.password !== undefined) {
    if (!limitsFor(o.plan).passwordProtection) throw new ProjectError("pro-only");
    u.passwordHash = patch.password ? await hashPassword(patch.password.slice(0, 200)) : null;
  }

  let slug = project.slug;
  // The link follows the title until the artist sets one by hand.
  const autoBase = slugify(project.title) || "project";
  const isAuto =
    project.slug === autoBase ||
    (project.slug.startsWith(`${autoBase}-`) && /^\d+$/.test(project.slug.slice(autoBase.length + 1)));
  if (patch.title !== undefined && patch.slug === undefined && isAuto) {
    slug = await uniqueSlug(o.siteId, slugify(String(u.title)) || "project", projectId);
    u.slug = slug;
  }
  if (patch.slug !== undefined) {
    const wanted = slugify(patch.slug) || slugify(project.title) || "project";
    if (RESERVED_SLUGS.has(wanted)) throw new ProjectError("slug-taken");
    const clash = await projectsCol(o.siteId).where("slug", "==", wanted).limit(2).get();
    if (clash.docs.some((d) => d.id !== projectId)) throw new ProjectError("slug-taken");
    slug = wanted;
    u.slug = slug;
  }
  await ref.update(u);
  return { slug };
}

export async function deleteProject(o: Owner, projectId: string) {
  const { ref, project } = await getProjectRef(o, projectId);
  for (const id of project.media) await deleteMediaFiles(o, id);
  await ref.delete();
}

async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Used by the public renderer in phase 4. */
export async function checkPassword(stored: string | null, pw: string): Promise<boolean> {
  if (!stored) return false;
  const [, salt, hash] = stored.split("$");
  const got = await scrypt(pw, Buffer.from(salt, "base64"), 32);
  const want = Buffer.from(hash, "base64");
  return want.length === got.length && timingSafeEqual(want, got);
}

/* ---------- uploads ---------- */

const TYPES: Record<string, { kind: ProcessKind; media: MediaType; ext: string; max: () => number }> = {
  "image/jpeg": { kind: "image", media: "image", ext: "jpg", max: () => plansConfig.uploads.maxImageBytes },
  "image/png": { kind: "image", media: "image", ext: "png", max: () => plansConfig.uploads.maxImageBytes },
  "image/webp": { kind: "image", media: "image", ext: "webp", max: () => plansConfig.uploads.maxImageBytes },
  "image/gif": { kind: "gif", media: "gif", ext: "gif", max: () => plansConfig.uploads.maxImageBytes },
  "image/svg+xml": { kind: "svg", media: "svg", ext: "svg", max: () => plansConfig.uploads.maxImageBytes },
  "application/pdf": { kind: "pdf", media: "pdf", ext: "pdf", max: () => plansConfig.uploads.maxPdfBytes },
  "video/mp4": { kind: "loop", media: "loop", ext: "mp4", max: () => plansConfig.uploads.maxLoopBytes },
};
export const ACCEPTED_TYPES = Object.keys(TYPES);

/** What the first bytes say the file is. Names and browser-reported types can lie. */
function sniff(head: Buffer): string | null {
  const ascii = head.toString("latin1");
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) return "image/gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.startsWith("%PDF-")) return "application/pdf";
  if (ascii.slice(4, 8) === "ftyp") return "video/mp4";
  const textStart = head.toString("utf8").replace(/^﻿/, "").trimStart();
  if (
    !head.includes(0) &&
    /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(textStart)
  )
    return "image/svg+xml";
  return null;
}

const blankDisplay = { fullWidth: false, lightbox: true, autoplay: true };

export async function startUpload(
  o: Owner,
  projectId: string,
  file: { name: string; type: string; size: number },
  replaceMediaId?: string,
): Promise<{ mediaId: string; uploadUrl: string; contentType: string }> {
  const t = TYPES[file.type];
  if (!t) throw new ProjectError("bad-type");
  if (file.size > t.max()) throw new ProjectError("too-big");
  const used = o.site.storageUsed ?? 0;
  if (used + file.size > limitsFor(o.plan).storageBytes) throw new ProjectError("storage-full");

  const { ref: projectRef, project } = await getProjectRef(o, projectId);
  let mediaRef: DocumentReference;
  let gen = 1;
  if (replaceMediaId) {
    const { ref, media } = await getMediaRef(o, replaceMediaId);
    if (media.projectId !== projectId) throw new ProjectError("not-found");
    mediaRef = ref;
    gen = (media.gen ?? 1) + 1;
  } else {
    mediaRef = mediaCol(o.siteId).doc();
  }
  const original = `originals/${o.siteId}/${mediaRef.id}/${gen}.${t.ext}`;
  const base = {
    projectId,
    type: t.media,
    status: "uploading" as MediaStatus,
    fileName: (text(file.name, 160) ?? "file").trim(),
    contentType: file.type,
    pendingOriginal: original,
    pendingSize: file.size,
  };
  if (replaceMediaId) {
    await mediaRef.update({ ...base, pendingGen: gen });
  } else {
    const media: MediaDoc = {
      ...base,
      sizeBytes: 0,
      original: null,
      gen: 0,
      caption: "",
      alt: "",
      crop: null,
      display: blankDisplay,
    };
    await mediaRef.set({
      ...media,
      pendingOriginal: original,
      pendingGen: gen,
      createdAt: FieldValue.serverTimestamp(),
    });
    await projectRef.update({
      media: FieldValue.arrayUnion(mediaRef.id),
      ...(project.coverMediaId ? {} : { coverMediaId: mediaRef.id }),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return { mediaId: mediaRef.id, uploadUrl: await signedUploadUrl(original, file.type), contentType: file.type };
}

type Pending = MediaDoc & { pendingOriginal?: string; pendingGen?: number; pendingSize?: number };

/** After the browser finished uploading: check the file and make the web versions. */
export async function finishUpload(o: Owner, mediaId: string): Promise<MediaDoc & { id: string }> {
  const { ref, media } = (await getMediaRef(o, mediaId)) as { ref: DocumentReference; media: Pending };
  const path = media.pendingOriginal;
  const gen = media.pendingGen ?? 1;
  if (!path || !media.contentType) throw new ProjectError("not-found");
  const t = TYPES[media.contentType];

  const fail = async (code: ProjectError["code"]) => {
    await deleteObject(path).catch(() => {});
    await deletePrefix(`variants/${o.siteId}/${mediaId}/${gen}`).catch(() => {});
    if (media.original) {
      // A failed replace keeps the old file.
      await ref.update({ status: "ready", pendingOriginal: null, pendingGen: null, pendingSize: null, error: code });
    } else {
      await ref.update({ status: "failed", error: code, pendingOriginal: null });
    }
    throw new ProjectError(code);
  };

  const size = await objectSize(path);
  if (size === null) return fail("unreadable");
  if (size > t.max()) return fail("too-big");
  const real = sniff(await readHead(path));
  if (real !== media.contentType) return fail("bad-type");

  await ref.update({ status: "processing" });
  const result: ProcessResult = await processMedia({
    source: path,
    dest: `variants/${o.siteId}/${mediaId}/${gen}`,
    kind: t.kind,
  });
  if (result.error) return fail(result.error === "too-long" ? "too-long" : "unreadable");

  const oldOriginal = media.original ?? null;
  const oldGen = media.original ? media.gen : null;
  const oldSize = media.original ? media.sizeBytes : 0;
  const done: Partial<MediaDoc> & Record<string, unknown> = {
    status: "ready",
    error: null,
    type: t.media,
    original: path,
    gen,
    sizeBytes: size,
    width: result.width,
    height: result.height,
    variants: result.variants ?? null,
    poster: result.poster ?? null,
    loop: result.loop ?? null,
    duration: result.duration ?? null,
    pages: result.pages ?? null,
    crop: null,
    pendingOriginal: null,
    pendingGen: null,
    pendingSize: null,
  };
  await ref.update(done);
  await siteRef(o.siteId).update({ storageUsed: FieldValue.increment(size - oldSize) });
  if (oldOriginal) await deleteObject(oldOriginal);
  if (oldGen !== null && oldGen !== gen) await deletePrefix(`variants/${o.siteId}/${mediaId}/${oldGen}`);
  const fresh = (await ref.get()).data() as MediaDoc;
  delete fresh.createdAt;
  return { id: mediaId, ...fresh };
}

/** Re-make the web versions from the original with a crop (0..1 of width/height). */
export async function cropMedia(
  o: Owner,
  mediaId: string,
  crop: { x: number; y: number; w: number; h: number } | null,
) {
  const { ref, media } = await getMediaRef(o, mediaId);
  if (!media.original || !["image", "svg"].includes(media.type)) throw new ProjectError("bad-type");
  const gen = media.gen + 1;
  const kind: ProcessKind = media.type === "svg" ? "svg" : "image";
  const result = await processMedia({
    source: media.original,
    dest: `variants/${o.siteId}/${mediaId}/${gen}`,
    kind,
    ...(crop ? { crop } : {}),
  });
  if (result.error) throw new ProjectError("unreadable");
  // The original keeps its first name; only the web versions move to the new generation.
  await ref.update({ gen, crop, width: result.width, height: result.height, variants: result.variants ?? null });
  await deletePrefix(`variants/${o.siteId}/${mediaId}/${media.gen}`);
  const fresh = (await ref.get()).data() as MediaDoc;
  delete fresh.createdAt;
  return { id: mediaId, ...fresh };
}

/* ---------- other items ---------- */

export function parseVideoLink(raw: string): { provider: "youtube" | "vimeo"; id: string; hash?: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] ?? "";
    return /^[\w-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:\/video)?\/(\d{6,12})(?:\/([0-9a-f]{6,20}))?/);
    if (!m) return null;
    return { provider: "vimeo", id: m[1], hash: m[2] ?? url.searchParams.get("h") ?? undefined };
  }
  return null;
}

async function videoInfo(v: NonNullable<ReturnType<typeof parseVideoLink>>) {
  if (v.provider === "youtube") {
    const url = `https://www.youtube.com/watch?v=${v.id}`;
    let title = "YouTube video";
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) title = ((await r.json()) as { title?: string }).title ?? title;
    } catch {
      /* keep the default title */
    }
    return { url, title, poster: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` };
  }
  const url = `https://vimeo.com/${v.id}${v.hash ? `/${v.hash}` : ""}`;
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?width=1600&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const j = (await r.json()) as { title?: string; thumbnail_url?: string };
      return { url, title: j.title ?? "Vimeo video", poster: j.thumbnail_url ?? null };
    }
  } catch {
    /* fall through */
  }
  return { url, title: "Vimeo video", poster: null };
}

export async function addEmbed(o: Owner, projectId: string, link: string) {
  const v = parseVideoLink(link);
  if (!v) throw new ProjectError("bad-link");
  const { ref: projectRef, project } = await getProjectRef(o, projectId);
  const info = await videoInfo(v);
  const ref = mediaCol(o.siteId).doc();
  const media: MediaDoc = {
    projectId,
    type: "embed",
    status: "ready",
    sizeBytes: 0,
    gen: 1,
    caption: "",
    alt: info.title,
    display: { ...blankDisplay, fullWidth: true },
    embed: { provider: v.provider, id: v.id, url: info.url, poster: info.poster, title: info.title },
  };
  await ref.set({ ...media, createdAt: FieldValue.serverTimestamp() });
  await projectRef.update({
    media: FieldValue.arrayUnion(ref.id),
    ...(project.coverMediaId ? {} : { coverMediaId: ref.id }),
  });
  return { id: ref.id, ...media };
}

export async function addText(o: Owner, projectId: string) {
  const { ref: projectRef } = await getProjectRef(o, projectId);
  const ref = mediaCol(o.siteId).doc();
  const media: MediaDoc = {
    projectId,
    type: "text",
    status: "ready",
    sizeBytes: 0,
    gen: 1,
    caption: "",
    alt: "",
    text: "",
    display: { ...blankDisplay, lightbox: false },
  };
  await ref.set({ ...media, createdAt: FieldValue.serverTimestamp() });
  await projectRef.update({ media: FieldValue.arrayUnion(ref.id) });
  return { id: ref.id, ...media };
}

export async function updateMedia(
  o: Owner,
  mediaId: string,
  patch: { caption?: string; alt?: string; text?: string; display?: Partial<MediaDoc["display"]> },
) {
  const { ref, media } = await getMediaRef(o, mediaId);
  const u: Record<string, unknown> = {};
  if (patch.caption !== undefined) u.caption = text(patch.caption, 300) ?? "";
  if (patch.alt !== undefined) u.alt = text(patch.alt, 300) ?? "";
  if (patch.text !== undefined && media.type === "text") u.text = text(patch.text, 6000) ?? "";
  if (patch.display) {
    for (const k of ["fullWidth", "lightbox", "autoplay"] as const) {
      if (patch.display[k] !== undefined) u[`display.${k}`] = !!patch.display[k];
    }
  }
  if (Object.keys(u).length) await ref.update(u);
}

export async function setCover(o: Owner, projectId: string, mediaId: string) {
  const { ref, project } = await getProjectRef(o, projectId);
  if (!project.media.includes(mediaId)) throw new ProjectError("not-found");
  await ref.update({ coverMediaId: mediaId });
}

export async function reorderMedia(o: Owner, projectId: string, order: string[]) {
  const { ref, project } = await getProjectRef(o, projectId);
  // Items the browser doesn't know about yet (e.g. still uploading in another tab) keep their place at the end.
  const known = order.filter((id, i) => project.media.includes(id) && order.indexOf(id) === i);
  await ref.update({ media: [...known, ...project.media.filter((id) => !known.includes(id))] });
}

async function deleteMediaFiles(o: Owner, mediaId: string) {
  const ref = mediaCol(o.siteId).doc(mediaId);
  const media = (await ref.get()).data() as MediaDoc | undefined;
  if (!media) return;
  await deletePrefix(`originals/${o.siteId}/${mediaId}`);
  await deletePrefix(`variants/${o.siteId}/${mediaId}`);
  if (media.sizeBytes) await siteRef(o.siteId).update({ storageUsed: FieldValue.increment(-media.sizeBytes) });
  await ref.delete();
}

export async function deleteMedia(o: Owner, projectId: string, mediaId: string) {
  const { ref, project } = await getProjectRef(o, projectId);
  if (!project.media.includes(mediaId)) throw new ProjectError("not-found");
  const rest = project.media.filter((id) => id !== mediaId);
  await ref.update({
    media: rest,
    ...(project.coverMediaId === mediaId ? { coverMediaId: rest[0] ?? null } : {}),
  });
  await deleteMediaFiles(o, mediaId);
}
