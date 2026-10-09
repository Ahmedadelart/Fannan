// How a section looks by default (round 7). Kept apart from normalize.ts so the design library can
// build styled sections without a circular import.
import type { SectionStyle } from "./types";

export function defaultSectionStyle(): SectionStyle {
  return {
    bg: {
      kind: "none",
      color: "#F4F1E6",
      color2: "#FFFFFF",
      color3: null,
      angle: 180,
      radial: false,
      mediaId: null,
      overlay: "#000000",
      overlayOpacity: 40,
      pattern: "dots",
      patternColor: "#141414",
      patternOpacity: 12,
      patternScale: 100,
    },
    edgeTop: { shape: "none", height: 60, flip: false },
    edgeBottom: { shape: "none", height: 60, flip: false },
    padTop: 48,
    padBottom: 48,
    width: "normal",
    card: { on: false, color: null, radius: 24, shadow: true, padding: 40 },
    text: null,
    anchor: "",
    animate: "none",
  };
}

/** A default style with some parts changed (for the design library). */
export function sectionStyle(
  patch: Omit<Partial<SectionStyle>, "bg"> & { bg?: Partial<SectionStyle["bg"]> } = {},
): SectionStyle {
  const d = defaultSectionStyle();
  return { ...d, ...patch, bg: { ...d.bg, ...(patch.bg ?? {}) } };
}
