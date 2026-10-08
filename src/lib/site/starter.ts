// Builds the four starter sites from the sign-up answers (ONBOARDING.md step 3/4), and the six
// theme presets of the editor. Pure functions: the same code makes the live preview and the saved site.

import { disciplineById, wantsReel, type DisciplineKind } from "@/config/disciplines";
import type { Locale } from "@/i18n/locales";
import { blockCopy, newId, sampleArt } from "./blocks";
import type { Block, LayoutId, PageDraft, SampleArt, SiteDraft, Theme, ThemePreset } from "./types";

export const layoutIds: LayoutId[] = ["reel", "grid", "storyteller", "minimalist"];

const base = { radius: 6, logoMediaId: null, faviconMediaId: null };

/** Editor Style tab presets (Editor.dc.html). Artist sites use these, never Fannan's own brand. */
export const themes: Record<ThemePreset, Theme> = {
  gallery: {
    ...base,
    preset: "gallery",
    colors: { background: "#FFFFFF", text: "#141414", accent: "#141414" },
    fonts: { heading: "space-grotesk", body: "plex", arabic: "plex-arabic" },
    radius: 2,
    nav: "top",
  },
  studio: {
    ...base,
    preset: "studio",
    colors: { background: "#0E0E10", text: "#F4F4F0", accent: "#E5432F" },
    fonts: { heading: "bricolage", body: "plex", arabic: "plex-arabic" },
    nav: "top",
  },
  paper: {
    ...base,
    preset: "paper",
    colors: { background: "#F5F1E8", text: "#2B2B2E", accent: "#5B3A2E" },
    fonts: { heading: "fraunces", body: "plex", arabic: "plex-arabic" },
    nav: "centered",
  },
  lime: {
    ...base,
    preset: "lime",
    colors: { background: "#FFFFFF", text: "#141414", accent: "#C6F432" },
    fonts: { heading: "bricolage", body: "plex", arabic: "marhey" },
    radius: 12,
    nav: "top",
  },
  night: {
    ...base,
    preset: "night",
    colors: { background: "#141414", text: "#F4F4F0", accent: "#C6F432" },
    fonts: { heading: "bricolage", body: "plex", arabic: "plex-arabic" },
    radius: 8,
    nav: "split",
  },
  sand: {
    ...base,
    preset: "sand",
    colors: { background: "#E9E2D4", text: "#24221F", accent: "#9C5B34" },
    fonts: { heading: "instrument-serif", body: "dm-sans", arabic: "alexandria" },
    radius: 10,
    nav: "centered",
  },
};

export const presetIds = Object.keys(themes) as ThemePreset[];

const layoutTheme: Record<LayoutId, ThemePreset> = {
  reel: "night",
  grid: "gallery",
  storyteller: "paper",
  minimalist: "gallery",
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
  design: ["#141414", "#9C5B34", "#B0903A", "#5B2E4F", "#7A5A2E", "#4E5B2E"],
  photo: ["#3A3A3A", "#6B5A4A", "#8A8478", "#2E2E2E", "#5B4C2E", "#7A746A"],
  film: ["#141414", "#5B3A2E", "#3A3A3A", "#6B3A3A", "#4A4A44", "#7A5A2E"],
  fineart: ["#9C5B34", "#6B3A3A", "#B0903A", "#4E5B2E", "#5B2E4F", "#7A6A58"],
  architecture: ["#8A8478", "#5B5B55", "#B8B0A0", "#4A4A44", "#6B6458", "#9A9488"],
  fashion: ["#5B2E4F", "#9C5B34", "#141414", "#B07A3A", "#6B3A3A", "#8A6A5A"],
  craft: ["#7A5A2E", "#9C5B34", "#5B4C2E", "#4E5B2E", "#B0903A", "#6B4A3A"],
  music: ["#141414", "#5B2E4F", "#3A3A3A", "#9C5B34", "#4E5B2E", "#6B3A3A"],
  performance: ["#2E2E2E", "#6B3A3A", "#5B2E4F", "#7A5A2E", "#3A3A3A", "#9C5B34"],
  beauty: ["#8A5A5A", "#5B2E4F", "#B07A6A", "#6B3A3A", "#9C7A6A", "#4A3A3A"],
  writing: ["#24221F", "#8A8478", "#5B5B55", "#9C5B34", "#4A4A44", "#B8B0A0"],
  other: ["#5B3A2E", "#4E5B2E", "#5B2E4F", "#3A3A44", "#5B4C2E", "#6B4A3A"],
};

const pageTitles = {
  en: { work: "Work", about: "About", contact: "Contact" },
  ar: { work: "الأعمال", about: "نبذة", contact: "تواصل" },
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
  if (kind === "direction" || kind === "story" || kind === "writing") return ["storyteller", "reel", "grid", "minimalist"];
  // Stills-first fields lead with the grid.
  if (["photo", "architecture", "fashion", "fineart", "craft", "beauty", "design"].includes(kind ?? ""))
    return ["grid", "minimalist", "reel", "storyteller"];
  return layoutIds;
}

export function disciplineText(discipline: string, language: Locale): string {
  const d = disciplineById(discipline);
  if (d) return language === "ar" ? d.ar : d.en;
  return discipline.trim();
}

/** The hero line of "The Storyteller", in words that fit the artist's field. */
function storyLine(kind: DisciplineKind, l: Locale): string {
  const lines: Partial<Record<DisciplineKind, [string, string]>> = {
    animation: ["Telling stories, frame by frame.", "أحكي القصص، لقطة بلقطة."],
    direction: ["Telling stories, frame by frame.", "أحكي القصص، لقطة بلقطة."],
    story: ["Telling stories, panel by panel.", "أحكي القصص، مشهدًا بمشهد."],
    film: ["Telling stories through the lens.", "أحكي القصص بعين الكاميرا."],
    photo: ["Moments, light and the people in them.", "لحظات وضوء وناس."],
    writing: ["Words that make people stop and read.", "كلمات تجعل الناس يتوقفون ويقرؤون."],
    music: ["Sound that stays with you.", "أصوات تبقى معك."],
    architecture: ["Spaces made for the people who live in them.", "مساحات مصنوعة لمن يعيش فيها."],
    fashion: ["Clothes with a point of view.", "أزياء لها رأي."],
    design: ["Ideas made clear and beautiful.", "أفكار واضحة وجميلة."],
  };
  const [en, ar] = lines[kind] ?? ["Work with a story behind it.", "أعمال وراءها حكاية."];
  return l === "ar" ? ar : en;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function generateStarter(input: StarterInput): SiteDraft {
  const l = input.language;
  const c = blockCopy[l];
  const kind = disciplineById(input.discipline)?.kind ?? "other";
  const tones = palettes[kind];
  const what = disciplineText(input.discipline, l) || (l === "ar" ? "فنان" : "Artist");
  const first = firstName(input.name) || input.name;
  const samples = (n: number, ratio: SampleArt["ratio"]) =>
    sampleArt(n, ratio).map((s, i) => ({ ...s, tone: tones[i % tones.length] }));
  const gallery = (
    columns: number,
    gap: number,
    n: number,
    ratio: SampleArt["ratio"],
    layout: "grid" | "masonry" = "grid",
  ): Block => ({
    id: newId(),
    type: "gallery",
    layout,
    source: "all",
    columns,
    gap,
    ratio: ratio === "1/1" ? "1:1" : ratio === "16/9" ? "16:9" : ratio === "3/4" ? "original" : "4:3",
    lightbox: true,
    captions: true,
    credits: true,
    hoverPlay: true,
    filter: false,
    samples: samples(n, ratio),
  });
  const aboutText =
    l === "ar" ? `${first}، ${what}. ${c.aboutText}` : `${first} is a ${what.toLowerCase()}. ${c.aboutText}`;
  const about: Block = { id: newId(), type: "about", heading: c.about, text: aboutText, photoId: null, cvId: null };
  const contact: Block = { id: newId(), type: "contact", heading: c.contact, text: c.contactText, button: c.send };

  let blocks: Block[];
  switch (input.layout) {
    case "reel":
      blocks = [
        reelLayoutName(input.discipline) === "reel"
          ? { id: newId(), type: "reel", url: "", mediaId: null, title: c.reel, tone: tones[0] }
          : { id: newId(), type: "image", mediaId: null, tone: tones[0], caption: "", fullWidth: true },
        gallery(3, 16, 6, "4/3"),
        about,
        contact,
      ];
      break;
    case "grid":
      blocks = [gallery(3, 8, 9, "1/1"), about, contact];
      break;
    case "storyteller":
      blocks = [
        {
          id: newId(),
          type: "hero",
          text: `${what}. ${storyLine(kind, l)}`,
          align: "start",
        },
        gallery(1, 40, 3, "16/9"),
        about,
        contact,
      ];
      break;
    case "minimalist":
      blocks = [gallery(2, 40, 4, "4/3"), contact];
      break;
  }

  const t = pageTitles[l];
  const pages: PageDraft[] = [
    { id: "home", slug: "", title: t.work, type: "gallery", showInNav: true, blocks },
    { id: "about", slug: "about", title: t.about, type: "about", showInNav: true, blocks: [{ ...about, id: newId() }] },
    {
      id: "contact",
      slug: "contact",
      title: t.contact,
      type: "custom",
      showInNav: true,
      blocks: [{ ...contact, id: newId() }],
    },
  ];
  return {
    layout: input.layout,
    language: l,
    title: input.name.trim(),
    tagline: what,
    theme: {
      ...themes[layoutTheme[input.layout]],
      nav: input.layout === "minimalist" ? "minimal" : themes[layoutTheme[input.layout]].nav,
    },
    pages,
  };
}
