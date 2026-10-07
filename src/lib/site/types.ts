// The shape of an artist's site. Drafts live in Firestore (sites/{id} + pages);
// "Publish" (phase 3) freezes a copy into sites/{id}/published/{version}.

import type { Locale } from "@/i18n/locales";

export type LayoutId = "reel" | "grid" | "storyteller" | "minimalist";
export type ThemePreset = "gallery" | "studio" | "paper" | "lime" | "night" | "sand";
export type HeadingFont = "grotesk" | "serif" | "sans";
export type NavLayout = "split" | "center" | "stacked" | "side" | "minimal";

export interface Theme {
  preset: ThemePreset;
  colors: { background: string; text: string; muted: string; surface: string; accent: string };
  fonts: { heading: HeadingFont; body: "sans" | "serif" };
  radius: number;
  nav: NavLayout;
}

/** Sample artwork until the artist uploads their own: just a colour and a shape. */
export interface SampleArt {
  tone: string;
  ratio: "16/9" | "4/3" | "1/1" | "3/4";
}

export type Block =
  | { id: string; type: "reel"; title: string; art: SampleArt }
  | { id: string; type: "hero-image"; art: SampleArt }
  | { id: string; type: "hero-headline"; text: string }
  | {
      id: string;
      type: "grid";
      columns: 2 | 3 | 4;
      gap: "tight" | "normal" | "airy";
      items: Array<{ title: string; art: SampleArt }>;
    }
  | { id: string; type: "case-studies"; items: Array<{ title: string; credit: string; art: SampleArt }> }
  | { id: string; type: "about"; heading: string; text: string }
  | { id: string; type: "contact"; heading: string; text: string; button: string };

export type BlockType = Block["type"];

export interface PageDraft {
  id: string;
  slug: string;
  title: string;
  type: "gallery" | "custom" | "about" | "link";
  blocks: Block[];
}

export interface SiteDraft {
  layout: LayoutId;
  language: Locale;
  title: string;
  tagline: string;
  theme: Theme;
  pages: PageDraft[];
}
