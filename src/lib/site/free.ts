// Free-form sections (phase 8C): new items, finding room for them, and ready-made layouts.
import type { Locale } from "@/i18n/locales";
import { newId } from "./ids";
import { sampleTone } from "./samples";
import type { Block, FreeItem, FreeKind, FreePlace } from "./types";

export const FREE_COLS = 24;
export const FREE_KINDS: FreeKind[] = ["text", "heading", "image", "button", "shape", "line", "video"];

const words = {
  en: { text: "Write something here. Click to edit.", heading: "A big heading", button: "Get in touch" },
  ar: { text: "اكتب شيئًا هنا. اضغط للتعديل.", heading: "عنوان كبير", button: "تواصل معي" },
};

const SIZES: Record<FreeKind, Pick<FreePlace, "w" | "h">> = {
  text: { w: 10, h: 3 },
  heading: { w: 14, h: 3 },
  image: { w: 8, h: 6 },
  button: { w: 5, h: 2 },
  shape: { w: 4, h: 4 },
  line: { w: 8, h: 1 },
  video: { w: 12, h: 7 },
};

export function freeItem(kind: FreeKind, language: Locale, place?: Partial<FreePlace>, extra: Partial<FreeItem> = {}): FreeItem {
  const w = words[language];
  const size = SIZES[kind];
  return {
    id: newId(),
    kind,
    place: { x: 0, y: 0, ...size, ...place },
    z: 1,
    rotate: 0,
    opacity: 100,
    hideOnPhone: false,
    text: kind === "text" ? w.text : kind === "heading" ? w.heading : kind === "button" ? w.button : "",
    size: kind === "heading" ? 56 : kind === "button" ? 16 : kind === "line" ? 16 : 18,
    align: "start",
    color: null,
    fill: null,
    mediaId: null,
    fit: "cover",
    radius: kind === "button" ? 999 : 0,
    shape: "rect",
    link: "",
    url: "",
    tone: sampleTone(0),
    ...extra,
  };
}

const overlaps = (a: FreePlace, b: FreePlace) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The first empty spot (top to bottom, from the reading start) where a w×h item fits. */
export function findSpot(items: FreeItem[], w: number, h: number): FreePlace {
  for (let y = 0; y < 400; y++) {
    for (let x = 0; x + w <= FREE_COLS; x++) {
      const p = { x, y, w, h };
      if (!items.some((i) => overlaps(i.place, p))) return p;
    }
  }
  return { x: 0, y: 0, w, h };
}

/** Adds an item where there's room, growing the section if needed. */
export function addFreeItem(b: Extract<Block, { type: "free" }>, kind: FreeKind, language: Locale) {
  const { w, h } = SIZES[kind];
  const place = findSpot(b.items, w, h);
  const top = b.items.reduce((m, i) => Math.max(m, i.z), 0);
  const item = freeItem(kind, language, place, { z: top + 1 });
  return { block: { ...b, items: [...b.items, item], rows: Math.max(b.rows, place.y + place.h) }, item };
}

/** The lowest row any item reaches. */
export const freeBottom = (items: FreeItem[]) => items.reduce((m, i) => Math.max(m, i.place.y + i.place.h), 0);

export type FreeTemplate = "blank" | "collage" | "split" | "statement";

/** Ready-made free-form sections for the block library. */
export function freeTemplate(name: FreeTemplate, language: Locale): Extract<Block, { type: "free" }> {
  const it = (kind: FreeKind, place: Partial<FreePlace>, extra: Partial<FreeItem> = {}) =>
    freeItem(kind, language, place, extra);
  const w = words[language];
  let items: FreeItem[];
  let rows = 12;
  switch (name) {
    case "blank":
      items = [it("heading", { x: 1, y: 1, w: 14, h: 3 }), it("text", { x: 1, y: 5, w: 10, h: 4 })];
      rows = 10;
      break;
    case "collage":
      // Overlapping, slightly turned pictures with a heading on top: the "make it yours" layout.
      items = [
        it("image", { x: 1, y: 1, w: 9, h: 11 }, { rotate: -4, tone: sampleTone(1), z: 1 }),
        it("image", { x: 8, y: 4, w: 9, h: 10 }, { rotate: 3, tone: sampleTone(4), z: 2 }),
        it("image", { x: 15, y: 0, w: 8, h: 9 }, { rotate: -2, tone: sampleTone(10), z: 3 }),
        it("heading", { x: 14, y: 11, w: 10, h: 3 }, { z: 4, text: language === "ar" ? "أعمال مختارة" : "Selected work" }),
      ];
      rows = 15;
      break;
    case "split":
      items = [
        it("image", { x: 0, y: 0, w: 12, h: 12 }, { tone: sampleTone(13) }),
        it("heading", { x: 13, y: 2, w: 10, h: 3 }),
        it("text", { x: 13, y: 6, w: 10, h: 4 }),
        it("button", { x: 13, y: 10, w: 5, h: 2 }, { text: w.button, link: "/contact" }),
      ];
      rows = 12;
      break;
    case "statement":
      items = [
        it("heading", { x: 2, y: 2, w: 20, h: 5 }, { size: 96, align: "center" }),
        it("line", { x: 9, y: 8, w: 6, h: 1 }),
      ];
      rows = 10;
      break;
  }
  return { id: newId(), type: "free", rows, background: null, bgMediaId: null, items };
}
