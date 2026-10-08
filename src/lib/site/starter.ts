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

// Sample drawings per kind of work (public/samples), shown until the artist adds their own.
const palettes: Record<DisciplineKind, string[]> = {
  animation: ["sample:15", "sample:02", "sample:08", "sample:01", "sample:03", "sample:04"],
  "3d": ["sample:12", "sample:07", "sample:05", "sample:01", "sample:16", "sample:10"],
  motion: ["sample:15", "sample:05", "sample:07", "sample:12", "sample:13", "sample:16"],
  direction: ["sample:03", "sample:01", "sample:09", "sample:10", "sample:14", "sample:06"],
  story: ["sample:03", "sample:04", "sample:08", "sample:15", "sample:02", "sample:14"],
  illustration: ["sample:02", "sample:11", "sample:14", "sample:06", "sample:01", "sample:10"],
  concept: ["sample:01", "sample:10", "sample:09", "sample:12", "sample:07", "sample:11"],
  comics: ["sample:04", "sample:03", "sample:02", "sample:08", "sample:05", "sample:13"],
  games: ["sample:08", "sample:12", "sample:02", "sample:09", "sample:15", "sample:07"],
  design: ["sample:05", "sample:13", "sample:07", "sample:16", "sample:12", "sample:04"],
  photo: ["sample:01", "sample:10", "sample:09", "sample:14", "sample:06", "sample:11"],
  film: ["sample:09", "sample:10", "sample:01", "sample:14", "sample:03", "sample:05"],
  fineart: ["sample:06", "sample:11", "sample:14", "sample:07", "sample:01", "sample:16"],
  architecture: ["sample:09", "sample:07", "sample:12", "sample:01", "sample:05", "sample:10"],
  fashion: ["sample:14", "sample:16", "sample:02", "sample:11", "sample:05", "sample:13"],
  craft: ["sample:16", "sample:06", "sample:11", "sample:12", "sample:07", "sample:01"],
  music: ["sample:05", "sample:09", "sample:13", "sample:07", "sample:15", "sample:16"],
  performance: ["sample:14", "sample:09", "sample:10", "sample:05", "sample:02", "sample:15"],
  beauty: ["sample:14", "sample:11", "sample:02", "sample:06", "sample:16", "sample:10"],
  writing: ["sample:13", "sample:04", "sample:03", "sample:06", "sample:11", "sample:05"],
  other: ["sample:01", "sample:02", "sample:05", "sample:06", "sample:11", "sample:12"],
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
    // The first drawing goes to the big picture at the top, so the gallery starts with the next one.
    sampleArt(n, ratio).map((s, i) => ({ ...s, tone: tones[(i + 1) % tones.length] }));
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
