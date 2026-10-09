// Sample artwork for empty pictures (round 4, redrawn after Ahmed's feedback: one flat style, no
// outlines or people, a small palette): 16 original drawings in public/samples, shown until
// the artist adds their own. A placeholder's `tone` is either a colour (#RRGGBB) or "sample:NN".

const BASES: Record<string, string> = {
  "01": "#F4F1E6",
  "02": "#E4DBC4",
  "03": "#F4F1E6",
  "04": "#F4F1E6",
  "05": "#F4F1E6",
  "06": "#6F8445",
  "07": "#EFD3BF",
  "08": "#F4F1E6",
  "09": "#E4DBC4",
  "10": "#EFD3BF",
  "11": "#F4F1E6",
  "12": "#E4DBC4",
  "13": "#F4F1E6",
  "14": "#EFD3BF",
  "15": "#E4DBC4",
  "16": "#F4F1E6",
};
const IDS = Object.keys(BASES);

/** The n-th sample (wraps around), as a tone. */
export const sampleTone = (n: number) => `sample:${IDS[((n % IDS.length) + IDS.length) % IDS.length]}`;

export const isSampleTone = (t: unknown): t is string => typeof t === "string" && /^sample:\d\d$/.test(t) && !!BASES[t.slice(7)];

/** CSS background for a placeholder: the drawing over its main colour, or the plain colour. */
export function toneFill(tone: string | null | undefined): string | undefined {
  if (!tone) return undefined;
  if (!isSampleTone(tone)) return tone;
  const id = tone.slice(7);
  return `url(/samples/${id}.svg?v=2) center / cover no-repeat ${BASES[id]}`;
}

/** The main colour behind a placeholder, for picking readable text on it. */
export const toneBase = (tone: string) => (isSampleTone(tone) ? BASES[tone.slice(7)] : tone);

// The dark colour tiles placeholders used before round 4. Drafts still holding one get a drawing
// instead (Ahmed found them muddy); a colour the artist picked themselves is kept.
const LEGACY = [
  "#141414", "#24221F", "#2A2622", "#2E2E2E", "#2E3A2E", "#3A3A3A", "#3A3A44", "#3E4A3A", "#4A3A3A",
  "#4A3E3A", "#4A4A44", "#4E5B2E", "#5A3E3A", "#5B2E4F", "#5B3A2E", "#5B4C2E", "#5B5B55", "#6A6A70",
  "#6B3A3A", "#6B4A3A", "#6B5A4A", "#6B6458", "#7A5A2E", "#7A6A58", "#7A746A", "#8A5A5A", "#8A6A5A",
  "#8A8478", "#9A9488", "#9C2E2E", "#9C5B34", "#9C7A6A", "#B07A3A", "#B07A6A", "#B0903A", "#B8B0A0",
];

/** Old placeholder colours become sample drawings; anything else stays as it is. */
export function upgradeTone(t: string): string {
  const i = LEGACY.indexOf(t.toUpperCase());
  return i < 0 ? t : sampleTone(i);
}
