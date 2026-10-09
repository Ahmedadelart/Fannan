// Free-form sections (phase 8C): new items, finding room for them, and ready-made layouts.
import type { Locale } from "@/i18n/locales";
import { newId } from "./ids";
import { sampleTone } from "./samples";
import { DECO_KINDS, decoDefaults, defaultDeco } from "./deco";
import type { Block, FreeItem, FreeKind, FreePlace } from "./types";

export const FREE_COLS = 24;
export const FREE_KINDS: FreeKind[] = [
  "text",
  "heading",
  "image",
  "button",
  "shape",
  "line",
  "video",
  "social",
  "quote",
  "list",
  "map",
  "audio",
  "project",
  ...DECO_KINDS,
];

/** The add-item menu, grouped like Squarespace's. */
export const ITEM_GROUPS: Array<{ group: "essentials" | "decorations" | "display" | "links"; kinds: FreeKind[] }> = [
  { group: "decorations", kinds: DECO_KINDS },
  { group: "essentials", kinds: ["text", "heading", "image", "button", "video", "shape", "line"] },
  { group: "display", kinds: ["quote", "list", "audio", "map"] },
  { group: "links", kinds: ["social", "project"] },
];

const words = {
  en: {
    text: "Write something here. Click to edit.",
    heading: "A big heading",
    button: "Get in touch",
    quote: "Working with them was a joy. Every detail was considered.",
    author: "Name, Studio",
    map: "Cairo, Egypt",
    entries: [
      { title: "What do you work on?", body: "Animation, characters and stories for film, TV and games." },
      { title: "Are you available?", body: "Yes, for freelance and full-time projects." },
    ],
  },
  ar: {
    text: "اكتب شيئًا هنا. اضغط للتعديل.",
    heading: "عنوان كبير",
    button: "تواصل معي",
    quote: "العمل معه كان متعة. كل تفصيلة مدروسة.",
    author: "الاسم، الاستوديو",
    map: "القاهرة، مصر",
    entries: [
      { title: "ما الذي تعمل عليه؟", body: "رسوم متحركة وشخصيات وقصص للأفلام والتلفزيون والألعاب." },
      { title: "هل أنت متاح؟", body: "نعم، للمشاريع الحرة والدوام الكامل." },
    ],
  },
};

const SIZES: Record<FreeKind, Pick<FreePlace, "w" | "h">> = {
  text: { w: 10, h: 3 },
  heading: { w: 14, h: 3 },
  image: { w: 8, h: 6 },
  button: { w: 5, h: 2 },
  shape: { w: 4, h: 4 },
  line: { w: 8, h: 1 },
  video: { w: 12, h: 7 },
  social: { w: 8, h: 2 },
  quote: { w: 14, h: 4 },
  list: { w: 12, h: 6 },
  map: { w: 12, h: 8 },
  audio: { w: 12, h: 4 },
  project: { w: 8, h: 9 },
  underline: { w: 8, h: 1 },
  arrow: { w: 5, h: 3 },
  highlight: { w: 8, h: 2 },
  doodle: { w: 2, h: 2 },
  badge: { w: 4, h: 1 },
  icon: { w: 2, h: 2 },
  divider: { w: 12, h: 1 },
  panel: { w: 12, h: 8 },
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
    text:
      kind === "text"
        ? w.text
        : kind === "heading"
          ? w.heading
          : kind === "button"
            ? w.button
            : kind === "quote"
              ? w.quote
              : kind === "map"
                ? w.map
                : "",
    size: kind === "heading" ? 56 : kind === "quote" ? 32 : kind === "social" ? 28 : kind === "button" ? 16 : kind === "line" ? 16 : 18,
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
    hidden: false,
    font: kind === "heading" || kind === "quote" ? "heading" : "body",
    weight: kind === "heading" ? 700 : kind === "button" ? 600 : 400,
    lineHeight: kind === "heading" ? 105 : kind === "quote" ? 120 : 155,
    tracking: 0,
    upper: false,
    italic: false,
    borderWidth: 0,
    borderColor: null,
    shadow: false,
    variant: "filled",
    caption: kind === "quote" ? w.author : "",
    entries: kind === "list" ? w.entries.map((e) => ({ ...e })) : [],
    projectId: null,
    deco: { ...defaultDeco(), ...decoDefaults(kind) },
    fill2: null,
    // Decorations sit next to other items; on phones (one column) they'd float alone.
    ...(["underline", "arrow", "highlight", "doodle", "panel"].includes(kind) ? { hideOnPhone: true } : {}),
    ...(kind === "badge" ? { text: language === "ar" ? "جديد" : "NEW", size: 13, radius: 999, upper: true, weight: 700 } : {}),
    ...(kind === "highlight" ? { fill: "#F5E663", opacity: 85 } : {}),
    ...(kind === "panel" ? { radius: 28, fill: null, shadow: true } : {}),
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
  // Highlights and panels go behind everything else; the rest on top.
  const behind = kind === "highlight" || kind === "panel";
  const item = freeItem(kind, language, place, { z: behind ? 0 : top + 1 });
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
