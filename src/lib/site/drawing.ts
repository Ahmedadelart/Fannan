// Doodles (round 11): vector drawings made in the editor with a finger, mouse or pen.
// Strokes are kept as points with pressure; their outline is made by perfect-freehand when drawn,
// so the same data looks the same in the editor and on the live site. Pure: browser and server.

import { getStroke } from "perfect-freehand";
import type { BrushId, DrawStroke, Drawing } from "./types";

export interface BrushSpec {
  id: BrushId;
  pro: boolean;
  /** How much pressure changes the width (0 none – 1 a lot). */
  thinning: number;
  /** Narrow ends. */
  taper: boolean;
  /** Width multiplier on the chosen size. */
  scale: number;
  /** Default see-through-ness for the brush. */
  opacity: number;
  /** An SVG filter that gives the brush its texture or glow. */
  filter: "none" | "pencil" | "crayon" | "neon" | "chalk" | "watercolor" | "glitch";
}

export const BRUSHES: BrushSpec[] = [
  { id: "pen", pro: false, thinning: 0.6, taper: true, scale: 1, opacity: 100, filter: "none" },
  { id: "marker", pro: false, thinning: 0, taper: false, scale: 1.6, opacity: 100, filter: "none" },
  { id: "pencil", pro: false, thinning: 0.35, taper: true, scale: 0.55, opacity: 85, filter: "pencil" },
  { id: "crayon", pro: false, thinning: 0.2, taper: false, scale: 1.4, opacity: 95, filter: "crayon" },
  { id: "neon", pro: true, thinning: 0.1, taper: false, scale: 0.9, opacity: 100, filter: "neon" },
  { id: "chalk", pro: true, thinning: 0.25, taper: false, scale: 1.5, opacity: 90, filter: "chalk" },
  { id: "watercolor", pro: true, thinning: 0.5, taper: true, scale: 2.4, opacity: 45, filter: "watercolor" },
  { id: "glitch", pro: true, thinning: 0.3, taper: false, scale: 1, opacity: 100, filter: "glitch" },
];

export const brushOf = (id: BrushId) => BRUSHES.find((b) => b.id === id) ?? BRUSHES[0];
export const isProBrush = (id: BrushId) => brushOf(id).pro;

export function emptyDrawing(w = 1000, h = 750): Drawing {
  return { w, h, strokes: [], boil: { on: false, amount: 40, speed: 50 } };
}

/** Safety limits: a drawing stays small enough to publish (points across all strokes). */
export const MAX_POINTS = 8000;
export const MAX_STROKES = 600;

/** Small, steady random numbers from a seed, so a "boiling" frame looks the same every time. */
function rand(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * The outline of a stroke as an SVG path. `jitter` moves the points a little (for the boiling
 * frames); `seed` makes that wobble repeatable.
 */
export function strokePath(s: DrawStroke, jitter = 0, seed = 1): string {
  const spec = brushOf(s.brush);
  // Boiling moves the whole line through a smooth, wavy field (not each point on its own), so the
  // line shifts and bends a little between frames but never breaks up, however much it wiggles.
  const r = rand(seed * 7919 + 13);
  const ph = [r(), r(), r(), r()].map((x) => x * Math.PI * 2);
  const amp = jitter ? (jitter / 100) * (3 + s.size * 0.25) : 0;
  const f = 0.018;
  const pts: number[][] = [];
  for (let i = 0; i + 2 < s.points.length; i += 3) {
    const x = s.points[i];
    const y = s.points[i + 1];
    const dx = amp ? amp * (Math.sin(y * f + ph[0]) + 0.6 * Math.sin(x * f * 1.7 + ph[1])) : 0;
    const dy = amp ? amp * (Math.sin(x * f + ph[2]) + 0.6 * Math.sin(y * f * 1.3 + ph[3])) : 0;
    pts.push([x + dx, y + dy, s.points[i + 2] / 100]);
  }
  if (!pts.length) return "";
  // The line's weight breathes a little too.
  const width = s.size * spec.scale * (amp ? 1 + (r() - 0.5) * 0.12 * (jitter / 100) : 1);
  const outline = getStroke(pts, {
    size: width,
    thinning: spec.thinning,
    smoothing: 0.5 + (s.smoothing / 100) * 0.45,
    streamline: 0.3 + (s.smoothing / 100) * 0.6,
    simulatePressure: s.pressure === false,
    start: { taper: spec.taper ? s.size * 2 : 0, cap: true },
    end: { taper: spec.taper ? s.size * 2 : 0, cap: true },
    last: true,
  });
  return outlineToPath(outline);
}

function outlineToPath(points: number[][]): string {
  if (points.length < 2) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M${r(points[0][0])} ${r(points[0][1])}Q`;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    d += `${r(x0)} ${r(y0)} ${r((x0 + x1) / 2)} ${r((y0 + y1) / 2)} `;
  }
  return `${d.trim()}Z`;
}

/** Thins a stroke's points (keeps the shape, drops near-duplicates) before it is saved. */
export function simplify(points: number[], tolerance = 0.8): number[] {
  if (points.length <= 9) return points;
  const out = [points[0], points[1], points[2]];
  for (let i = 3; i + 2 < points.length; i += 3) {
    const lx = out[out.length - 3];
    const ly = out[out.length - 2];
    if (Math.hypot(points[i] - lx, points[i + 1] - ly) >= tolerance || i + 3 >= points.length)
      out.push(points[i], points[i + 1], points[i + 2]);
  }
  return out.map((n, i) => (i % 3 === 2 ? Math.round(n) : Math.round(n * 10) / 10));
}

/** Checked drawing data (from the editor or the database). */
export function normalizeDrawing(raw: unknown): Drawing {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, def: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
  const w = Math.round(num(d.w, 100, 4000, 1000));
  const h = Math.round(num(d.h, 100, 4000, 750));
  const boil = (d.boil && typeof d.boil === "object" ? d.boil : {}) as Record<string, unknown>;
  let budget = MAX_POINTS * 3;
  const strokes: DrawStroke[] = [];
  for (const s of (Array.isArray(d.strokes) ? d.strokes : []).slice(0, MAX_STROKES) as Array<Record<string, unknown>>) {
    if (!s || !Array.isArray(s.points)) continue;
    const pts = (s.points as unknown[]).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const usable = pts.slice(0, Math.max(0, Math.min(pts.length - (pts.length % 3), budget)));
    if (usable.length < 3) continue;
    budget -= usable.length;
    strokes.push({
      brush: BRUSHES.some((b) => b.id === s.brush) ? (s.brush as BrushId) : "pen",
      color: typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color.toUpperCase() : "#1A1C16",
      size: num(s.size, 1, 200, 8),
      opacity: Math.round(num(s.opacity, 5, 100, 100)),
      smoothing: Math.round(num(s.smoothing, 0, 100, 50)),
      pressure: s.pressure !== false,
      points: usable.map((n, i) => (i % 3 === 2 ? Math.round(Math.min(100, Math.max(0, n))) : Math.round(n * 10) / 10)),
    });
    if (budget <= 0) break;
  }
  return {
    w,
    h,
    strokes,
    boil: {
      on: boil.on === true,
      amount: Math.round(num(boil.amount, 0, 100, 40)),
      speed: Math.round(num(boil.speed, 0, 100, 50)),
    },
  };
}
