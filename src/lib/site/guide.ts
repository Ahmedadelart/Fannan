// The guided setup (round 8): the answers people give, step by step, and the site they make.
// Pure functions: the same code draws the live preview in the guide and builds the saved site.

import { disciplineById, type DisciplineKind } from "@/config/disciplines";
import { slugify } from "@/config/usernames";
import type { Locale } from "@/i18n/locales";
import { kindByKey, newId } from "./blocks";
import { designWords } from "./designBlocks";
import { normalizeFooter, normalizeHeader } from "./normalize";
import { disciplineText, themes } from "./starter";
import type {
  Block,
  CardSize,
  CardText,
  FreeItem,
  HeaderSettings,
  PageDraft,
  PageType,
  SiteDraft,
  ThemePreset,
} from "./types";

/* ---------- the answers ---------- */

export type GuidePageKind = "home" | "work" | "about" | "contact" | "page" | "folder";

/** Sections people can tick on a page; each asks only for what it needs. */
export type ExtraKey = "about" | "contact" | "social" | "logos" | "testimonials" | "cv" | "offers" | "faq" | "stats" | "cta";

export interface GuideItem {
  title: string;
  text: string;
  meta: string;
  mediaId: string | null;
}

export interface GuideExtra {
  on: boolean;
  text: string;
  mediaId: string | null;
  items: GuideItem[];
}

export interface GuidePage {
  id: string;
  title: string;
  kind: GuidePageKind;
  /** Inside this dropdown in the menu. */
  parentId: string | null;
  inMenu: boolean;
  /** The section the page starts with (a library key), or null for none. */
  template: string | null;
  /** Pictures for this page: they fill the template, then follow it in rows. */
  mediaIds: string[];
  showProjects: boolean;
  /** Which projects show here (empty: all of them). */
  projectIds: string[];
  extras: Partial<Record<ExtraKey, GuideExtra>>;
}

export interface GuideProject {
  /** The real project's id: projects are made for real as people add them. */
  id: string;
  size: CardSize;
  text: CardText;
  inMenu: boolean;
}

export interface GuideAnswers {
  discipline: string;
  logo: { mode: "name" | "image"; mediaId: string | null; name: string; font: HeaderSettings["logoFont"]; tagline: string };
  preset: ThemePreset;
  /** Changes the theme's accent colour; null keeps the theme's own. */
  accent: string | null;
  pages: GuidePage[];
  projects: GuideProject[];
  /** Projects shown in the menu sit in one dropdown. */
  groupProjects: boolean;
  social: Array<{ network: string; url: string }>;
}

export interface GuideState {
  step: number;
  answers: GuideAnswers;
  done?: boolean;
}

export const GUIDE_STEPS = ["what", "name", "look", "pages", "projects", "inside", "pages2", "build"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

/* ---------- words ---------- */

const WORDS = {
  en: {
    home: "Home",
    work: "Work",
    about: "About",
    contact: "Contact",
    more: "More",
    projects: "Projects",
    suggestions: {
      work: "Work",
      showreel: "Showreel",
      sketchbook: "Sketchbook",
      films: "Films",
      shop: "Shop",
      services: "Services",
      press: "Press",
      cv: "CV",
      teaching: "Teaching",
      personal: "Personal work",
      photos: "Photos",
      writing: "Writing",
    },
  },
  ar: {
    home: "الرئيسية",
    work: "أعمالي",
    about: "عني",
    contact: "تواصل",
    more: "المزيد",
    projects: "المشاريع",
    suggestions: {
      work: "أعمالي",
      showreel: "الشوريل",
      sketchbook: "اسكتشات",
      films: "أفلام",
      shop: "المتجر",
      services: "خدماتي",
      press: "في الصحافة",
      cv: "السيرة الذاتية",
      teaching: "التدريس",
      personal: "أعمال شخصية",
      photos: "صور",
      writing: "كتابات",
    },
  },
} as const;

export type SuggestionKey = keyof (typeof WORDS)["en"]["suggestions"];

/** Pages people often add, by the kind of work they do. */
export function pageSuggestions(discipline: string): SuggestionKey[] {
  const kind: DisciplineKind | "other" = disciplineById(discipline)?.kind ?? "other";
  const lead: Partial<Record<DisciplineKind | "other", SuggestionKey[]>> = {
    animation: ["showreel", "sketchbook", "films"],
    "3d": ["showreel", "personal"],
    motion: ["showreel", "services"],
    direction: ["showreel", "films", "press"],
    film: ["films", "showreel", "press"],
    story: ["sketchbook", "films"],
    illustration: ["sketchbook", "shop", "personal"],
    concept: ["sketchbook", "personal"],
    comics: ["sketchbook", "shop", "press"],
    games: ["showreel", "personal"],
    photo: ["photos", "services", "shop"],
    design: ["services", "personal"],
    writing: ["writing", "press"],
    fineart: ["shop", "press"],
  };
  const all: SuggestionKey[] = ["work", "sketchbook", "showreel", "films", "shop", "services", "press", "cv", "teaching", "personal", "photos", "writing"];
  const first = lead[kind] ?? ["sketchbook", "services"];
  return [...new Set<SuggestionKey>(["work", ...first, ...all])];
}

export function suggestionTitle(key: SuggestionKey, l: Locale) {
  return WORDS[l].suggestions[key];
}

export function newGuidePage(title: string, kind: GuidePageKind): GuidePage {
  return {
    id: newId(),
    title,
    kind,
    parentId: null,
    inMenu: true,
    template: kind === "folder" ? null : (TEMPLATES[kind][0] ?? null),
    mediaIds: [],
    showProjects: kind === "home" || kind === "work",
    projectIds: [],
    extras:
      kind === "about"
        ? { about: { ...blankExtra(), on: true } }
        : kind === "contact"
          ? { contact: { ...blankExtra(), on: true }, social: { ...blankExtra(), on: true } }
          : {},
  };
}

export function blankExtra(): GuideExtra {
  return { on: false, text: "", mediaId: null, items: [] };
}

export function folderTitle(l: Locale) {
  return WORDS[l].more;
}

/** First answers: what sign-up already knows, and the essential pages. */
export function defaultGuide(input: { name: string; discipline: string; language: Locale; preset?: ThemePreset }): GuideAnswers {
  const w = WORDS[input.language];
  return {
    discipline: input.discipline,
    logo: { mode: "name", mediaId: null, name: input.name, font: null, tagline: "" },
    preset: input.preset ?? "gallery",
    accent: null,
    pages: [
      newGuidePage(w.home, "home"),
      newGuidePage(w.about, "about"),
      newGuidePage(w.contact, "contact"),
    ],
    projects: [],
    groupProjects: true,
    social: [],
  };
}

/* ---------- choices on each page ---------- */

/** Sections a page can start with, by kind of page (library keys). */
export const TEMPLATES: Record<Exclude<GuidePageKind, "folder">, string[]> = {
  home: ["d-hero-split", "d-hero-photo", "d-title", "d-statement"],
  work: ["d-title", "d-headline-image", "d-big-type"],
  about: ["d-about-circle", "d-about", "d-resume"],
  contact: ["d-contact-me", "d-cta-banner", "d-title"],
  page: ["d-title", "d-image-caption", "d-grid-4", "d-two-images"],
};

export interface ExtraSpec {
  key: ExtraKey;
  /** The library key of the section it adds. */
  block: string;
  /** What it asks for. */
  asks: "text" | "photoText" | "items" | "social" | "logos";
  /** Item fields shown for "items" and "logos". */
  fields?: Array<"title" | "text" | "meta" | "media">;
}

export const EXTRAS: ExtraSpec[] = [
  { key: "about", block: "d-about-circle", asks: "photoText" },
  { key: "contact", block: "contact", asks: "text" },
  { key: "social", block: "social", asks: "social" },
  { key: "logos", block: "logos", asks: "logos", fields: ["title", "media"] },
  { key: "testimonials", block: "c-testimonials", asks: "items", fields: ["title", "meta", "text", "media"] },
  { key: "cv", block: "credits", asks: "items", fields: ["meta", "title", "text"] },
  { key: "offers", block: "c-offers", asks: "items", fields: ["title", "meta", "text"] },
  { key: "faq", block: "c-faq", asks: "items", fields: ["title", "text"] },
  { key: "stats", block: "c-stats", asks: "items", fields: ["title", "text"] },
  { key: "cta", block: "d-cta-banner", asks: "text" },
];

export const extraSpec = (key: ExtraKey) => EXTRAS.find((e) => e.key === key)!;

/** Pro sections still go on the page; Free sites keep them hidden, like in the editor. */
export const isProExtra = (key: ExtraKey) => !!kindByKey(extraSpec(key).block)?.pro;

/* ---------- building the site ---------- */

/** Pages in menu order: each dropdown is followed by the pages inside it. Home stays first. */
export function tidyPages(pages: GuidePage[]): GuidePage[] {
  const [home, ...rest] = pages;
  if (!home) return pages;
  const parents = new Set(rest.filter((p) => p.kind === "folder").map((p) => p.id));
  const fixed = rest.map((p) => (p.parentId && !parents.has(p.parentId) ? { ...p, parentId: null } : p));
  const top = fixed.filter((p) => !p.parentId);
  const out: GuidePage[] = [{ ...home, parentId: null }];
  for (const p of top) {
    out.push(p);
    out.push(...fixed.filter((c) => c.parentId === p.id));
  }
  return out;
}

const pageType: Record<GuidePageKind, PageType> = {
  home: "gallery",
  work: "gallery",
  about: "about",
  contact: "custom",
  page: "custom",
  folder: "folder",
};

/** Put uploaded pictures into a section's empty picture places, in order. Returns how many it used. */
export function fillPictures(b: Block, ids: string[]): number {
  let used = 0;
  const next = () => (used < ids.length ? ids[used++] : null);
  switch (b.type) {
    case "free":
      for (const it of b.items) if (it.kind === "image" && !it.mediaId) it.mediaId = next() ?? it.mediaId;
      break;
    case "cards":
      if (["images", "mosaic", "films", "timeline"].includes(b.variant))
        for (const it of b.items) if (!it.mediaId) it.mediaId = next() ?? it.mediaId;
      break;
    case "cover":
    case "image":
      if (!b.mediaId) b.mediaId = next();
      break;
    case "about":
      if (!b.photoId) b.photoId = next();
      break;
  }
  return used;
}

const firstItem = (b: Block, kind: FreeItem["kind"], biggest = false): FreeItem | undefined => {
  if (b.type !== "free") return undefined;
  const all = b.items.filter((i) => i.kind === kind);
  return biggest ? all.sort((a, c) => (c.size ?? 0) - (a.size ?? 0))[0] : all[0];
};

/** Sample words in the designed sections become the artist's own name and work. */
function personalise(b: Block, name: string, what: string, l: Locale) {
  if (b.type !== "free" || !name) return;
  const w = designWords[l];
  for (const it of b.items) {
    if (it.text === w.heroName) it.text = name;
    else if (it.text === w.by) it.text = l === "ar" ? `بقلم ${name}` : `by ${name}`;
    else if (it.text === w.heroRole && what) it.text = what;
  }
}

const made = new Map<string, Block>();

/**
 * A copy of a library section with ids that come from where it sits, so the live preview keeps the
 * same pictures on screen while people type (no flicker) and filling it never changes the sample.
 */
function make(key: string, l: Locale, id: string): Block | null {
  let sample = made.get(`${key}:${l}`);
  if (!sample) {
    const kind = kindByKey(key);
    if (!kind) return null;
    sample = kind.make(l);
    made.set(`${key}:${l}`, sample);
  }
  const b = JSON.parse(JSON.stringify(sample)) as Block;
  b.id = id.slice(0, 40);
  if (b.type === "free") b.items.forEach((it, n) => (it.id = `${b.id}-${n}`.slice(0, 40)));
  return b;
}

/** Leftover pictures after the template: rows of four, two or one. */
function pictureRows(ids: string[], l: Locale, idBase: string): Block[] {
  const out: Block[] = [];
  let rest = ids;
  while (rest.length) {
    const key = rest.length >= 4 ? "d-grid-4" : rest.length >= 2 ? "d-two-images" : "d-image-caption";
    const b = make(key, l, `${idBase}${out.length}`);
    if (!b) break;
    const used = fillPictures(b, rest);
    if (!used) break;
    out.push(b);
    rest = rest.slice(used);
  }
  return out;
}

function extraBlock(key: ExtraKey, e: GuideExtra, l: Locale, id: string): Block | null {
  const b = make(extraSpec(key).block, l, id);
  if (!b) return null;
  const items = e.items.filter((i) => i.title.trim() || i.text.trim() || i.mediaId);
  if (b.type === "cards" && items.length) {
    const like = b.items[0];
    b.items = items.slice(0, 12).map((i, n) => ({
      ...(like ?? b.items[n]),
      title: i.title,
      text: i.text,
      meta: key === "offers" ? "" : i.meta,
      price: key === "offers" ? i.meta : (like?.price ?? ""),
      mediaId: i.mediaId ?? like?.mediaId ?? null,
    }));
  }
  if (b.type === "logos" && items.length) b.items = items.slice(0, 24).map((i) => ({ name: i.title, mediaId: i.mediaId }));
  if (b.type === "credits" && items.length)
    b.items = items.slice(0, 40).map((i) => ({ year: i.meta, title: i.title, role: i.text, studio: "" }));
  if (b.type === "contact" && e.text.trim()) b.text = e.text;
  if (key === "about") {
    const body = firstItem(b, "text", true);
    if (body && e.text.trim()) body.text = e.text;
    const photo = firstItem(b, "image");
    if (photo && e.mediaId) photo.mediaId = e.mediaId;
  }
  if (key === "cta" && e.text.trim()) {
    const h = firstItem(b, "heading", true);
    if (h) h.text = e.text;
  }
  return b;
}

function pageBlocks(p: GuidePage, a: GuideAnswers, l: Locale, name: string, what: string): Block[] {
  const blocks: Block[] = [];
  let pics = p.mediaIds;
  if (p.template) {
    const b = make(p.template, l, `${p.id}-t`);
    if (b) {
      personalise(b, name, what, l);
      pics = pics.slice(fillPictures(b, pics));
      blocks.push(b);
    }
  }
  blocks.push(...pictureRows(pics, l, `${p.id}-r`));
  if (p.showProjects) {
    const g = make("grid", l, `${p.id}-g`);
    if (g && g.type === "gallery") {
      g.cardSizes = true;
      g.layout = "grid";
      if (p.projectIds.length) g.picks = p.projectIds;
      blocks.push(g);
    }
  }
  for (const spec of EXTRAS) {
    const e = p.extras[spec.key];
    if (!e?.on) continue;
    const b = extraBlock(spec.key, e, l, `${p.id}-${spec.key}`);
    if (b) blocks.push(b);
  }
  void a;
  return blocks;
}

/** The whole site from the answers. Projects are needed for their names in the menu. */
export function buildFromGuide(
  a: GuideAnswers,
  ctx: { language: Locale; title: string; projects: Array<{ id: string; title: string }>; header?: HeaderSettings },
): SiteDraft {
  const l = ctx.language;
  const name = a.logo.name.trim() || ctx.title;
  const what = disciplineText(a.discipline, l);
  const base = themes[a.preset] ?? themes.gallery;
  const theme = {
    ...base,
    colors: { ...base.colors, ...(a.accent ? { accent: a.accent } : {}) },
    logoMediaId: a.logo.mode === "image" ? a.logo.mediaId : null,
  };

  const used = new Set<string>();
  const slugFor = (title: string, i: number) => {
    if (i === 0) return "";
    const base = slugify(title) || `page-${i}`;
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  };

  const pages: PageDraft[] = tidyPages(a.pages).map((p, i) => ({
    id: p.id,
    slug: p.kind === "folder" ? `menu-${i}` : slugFor(p.title, i),
    title: p.title.slice(0, 60) || "Page",
    type: i === 0 ? "gallery" : pageType[p.kind],
    showInNav: p.inMenu,
    parentId: i === 0 ? null : p.parentId,
    blocks: p.kind === "folder" ? [] : pageBlocks(p, a, l, name, what),
  }));

  // Projects in the menu: their own menu items, in one dropdown when there are several.
  const inMenu = a.projects.filter((p) => p.inMenu && ctx.projects.some((x) => x.id === p.id));
  let parentId: string | null = null;
  if (a.groupProjects && inMenu.length > 1) {
    parentId = "projects-menu";
    pages.push({ id: parentId, slug: `menu-${pages.length}`, title: WORDS[l].projects, type: "folder", showInNav: true, parentId: null, blocks: [] });
  }
  for (const p of inMenu) {
    const project = ctx.projects.find((x) => x.id === p.id)!;
    pages.push({
      id: `pm-${p.id}`.slice(0, 40),
      slug: `project-${pages.length}`,
      title: project.title.slice(0, 60),
      type: "project",
      projectId: p.id,
      showInNav: true,
      parentId,
      blocks: [],
    });
  }

  return {
    language: l,
    title: name,
    tagline: a.logo.tagline,
    theme,
    pages,
    header: { ...(ctx.header ?? normalizeHeader(null)), tagline: !!a.logo.tagline, logoFont: a.logo.mode === "name" ? a.logo.font : null },
    footer: normalizeFooter(null),
  };
}
