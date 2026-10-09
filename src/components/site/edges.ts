// Shaped edges between sections (round 7): a wave, curve, slant, torn paper, zigzag or scallops in the
// section's own colour, biting into the neighbour. Paths are drawn in a 1200×100 box, filled below the
// line (a top edge); bottom edges are the same shape turned over. Stretched to the section's width.
import type { EdgeShape } from "@/lib/site/types";

function zigzag(step: number, low: number, high: number) {
  let d = `M0,100 L0,${low}`;
  for (let x = step / 2, up = true; x <= 1200; x += step / 2, up = !up) d += ` L${x},${up ? high : low}`;
  return `${d} L1200,100 Z`;
}

function scallop(r: number) {
  let d = `M0,100 L0,${100 - r}`;
  for (let x = 0; x < 1200; x += r * 2) d += ` A${r},${r} 0 0 1 ${x + r * 2},${100 - r}`;
  return `${d} L1200,100 Z`;
}

/** A torn-paper line: fixed, irregular points (the same on every render). */
function torn() {
  const ys = [62, 48, 70, 40, 58, 35, 66, 44, 72, 50, 38, 60, 46, 68, 42, 56, 34, 64, 52, 40, 70, 46, 58, 36, 62];
  return `M0,100 ${ys.map((y, i) => `L${(i * 1200) / (ys.length - 1)},${y}`).join(" ")} L1200,100 Z`;
}

export const EDGE_PATHS: Record<Exclude<EdgeShape, "none">, string> = {
  wave: "M0,58 C150,10 350,0 600,46 C850,92 1050,90 1200,36 L1200,100 L0,100 Z",
  curve: "M0,100 Q600,-10 1200,100 Z",
  slant: "M0,100 L1200,8 L1200,100 Z",
  torn: torn(),
  zigzag: zigzag(80, 70, 30),
  scallop: scallop(30),
};
