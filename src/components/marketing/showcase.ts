// Example sites for fannan.net (round 10): real Fannan sites, built by the same code as the guided
// setup (buildFromGuide) and drawn by the real renderer. "Less talk, more show."

import type { GalleryProject } from "@/components/site/SiteRender";
import type { Locale } from "@/i18n/locales";
import { buildFromGuide, newGuidePage, type GuideAnswers, type GuidePage } from "@/lib/site/guide";
import type { HeaderSettings, SiteDraft, ThemePreset } from "@/lib/site/types";

export type ShowcaseKey = "animator" | "illustrator" | "photographer" | "designer" | "comics" | "modeler";

interface Spec {
  name: [string, string];
  discipline: string;
  preset: ThemePreset;
  accent?: string;
  font?: HeaderSettings["logoFont"];
  home: string;
  /** Project titles, and their card sizes. */
  projects: Array<[string, string, "m" | "l" | "wide"]>;
}

const SPECS: Record<ShowcaseKey, Spec> = {
  animator: {
    name: ["Nour Adel", "نور عادل"],
    discipline: "2d-animator",
    preset: "night",
    home: "d-hero-split",
    projects: [
      ["Sandstorm", "عاصفة رملية", "l"],
      ["Moonlight", "ضوء القمر", "m"],
      ["Tiny Giants", "عمالقة صغار", "m"],
      ["The Lantern", "الفانوس", "wide"],
    ],
  },
  illustrator: {
    name: ["Layla Farid", "ليلى فريد"],
    discipline: "illustrator",
    preset: "paper",
    font: "fraunces",
    home: "d-about-circle",
    projects: [
      ["Garden Stories", "حكايات الحديقة", "m"],
      ["Cairo at Night", "القاهرة ليلًا", "m"],
      ["Paper Birds", "طيور ورقية", "m"],
    ],
  },
  photographer: {
    name: ["Omar Saleh", "عمر صالح"],
    discipline: "photographer",
    preset: "gallery",
    home: "d-hero-photo",
    projects: [
      ["Desert Light", "ضوء الصحراء", "wide"],
      ["Portraits", "بورتريهات", "m"],
      ["Old Town", "المدينة القديمة", "m"],
    ],
  },
  designer: {
    name: ["Sara Nabil", "سارة نبيل"],
    discipline: "graphic-designer",
    preset: "lime",
    home: "d-statement",
    projects: [
      ["Brand for Nile", "هوية نايل", "l"],
      ["Poster Series", "سلسلة ملصقات", "m"],
      ["Type Specimen", "عيّنة خط", "m"],
    ],
  },
  comics: {
    name: ["Yusuf Kamal", "يوسف كمال"],
    discipline: "comic-artist",
    preset: "sand",
    font: "syne",
    home: "d-title",
    projects: [
      ["Night Market", "سوق الليل", "m"],
      ["Falcon", "الصقر", "m"],
      ["Sketchbook", "اسكتشات", "m"],
    ],
  },
  modeler: {
    name: ["Mariam Hany", "مريم هاني"],
    discipline: "3d-modeler",
    preset: "studio",
    home: "d-hero-split",
    projects: [
      ["Robot Garden", "حديقة الروبوت", "l"],
      ["Toy Shop", "متجر الألعاب", "m"],
      ["Spaceship", "سفينة فضاء", "m"],
    ],
  },
};

const PAGE_WORDS = {
  en: { home: "Work", about: "About", contact: "Contact" },
  ar: { home: "أعمالي", about: "عني", contact: "تواصل" },
};

export function showcaseAnswers(key: ShowcaseKey, l: Locale): { answers: GuideAnswers; projects: GalleryProject[] } {
  const s = SPECS[key];
  const w = PAGE_WORDS[l];
  const projects: GalleryProject[] = s.projects.map(([en, ar], i) => ({
    id: `${key}-p${i}`,
    slug: `p${i}`,
    title: l === "ar" ? ar : en,
    category: "",
    client: "",
    role: "",
    visibility: "public",
    coverId: null,
    mature: false,
  }));
  const fixed = (p: GuidePage, id: string): GuidePage => ({ ...p, id: `${key}-${id}` });
  const home = fixed({ ...newGuidePage(w.home, "home"), template: s.home }, "home");
  return {
    projects,
    answers: {
      discipline: s.discipline,
      logo: { mode: "name", mediaId: null, name: s.name[l === "ar" ? 1 : 0], font: s.font ?? null, tagline: "" },
      preset: s.preset,
      accent: s.accent ?? null,
      pages: [home, fixed(newGuidePage(w.about, "about"), "about"), fixed(newGuidePage(w.contact, "contact"), "contact")],
      projects: s.projects.map(([, , size], i) => ({ id: `${key}-p${i}`, size, text: "title", inMenu: false })),
      groupProjects: true,
      social: [
        { network: "instagram", url: "#" },
        { network: "behance", url: "#" },
        { network: "youtube", url: "#" },
      ],
    },
  };
}

/** A finished example site, and its projects with their card sizes. */
export function showcaseSite(key: ShowcaseKey, l: Locale): { site: SiteDraft; projects: GalleryProject[] } {
  const { answers, projects } = showcaseAnswers(key, l);
  const site = buildFromGuide(answers, { language: l, title: answers.logo.name, projects });
  return {
    site,
    projects: projects.map((p) => {
      const a = answers.projects.find((x) => x.id === p.id)!;
      return { ...p, card: { size: a.size, text: a.text } };
    }),
  };
}

export const SHOWCASE_KEYS = Object.keys(SPECS) as ShowcaseKey[];
export const showcaseDiscipline = (key: ShowcaseKey) => SPECS[key].discipline;
/** The example's web address, the same in both languages (nour.fannan.net). */
export const showcaseAddress = (key: ShowcaseKey) => `${SPECS[key].name[0].split(" ")[0].toLowerCase()}.fannan.net`;
