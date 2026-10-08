// Typed access to config/disciplines.json and the step-2 autocomplete.
import raw from "../../config/disciplines.json";
import type { Locale } from "@/i18n/locales";

export type DisciplineKind =
  | "animation"
  | "3d"
  | "motion"
  | "direction"
  | "story"
  | "illustration"
  | "concept"
  | "comics"
  | "games"
  | "design"
  | "photo"
  | "film"
  | "fineart"
  | "architecture"
  | "fashion"
  | "craft"
  | "music"
  | "performance"
  | "beauty"
  | "writing"
  | "other";

export interface Discipline {
  id: string;
  kind: DisciplineKind;
  en: string;
  enPlural: string;
  ar: string;
  arPlural: string;
  synonyms: string[];
}

export const disciplines = (raw as { disciplines: Discipline[] }).disciplines;

const byId = new Map(disciplines.map((d) => [d.id, d]));
export function disciplineById(id: string | undefined | null): Discipline | undefined {
  return id ? byId.get(id) : undefined;
}

/** Quick-pick chips shown before the artist types anything. */
export const quickPicks = [
  "illustrator",
  "photographer",
  "graphic-designer",
  "2d-animator",
  "architect",
  "3d-modeler",
  "fashion-designer",
  "calligrapher",
  "ux-designer",
  "concept-artist",
  "contemporary-artist",
  "filmmaker",
];

/** Lowercase, strip Arabic diacritics and unify letter forms (أ/إ/آ → ا, ة → ه, ى → ي). */
export function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** Autocomplete: best matches first. Matches the English name, the Arabic name and synonyms. */
export function searchDisciplines(query: string, limit = 12): Discipline[] {
  const q = foldText(query);
  if (!q) return quickPicks.map((id) => byId.get(id)!).slice(0, limit);
  const scored: Array<{ d: Discipline; score: number }> = [];
  for (const d of disciplines) {
    const names = [d.en, d.ar].map(foldText);
    const syns = d.synonyms.map(foldText);
    let score = 0;
    if (names.some((n) => n === q) || syns.includes(q)) score = 100;
    else if (names.some((n) => n.startsWith(q))) score = 80;
    else if (syns.some((s) => s.startsWith(q))) score = 70;
    else if (names.some((n) => n.split(" ").some((w) => w.startsWith(q)))) score = 60;
    else if ([...names, ...syns].some((n) => n.includes(q))) score = 40;
    if (score) scored.push({ d, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.d)
    .slice(0, limit);
}

export function disciplineLabel(d: Discipline, locale: Locale): string {
  return locale === "ar" ? d.ar : d.en;
}

export function disciplinePlural(d: Discipline, locale: Locale): string {
  return locale === "ar" ? d.arPlural : d.enPlural;
}

/** People whose work moves (animation, motion, 3D, film, performance) get "The Reel"; everyone else "The Showcase". */
export function wantsReel(kind: DisciplineKind | undefined): boolean {
  return (
    kind === "animation" ||
    kind === "3d" ||
    kind === "motion" ||
    kind === "direction" ||
    kind === "film" ||
    kind === "performance"
  );
}
