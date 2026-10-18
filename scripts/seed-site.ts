/*
 * Builds an artist's site from a content file and a folder of files, using only the functions the
 * app itself uses (the same account, upload, project, draft and publish code as the editor).
 * Nothing in the app is special to the site it builds: every block and setting here is one any
 * artist can use and change in the editor afterwards.
 *
 * First use: Ahmed Adel's portfolio (seed/ahmedadel/site-content.json). See docs/SEED-AHMEDADEL.md.
 *
 *   Local (emulators + media function running):
 *     FIREBASE_ENV=emulator npx tsx --conditions=react-server scripts/seed-site.ts --assets "<folder>" --fresh --publish
 *
 *   Production (after `gcloud auth login`; nothing secret is printed):
 *     MEDIA_ID_TOKEN="$(gcloud auth print-identity-token)" FIREBASE_ENV=production MEDIA_BUCKET=fannan-media-production  *     MEDIA_FUNCTION_URL=https://fannan-media-mtxig4fw3a-ew.a.run.app GOOGLE_CLOUD_QUOTA_PROJECT=fannan-510913  *     CLOUDFLARE_API_TOKEN="$(gcloud secrets versions access latest --secret=cloudflare-api-token --project fannan-510913)"  *     CLOUDFLARE_ZONE_ID=ee75c783272f2a590bb5c44b0eccf85c ROOT_DOMAIN=fannan.net  *     npx tsx --conditions=react-server scripts/seed-site.ts --assets "<folder>" --fresh --publish
 *
 * Flags:
 *   --assets <dir>   the artist's folder of files (ASSETS_ROOT)
 *   --fresh          remove the site's existing projects and library files first
 *   --publish        publish when done
 *   --pro <months>   comp Pro for this many months (the admin tool's grant)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { claimUsernameAndCreateSite, ensureUser, getUser, makeNamesPermanent } from "@/lib/server/data";
import { grantPro } from "@/lib/server/billing";
import {
  createProject,
  deleteProject,
  finishUpload,
  LIBRARY,
  ownerOf,
  startUpload,
  updateMedia,
  updateProject,
  type MediaDoc,
  type Owner,
  type ProjectPatch,
} from "@/lib/server/projects";
import { publish, saveDraft } from "@/lib/server/site";
import { saveSettings } from "@/lib/server/settings";
import { writeObject } from "@/lib/server/storage";
import { newId } from "@/lib/site/ids";
import { themes } from "@/lib/site/starter";
import { sectionStyle } from "@/lib/site/style";
import { normalizeFooter, normalizeHeader } from "@/lib/site/normalize";
import type { Block, PageDraft, SiteDraft } from "@/lib/site/types";
import { sampleTone } from "@/lib/site/samples";

/* ---------- arguments ---------- */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ASSETS = opt("assets") ?? process.env.ASSETS_ROOT ?? "";
const CONTENT = opt("content") ?? "seed/ahmedadel/site-content.json";
if (!ASSETS || !statSync(ASSETS, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("Give the artist's folder with --assets <dir>");
  process.exit(1);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const content: Any = JSON.parse(readFileSync(CONTENT, "utf8"));

/* ---------- files ---------- */

const PICTURE = /\.(jpe?g|png|gif|webp)$/i;
const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf" };

/** "home/04_x/002_a.jpg" → that file; "character-design/09/" → the folder starting with 09, its pictures in order. */
function filesOf(spec: string): string[] {
  const clean = spec.split(/\s+\(|\s+or\s+/)[0].trim();
  const [section, ...rest] = clean.replace(/\/$/, "").split("/");
  let dir = join(ASSETS, section);
  for (const part of rest) {
    const exact = join(dir, part);
    if (statSync(exact, { throwIfNoEntry: false })) {
      dir = exact;
      continue;
    }
    const match = readdirSync(dir).find((n) => n === part || n.startsWith(`${part}_`) || n.startsWith(part));
    if (!match) throw new Error(`Not found: ${spec}`);
    dir = join(dir, match);
  }
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir)
    .filter((n) => PICTURE.test(n))
    .sort()
    .map((n) => join(dir, n));
}
function realType(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b.subarray(0, 3).toString("latin1") === "GIF") return "image/gif";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}
const fileOf = (spec: string) => filesOf(spec)[0];
/** Pictures by number in one folder ("002", "006"). */
const pick = (folder: string, nums: string[]) => filesOf(folder).filter((f) => nums.some((n) => basename(f).startsWith(`${n}_`)));

/* ---------- uploads through the normal pipeline ---------- */

const uploaded = new Map<string, string>();
let o: Owner;

async function upload(target: string, file: string, alt: string, use: "gallery" | "logo" | "laurel" = "gallery"): Promise<string> {
  const key = `${target}|${file}|${use}`;
  const known = uploaded.get(key);
  if (known) return known;
  const data = readFileSync(file);
  // Names can be wrong (a JPEG saved as .png): the first bytes say what the file really is.
  const type = realType(data) ?? TYPES[extname(file).toLowerCase()];
  if (!type) throw new Error(`Unsupported file: ${file}`);
  const { mediaId } = await startUpload(o, target, { name: basename(file), type, size: data.length }, undefined, { link: false });
  const media = (await adminDb().collection("sites").doc(o.siteId).collection("media").doc(mediaId).get()).data() as MediaDoc & { pendingOriginal: string };
  await writeObject(media.pendingOriginal, data, type);
  await finishUpload(o, mediaId);
  await updateMedia(o, mediaId, { alt, ...(use !== "gallery" ? { display: { use } } : {}) });
  uploaded.set(key, mediaId);
  process.stdout.write(".");
  return mediaId;
}
const lib = (spec: string, alt: string) => upload(LIBRARY, fileOf(spec), alt);

/** A few uploads at a time; the order of the results matches the order of the files. */
async function each<T, R>(list: T[], fn: (x: T, i: number) => Promise<R>, n = 4): Promise<R[]> {
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

/* ---------- brands, by file (the file names don't say) ---------- */

const BRANDS: Record<string, string> = {
  "home/03_network-logos-hbo-cartoon-network-netfli/001": "HBO",
  "home/03_network-logos-hbo-cartoon-network-netfli/002": "Cartoon Network",
  "home/03_network-logos-hbo-cartoon-network-netfli/003": "Netflix",
  "home/03_network-logos-hbo-cartoon-network-netfli/004": "OSN+",
  "home/03_network-logos-hbo-cartoon-network-netfli/005": "Majid TV",
  "home/03_network-logos-hbo-cartoon-network-netfli/006": "MBC Academy",
  "about/03_studio-logos-big-cat-jump-animation-sun-/001": "Big Cat Animation",
  "about/03_studio-logos-big-cat-jump-animation-sun-/002": "Jump Animation",
  "about/03_studio-logos-big-cat-jump-animation-sun-/003": "Sun Creature",
  "about/03_studio-logos-big-cat-jump-animation-sun-/004": "Giraffics",
  "about/03_studio-logos-big-cat-jump-animation-sun-/005": "The Post Office",
  "about/03_studio-logos-big-cat-jump-animation-sun-/006": "[Studio name]",
  "about/03_studio-logos-big-cat-jump-animation-sun-/007": "Parrots Studio",
  "about/03_studio-logos-big-cat-jump-animation-sun-/008": "Aspect",
  "about/03_studio-logos-big-cat-jump-animation-sun-/009": "Zaini Studios",
  "about/03_studio-logos-big-cat-jump-animation-sun-/010": "Hive Studio",
  "about/03_studio-logos-big-cat-jump-animation-sun-/011": "Jamp Studio",
  "about/03_studio-logos-big-cat-jump-animation-sun-/012": "BUG Studio",
  "2d-animation/02_header-logos-zakia-al-zakia-majid-tv-jum/001": "Majid TV",
  "2d-animation/02_header-logos-zakia-al-zakia-majid-tv-jum/002": "Jump Animation",
  "2d-animation/02_header-logos-zakia-al-zakia-majid-tv-jum/003": "Zakia Al Zakia",
  "2d-animation/04_header-logos-valiant-prince-ivandoe-cart/001": "Cartoon Network",
  "2d-animation/04_header-logos-valiant-prince-ivandoe-cart/002": "Sun Creature",
  "2d-animation/04_header-logos-valiant-prince-ivandoe-cart/003": "The Heroic Quest of the Valiant Prince Ivandoe",
  "2d-animation/06_header-logos-the-grand-night-giraffics-j/001": "Giraffics",
  "2d-animation/06_header-logos-the-grand-night-giraffics-j/002": "Annecy Festival 2020, Official Selection, MIFA Pitches",
  "2d-animation/06_header-logos-the-grand-night-giraffics-j/003": "The Grand Night",
  "2d-animation/08_graduation-film-header-background-image-/002": "Babylon Animation Cinema Festival",
  "2d-animation/08_graduation-film-header-background-image-/003": "Alexandria Short Film Festival",
  "2d-animation/08_graduation-film-header-background-image-/004": "Long Night",
  "2d-animation/08_graduation-film-header-background-image-/005": "Long Night",
  "2d-animation/08_graduation-film-header-background-image-/006": "Animatex 2023, Official Selection",
  "2d-animation/08_graduation-film-header-background-image-/007": "Cairo International Animation Festival, winner, 2nd prize",
  "character-design/02_project-header-logos-fever-dreams-netfli/001": "Zaini Studios",
  "character-design/02_project-header-logos-fever-dreams-netfli/002": "Al Akhawain Qods",
  "character-design/02_project-header-logos-fever-dreams-netfli/003": "Netflix",
  "character-design/02_project-header-logos-fever-dreams-netfli/004": "Fever Dreams",
  "character-design/04_project-header-logos-hakawati-nation-mbc/001": "MBC Academy",
  "character-design/04_project-header-logos-hakawati-nation-mbc/002": "Aspect",
  "character-design/04_project-header-logos-hakawati-nation-mbc/003": "Hakawati Nation",
  "character-design/06_project-header-logos-bug-studio-1/001": "BUG Studio",
  "character-design/06_project-header-logos-bug-studio-1/002": "Mobile Legends: Bang Bang",
  "character-design/08_project-header-logos/001": "Zaini Studios",
  "character-design/08_project-header-logos/002": "Saudi Film Festival",
  "character-design/10_project-header-logo/001": "Sweet & Sour",
  "storyboard/11_client-header-logos/001": "Cultural Development Fund",
  "storyboard/11_client-header-logos/002": "Yaqoot",
  "storyboard/11_client-header-logos/003": "A’lam Al Rowad",
  "home/07_commercial-leadership/001": "Big Cat Animation",
};
const brandOf = (file: string, fallback: string) => {
  const rel = file.slice(ASSETS.length + 1).replace(/\\/g, "/");
  const key = `${rel.split("/").slice(0, -1).join("/")}/${basename(file).slice(0, 3)}`;
  return BRANDS[key] ?? fallback;
};
/** Files the content calls laurels that are really the film's title art. */
const TITLE_ART = new Set(["004", "005"]);

/* ---------- projects ---------- */

interface Made {
  id: string;
  title: string;
  coverId?: string;
}
const made = new Map<string, Made>();

const yearsOf = (dates?: string) => {
  const ys = (dates ?? "").match(/\b(19|20)\d{2}\b/g);
  return ys ? (ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : ys[0]) : "";
};

async function makeProject(p: Any) {
  const id = await createProject(o, p.title);
  const details: string[] = [];
  if (p.episodes) details.push(`Episodes: ${p.episodes}`);
  if (p.type) details.push(`Type: ${p.type}`);
  if (p.school) details.push(`School: ${p.school}`);
  if (p.dates) details.push(`Dates: ${p.dates}`);
  const patch: ProjectPatch = {
    role: p.role ?? "",
    client: p.client ?? "",
    studio: p.studio ?? "",
    year: yearsOf(p.dates),
    tags: [p.group, ...(p.group === "needs-role" ? [] : [])].join(", "),
    description: (p.words ?? []).join("\n\n"),
    network: p.network ?? "",
    details: details.join("\n"),
    credits: (p.credits ?? []).map(([a, b]: string[]) => `${a}: ${b}`).join("\n"),
    thanks: (p.thanks ?? []).map(([a, b]: string[]) => `${a}: ${b}`).join("\n"),
    tools: (p.tools ?? []).join(", "),
    // Ahmed sorts these himself: hidden until he gives them a role.
    // A project with nothing to show yet (only a [video link] to come) waits as a hidden draft too.
    ...(p.group === "needs-role" || (!p.cover && !p.loop && !p.gallery) ? { visibility: "hidden" as const } : {}),
  };
  await updateProject(o, id, patch);

  // Cover first (the first picture becomes the cover), then logos, laurels and the gallery.
  const coverFile = p.loop ?? p.cover;
  const coverId = coverFile ? await upload(id, fileOf(coverFile), p.title) : undefined;
  if (p.logo) await upload(id, fileOf(p.logo), brandOf(fileOf(p.logo), p.client ?? p.title), "logo");
  if (p.headerLogos) await each(filesOf(p.headerLogos), (f) => upload(id, f, brandOf(f, p.title), "logo"));
  if (p.laurels) {
    const folder = p.laurels.split(" ")[0].split("/").slice(0, 2).join("/");
    const files = pick(folder, ["002", "003", "004", "005", "006", "007"]);
    await each(files, (f) => upload(id, f, brandOf(f, p.title), TITLE_ART.has(basename(f).slice(0, 3)) ? "logo" : "laurel"));
  }
  if (p.gallery) {
    const files = String(p.gallery)
      .split("+")
      .map((x) => x.trim())
      .flatMap((spec) => {
        const s = spec.split(" ")[0];
        return /header-logo/.test(s) ? [] : filesOf(s.startsWith("character-design") || s.includes("/") ? s : `character-design/${s}`);
      });
    await each(files, (f) => upload(id, f, p.title));
  }
  made.set(p.id, { id, title: p.title, coverId });
  console.log(`\n  project: ${p.title}`);
}

/* ---------- blocks ---------- */

const header = (number: string, title: string, extra: Partial<Extract<Block, { type: "header" }>> = {}, anchor = ""): Block => ({
  id: newId(),
  type: "header",
  number,
  title,
  subtitle: "",
  logoId: null,
  badge: "",
  divider: true,
  size: "m",
  ...extra,
  ...(anchor ? { style: sectionStyle({ anchor, padBottom: 0 }) } : {}),
});

const grid = (tag: string, extra: Partial<Extract<Block, { type: "gallery" }>> = {}): Block => ({
  id: newId(),
  type: "gallery",
  layout: "grid",
  source: `tag:${tag}`,
  columns: 4,
  gap: 24,
  ratio: "2:3",
  lightbox: false,
  captions: true,
  credits: false,
  hoverPlay: true,
  filter: false,
  samples: [],
  ...extra,
});

const heroTitle = (text: string): Block => ({ id: newId(), type: "hero", text, align: "start" });

const images = (ids: string[], extra: Partial<Extract<Block, { type: "images" }>> = {}): Block => ({
  id: newId(),
  type: "images",
  heading: "",
  items: ids.map((mediaId, i) => ({ id: newId(), mediaId, tone: sampleTone(i), caption: "" })),
  layout: "masonry",
  columns: 3,
  gap: 16,
  ratio: "original",
  captions: false,
  ...extra,
});

const logos = (heading: string, items: Array<{ name: string; mediaId: string }>, extra: Partial<Extract<Block, { type: "logos" }>> = {}): Block => ({
  id: newId(),
  type: "logos",
  heading,
  items,
  ...extra,
});

/* ---------- the run ---------- */

async function main() {
  const acct = content.account;
  console.log(`Seeding ${acct.username} (${acct.email}) from ${CONTENT}`);

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
    const r = await claimUsernameAndCreateSite(uid, acct.username, { name: acct.displayName, discipline: "animation-director", layout: "grid", language: "en" }, false);
    if (!r.ok) throw new Error(`Couldn't claim ${acct.username}: ${r.reason}`);
  }
  await makeNamesPermanent(uid);
  o = await ownerOf(uid);
  if (o.site.username !== acct.username) throw new Error(`This account's site is ${o.site.username}, not ${acct.username}`);
  const months = Number(opt("pro") ?? 0);
  if (months > 0) await grantPro(uid, months, "seed", "Comped: first real site on Fannan");
  o = await ownerOf(uid);
  console.log(`  account ${uid}, site ${o.siteId}, plan ${o.plan}`);

  // 2. Fresh start when asked: the site's projects and library files go.
  const projectsCol = adminDb().collection("sites").doc(o.siteId).collection("projects");
  const existing = await projectsCol.get();
  if (existing.size && !flag("fresh")) throw new Error(`The site already has ${existing.size} projects. Run with --fresh to replace them.`);
  for (const d of existing.docs) await deleteProject(o, d.id);
  if (flag("fresh")) {
    const libMedia = await adminDb().collection("sites").doc(o.siteId).collection("media").where("projectId", "==", LIBRARY).get();
    for (const d of libMedia.docs) await d.ref.delete();
    await adminDb().collection("sites").doc(o.siteId).update({ storageUsed: 0 });
  }

  // 3. Projects, oldest first in each group, so galleries (newest first) show them in the content's order.
  const projects = (content.projects as Any[]).filter((p) => p.id);
  for (const p of [...projects].reverse()) await makeProject(p);

  // 4. Library pictures for the pages.
  const logoItems = async (folder: string) =>
    each(filesOf(folder), async (f) => {
      const name = brandOf(f, "Logo");
      return { name, mediaId: await upload(LIBRARY, f, name) };
    });
  const siteLogo = await lib("_site/logo.png", acct.displayName);
  const share = await lib("_site/social-share-image.jpeg", acct.displayName);

  const home: Any = content.pages.find((p: Any) => p.slug === "/");
  const hb = (name: string, i = 0) => home.blocks.filter((b: Any) => b.block === name)[i];
  const cover = hb("Fullscreen cover");
  const coverImg = await lib(cover.image, "Key art: a warrior between two giant cats");
  const credits = await logoItems("home/03_network-logos-hbo-cartoon-network-netfli");
  const bigCatLogo = await lib("home/07_commercial-leadership/001_Comp 2.gif", "Big Cat Animation");
  const ventures = hb("Columns (cards)");
  // Where the content offers two pictures, the second (a photo) reads better than a white-on-white animation.
  const ventureImgs = await each(ventures.cards as Any[], (c) => lib(String(c.image).split(" or ").pop()!, c.title));
  const tilesBlock = hb("Category tiles");
  const tileImgs = await each(tilesBlock.tiles as Any[], (t) => lib(t.image, t.title));
  const contactArt = await lib(hb("Contact form").image, "Ahmed drawn as a cartoon holding an orange cat");

  const soft = "#F5F2EE";
  const dark = sectionStyle({ bg: { kind: "color", color: "#111111" } as never, padTop: 72, padBottom: 72 });
  const homeBlocks: Block[] = [
    {
      id: newId(),
      type: "cover",
      mediaId: coverImg,
      tone: "#1A1714",
      heading: cover.heading,
      subheading: "",
      height: "large",
      eyebrow: cover.eyebrow,
      button: "Watch reel",
      link: "",
      inset: true,
    },
    logos("", credits, { band: "#FF5A1F", tint: "white", oneRow: true }),
    header("01", "Broadcast Work", {}, "broadcast"),
    grid("broadcast", { columns: 4, split: true, wideColumns: 2, lines: ["network", "role"], accentRole: true }),
    { ...header("02", "Independent Directing", {}, "directing"), style: { ...dark, anchor: "directing", padBottom: 0 } },
    { ...grid("directing", { columns: 5, lines: ["role"], accentRole: true }), style: { ...dark, padTop: 24 } },
    header("03", "Commercial Leadership at BIG CAT Animation", { subtitle: "Co-Founder, CEO and Director", badge: "Directed by me" }, "bigcat"),
    grid("bigcat", { layout: "rows", columns: 4, ratio: "original", gap: 20, lines: ["role"], loopPlay: "always" }),
    header("04", "Commercial Projects", { subtitle: "At other studios" }, "commercial"),
    grid("commercial", { layout: "rows", columns: 4, ratio: "original", gap: 20, lines: ["role", "studio"], accentRole: true, loopPlay: "always" }),
    header("05", "Ventures & IPs", {}, "ventures"),
    {
      id: newId(),
      type: "cards",
      design: "c-cards",
      variant: "images",
      heading: "",
      intro: "",
      columns: 3,
      align: "start",
      button: "",
      link: "",
      mediaId: null,
      tone: sampleTone(0),
      items: (ventures.cards as Any[]).map((c, i) => ({ title: c.title, text: c.role, meta: "", icon: "sparkle", mediaId: ventureImgs[i], tone: sampleTone(i), link: "", button: "", stars: 0, price: "", url: "" })),
    },
    header("06", "Portfolio", {}, "portfolio"),
    {
      id: newId(),
      type: "cards",
      design: "c-tiles",
      variant: "tiles",
      heading: "",
      intro: "",
      columns: 4,
      align: "start",
      button: "",
      link: "",
      mediaId: null,
      tone: sampleTone(0),
      items: (tilesBlock.tiles as Any[]).map((t, i) => ({ title: t.title, text: "", meta: "", icon: "sparkle", mediaId: tileImgs[i], tone: sampleTone(i), link: t.link, button: "", stars: 0, price: "", url: "" })),
    },
    {
      id: newId(),
      type: "contact",
      heading: hb("Contact form").title,
      text: "",
      button: "Send",
      mediaId: contactArt,
      form: { projectType: false, budget: false, deadline: false, custom: "", labels: { name: "Name", email: "Email", message: "Message" }, success: "", layout: "stacked" } as never,
      style: sectionStyle({ anchor: "contact" }),
    },
  ];
  homeBlocks[1] = { ...homeBlocks[1], ...{} };
  // The Big Cat section header shows its logo.
  (homeBlocks[6] as Extract<Block, { type: "header" }>).logoId = bigCatLogo;

  // Character Design: one section per project, then personal work.
  const cd: Any = content.pages.find((p: Any) => p.slug === "/character-design");
  const cdBlocks: Block[] = [heroTitle("Character Design")];
  const sectionStyles: Record<string, ReturnType<typeof sectionStyle>> = {
    "fever-dreams": sectionStyle({ bg: { kind: "color", color: "#111111" } as never, padTop: 64, padBottom: 64 }),
    "hakawati-nation": sectionStyle({ bg: { kind: "color", color: "#F6E3DC" } as never, padTop: 64, padBottom: 64 }),
  };
  for (const b of cd.blocks as Any[]) {
    if (b.block === "Project section") {
      const p = b.project ? projects.find((x) => x.id === b.project) : null;
      const title = p?.title ?? b.title;
      const st = p ? sectionStyles[p.id] : undefined;
      const logoList = await each(filesOf(b.logos), async (f) => ({ name: brandOf(f, title), mediaId: await upload(LIBRARY, f, brandOf(f, title)) }));
      const galleryFiles = filesOf(b.gallery);
      const pics = p ? await each(galleryFiles, (f) => upload(made.get(p.id)!.id, f, title)) : await each(galleryFiles, (f) => upload(LIBRARY, f, title));
      cdBlocks.push(
        { ...header("", title, { subtitle: p ? [p.role, p.network ?? p.studio].filter(Boolean).join(" · ") : "", divider: false }), ...(st ? { style: { ...st, padBottom: 0 } } : {}) },
        { ...logos("", logoList, { tint: p?.id === "fever-dreams" ? "white" : "original" }), ...(st ? { style: { ...st, padTop: 0, padBottom: 0 } } : {}) },
        { ...images(pics, { layout: "grid", columns: 3, ratio: "original" }), ...(st ? { style: { ...st, padTop: 16 } } : {}) },
      );
    } else if (String(b.block).startsWith("Gallery")) {
      const files = (b.folders as string[]).flatMap((f) => filesOf(f.includes("/") && f.startsWith("character-design") ? f : `character-design/${f}`));
      const pics = await each(files, (f) => upload(LIBRARY, f, "Personal work"));
      cdBlocks.push(header("", b.title), images(pics, { layout: "masonry", columns: 3 }));
    }
  }

  // Illustration.
  const illFiles = filesOf("illustration/02_gallery-30-pieces-lightbox");
  const illPics = await each(illFiles, (f) => upload(LIBRARY, f, "Illustration"));
  const illBlocks: Block[] = [heroTitle("Illustration"), images(illPics, { layout: "masonry", columns: 3 })];

  // 2D Animation: one project feature each.
  const anim: Any = content.pages.find((p: Any) => p.slug === "/2d-animation");
  const longNightBg = await lib("2d-animation/08_graduation-film-header-background-image-/001_Untitled-1 copy.jpg", "Long Night");
  const animBlocks: Block[] = [heroTitle("2D Animation")];
  for (const b of anim.blocks as Any[]) {
    if (b.block !== "Project feature") continue;
    const m = made.get(b.project);
    if (!m) continue;
    animBlocks.push({
      id: newId(),
      type: "feature",
      projectId: m.id,
      words: b.project === "sweet-potato" ? "none" : "short",
      logos: true,
      laurels: true,
      tools: !!b.tools,
      credits: b.project === "the-grand-night" || b.project === "long-night",
      bgMediaId: b.project === "long-night" ? longNightBg : null,
      side: animBlocks.length % 2 ? "start" : "end",
    });
  }

  // Storyboards: groups of boards, wide and uncropped, with the video slots waiting for links.
  const sb: Any = content.pages.find((p: Any) => p.slug === "/storyboard");
  const sbBlocks: Block[] = [heroTitle("Storyboards & Animatics")];
  for (const b of sb.blocks as Any[]) {
    if (b.block !== "Section") continue;
    const extra: Partial<Extract<Block, { type: "header" }>> = {};
    sbBlocks.push(header("", b.title, extra));
    if (b.logos) sbBlocks.push(logos("", await logoItems(b.logos)));
    if (b.items) {
      const files = (b.items as string[]).flatMap((x) => filesOf(x));
      const pics = await each(files, (f) => upload(LIBRARY, f, `${b.title}: storyboard`));
      sbBlocks.push(images(pics, { layout: "grid", columns: 2, ratio: "original" }));
    }
    const videos = (b.videos ?? (b.video ? [b.video] : [])) as string[];
    for (const v of videos) sbBlocks.push({ id: newId(), type: "video", url: "", caption: `[Video: ${basename(v)}]` });
  }

  // About.
  const ab: Any = content.pages.find((p: Any) => p.slug === "/about");
  const bio = ab.blocks.find((b: Any) => b.block === "About / CV");
  const portrait = await lib(bio.image, "Portrait of Ahmed Adel");
  const teams = await logoItems("about/03_studio-logos-big-cat-jump-animation-sun-");
  const community = ab.blocks.find((b: Any) => b.block === "Columns (cards)");
  const communityImgs = await each(community.cards as Any[], (c) => lib(c.image, c.title));
  const aboutBlocks: Block[] = [
    { id: newId(), type: "about", heading: bio.heading, text: (bio.words as string[]).join("\n\n"), photoId: portrait, cvId: null },
    logos(ab.blocks.find((b: Any) => b.block === "Logo wall").title, teams, { band: "#FF5A1F", tint: "white" }),
    {
      id: newId(),
      type: "cards",
      design: "c-cards",
      variant: "images",
      heading: community.title,
      intro: "",
      columns: 3,
      align: "start",
      button: "",
      link: "",
      mediaId: null,
      tone: sampleTone(0),
      items: (community.cards as Any[]).map((c, i) => ({ title: c.title, text: `${c.role}. ${c.words}`, meta: c.role, icon: "sparkle", mediaId: communityImgs[i], tone: sampleTone(i), link: "", button: "", stars: 0, price: "", url: "" })),
    },
  ];

  // Contact.
  const ct: Any = content.pages.find((p: Any) => p.slug === "/contact");
  const ctb = ct.blocks[0];
  const contactPhoto = await lib(ctb.image, "Ahmed Adel");
  const contactBlocks: Block[] = [
    {
      id: newId(),
      type: "contact",
      heading: ctb.heading,
      text: "",
      button: "Send",
      mediaId: contactPhoto,
      form: { projectType: false, budget: false, deadline: false, custom: "", labels: { name: "Name", email: "Email", message: "Message" }, success: "", layout: "stacked" } as never,
    },
  ];

  // 5. Pages and menu: Broadcast · Directing · Big Cat · Commercial · Portfolio ▾ · About · Contact.
  const page = (slug: string, title: string, blocks: Block[], extra: Partial<PageDraft> = {}): PageDraft => ({ id: newId(), slug, title, type: "custom", showInNav: true, blocks, ...extra });
  const link = (title: string, url: string): PageDraft => ({ id: newId(), slug: title.toLowerCase().replace(/\W+/g, "-"), title, type: "link", url, showInNav: true, blocks: [] });
  const folder = page("portfolio", "Portfolio", [], { type: "folder" });
  const pages: PageDraft[] = [
    page("", "Home", homeBlocks, { showInNav: false }),
    link("Broadcast", "/#broadcast"),
    link("Directing", "/#directing"),
    link("Big Cat", "/#bigcat"),
    link("Commercial", "/#commercial"),
    folder,
    page("character-design", "Character Design", cdBlocks, { parentId: folder.id }),
    page("illustration", "Illustration", illBlocks, { parentId: folder.id }),
    page("2d-animation", "2D Animation", animBlocks, { parentId: folder.id }),
    page("storyboard", "Storyboard", sbBlocks, { parentId: folder.id }),
    page("about", "About", aboutBlocks, { type: "about" }),
    page("contact", "Contact", contactBlocks, { showInNav: false }),
  ];

  // 6. Theme: Studio Orange, Rubik, his logo; the header's button goes to Contact.
  const draft: SiteDraft = {
    language: "en",
    title: acct.displayName,
    tagline: "",
    theme: { ...themes.orange, logoMediaId: siteLogo, faviconMediaId: null },
    pages,
    header: { ...normalizeHeader({}), hire: { on: true, label: "Contact", link: "/contact", style: "filled" }, logoSize: 22, tagline: false },
    footer: { ...normalizeFooter({}), text: content.footer.left, email: "Adel4art@gmail.com", social: true, align: "start" },
  };
  void soft;
  await saveDraft(o, draft);
  await saveSettings(o, { seo: { title: "Ahmed Adel · Animation Director", description: cover.heading, shareImageId: share } });
  await adminDb().collection("sites").doc(o.siteId).update({ title: acct.displayName, updatedAt: FieldValue.serverTimestamp() });
  console.log("\n  draft saved");

  if (flag("publish")) {
    // No automatic "your site is live" email from a seed run: the artist hears from us in person.
    await adminDb().collection("users").doc(uid).set({ emails: { live: true } }, { merge: true });
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
