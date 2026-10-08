// Brings stored drafts up to the current shape. Sites created in phases 1–2 used an earlier set of
// blocks and theme fields; anything unknown is dropped rather than breaking the editor.

import { isSampleTone, upgradeTone } from "./samples";
import { blockKinds, newId, sampleArt } from "./blocks";
import { FREE_COLS, FREE_KINDS } from "./free";
import { themes } from "./starter";
import type {
  Block,
  ContactForm,
  FooterSettings,
  FreeItem,
  HeaderSettings,
  PageDraft,
  PageType,
  SampleArt,
  SiteDraft,
  Theme,
  ThemePreset,
} from "./types";

type Any = Record<string, unknown>;
const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const bool = (v: unknown, d = false) => (typeof v === "boolean" ? v : d);
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
const color = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : d);
/** A placeholder's look: a colour or one of the sample drawings. */
const tone = (v: unknown, d: string) => (isSampleTone(v) ? v : upgradeTone(color(v, d)));
const idOrNull = (v: unknown) => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : null);
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  allowed.includes(v as T) ? (v as T) : d;

export function normalizeTheme(raw: unknown): Theme {
  const t = (raw ?? {}) as Any;
  const preset = pick(t.preset as string, Object.keys(themes) as ThemePreset[], "gallery");
  const p = themes[preset];
  const colors = (t.colors ?? {}) as Any;
  const fonts = (t.fonts ?? {}) as Any;
  // Old drafts stored heading: grotesk | serif | sans.
  const oldHeading = { grotesk: "bricolage", serif: "fraunces", sans: "space-grotesk" } as Record<string, string>;
  const oldNav = {
    split: "split",
    center: "centered",
    minimal: "minimal",
    stacked: "centered",
    side: "sidebar",
  } as Record<string, string>;
  return {
    preset,
    colors: {
      background: color(colors.background, p.colors.background),
      text: color(colors.text, p.colors.text),
      accent: color(colors.accent, p.colors.accent),
    },
    fonts: {
      heading: pick(
        oldHeading[fonts.heading as string] ?? fonts.heading,
        ["bricolage", "fraunces", "syne", "space-grotesk", "instrument-serif"],
        p.fonts.heading,
      ),
      body: pick(
        fonts.body === "sans" || fonts.body === "serif" ? "plex" : fonts.body,
        ["plex", "dm-sans", "work-sans"],
        p.fonts.body,
      ),
      arabic: pick(fonts.arabic, ["plex-arabic", "marhey", "readex", "alexandria"], p.fonts.arabic),
    },
    radius: num(t.radius, 0, 24, p.radius),
    nav: pick(oldNav[t.nav as string] ?? t.nav, ["top", "centered", "sidebar", "split", "minimal"], p.nav),
    logoMediaId: idOrNull(t.logoMediaId),
    faviconMediaId: idOrNull(t.faviconMediaId),
  };
}

const RATIOS: SampleArt["ratio"][] = ["16/9", "4/3", "1/1", "3/4"];
const samples = (v: unknown): SampleArt[] =>
  Array.isArray(v)
    ? v
        .slice(0, 24)
        .map((s) => ({ tone: tone((s as Any)?.tone, "#5B3A2E"), ratio: pick((s as Any)?.ratio, RATIOS, "4/3") }))
    : sampleArt(6);

const list = <T>(v: unknown, max: number, f: (x: Any) => T): T[] =>
  Array.isArray(v) ? v.slice(0, max).map((x) => f((x ?? {}) as Any)) : [];

export function normalizeBlock(raw: unknown): Block | null {
  const b = (raw ?? {}) as Any;
  const id = typeof b.id === "string" && b.id ? b.id.slice(0, 40) : newId();
  switch (b.type) {
    case "cover":
      return {
        id,
        type: "cover",
        mediaId: idOrNull(b.mediaId),
        tone: tone(b.tone, "#2A2622"),
        heading: str(b.heading, 200),
        subheading: str(b.subheading, 300),
        height: pick(b.height, ["full", "large"], "large"),
      };
    case "text":
      return {
        id,
        type: "text",
        text: str(b.text, 6000),
        align: pick(b.align, ["start", "center"], "start"),
        size: pick(b.size, ["body", "large"], "body"),
      };
    case "hero":
    case "hero-headline":
      return { id, type: "hero", text: str(b.text, 300), align: pick(b.align, ["start", "center"], "start") };
    case "columns":
      return {
        id,
        type: "columns",
        items: list(b.items, 4, (x) => ({ heading: str(x.heading, 120), text: str(x.text, 1000) })),
      };
    case "gallery":
      return {
        id,
        type: "gallery",
        layout: pick(b.layout, ["grid", "masonry", "slider", "fullscreen"], "grid"),
        source: str(b.source, 40) || "all",
        columns: num(b.columns, 1, 6, 3),
        gap: num(b.gap, 0, 40, 12),
        ratio: pick(b.ratio, ["16:9", "4:3", "1:1", "2:3", "original"], "4:3"),
        lightbox: bool(b.lightbox, true),
        captions: bool(b.captions, true),
        credits: bool(b.credits, true),
        hoverPlay: bool(b.hoverPlay, true),
        filter: bool(b.filter),
        samples: samples(b.samples),
      };
    case "grid": {
      // Phase 1 starter grid with sample items.
      const items = Array.isArray(b.items) ? (b.items as Any[]) : [];
      const ratio = (items[0]?.art as Any)?.ratio;
      return {
        id,
        type: "gallery",
        layout: "grid",
        source: "all",
        columns: num(b.columns, 1, 6, 3),
        gap: b.gap === "tight" ? 8 : b.gap === "airy" ? 40 : 16,
        ratio: ratio === "1/1" ? "1:1" : ratio === "16/9" ? "16:9" : "4:3",
        lightbox: true,
        captions: true,
        credits: true,
        hoverPlay: true,
        filter: false,
        samples: samples(items.map((i) => i.art)),
      };
    }
    case "case-studies":
      return { ...(normalizeBlock({ id, type: "grid", columns: 1, gap: "airy", items: b.items }) as Block) };
    case "image":
      return {
        id,
        type: "image",
        mediaId: idOrNull(b.mediaId),
        tone: tone(b.tone, "#5B3A2E"),
        caption: str(b.caption, 300),
        fullWidth: bool(b.fullWidth),
      };
    case "hero-image":
      return {
        id,
        type: "image",
        mediaId: null,
        tone: tone((b.art as Any)?.tone, "#5B3A2E"),
        caption: "",
        fullWidth: true,
      };
    case "video":
      return { id, type: "video", url: str(b.url, 300), caption: str(b.caption, 300) };
    case "loop":
      return { id, type: "loop", mediaId: idOrNull(b.mediaId), caption: str(b.caption, 300) };
    case "before-after":
      return {
        id,
        type: "before-after",
        beforeId: idOrNull(b.beforeId),
        afterId: idOrNull(b.afterId),
        beforeLabel: str(b.beforeLabel, 40),
        afterLabel: str(b.afterLabel, 40),
      };
    case "pdf":
      return { id, type: "pdf", mediaId: idOrNull(b.mediaId), label: str(b.label, 80) };
    case "reel":
      return {
        id,
        type: "reel",
        url: str(b.url, 300),
        mediaId: idOrNull(b.mediaId),
        title: str(b.title, 120),
        tone: tone(b.tone ?? (b.art as Any)?.tone, "#2A2622"),
      };
    case "credits":
      return {
        id,
        type: "credits",
        heading: str(b.heading, 120),
        items: list(b.items, 60, (x) => ({
          year: str(x.year, 12),
          title: str(x.title, 160),
          role: str(x.role, 160),
          studio: str(x.studio, 160),
        })),
      };
    case "logos":
      return {
        id,
        type: "logos",
        heading: str(b.heading, 120),
        items: list(b.items, 40, (x) => ({ name: str(x.name, 80), mediaId: idOrNull(x.mediaId) })),
      };
    case "about":
      return {
        id,
        type: "about",
        heading: str(b.heading, 120),
        text: str(b.text, 6000),
        photoId: idOrNull(b.photoId),
        cvId: idOrNull(b.cvId),
      };
    case "contact":
      return {
        id,
        type: "contact",
        heading: str(b.heading, 120),
        text: str(b.text, 600),
        button: str(b.button, 60),
        ...(b.form ? { form: normalizeContactForm(b.form) } : {}),
      };
    case "hire":
      return { id, type: "hire", text: str(b.text, 300) };
    case "social":
      return {
        id,
        type: "social",
        links: list(b.links, 12, (x) => ({ network: str(x.network, 20), url: str(x.url, 300) })),
      };
    case "quote":
      return { id, type: "quote", text: str(b.text, 600), author: str(b.author, 120) };
    case "free":
      return normalizeFree(id, b);
    default:
      return null;
  }
}

/* ---------- free-form sections ---------- */


/** Links an artist can put on a button or picture: web, email, phone, or a page on their own site. */
export function safeLink(v: unknown): string {
  const s = str(v, 500).trim();
  if (!s) return "";
  if (/^\/[\w\-/#?=&.%]*$/.test(s)) return s;
  if (/^(mailto:|tel:)[^\s<>"']+$/i.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function normalizeFreeItem(raw: Any): FreeItem {
  const p = (raw.place ?? {}) as Any;
  const w = num(p.w, 1, FREE_COLS, 8);
  const x = num(p.x, 0, FREE_COLS - w, 0);
  const h = num(p.h, 1, 200, 4);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 40) : newId(),
    kind: pick(raw.kind, FREE_KINDS, "text"),
    place: { x, y: num(p.y, 0, 400, 0), w, h },
    z: num(raw.z, 0, 999, 1),
    rotate: num(raw.rotate, -180, 180, 0),
    opacity: num(raw.opacity, 0, 100, 100),
    hideOnPhone: bool(raw.hideOnPhone),
    text: str(raw.text, 4000),
    size: num(raw.size, 8, 240, 18),
    align: pick(raw.align, ["start", "center", "end"], "start"),
    color: raw.color === null || raw.color === undefined ? null : color(raw.color, "#141414"),
    fill: raw.fill === null || raw.fill === undefined ? null : color(raw.fill, "#141414"),
    mediaId: idOrNull(raw.mediaId),
    fit: pick(raw.fit, ["cover", "contain"], "cover"),
    radius: num(raw.radius, 0, 400, 0),
    shape: pick(raw.shape, ["rect", "circle"], "rect"),
    link: safeLink(raw.link),
    url: str(raw.url, 500),
    tone: tone(raw.tone, "#5B3A2E"),
  };
}

function normalizeFree(id: string, b: Any): Block {
  const items = list(b.items, 60, normalizeFreeItem);
  const lowest = items.reduce((m, i) => Math.max(m, i.place.y + i.place.h), 0);
  return {
    id,
    type: "free",
    ...(typeof b.design === "string" && /^d-[a-z0-9-]{1,30}$/.test(b.design) ? { design: b.design } : {}),
    rows: Math.max(num(b.rows, 2, 400, 12), lowest),
    background: b.background === null || b.background === undefined ? null : color(b.background, "#FFFFFF"),
    bgMediaId: idOrNull(b.bgMediaId),
    items,
  };
}

export function normalizePage(raw: unknown, i: number): PageDraft {
  const p = (raw ?? {}) as Any;
  const type: PageType = pick(p.type, ["gallery", "custom", "about", "link"], "custom");
  return {
    id: typeof p.id === "string" && p.id ? p.id.slice(0, 40) : newId(),
    slug:
      i === 0
        ? ""
        : str(p.slug, 60)
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "") || `page-${i}`,
    title: str(p.title, 60) || "Page",
    type,
    ...(type === "link" ? { url: str(p.url, 300) } : {}),
    showInNav: bool(p.showInNav, true),
    hasPassword: bool(p.hasPassword),
    blocks: Array.isArray(p.blocks) ? (p.blocks.slice(0, 60).map(normalizeBlock).filter(Boolean) as Block[]) : [],
  };
}

export function normalizeContactForm(raw: unknown): ContactForm {
  const f = (raw && typeof raw === "object" ? raw : {}) as Any;
  const l = (f.labels && typeof f.labels === "object" ? f.labels : {}) as Any;
  return {
    projectType: f.projectType === true,
    budget: f.budget === true,
    deadline: f.deadline === true,
    custom: str(f.custom, 160),
    labels: { name: str(l.name, 60), email: str(l.email, 60), message: str(l.message, 60) },
    success: str(f.success, 200),
    layout: f.layout === "split" ? "split" : "stacked",
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeHeader(raw: unknown): HeaderSettings {
  const h = (raw && typeof raw === "object" ? raw : {}) as Any;
  const hire = (h.hire && typeof h.hire === "object" ? h.hire : {}) as Any;
  const bg = typeof h.background === "string" ? h.background : "none";
  return {
    sticky: h.sticky === true,
    background: bg === "surface" || HEX.test(bg) ? bg : "none",
    tagline: h.tagline !== false,
    hire: {
      on: typeof hire.on === "boolean" ? hire.on : null,
      label: str(hire.label, 40),
      link: safeLink(hire.link),
    },
  };
}

export function normalizeFooter(raw: unknown): FooterSettings {
  const f = (raw && typeof raw === "object" ? raw : {}) as Any;
  return {
    text: str(f.text, 300),
    align: f.align === "start" ? "start" : "center",
    social: f.social !== false,
    cv: f.cv !== false,
  };
}

export function normalizeDraft(raw: Any & { pages?: unknown[] }): SiteDraft {
  const pages = (raw.pages ?? []).slice(0, 30).map(normalizePage);
  return {
    language: raw.language === "ar" ? "ar" : "en",
    title: str(raw.title, 80),
    tagline: str(raw.tagline, 120),
    theme: normalizeTheme(raw.theme),
    header: normalizeHeader(raw.header),
    footer: normalizeFooter(raw.footer),
    pages: pages.length
      ? pages
      : [{ id: "home", slug: "", title: "Work", type: "gallery", showInNav: true, blocks: [] }],
  };
}

/** For "is this a known block?" checks in tests and the editor. */
export const KNOWN_BLOCK_TYPES = new Set(blockKinds.map((k) => k.type));
