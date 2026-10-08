// Fonts artists can choose in the Style tab. Declared once; the browser only downloads the ones a
// site actually uses. Bricolage, IBM Plex Sans/Arabic and Marhey come from the root layout.
import { DM_Sans, Fraunces, Instrument_Serif, Space_Grotesk, Syne, Work_Sans } from "next/font/google";
import localFont from "next/font/local";
import type { ArabicFont, BodyFont, HeadingFont } from "@/lib/site/types";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600"], variable: "--font-fraunces", preload: false });
const syne = Syne({ subsets: ["latin"], weight: ["700"], variable: "--font-syne", preload: false });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-space-grotesk",
  preload: false,
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  preload: false,
});
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-dm-sans", preload: false });
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-work-sans",
  preload: false,
});
// These two are kept in the project (src/fonts, SIL Open Font License): Google Fonts sometimes
// serves them in a form the build can't read, which broke production builds.
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
