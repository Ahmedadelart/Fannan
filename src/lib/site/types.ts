// The shape of an artist's site. The draft lives in Firestore (sites/{id} + pages);
// "Publish" freezes a copy into sites/{id}/published/{version}, which the public renderer reads.

import type { Locale } from "@/i18n/locales";

export type LayoutId = "reel" | "grid" | "storyteller" | "minimalist";
export type ThemePreset = "gallery" | "studio" | "paper" | "lime" | "night" | "sand";
export type HeadingFont = "bricolage" | "fraunces" | "syne" | "space-grotesk" | "instrument-serif";
export type BodyFont = "plex" | "dm-sans" | "work-sans";
export type ArabicFont = "plex-arabic" | "marhey" | "readex" | "alexandria";
export type NavLayout = "top" | "centered" | "sidebar" | "split" | "minimal";

export interface Theme {
  preset: ThemePreset;
  colors: { background: string; text: string; accent: string };
  fonts: { heading: HeadingFont; body: BodyFont; arabic: ArabicFont };
  /** Corner radius in px, 0–24. */
  radius: number;
  nav: NavLayout;
  logoMediaId: string | null;
  faviconMediaId: string | null;
}

/** Placeholder artwork until the artist picks real media: just a colour and a shape. */
export interface SampleArt {
  tone: string;
  ratio: "16/9" | "4/3" | "1/1" | "3/4";
}

type B<T extends string, P> = { id: string; type: T } & P;

export type GalleryLayout = "grid" | "masonry" | "slider" | "fullscreen";
export type ThumbRatio = "16:9" | "4:3" | "1:1" | "2:3" | "original";

export type Block =
  | B<"cover", { mediaId: string | null; tone: string; heading: string; subheading: string; height: "full" | "large" }>
  | B<"text", { text: string; align: "start" | "center"; size: "body" | "large" }>
  | B<"hero", { text: string; align: "start" | "center" }>
  | B<"columns", { items: Array<{ heading: string; text: string }> }>
  | B<
      "gallery",
      {
        layout: GalleryLayout;
        /** "all" or a project category id. */
        source: string;
        columns: number;
        gap: number;
        ratio: ThumbRatio;
        lightbox: boolean;
        captions: boolean;
        credits: boolean;
        hoverPlay: boolean;
        filter: boolean;
        /** Shown while the artist has no projects yet. */
        samples: SampleArt[];
      }
    >
  | B<"image", { mediaId: string | null; tone: string; caption: string; fullWidth: boolean }>
  | B<"video", { url: string; caption: string }>
  | B<"loop", { mediaId: string | null; caption: string }>
  | B<"before-after", { beforeId: string | null; afterId: string | null; beforeLabel: string; afterLabel: string }>
  | B<"pdf", { mediaId: string | null; label: string }>
  | B<"reel", { url: string; mediaId: string | null; title: string; tone: string }>
  | B<"credits", { heading: string; items: Array<{ year: string; title: string; role: string; studio: string }> }>
  | B<"logos", { heading: string; items: Array<{ name: string; mediaId: string | null }> }>
  | B<"about", { heading: string; text: string; photoId: string | null; cvId: string | null }>
  | B<"contact", { heading: string; text: string; button: string }>
  | B<"hire", { text: string }>
  | B<"social", { links: Array<{ network: string; url: string }> }>
  | B<"quote", { text: string; author: string }>
  | B<"free", FreeSection>;

/* ---------- free-form sections (phase 8C) ---------- */

/** What a free-form block shows. Every item carries every field, so editing and checking stay simple. */
export type FreeKind = "text" | "heading" | "image" | "button" | "shape" | "line" | "video";

/**
 * Where an item sits on the section's grid: 24 columns on desktop, square cells, counted from the
 * reading start (left in English, right in Arabic). On phones items stack in reading order.
 */
export interface FreePlace {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FreeItem {
  id: string;
  kind: FreeKind;
  place: FreePlace;
  /** Stacking order: higher is in front. */
  z: number;
  /** Degrees, -180…180. */
  rotate: number;
  /** 0–100. */
  opacity: number;
  hideOnPhone: boolean;
  /** Text, heading and button label. */
  text: string;
  /** Font size in px on a 1200px-wide page; it scales with the page. */
  size: number;
  align: "start" | "center" | "end";
  /** Text colour; null follows the theme. */
  color: string | null;
  /** Shape fill, button background, line colour; null follows the theme. */
  fill: string | null;
  mediaId: string | null;
  fit: "cover" | "contain";
  /** Corner radius in px. */
  radius: number;
  shape: "rect" | "circle";
  /** Where an image or button goes (https://…, mailto:…, or a page address like /about). */
  link: string;
  /** YouTube or Vimeo address for video items. */
  url: string;
  /** Shown when sample art stands in for a missing picture. */
  tone: string;
}

export interface FreeSection {
  /** Which library design it started from (e.g. "d-cover"); Pro designs are hidden on Free sites. */
  design?: string;
  /** Height in grid rows (one row = one column width). */
  rows: number;
  background: string | null;
  bgMediaId: string | null;
  items: FreeItem[];
}

export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export type PageType = "gallery" | "custom" | "about" | "link";

export interface PageDraft {
  id: string;
  slug: string;
  title: string;
  type: PageType;
  /** External link pages only. */
  url?: string;
  showInNav: boolean;
  /** Set on the server; the password itself never reaches the browser. */
  hasPassword?: boolean;
  blocks: Block[];
}

export interface SiteDraft {
  language: Locale;
  title: string;
  tagline: string;
  theme: Theme;
  pages: PageDraft[];
  /** Which starter it came from (sign-up step 4). */
  layout?: LayoutId;
}
