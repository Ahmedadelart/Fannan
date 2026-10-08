// Fonts artists can choose in the Style tab. Declared once; the browser only downloads the ones a
// site actually uses. Bricolage, IBM Plex Sans/Arabic and Marhey come from the root layout.
// Latin fonts get no Arial stand-in (adjustFontFallback: false): Arial has Arabic letters and would
// otherwise draw Arabic text before the chosen Arabic font is reached in the stack.
import localFont from "next/font/local";
import type { ArabicFont, BodyFont, HeadingFont } from "@/lib/site/types";

const fraunces = localFont({
  src: "../../fonts/fraunces-latin-600-normal.woff2",
  weight: "600",
  variable: "--font-fraunces",
  preload: false,
  adjustFontFallback: false,
});
const syne = localFont({
  src: "../../fonts/syne-latin-700-normal.woff2",
  weight: "700",
  variable: "--font-syne",
  preload: false,
  adjustFontFallback: false,
});
const spaceGrotesk = localFont({
  src: "../../fonts/space-grotesk-latin-600-normal.woff2",
  weight: "600",
  variable: "--font-space-grotesk",
  preload: false,
  adjustFontFallback: false,
});
const instrumentSerif = localFont({
  src: "../../fonts/instrument-serif-latin-400-normal.woff2",
  weight: "400",
  variable: "--font-instrument-serif",
  preload: false,
  adjustFontFallback: false,
});
const dmSans = localFont({
  src: [
    { path: "../../fonts/dm-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../../fonts/dm-sans-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-dm-sans",
  preload: false,
  adjustFontFallback: false,
});
const workSans = localFont({
  src: [
    { path: "../../fonts/work-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../../fonts/work-sans-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-work-sans",
  preload: false,
  adjustFontFallback: false,
});
const readex = localFont({
  src: "../../fonts/readex-pro-arabic-wght-normal.woff2",
  weight: "160 700",
  variable: "--font-readex",
  preload: false,
});
const alexandria = localFont({
  src: "../../fonts/alexandria-arabic-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-alexandria",
  preload: false,
});

export const siteFontVars = [fraunces, syne, spaceGrotesk, instrumentSerif, dmSans, workSans, readex, alexandria]
  .map((f) => f.variable)
  .join(" ");

export const headingFonts: Record<HeadingFont, { family: string; weight: number; label: string }> = {
  bricolage: { family: "var(--font-bricolage)", weight: 800, label: "Bricolage Grotesque" },
  fraunces: { family: "var(--font-fraunces)", weight: 600, label: "Fraunces" },
  syne: { family: "var(--font-syne)", weight: 700, label: "Syne" },
  "space-grotesk": { family: "var(--font-space-grotesk)", weight: 600, label: "Space Grotesk" },
  "instrument-serif": { family: "var(--font-instrument-serif)", weight: 400, label: "Instrument Serif" },
};

export const bodyFonts: Record<BodyFont, { family: string; label: string }> = {
  plex: { family: "var(--font-plex)", label: "IBM Plex Sans" },
  "dm-sans": { family: "var(--font-dm-sans)", label: "DM Sans" },
  "work-sans": { family: "var(--font-work-sans)", label: "Work Sans" },
};

export const arabicFonts: Record<ArabicFont, { family: string; label: string }> = {
  "plex-arabic": { family: "var(--font-plex-arabic)", label: "IBM Plex Sans Arabic" },
  marhey: { family: "var(--font-marhey)", label: "Marhey" },
  readex: { family: "var(--font-readex)", label: "Readex Pro" },
  alexandria: { family: "var(--font-alexandria)", label: "Alexandria" },
};
