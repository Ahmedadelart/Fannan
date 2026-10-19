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
  deleteLibraryMedia,
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
import { themes } from "@/lib/site/starter";
import { normalizeFooter, normalizeHeader } from "@/lib/site/normalize";
import type { SiteDraft } from "@/lib/site/types";
import { classicPages } from "./seed-classic";

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
const pick = (folder: string, nums: string[]) => {
  const files = filesOf(folder);
  return nums.map((n) => files.find((f) => basename(f).startsWith(`${n}_`))).filter((f): f is string => !!f);
};

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
    // On his current site every commercial piece shows; only a project with nothing to show yet waits hidden.
    ...(!p.cover && !p.loop && !p.gallery ? { visibility: "hidden" as const } : {}),
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
    // Through the app's own delete, so stored files go too and the storage meter stays right.
    await each(libMedia.docs, (d) => deleteLibraryMedia(o, d.id), 6);
  }

  // 3. Projects, oldest first in each group, so galleries (newest first) show them in the content's order.
  const projects = (content.projects as Any[]).filter((p) => p.id);
  for (const p of [...projects].reverse()) await makeProject(p);

  // 4. The pages, as on his current site (see seed-classic.ts).
  const { pages, logoId: siteLogo, shareId: share, heroText } = await classicPages(content, {
    lib,
    libs: (files, alt) => each(files, (f) => upload(LIBRARY, f, alt)),
    logoItems: (files) =>
      each(files, async (f) => {
        const name = brandOf(f, "Logo");
        return { name, mediaId: await upload(LIBRARY, f, name) };
      }),
    filesOf,
    pick,
    project: (id) => {
      const m = made.get(id);
      if (!m) throw new Error(`No project ${id}`);
      return m.id;
    },
    projectPics: (id, files, alt) => each(files, (f) => upload(made.get(id)!.id, f, alt)),
  });

  // 5. Theme and frame: Studio Orange; links beside the logo, social icons on the right; a black footer.
  const draft: SiteDraft = {
    language: "en",
    title: acct.displayName,
    tagline: "",
    // His current site: red, Londrina Solid headings in capitals with a little letter spacing, Montserrat text.
    theme: {
      ...themes.orange,
      colors: { ...themes.orange.colors, accent: "#FC221C" },
      fonts: { ...themes.orange.fonts, heading: "londrina", body: "montserrat", headingWeight: 400, headingUpper: true, headingTracking: 5 },
      nav: "inline",
      radius: 4,
      logoMediaId: siteLogo,
      faviconMediaId: null,
    },
    pages,
    header: {
      ...normalizeHeader({}),
      hire: { on: false, label: "Contact", link: "/contact", style: "filled" },
      // The wordmark is 12:1, so an 83px box shows it about 297px wide, as on the old site; 6px above and below makes the 96px bar.
      logoSize: 83,
      space: 6,
      tagline: false,
      social: true,
      textColor: "#000000",
      upperLinks: false,
    },
    footer: {
      ...normalizeFooter({}),
      text: "© 2026 All rights reserved.",
      email: "Adel4art@gmail.com",
      social: true,
      socialStyle: "icons",
      layout: "columns",
      showTitle: true,
      backToTop: true,
      background: "#000000",
      textColor: "#FFFFFF",
      align: "start",
      big: true,
    },
  };
  // Social links known from his folder (Behance and Instagram captures); Ahmed adds Vimeo, LinkedIn and Facebook.
  // The links on his current site.
  await saveSettings(o, {
    social: [
      { network: "vimeo", url: "https://vimeo.com/ahmadadelart" },
      { network: "youtube", url: "https://www.youtube.com/@AhmedAdel-art" },
      { network: "instagram", url: "https://www.instagram.com/ahmedadel.art/" },
      { network: "behance", url: "https://www.behance.net/ahmedadelart" },
      { network: "linkedin", url: "https://www.linkedin.com/in/ahmedadel-art/" },
    ],
  });
  await saveDraft(o, draft);
  await saveSettings(o, { seo: { title: "Ahmed Adel · Animation Director", description: heroText, shareImageId: share } });
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
