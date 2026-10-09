// Background patterns for sections (round 7): small SVG tiles in one colour, repeated behind the content.
// "doodles" is drawn in the same flat, friendly style as the sample artwork (no people).
import type { PatternId } from "@/lib/site/types";

const tiles: Record<Exclude<PatternId, "custom">, { size: number; svg: (c: string) => string }> = {
  dots: { size: 24, svg: (c) => `<circle cx="12" cy="12" r="1.8" fill="${c}"/>` },
  grid: { size: 40, svg: (c) => `<path d="M40 0H0V40" fill="none" stroke="${c}" stroke-width="1"/>` },
  waves: {
    size: 60,
    svg: (c) => `<path d="M0 30 Q15 18 30 30 T60 30" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
  },
  sparkles: {
    size: 90,
    svg: (c) =>
      `<path d="M22 10 L25 21 L36 24 L25 27 L22 38 L19 27 L8 24 L19 21 Z" fill="${c}"/>` +
      `<path d="M66 56 L68 63 L75 65 L68 67 L66 74 L64 67 L57 65 L64 63 Z" fill="${c}"/>` +
      `<circle cx="70" cy="18" r="2" fill="${c}"/><circle cx="20" cy="72" r="2" fill="${c}"/>`,
  },
  doodles: {
    size: 180,
    svg: (c) =>
      `<g fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
      // a little star, a squiggle, a flower, a leaf, a circle and a pencil line
      `<path d="M34 18 L38 30 L50 31 L41 39 L44 51 L34 44 L24 51 L27 39 L18 31 L30 30 Z"/>` +
      `<path d="M96 30 q8 -10 16 0 t16 0 t16 0"/>` +
      `<circle cx="140" cy="96" r="6"/><path d="M140 82 v-8 M140 110 v8 M126 96 h-8 M154 96 h8"/>` +
      `<path d="M40 120 C40 100 66 96 72 112 C60 112 48 116 40 120 Z M40 120 L66 104"/>` +
      `<circle cx="96" cy="150" r="12"/>` +
      `<path d="M150 150 l18 -18 M146 154 l4 -4"/></g>`,
  },
};

/** A CSS background-image (and its tile size) for a built-in pattern. */
export function patternCss(id: PatternId, color: string, scale: number): { image: string; size: string } | null {
  if (id === "custom") return null;
  const t = tiles[id];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.size}" height="${t.size}" viewBox="0 0 ${t.size} ${t.size}">${t.svg(color)}</svg>`;
  const px = Math.round((t.size * scale) / 100);
  return { image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, size: `${px}px ${px}px` };
}

export const PATTERN_IDS: PatternId[] = ["dots", "grid", "waves", "sparkles", "doodles", "custom"];
