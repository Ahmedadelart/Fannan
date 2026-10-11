// Fonts artists can choose (round 12): 60 open fonts, English and Arabic, from config/fonts.json.
// Their @font-face rules are in src/styles/fonts.generated.css (loaded once for every surface); a
// browser downloads a font only when a page uses it. Pure: safe on the server and in the browser.

import { FONT_LIST, FONT_PAIRS } from "./fonts.generated";

export type FontScript = "latin" | "arabic";

export interface FontInfo {
  id: string;
  name: string;
  script: FontScript;
  category: string;
  /** A CSS font-family value (quoted). */
  family: string;
  /** The weight that looks best for headings. */
  headingWeight: number;
  /** Variable fonts: [lightest, heaviest]; others: the weights there are. */
  weights: readonly number[];
  variable: boolean;
}

export const FONTS: Record<string, FontInfo> = Object.fromEntries(FONT_LIST.map((f) => [f.id, f as unknown as FontInfo]));
export const LATIN_FONTS = FONT_LIST.filter((f) => f.script === "latin") as unknown as FontInfo[];
export const ARABIC_FONTS = FONT_LIST.filter((f) => f.script === "arabic") as unknown as FontInfo[];
export const PAIRS = FONT_PAIRS as unknown as Array<{ id: string; heading: string; body: string; arabic: string; arabicBody: string }>;

export const LATIN_CATEGORIES = ["sans", "serif", "display", "handwritten", "mono"] as const;
export const ARABIC_CATEGORIES = ["modern", "classic", "display", "handwritten"] as const;

export const isFont = (id: unknown, script?: FontScript): id is string =>
  typeof id === "string" && !!FONTS[id] && (!script || FONTS[id].script === script);

/** A font by id, or the fallback when the id isn't known. */
export function fontOf(id: string | null | undefined, fallback: string): FontInfo {
  return (id && FONTS[id]) || FONTS[fallback] || LATIN_FONTS[0];
}

/** The font stack for a font: the font, then a generic family that suits it. */
export function fontStack(f: FontInfo): string {
  const generic = f.category === "serif" || f.category === "classic" ? "serif" : f.category === "mono" ? "monospace" : "sans-serif";
  return `${f.family}, ${generic}`;
}

/** No longer needed (fonts load from the generated stylesheet); kept so older imports still work. */
export const siteFontVars = "";

// Older names, still used across the app: every Latin font can be a heading or body font.
export const headingFonts: Record<string, { family: string; weight: number; label: string }> = Object.fromEntries(
  LATIN_FONTS.map((f) => [f.id, { family: f.family, weight: f.headingWeight, label: f.name }]),
);
export const bodyFonts: Record<string, { family: string; label: string }> = Object.fromEntries(
  LATIN_FONTS.map((f) => [f.id, { family: f.family, label: f.name }]),
);
export const arabicFonts: Record<string, { family: string; label: string }> = Object.fromEntries(
  ARABIC_FONTS.map((f) => [f.id, { family: f.family, label: f.name }]),
);
