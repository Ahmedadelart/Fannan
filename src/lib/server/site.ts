import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { limitsFor } from "@/config/plans";
import type { GalleryProject, SiteMedia } from "@/components/site/SiteRender";
import { adminDb } from "@/lib/firebase/admin";
import { aboutWritten } from "@/lib/site/blocks";
import { normalizeDraft } from "@/lib/site/normalize";
import type { Block, PageDraft, SiteDraft } from "@/lib/site/types";
import { getSite, type SiteDoc } from "./data";
import { checkPassword, scryptHash } from "./passwords";
import { ProjectError, type MediaDoc, type Owner, type ProjectDoc } from "./projects";

const db = () => adminDb();
const siteRef = (siteId: string) => db().collection("sites").doc(siteId);

/* ---------- reading ---------- */

export function toSiteMedia(id: string, m: MediaDoc): SiteMedia & { display?: MediaDoc["display"]; text?: string } {
  return {
    id,
    type: m.type,
    status: m.status,
    variants: m.variants ?? null,
    poster: m.poster ?? null,
    loop: m.loop ?? null,
    width: m.width,
    height: m.height,
    alt: m.alt,
    caption: m.caption,
    pages: m.pages ?? null,
    embed: m.embed
      ? { poster: m.embed.poster, url: m.embed.url, title: m.embed.title, provider: m.embed.provider }
      : null,
    display: m.display,
    ...(m.type === "text" ? { text: m.text ?? "" } : {}),
  };
}

/** Everything the renderer needs besides the draft: the site's media and its projects. */
export async function loadRenderData(siteId: string): Promise<{
  media: Record<string, SiteMedia>;
  projects: GalleryProject[];
}> {
  const [mediaSnap, projectSnap] = await Promise.all([
    siteRef(siteId).collection("media").where("status", "==", "ready").limit(1000).get(),
    siteRef(siteId).collection("projects").orderBy("createdAt", "desc").get(),
  ]);
  const media: Record<string, SiteMedia> = {};
  for (const d of mediaSnap.docs) media[d.id] = toSiteMedia(d.id, d.data() as MediaDoc);
  const projects = projectSnap.docs.map((d) => {
    const p = d.data() as ProjectDoc;
    const coverId = p.coverMediaId ?? p.media.find((id) => media[id]) ?? null;
    return {
      id: d.id,
      slug: p.slug,
      title: p.title,
      category: p.category,
      client: p.client,
      role: p.role,
      visibility: p.visibility,
      coverId: coverId && media[coverId] ? coverId : null,
      mature: p.mature,
    };
  });
  return { media, projects };
}

export async function loadDraft(siteId: string): Promise<SiteDraft | null> {
  const site = await getSite(siteId);
  if (!site) return null;
  const pages = await siteRef(siteId).collection("pages").orderBy("order").get();
  return normalizeDraft({
    ...site,
    pages: pages.docs.map((d) => {
      const p = d.data();
      return { ...p, id: d.id, hasPassword: !!p.passwordHash };
    }),
  } as unknown as Record<string, unknown>);
}

/* ---------- saving the draft ---------- */

export async function saveDraft(o: Owner, raw: unknown): Promise<{ savedAt: number }> {
  const draft = normalizeDraft((raw ?? {}) as Record<string, unknown>);
  // Page addresses must be unique; the home page has none.
  const seen = new Set<string>();
  draft.pages.forEach((p, i) => {
    if (i === 0) p.slug = "";
    else {
      let s = p.slug || `page-${i}`;
      while (seen.has(s)) s = `${s}-${i}`;
      p.slug = s;
    }
    seen.add(p.slug);
  });
  // Free plan: no page passwords. Pro only (and set through setPagePassword, never here).

  const ref = siteRef(o.siteId);
  const existing = await ref.collection("pages").get();
  const keep = new Set(draft.pages.map((p) => p.id));
  const batch = db().batch();
  batch.update(ref, {
    title: draft.title,
    tagline: draft.tagline,
    theme: draft.theme,
    aboutWritten: aboutWritten(draft.pages),
    draftUpdatedAt: FieldValue.serverTimestamp(),
  });
  draft.pages.forEach((p, order) => {
    const { hasPassword: _hp, ...page } = p;
    void _hp;
    batch.set(ref.collection("pages").doc(p.id), { ...page, url: p.url ?? null, order }, { merge: true });
  });
  existing.docs.forEach((d) => {
    if (!keep.has(d.id)) batch.delete(d.ref);
  });
  await batch.commit();
  return { savedAt: Date.now() };
}

export async function setPagePassword(o: Owner, pageId: string, password: string) {
  if (!limitsFor(o.plan).passwordProtection) throw new ProjectError("pro-only");
  const ref = siteRef(o.siteId).collection("pages").doc(pageId);
  if (!(await ref.get()).exists) throw new ProjectError("not-found");
  await ref.update({ passwordHash: password ? await scryptHash(password.slice(0, 200)) : null });
}

/* ---------- publishing ---------- */

export interface PublishedProject {
  id: string;
  slug: string;
  title: string;
  category: string;
  year: string;
  role: string;
  client: string;
  studio: string;
  team: string;
  tags: string[];
  description: string;
  visibility: ProjectDoc["visibility"];
  passwordHash: string | null;
  coverId: string | null;
  mediaIds: string[];
  seo: ProjectDoc["seo"];
  arabic: boolean;
  ar: ProjectDoc["ar"];
  mature: boolean;
}

export interface PublishedSite {
  version: number;
  publishedAt: number;
  username: string;
  language: SiteDraft["language"];
  title: string;
  tagline: string;
  theme: SiteDraft["theme"];
  available: SiteDoc["available"];
  plan: "free" | "pro";
  pages: Array<PageDraft & { passwordHash: string | null }>;
  projects: PublishedProject[];
  media: Record<string, SiteMedia>;
}

function blockMediaIds(b: Block): Array<string | null> {
  switch (b.type) {
    case "cover":
    case "image":
    case "loop":
    case "pdf":
    case "reel":
      return [b.mediaId];
    case "before-after":
      return [b.beforeId, b.afterId];
    case "about":
      return [b.photoId, b.cvId];
    case "logos":
      return b.items.map((i) => i.mediaId);
    default:
      return [];
  }
}

const MAX_SNAPSHOT_BYTES = 900_000;
const KEEP_VERSIONS = 5;

/**
 * Freeze the saved draft into an immutable snapshot the public site reads in one document read.
 * Editing afterwards never changes the live site until the next publish.
 */
export async function publish(o: Owner): Promise<{ version: number }> {
  const ref = siteRef(o.siteId);
  const [draft, siteSnap, pageSnap, projectSnap, mediaSnap] = await Promise.all([
    loadDraft(o.siteId),
    ref.get(),
    ref.collection("pages").get(),
    ref.collection("projects").get(),
    ref.collection("media").where("status", "==", "ready").get(),
  ]);
  const site = siteSnap.data() as SiteDoc & { publishedVersion: number | null };
  if (!draft || !site) throw new ProjectError("not-found");

  const hashes = new Map(pageSnap.docs.map((d) => [d.id, (d.data().passwordHash as string | null) ?? null]));
  const allMedia = new Map(mediaSnap.docs.map((d) => [d.id, d.data() as MediaDoc]));
  const projects: PublishedProject[] = projectSnap.docs.map((d) => {
    const p = d.data() as ProjectDoc;
    const mediaIds = p.media.filter((id) => allMedia.has(id));
    return {
      id: d.id,
      slug: p.slug,
      title: p.title,
      category: p.category,
      year: p.year,
      role: p.role,
      client: p.client,
      studio: p.studio,
      team: p.team,
      tags: p.tags,
      description: p.description,
      visibility: p.visibility,
      passwordHash: p.visibility === "password" ? p.passwordHash : null,
      coverId: p.coverMediaId && allMedia.has(p.coverMediaId) ? p.coverMediaId : (mediaIds[0] ?? null),
      mediaIds,
      seo: p.seo,
      arabic: p.arabic,
      ar: p.ar,
      mature: p.mature,
    };
  });

  const used = new Set<string>();
  projects.forEach((p) => p.mediaIds.forEach((id) => used.add(id)));
  draft.pages.forEach((p) => p.blocks.forEach((b) => blockMediaIds(b).forEach((id) => id && used.add(id))));
  if (draft.theme.logoMediaId) used.add(draft.theme.logoMediaId);
  if (draft.theme.faviconMediaId) used.add(draft.theme.faviconMediaId);
  const media: Record<string, SiteMedia> = {};
  for (const id of used) {
    const m = allMedia.get(id);
    if (m) media[id] = toSiteMedia(id, m);
  }

  const version = (site.publishedVersion ?? 0) + 1;
  const snapshot: PublishedSite = {
    version,
    publishedAt: Date.now(),
    username: site.username,
    language: draft.language,
    title: draft.title,
    tagline: draft.tagline,
    theme: draft.theme,
    available: site.available,
    plan: o.plan,
    pages: draft.pages.map((p) => ({
      ...p,
      passwordHash: limitsFor(o.plan).passwordProtection ? (hashes.get(p.id) ?? null) : null,
    })),
    projects,
    media,
  };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_SNAPSHOT_BYTES) throw new ProjectError("too-big");

  const now = Timestamp.now();
  const batch = db().batch();
  batch.set(ref.collection("published").doc(String(version)), snapshot);
  batch.update(ref, { publishedVersion: version, publishedAt: now });
  projectSnap.docs.forEach((d) => batch.update(d.ref, { publishedAt: now }));
  await batch.commit();

  // Keep the last few versions; older snapshots are never read.
  const old = await ref
    .collection("published")
    .where("version", "<=", version - KEEP_VERSIONS)
    .get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  await purgeSiteCache(site.username);
  return { version };
}

/** Clears the edge cache for an artist site. Cloudflare is wired up in phase 4. */
export async function purgeSiteCache(username: string) {
  void username;
}

export async function readPublished(siteId: string, version: number): Promise<PublishedSite | null> {
  const snap = await siteRef(siteId).collection("published").doc(String(version)).get();
  return snap.exists ? (snap.data() as PublishedSite) : null;
}

export { checkPassword };
