// Builds the four starter sites from the sign-up answers (ONBOARDING.md step 3/4).
// Pure function: the same code makes the live preview and the site saved to Firestore.

import { disciplineById, wantsReel, type DisciplineKind } from "@/config/disciplines";
import type { Locale } from "@/i18n/locales";
import type { Block, LayoutId, SampleArt, SiteDraft, Theme, ThemePreset } from "./types";

export const layoutIds: LayoutId[] = ["reel", "grid", "storyteller", "minimalist"];

export const themes: Record<ThemePreset, Theme> = {
  night: {
    preset: "night",
    colors: { background: "#141414", text: "#FFFFFF", muted: "#BDBDB7", surface: "#222222", accent: "#C6F432" },
    fonts: { heading: "grotesk", body: "sans" },
    radius: 8,
    nav: "split",
  },
  gallery: {
    preset: "gallery",
    colors: { background: "#FFFFFF", text: "#141414", muted: "#6A6A70", surface: "#F4F4F2", accent: "#141414" },
    fonts: { heading: "sans", body: "sans" },
    radius: 4,
    nav: "split",
  },
  paper: {
    preset: "paper",
    colors: { background: "#F5F1E8", text: "#2B2B2E", muted: "#6E675C", surface: "#ECE6D8", accent: "#5B3A2E" },
    fonts: { heading: "serif", body: "serif" },
    radius: 6,
    nav: "center",
  },
  studio: {
    preset: "studio",
    colors: { background: "#FFFFFF", text: "#141414", muted: "#8A8A8F", surface: "#F7F7F5", accent: "#141414" },
    fonts: { heading: "sans", body: "sans" },
    radius: 0,
    nav: "minimal",
  },
  lime: {
    preset: "lime",
    colors: { background: "#FFFFFF", text: "#141414", muted: "#6A6A70", surface: "#C6F432", accent: "#C6F432" },
    fonts: { heading: "grotesk", body: "sans" },
    radius: 12,
    nav: "split",
  },
  sand: {
    preset: "sand",
    colors: { background: "#EFE6D8", text: "#3B2F25", muted: "#7A6A58", surface: "#E4D7C3", accent: "#9C5B34" },
    fonts: { heading: "serif", body: "sans" },
    radius: 10,
    nav: "center",
  },
};

const layoutTheme: Record<LayoutId, ThemePreset> = {
  reel: "night",
  grid: "gallery",
  storyteller: "paper",
  minimalist: "studio",
};

// Earthy sample tones per kind of work (no blue: brand rule).
const palettes: Record<DisciplineKind, string[]> = {
  animation: ["#5B3A2E", "#4E5B2E", "#5B2E4F", "#7A5A2E", "#3A3A3A", "#6B3A3A"],
  "3d": ["#4A4A44", "#5B4C2E", "#3E4A3A", "#6B5A4A", "#2E2E2E", "#5A3E3A"],
  motion: ["#141414", "#5B2E4F", "#7A5A2E", "#4E5B2E", "#6B3A3A", "#3A3A3A"],
  direction: ["#2E2E2E", "#5B3A2E", "#4E5B2E", "#5B2E4F", "#7A5A2E", "#3A3A3A"],
  story: ["#6A6A70", "#8A8478", "#5B5B55", "#7A746A", "#4A4A44", "#9A9488"],
  illustration: ["#9C5B34", "#5B2E4F", "#4E5B2E", "#B07A3A", "#6B3A3A", "#7A5A2E"],
  concept: ["#3E4A3A", "#5B4C2E", "#4A3E3A", "#6B5A4A", "#2E3A2E", "#7A6A58"],
  comics: ["#141414", "#9C2E2E", "#B0903A", "#3A3A3A", "#6B3A3A", "#7A5A2E"],
  games: ["#4E5B2E", "#5B2E4F", "#7A5A2E", "#3A3A3A", "#9C5B34", "#5B3A2E"],
  design: ["#141414", "#C6F432", "#9C5B34", "#E2E2DE", "#5B2E4F", "#7A5A2E"],
  other: ["#5B3A2E", "#4E5B2E", "#5B2E4F", "#3A3A44", "#5B4C2E", "#6B4A3A"],
};

const copy = {
  en: {
    work: "Work",
    about: "About",
    contact: "Contact",
    reel: "Showreel",
    project: (n: number) => `Project ${n}`,
    aboutText: (first: string, what: string) =>
      `${first} is a ${what.toLowerCase()}. Write a few lines about your work, the studios you've worked with and what you'd like to do next.`,
    contactHeading: "Let's work together",
    contactText: "Tell me about your project, your timeline and your budget.",
    contactButton: "Send a message",
    headline: (what: string) => `${what}. Telling stories, frame by frame.`,
    credit: "Studio · Your role · Year",
  },
  ar: {
    work: "الأعمال",
    about: "نبذة",
    contact: "تواصل",
    reel: "الريل",
    project: (n: number) => `مشروع ${n}`,
    aboutText: (first: string, what: string) =>
      `${first}، ${what}. اكتب بضعة أسطر عن عملك والاستوديوهات التي عملت معها وما تريد فعله بعد ذلك.`,
    contactHeading: "لنعمل معًا",
    contactText: "أخبرني عن مشروعك وموعده وميزانيته.",
    contactButton: "أرسل رسالة",
    headline: (what: string) => `${what}. أحكي القصص، لقطة بلقطة.`,
    credit: "الاستوديو · دورك · السنة",
  },
};

export interface StarterInput {
  name: string;
  /** Discipline id from config/disciplines.json, or free text the artist typed. */
  discipline: string;
  layout: LayoutId;
  language: Locale;
}

/** "The Reel" for animators, "The Showcase" for everyone else. */
export function reelLayoutName(discipline: string): "reel" | "showcase" {
  return wantsReel(disciplineById(discipline)?.kind) ? "reel" : "showcase";
}

/** Layout order for step 4: the most fitting first. */
export function layoutOrder(discipline: string): LayoutId[] {
  const kind = disciplineById(discipline)?.kind;
  if (kind === "direction" || kind === "story") return ["storyteller", "reel", "grid", "minimalist"];
  return layoutIds;
}

export function disciplineText(discipline: string, language: Locale): string {
  const d = disciplineById(discipline);
  if (d) return language === "ar" ? d.ar : d.en;
  return discipline.trim();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function generateStarter(input: StarterInput): SiteDraft {
  const t = copy[input.language];
  const kind = disciplineById(input.discipline)?.kind ?? "other";
  const tones = palettes[kind];
  const what = disciplineText(input.discipline, input.language) || (input.language === "ar" ? "فنان" : "Artist");
  const first = firstName(input.name) || input.name;
  const art = (i: number, ratio: SampleArt["ratio"] = "1/1"): SampleArt => ({ tone: tones[i % tones.length], ratio });
  const items = (n: number, ratio: SampleArt["ratio"] = "1/1") =>
    Array.from({ length: n }, (_, i) => ({ title: t.project(i + 1), art: art(i, ratio) }));

  const about: Block = { id: "about", type: "about", heading: t.about, text: t.aboutText(first, what) };
  const contact: Block = {
    id: "contact",
    type: "contact",
    heading: t.contactHeading,
    text: t.contactText,
    button: t.contactButton,
  };

  let blocks: Block[];
  switch (input.layout) {
    case "reel":
      blocks = [
        reelLayoutName(input.discipline) === "reel"
          ? { id: "reel", type: "reel", title: t.reel, art: art(0, "16/9") }
          : { id: "hero", type: "hero-image", art: art(0, "16/9") },
        { id: "work", type: "grid", columns: 3, gap: "normal", items: items(6, "4/3") },
        about,
        contact,
      ];
      break;
    case "grid":
      blocks = [{ id: "work", type: "grid", columns: 3, gap: "tight", items: items(9) }, about, contact];
      break;
    case "storyteller":
      blocks = [
        { id: "intro", type: "hero-headline", text: t.headline(what) },
        {
          id: "cases",
          type: "case-studies",
          items: [0, 1, 2].map((i) => ({ title: t.project(i + 1), credit: t.credit, art: art(i, "16/9") })),
        },
        about,
        contact,
      ];
      break;
    case "minimalist":
      blocks = [{ id: "work", type: "grid", columns: 2, gap: "airy", items: items(4, "4/3") }, contact];
      break;
  }

  return {
    layout: input.layout,
    language: input.language,
    title: input.name.trim(),
    tagline: what,
    theme: themes[layoutTheme[input.layout]],
    pages: [
      { id: "home", slug: "", title: t.work, type: "gallery", blocks },
      { id: "about", slug: "about", title: t.about, type: "about", blocks: [about] },
      { id: "contact", slug: "contact", title: t.contact, type: "custom", blocks: [contact] },
    ],
  };
}
