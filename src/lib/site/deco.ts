// Decoration settings (round 7): one bag of options shared by underlines, arrows, highlights, doodles,
// dividers, icons, and the extra looks for pictures, buttons and text. Defaults are clean (no wobble).
import type { FreeDeco, FreeKind } from "./types";

export const DECO_KINDS: FreeKind[] = ["underline", "arrow", "highlight", "doodle", "badge", "icon", "divider", "panel"];

export const DECO_STYLES: Partial<Record<FreeKind, string[]>> = {
  underline: ["wave", "zigzag", "scribble", "straight", "double", "loop"],
  arrow: ["curved", "straight", "loop", "bent", "zigzag"],
  doodle: ["sparkle", "star", "burst", "heart", "circle", "swirl", "emphasis", "pencil"],
  divider: ["solid", "dashed", "dotted", "wavy", "zigzag", "double"],
  icon: [
    "sparkle", "star", "heart", "brush", "pen", "camera", "film", "book", "clock", "download", "image", "video-4k",
    "audio", "email", "messages", "map", "link", "check", "palette", "projects", "quote", "social-links", "language", "publish",
  ],
};

export function defaultDeco(): FreeDeco {
  return {
    style: "",
    amp: 50,
    freq: 4,
    curve: 40,
    stroke: 4,
    head: "open",
    headSize: 36,
    dashed: false,
    wobble: 0,
    flipX: false,
    flipY: false,
    round: true,
    filled: false,
    backing: "none",
    mask: "none",
    frame: "none",
    filter: "none",
    duo1: "#141414",
    duo2: "#F4F1E6",
    backdrop: "none",
    arrow: false,
    textShadow: false,
  };
}

/** A new decoration of each kind starts from these. */
export function decoDefaults(kind: FreeKind): Partial<FreeDeco> {
  switch (kind) {
    case "underline":
      return { style: "wave", amp: 60, freq: 4, stroke: 6 };
    case "arrow":
      return { style: "curved", curve: 50, stroke: 6, head: "open", headSize: 40 };
    case "highlight":
      return { curve: 10, wobble: 30 };
    case "doodle":
      return { style: "sparkle", stroke: 5, filled: true, freq: 5, curve: 60 };
    case "divider":
      return { style: "solid", amp: 40, freq: 8, stroke: 3 };
    case "icon":
      return { style: "sparkle", stroke: 3 };
    default:
      return {};
  }
}
