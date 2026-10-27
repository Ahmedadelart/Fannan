/*
 * Builds Eslam Aboshady's portfolio (round 19) from the reference site's folder, using only the functions
 * the app itself uses (account, uploads, projects, draft, publish). Nothing here is special to his site:
 * every block and setting is one any artist can add and change in the editor afterwards.
 *
 * Reference: C:\Users\PC\Downloads\Eslam\website (index.html, data.json, img/). Words: seed/eslamaboshady/content.json.
 *
 *   Local (emulators + media function running):
 *     FIREBASE_ENV=emulator npx tsx --conditions=react-server scripts/seed-eslam.ts --assets "<website folder>" --logos "<png logos folder>" --fresh --publish --pro 12
 *
 *   Production (after `gcloud auth login`; nothing secret is printed): same environment variables as scripts/seed-site.ts.
 *
 * Flags:
 *   --assets <dir>   the reference folder (holds data.json and img/)
 *   --logos <dir>    PNG renderings of the reference's SVG logos (disney, epic, ffg, vodafone, logo-arabesque)
 *   --fresh          remove the site's existing projects and library files first
 *   --publish        publish when done
 *   --pro <months>   comp Pro for this many months
 */

import { readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { claimUsernameAndCreateSite, ensureUser, getUser, makeNamesPermanent } from "@/lib/server/data";
import { grantPro } from "@/lib/server/billing";
import {
  addText,
  createProject,
  deleteLibraryMedia,
  deleteMedia,
  deleteProject,
  finishUpload,
  LIBRARY,
  ownerOf,
  reorderMedia,
  setCover,
  startUpload,
  updateMedia,
  updateProject,
  type MediaDoc,
  type Owner,
} from "@/lib/server/projects";
import { publish, saveDraft } from "@/lib/server/site";
import { saveSettings } from "@/lib/server/settings";
import { writeObject } from "@/lib/server/storage";
import { newId } from "@/lib/site/ids";
import { sectionStyle } from "@/lib/site/style";
import { normalizeFooter, normalizeHeader } from "@/lib/site/normalize";
import { themes } from "@/lib/site/starter";
import type { Block, PageDraft, SectionStyle, SiteDraft } from "@/lib/site/types";

/* ---------- arguments ---------- */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ASSETS = opt("assets") ?? "";
const LOGOS = opt("logos") ?? "";
if (!ASSETS || !statSync(join(ASSETS, "data.json"), { throwIfNoEntry: false })) {
  console.error("Give the reference folder (with data.json) as --assets <dir>");
  process.exit(1);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const data: Any = JSON.parse(readFileSync(join(ASSETS, "data.json"), "utf8"));
const content: Any = JSON.parse(readFileSync("seed/eslamaboshady/content.json", "utf8"));

/* ---------- files ---------- */

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
/** "img/x.jpg" in data.json, "x.jpg" in content.json, "logos-png/x.png" for the rendered SVGs. */
function fileOf(spec: string): string {
  if (spec.startsWith("logos-png/")) return join(LOGOS, spec.slice("logos-png/".length));
  const rel = spec.startsWith("img/") ? spec : `img/${spec}`;
  if (/\.svg$/i.test(rel)) return join(LOGOS, basename(rel).replace(/\.svg$/i, ".png"));
  return join(ASSETS, rel);
}
function realType(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b.subarray(0, 3).toString("latin1") === "GIF") return "image/gif";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP")
    return "image/webp";
  return null;
}

/* ---------- uploads through the normal pipeline ---------- */

const uploaded = new Map<string, string>();
let o: Owner;
type Look = "white" | "original" | "chip";

async function upload(
  target: string,
  file: string,
  alt: string,
  use: "gallery" | "logo" | "laurel" = "gallery",
  look?: Look,
): Promise<string> {
  const key = `${target}|${file}|${use}`;
  const known = uploaded.get(key);
  if (known) return known;
  const bytes = readFileSync(file);
  const type = realType(bytes) ?? TYPES[extname(file).toLowerCase()];
  if (!type) throw new Error(`Unsupported file: ${file}`);
  let mediaId = "";
  for (let attempt = 1; ; attempt++) {
    ({ mediaId } = await startUpload(o, target, { name: basename(file), type, size: bytes.length }, undefined, {
      link: false,
    }));
    const media = (
      await adminDb().collection("sites").doc(o.siteId).collection("media").doc(mediaId).get()
    ).data() as MediaDoc & { pendingOriginal: string };
    try {
      await writeObject(media.pendingOriginal, bytes, type);
      await finishUpload(o, mediaId);
      break;
    } catch (e) {
      await (target === LIBRARY ? deleteLibraryMedia(o, mediaId) : deleteMedia(o, target, mediaId)).catch(() => {});
      if (attempt >= 3) throw e;
      process.stdout.write("r");
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  await updateMedia(o, mediaId, { alt, ...(use !== "gallery" ? { display: { use, ...(look ? { look } : {}) } } : {}) });
  uploaded.set(key, mediaId);
  process.stdout.write(".");
  return mediaId;
}
const lib = (spec: string, alt: string) => upload(LIBRARY, fileOf(spec), alt);

/** A few uploads at a time; the order of the results matches the order of the inputs. */
async function each<T, R>(list: T[], fn: (x: T, i: number) => Promise<R>, n = 3): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i], i);
      }
    }),
  );
  return out;
}

/* ---------- projects ---------- */

interface Made {
  id: string;
  mediaIds: string[];
  title: string;
}
const made = new Map<string, Made>();

async function makeProject(p: Any) {
  const id = await createProject(o, p.title);
  await updateProject(o, id, {
    role: p.role ?? "",
    client: p.client ?? "",
    year: p.year ?? "",
    description: p.blurb ?? "",
    unit: p.unit ?? "",
    tags: p.spread ? "featured" : "more work",
  });
  // The gallery, in the reference's order (a few files at a time, then put back in order).
  const mediaIds = await each(p.images as Any[], (im) =>
    upload(id, fileOf(im.src), `${p.title}, ${p.unit ?? "sheet"} ${(p.images as Any[]).indexOf(im) + 1}`),
  );
  await reorderMedia(o, id, mediaIds);
  const coverAt = (p.images as Any[]).findIndex((im) => im.src === p.cover?.src);
  if (coverAt >= 0) await setCover(o, id, mediaIds[coverAt]);
  // Client logos: pictures (white, as they are, or on a white chip) and wordmarks (text items marked as logos).
  for (const l of (p.logos ?? []) as Any[]) {
    if (l.img) await upload(id, fileOf(l.img), l.alt ?? "", "logo", l.chip ? "chip" : l.color ? "original" : "white");
    if (l.text) {
      const t = await addText(o, id, { title: l.text });
      await updateMedia(o, t.id, { display: { use: "logo" } });
    }
  }
  made.set(p.slug, { id, mediaIds, title: p.title });
  console.log(`\n  project: ${p.title} (${mediaIds.length})`);
}

/* ---------- the pages ---------- */

const band = (color: string, patch: Partial<Omit<SectionStyle, "bg">> = {}): SectionStyle =>
  sectionStyle({ bg: { kind: "color", color }, ...patch });
const plain = (patch: Partial<Omit<SectionStyle, "bg">> = {}): SectionStyle => sectionStyle(patch);

function header(title: string, subtitle: string, anchor: string, railLabel?: string): Block {
  return {
    id: newId(),
    type: "header",
    number: "",
    title,
    subtitle,
    logoId: null,
    badge: "",
    divider: false,
    size: "xl",
    style: plain({ anchor, padTop: 72, padBottom: 28, ...(railLabel ? { railLabel } : {}) }),
  };
}

async function homeBlocks(): Promise<Block[]> {
  const blocks: Block[] = [];
  const c = content;

  // 1. Hero: a slideshow of five artworks, the headline, two numbers.
  const heroes = await each(data.hero as Any[], (h) => lib(h.src, h.cap), 2);
  const pos = (s: string) => {
    const [x, y] = String(s ?? "50% 50%")
      .split(/\s+/)
      .map((v) => Number(v.replace("%", "")));
    return { x: x ?? 50, y: y ?? 50, zoom: 1 };
  };
  blocks.push({
    id: newId(),
    type: "cover",
    mediaId: heroes[0],
    tone: "#2A2622",
    heading: c.hero.heading,
    subheading: c.hero.text,
    note: c.hero.note,
    height: "full",
    size: "xl",
    crop: pos(data.hero[0].pos),
    caption: data.hero[0].cap,
    slides: (data.hero as Any[]).slice(1).map((h, i) => ({ mediaId: heroes[i + 1], caption: h.cap, crop: pos(h.pos) })),
    interval: 6.5,
    stats: c.hero.stats,
    style: plain({ anchor: "top", padTop: 48, padBottom: 0 }),
  });

  // 2. Client logo strip.
  const strip = await each(c.clients as Any[], async (l) => ({
    name: l.name,
    mediaId: l.img ? await lib(l.img, l.name) : null,
    ...(l.look ? { look: l.look } : {}),
    ...(l.height ? { height: l.height } : {}),
  }));
  blocks.push({
    id: newId(),
    type: "logos",
    heading: "",
    items: strip,
    tint: "white",
    style: plain({ align: "center", padTop: 22, padBottom: 22 }),
  });

  // 3. The twelve spreads, each in its own colour.
  const featured = (data.projects as Any[]).filter((p) => p.spread);
  featured.forEach((p, i) => {
    const m = made.get(p.slug)!;
    blocks.push({
      id: newId(),
      type: "spread",
      projectId: m.id,
      lead: p.spread.lead,
      supports: p.spread.supports,
      label: p.short ?? "",
      counter: true,
      logos: true,
      words: true,
      snap: true,
      style: band(p.bg, { anchor: i === 0 ? "work" : p.slug, padTop: 72, padBottom: 48 }),
    });
  });

  // 4. More work: justified rows of the other projects.
  const more = (data.projects as Any[]).filter((p) => !p.spread);
  blocks.push(header(c.more.title, c.more.subtitle, "more-h"));
  blocks.push({
    id: newId(),
    type: "gallery",
    layout: "rows",
    source: "all",
    columns: 3,
    gap: 14,
    ratio: "original",
    lightbox: false,
    captions: true,
    credits: false,
    hoverPlay: false,
    hover: "view",
    lines: ["meta"],
    captionStyle: "heading",
    captionSize: "l",
    captionLogos: true,
    rowHeight: 300,
    filter: false,
    picks: more.map((p) => made.get(p.slug)!.id),
    samples: [],
    style: plain({ padTop: 48, padBottom: 60 }),
  });

  // 5. Jump Animation: red field, a tinted studio photo, angled edges, three black tiles.
  const bandPhoto = await lib("jump-band.jpg", "");
  const jumpLogo = await lib("logo-jump-dark.png", "Jump Animation");
  const jumpTiles = await each(c.jump.tiles as Any[], async (t) => ({
    mediaId: t.img ? await lib(t.img, t.title) : null,
    tone: "#16140F",
    title: t.title,
    text: t.text ?? "",
    link: t.link ?? "",
    projectId: t.project ? made.get(t.project)!.id : null,
    sheet: t.sheet ?? 0,
  }));
  blocks.push({
    id: newId(),
    type: "brand",
    logoId: jumpLogo,
    logoWidth: 260,
    mark: null,
    heading: c.jump.heading,
    headingFont: "heading",
    text: c.jump.text,
    button: { label: c.jump.button, link: c.jump.link, style: "filled" },
    colors: { text: "#FFFFFF", heading: "#FFFFFF", accent: "#16140F", tile: "#16140F", tileText: "#FFFFFF" },
    dir: "ltr",
    tiles: jumpTiles,
    columns: 3,
    tileRatio: "16/9",
    tileRadius: 0,
    tileBorder: true,
    tileFont: "heading",
    style: sectionStyle({
      bg: {
        kind: "image",
        mediaId: bandPhoto,
        overlay: "#FF0A3A",
        overlayOpacity: 78,
        blend: "luminosity",
        color: "#FF0A3A",
      },
      edgeTop: { shape: "slant", height: 34, flip: false },
      edgeBottom: { shape: "slant", height: 34, flip: true },
      padTop: 72,
      padBottom: 72,
      anchor: "jump",
      railLabel: "Jump Animation",
      text: "#FFFFFF",
    }),
  });

  // 6. Arabesque: deep green, mint accent, gold Arabic title, right to left.
  const arabLogo = await lib("logos-png/logo-arabesque.png", "Arabesque — أرابيسك");
  const arabTiles = (c.arabesque.tiles as Any[]).map((t) => {
    const m = made.get(t.project)!;
    return {
      mediaId: m.mediaIds[t.sheet] ?? null,
      tone: "#113A30",
      title: t.title,
      text: "",
      link: "",
      projectId: m.id,
      sheet: t.sheet,
    };
  });
  blocks.push({
    id: newId(),
    type: "brand",
    logoId: arabLogo,
    logoWidth: 240,
    mark: null,
    heading: c.arabesque.heading,
    headingFont: "arabic",
    text: c.arabesque.text,
    button: { label: c.arabesque.button, link: c.arabesque.link, style: "outline" },
    colors: { text: "#EAF3EE", heading: "#E3B64C", accent: "#4BDD88", tile: "#113A30", tileText: "#FFFFFF" },
    dir: "rtl",
    tiles: arabTiles,
    columns: 3,
    tileRatio: "1/1",
    tileRadius: 10,
    tileBorder: true,
    tileFont: "arabic",
    style: band("#0D2B24", { padTop: 80, padBottom: 80, anchor: "arabesque", railLabel: "Arabesque", text: "#EAF3EE" }),
  });

  // 7. Fan art: eight groups, justified rows, lightbox.
  blocks.push(header(c.fanart.title, c.fanart.subtitle, "fanart", c.fanart.railLabel));
  const fanIds = await each(data.fanart as Any[], (f) => lib(f.src, f.title), 3);
  (data.groups as string[]).forEach((g, gi) => {
    const items = (data.fanart as Any[]).map((f, i) => ({ f, i })).filter((x) => x.f.group === g);
    blocks.push({
      id: newId(),
      type: "images",
      heading: g,
      headingSize: "s",
      items: items.map(({ f, i }) => ({ id: newId(), mediaId: fanIds[i], tone: "#5B3A2E", caption: f.title })),
      layout: "rows",
      columns: 4,
      gap: 14,
      ratio: "original",
      captions: false,
      style: plain({ padTop: gi === 0 ? 48 : 36, padBottom: 36 }),
    });
  });

  // 8. Shop: a light card world with the Redbubble mark.
  const shopTiles = await each(c.shop.tiles as Any[], async (t) => ({
    mediaId: await lib(t.img, t.title),
    tone: "#FFFFFF",
    title: t.title,
    text: t.text,
    link: c.shop.link,
    projectId: null,
    sheet: 0,
  }));
  blocks.push({
    id: newId(),
    type: "brand",
    logoId: null,
    logoWidth: 240,
    mark: c.shop.mark,
    heading: c.shop.heading,
    headingFont: "heading",
    text: c.shop.text,
    button: { label: c.shop.button, link: c.shop.link, style: "filled", pill: true },
    colors: { text: "#16140F", heading: "#16140F", accent: "#E41321", tile: "#FFFFFF", tileText: "#16140F" },
    dir: "ltr",
    tiles: shopTiles,
    columns: 4,
    tileRatio: "15/16",
    tileRadius: 10,
    tileBorder: false,
    tileFont: "body",
    style: band("#F7F7F8", { padTop: 80, padBottom: 80, anchor: "shop", railLabel: "Shop", text: "#16140F" }),
  });

  // 9. Recognition.
  blocks.push(header(c.recognition.title, c.recognition.subtitle, "recognition"));
  const recItems = await each(c.recognition.items as Any[], async (it) => ({
    title: it.title,
    text: it.text ?? "",
    meta: it.tag ?? "",
    icon: "star",
    mediaId: it.img ? await lib(it.img, it.title) : null,
    tone: "#5B3A2E",
    link: it.link ?? "",
    button: "",
    stars: 0,
    price: "",
    url: "",
    ...(it.date ? { date: it.date } : {}),
  }));
  blocks.push({
    id: newId(),
    type: "cards",
    design: "c-awards",
    variant: "awards",
    heading: "",
    intro: "",
    columns: 3,
    align: "start",
    button: "",
    link: "",
    mediaId: null,
    tone: "#5B3A2E",
    items: recItems,
    style: plain({ padTop: 48, padBottom: 60 }),
  });

  // 10. Experience.
  blocks.push(header(c.experience.title, c.experience.subtitle, "experience"));
  blocks.push({
    id: newId(),
    type: "cards",
    design: "c-list",
    variant: "list",
    heading: "",
    intro: "",
    columns: 1,
    align: "start",
    button: "",
    link: "",
    mediaId: null,
    tone: "#5B3A2E",
    items: (c.experience.items as Any[]).map((it) => ({
      title: it.role,
      subtitle: it.org,
      text: it.text,
      meta: it.years,
      icon: "sparkle",
      mediaId: null,
      tone: "#5B3A2E",
      link: "",
      button: "",
      stars: 0,
      price: "",
      url: "",
    })),
    style: plain({ padTop: 48, padBottom: 48 }),
  });

  // 11. About, with the portrait inside the words and a side column.
  blocks.push(header(c.about.title, "", "about"));
  const portrait = await lib(c.about.portrait, "Eslam Aboshady");
  const orgs = await each(c.about.orgs as Any[], async (x) => ({
    mediaId: await lib(x.img, x.text),
    text: x.text,
    link: x.link,
  }));
  blocks.push({
    id: newId(),
    type: "about",
    heading: "",
    text: c.about.text,
    photoId: portrait,
    cvId: null,
    photoStyle: "float",
    skillsTitle: c.about.skillsTitle,
    skills: c.about.skills,
    orgsTitle: c.about.orgsTitle,
    orgs,
    style: plain({ padTop: 48, padBottom: 40 }),
  });

  // 12. Contact: the email with a Copy button and link buttons.
  blocks.push({
    ...Object.assign(header(c.contact.heading, "", "contact"), { narrow: true }),
    style: { ...plain({ anchor: "contact", padTop: 54, padBottom: 18 }), railHide: true },
  });
  blocks.push({
    id: newId(),
    type: "contact",
    heading: "",
    text: "",
    button: "",
    mode: "links",
    email: c.contact.email,
    links: (c.contact.links as string[][]).map(([label, url]) => ({ label, url })),
    flat: true,
    style: plain({ padTop: 48, padBottom: 64 }),
  });
  return blocks;
}

/* ---------- the run ---------- */

async function main() {
  const acct = content.account;
  console.log(`Seeding ${acct.username} (${acct.email}) from ${ASSETS}`);

  // 1. Account: find or create; no emails are sent from here.
  let uid: string;
  try {
    uid = (await adminAuth().getUserByEmail(acct.email)).uid;
  } catch {
    uid = (await adminAuth().createUser({ email: acct.email, emailVerified: true, displayName: acct.displayName })).uid;
  }
  await ensureUser(uid, { locale: "en", isAnonymous: false, email: acct.email });
  const user = await getUser(uid);
  if (!user?.siteId) {
    const r = await claimUsernameAndCreateSite(
      uid,
      acct.username,
      { name: acct.displayName, discipline: acct.discipline, layout: "grid", language: "en" },
      false,
    );
    if (!r.ok) throw new Error(`Couldn't claim ${acct.username}: ${r.reason}`);
  }
  await makeNamesPermanent(uid);
  o = await ownerOf(uid);
  if (o.site.username !== acct.username)
    throw new Error(`This account's site is ${o.site.username}, not ${acct.username}`);
  const months = Number(opt("pro") ?? 0);
  if (months > 0) await grantPro(uid, months, "seed", "Comped: Eslam Aboshady's site on Fannan");
  o = await ownerOf(uid);
  console.log(`  account ${uid}, site ${o.siteId}, plan ${o.plan}`);

  // 2. Fresh start when asked.
  const projectsCol = adminDb().collection("sites").doc(o.siteId).collection("projects");
  const existing = await projectsCol.get();
  if (existing.size && !flag("fresh"))
    throw new Error(`The site already has ${existing.size} projects. Run with --fresh to replace them.`);
  for (const d of existing.docs) await deleteProject(o, d.id);
  if (flag("fresh")) {
    const libMedia = await adminDb()
      .collection("sites")
      .doc(o.siteId)
      .collection("media")
      .where("projectId", "==", LIBRARY)
      .get();
    await each(libMedia.docs, (d) => deleteLibraryMedia(o, d.id), 6);
  }

  // 3. Projects, last first, so galleries (newest first) keep the reference's order.
  for (const p of [...(data.projects as Any[])].reverse()) await makeProject(p);

  // 4. The home page, the menu, the theme and the frame.
  const blocks = await homeBlocks();
  const home: PageDraft = { id: "home", slug: "", title: "Home", type: "custom", showInNav: false, blocks };
  const work: PageDraft = {
    id: newId(),
    slug: "work",
    title: content.menu.work.title,
    type: "folder",
    showInNav: true,
    blocks: [],
  };
  const workItems: PageDraft[] = (content.menu.work.items as string[][]).map(([title, url], i) => ({
    id: newId(),
    slug: `work-${i + 1}`,
    title,
    type: "link",
    url,
    showInNav: true,
    parentId: work.id,
    blocks: [],
  }));
  const links: PageDraft[] = (content.menu.links as string[][]).map(([title, url], i) => ({
    id: newId(),
    slug: `link-${i + 1}`,
    title,
    type: "link",
    url,
    showInNav: true,
    blocks: [],
  }));
  const s = content.site;
  const draft: SiteDraft = {
    language: "en",
    title: s.title,
    tagline: s.tagline,
    theme: {
      ...themes.night,
      colors: s.colors,
      fonts: {
        heading: "big-shoulders",
        body: "instrument-sans",
        arabic: "cairo",
        arabicBody: "cairo",
        headingWeight: 900,
        headingUpper: true,
        headingTracking: -1,
      },
      nav: "top",
      radius: 0,
      logoMediaId: null,
      faviconMediaId: null,
      maxWidth: 1520,
      projectPage: "reader",
    },
    pages: [home, work, ...workItems, ...links],
    header: {
      ...normalizeHeader({}),
      sticky: true,
      background: "glass",
      tagline: true,
      taglineBeside: true,
      hire: { on: true, label: s.shop.label, link: s.shop.link, style: "filled", color: s.shop.color, icon: "cart" },
      linkGap: 22,
      space: 14,
      social: true,
      socialDivider: true,
      rail: true,
      titleSize: 26,
    },
    footer: {
      ...normalizeFooter({}),
      text: content.footer.legal,
      line: content.footer.line,
      tagline: true,
      showTitle: true,
      social: false,
      cv: false,
      layout: "stack",
      align: "start",
      border: true,
      padding: 36,
    },
  };
  await saveSettings(o, { social: s.social });
  await saveDraft(o, draft);
  await saveSettings(o, { seo: { title: s.seoTitle, description: s.seoDescription, shareImageId: null } });
  await adminDb().collection("sites").doc(o.siteId).update({ title: s.title, updatedAt: FieldValue.serverTimestamp() });
  console.log("\n  draft saved");

  if (flag("publish")) {
    await adminDb()
      .collection("users")
      .doc(uid)
      .set({ emails: { live: true } }, { merge: true });
    const { version } = await publish(o);
    console.log(`  published version ${version}`);
  }
  console.log(`Done: ${uploaded.size} files.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
