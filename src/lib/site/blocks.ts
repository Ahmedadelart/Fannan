// The editor's block catalogue: which group each block sits in, its icon, and a fresh copy.
import type { IconName } from "@/components/ui/icons.generated";
import type { Locale } from "@/i18n/locales";
import { plansConfig } from "@/config/plans";
import { designBlock, type DesignKey } from "./designBlocks";
import { freeTemplate } from "./free";
import type { Block, BlockType, SampleArt } from "./types";

export type BlockGroup = "freeform" | "layout" | "galleries" | "media" | "hire";

export interface BlockKind {
  /** Key used for the label in messages (editor.blocks.*). */
  key: string;
  type: BlockType;
  group: BlockGroup;
  icon: IconName;
  /** Fannan-only blocks get a small lime "Fannan" tag. */
  fannan?: boolean;
  /** Showpiece blocks only Pro sites can publish (config/plans.json → proBlocks). */
  pro?: boolean;
  make: (locale: Locale) => Block;
}

export { newId } from "./ids";
import { newId } from "./ids";

const SAMPLE_TONES = ["#5B3A2E", "#4E5B2E", "#5B2E4F", "#7A5A2E", "#3A3A3A", "#6B3A3A"];
export const sampleArt = (n: number, ratio: SampleArt["ratio"] = "4/3"): SampleArt[] =>
  Array.from({ length: n }, (_, i) => ({ tone: SAMPLE_TONES[i % SAMPLE_TONES.length], ratio }));

const copy = {
  en: {
    cover: "Your next job is looking for you.",
    coverSub: "Selected work · Projects · Process",
    text: "Write something about this part of your work.",
    hero: "I make work people remember.",
    col: ["Idea", "Process", "Final work"],
    colText: "A short line about what you do here.",
    pdf: "Download PDF",
    reel: "Showreel",
    credits: "Credits",
    logos: "Clients I’ve worked with",
    about: "About",
    aboutText: "Write a few lines about yourself, who you’ve worked with and what you’d like to do next.",
    contact: "Let’s work together",
    contactText: "Tell me about your project, your timeline and your budget.",
    send: "Send a message",
    hire: "Available for freelance and full-time work.",
    quote: "Working with them was a joy. Every detail was considered.",
    author: "Name, Company",
    before: "Sketch",
    after: "Final",
  },
  ar: {
    cover: "خلّي الفرص تلاقيك.",
    coverSub: "أعمال مختارة · مشاريع · مراحل العمل",
    text: "اكتب شيئًا عن هذا الجزء من عملك.",
    hero: "أصنع أعمالًا لا تُنسى.",
    col: ["الفكرة", "المراحل", "العمل النهائي"],
    colText: "سطر قصير عمّا تقدّمه هنا.",
    pdf: "تحميل PDF",
    reel: "الريل",
    credits: "الاعتمادات",
    logos: "عملاء عملت معهم",
    about: "نبذة",
    aboutText: "اكتب بضعة أسطر عن نفسك ومن عملت معهم وما تريد فعله بعد ذلك.",
    contact: "لنعمل معًا",
    contactText: "أخبرني عن مشروعك وموعده وميزانيته.",
    send: "أرسل رسالة",
    hire: "متاح للعمل الحر والدوام الكامل.",
    quote: "العمل معه كان متعة. كل تفصيلة كانت مدروسة.",
    author: "الاسم، الشركة",
    before: "اسكتش",
    after: "النهائي",
  },
};
export const blockCopy = copy;

const gallery = (layout: "grid" | "masonry" | "slider", locale: Locale): Block => {
  void locale;
  return {
    id: newId(),
    type: "gallery",
    layout,
    source: "all",
    columns: layout === "slider" ? 2 : 3,
    gap: 12,
    ratio: layout === "masonry" ? "original" : "4:3",
    lightbox: true,
    captions: true,
    credits: true,
    hoverPlay: true,
    filter: false,
    samples: sampleArt(6, layout === "masonry" ? "3/4" : "4/3"),
  };
};

export const blockKinds: BlockKind[] = [
  // Free-form: blocks placed anywhere, resized, turned and layered (phase 8C)
  { key: "free-blank", type: "free", group: "freeform", icon: "shape", make: (l) => freeTemplate("blank", l) },
  { key: "free-collage", type: "free", group: "freeform", icon: "masonry", make: (l) => freeTemplate("collage", l) },
  { key: "free-split", type: "free", group: "freeform", icon: "columns", make: (l) => freeTemplate("split", l) },
  { key: "free-statement", type: "free", group: "freeform", icon: "hero-headline", make: (l) => freeTemplate("statement", l) },
  // Layout
  {
    key: "cover",
    type: "cover",
    group: "layout",
    icon: "fullscreen-cover",
    make: (l) => ({
      id: newId(),
      type: "cover",
      mediaId: null,
      tone: "#2A2622",
      heading: copy[l].cover,
      subheading: copy[l].coverSub,
      height: "large",
    }),
  },
  {
    key: "text",
    type: "text",
    group: "layout",
    icon: "text",
    make: (l) => ({ id: newId(), type: "text", text: copy[l].text, align: "start", size: "body" }),
  },
  {
    key: "columns",
    type: "columns",
    group: "layout",
    icon: "columns",
    make: (l) => ({
      id: newId(),
      type: "columns",
      items: copy[l].col.map((h) => ({ heading: h, text: copy[l].colText })),
    }),
  },
  {
    key: "hero",
    type: "hero",
    group: "layout",
    icon: "hero-headline",
    make: (l) => ({ id: newId(), type: "hero", text: copy[l].hero, align: "start" }),
  },
  // Galleries
  { key: "grid", type: "gallery", group: "galleries", icon: "grid", make: (l) => gallery("grid", l) },
  { key: "masonry", type: "gallery", group: "galleries", icon: "masonry", make: (l) => gallery("masonry", l) },
  { key: "slider", type: "gallery", group: "galleries", icon: "slider", make: (l) => gallery("slider", l) },
  // Media
  {
    key: "image",
    type: "image",
    group: "media",
    icon: "image",
    make: () => ({ id: newId(), type: "image", mediaId: null, tone: "#5B3A2E", caption: "", fullWidth: false }),
  },
  {
    key: "video",
    type: "video",
    group: "media",
    icon: "video-4k",
    make: () => ({ id: newId(), type: "video", url: "", caption: "" }),
  },
  {
    key: "loop",
    type: "loop",
    group: "media",
    icon: "loop-gif",
    make: () => ({ id: newId(), type: "loop", mediaId: null, caption: "" }),
  },
  {
    key: "beforeAfter",
    type: "before-after",
    group: "media",
    icon: "before-after",
    make: (l) => ({
      id: newId(),
      type: "before-after",
      beforeId: null,
      afterId: null,
      beforeLabel: copy[l].before,
      afterLabel: copy[l].after,
    }),
  },
  {
    key: "pdf",
    type: "pdf",
    group: "media",
    icon: "pdf",
    make: (l) => ({ id: newId(), type: "pdf", mediaId: null, label: copy[l].pdf }),
  },
  // Get hired
  {
    key: "reel",
    type: "reel",
    group: "hire",
    icon: "reel",
    fannan: true,
    make: (l) => ({ id: newId(), type: "reel", url: "", mediaId: null, title: copy[l].reel, tone: "#2A2622" }),
  },
  {
    key: "credits",
    type: "credits",
    group: "hire",
    icon: "credits",
    fannan: true,
    make: (l) => ({
      id: newId(),
      type: "credits",
      heading: copy[l].credits,
      items: [{ year: String(new Date().getFullYear()), title: "", role: "", studio: "" }],
    }),
  },
  {
    key: "logos",
    type: "logos",
    group: "hire",
    icon: "logo-wall",
    fannan: true,
    make: (l) => ({ id: newId(), type: "logos", heading: copy[l].logos, items: [{ name: "Studio", mediaId: null }] }),
  },
  {
    key: "about",
    type: "about",
    group: "hire",
    icon: "about-cv",
    make: (l) => ({
      id: newId(),
      type: "about",
      heading: copy[l].about,
      text: copy[l].aboutText,
      photoId: null,
      cvId: null,
    }),
  },
  {
    key: "contact",
    type: "contact",
    group: "hire",
    icon: "contact-form",
    make: (l) => ({
      id: newId(),
      type: "contact",
      heading: copy[l].contact,
      text: copy[l].contactText,
      button: copy[l].send,
    }),
  },
  {
    key: "hire",
    type: "hire",
    group: "hire",
    icon: "hire-me-badge",
    fannan: true,
    make: (l) => ({ id: newId(), type: "hire", text: copy[l].hire }),
  },
  {
    key: "social",
    type: "social",
    group: "hire",
    icon: "social-links",
    make: () => ({ id: newId(), type: "social", links: [{ network: "instagram", url: "" }] }),
  },
  {
    key: "quote",
    type: "quote",
    group: "hire",
    icon: "quote",
    make: (l) => ({ id: newId(), type: "quote", text: copy[l].quote, author: copy[l].author }),
  },
];

export const blockGroups: BlockGroup[] = ["freeform", "layout", "galleries", "media", "hire"];

/* ---------- the library as artists see it (Carbonmade-style list of real previews) ---------- */

const DESIGN_ICONS: Record<DesignKey, IconName> = {
  "d-cover": "fullscreen-cover",
  "d-title": "hero-headline",
  "d-statement": "hero-headline",
  "d-info": "text",
  "d-long-text": "text",
  "d-project-info": "columns",
  "d-resume": "columns",
  "d-image-caption": "image",
  "d-grid-4": "grid",
  "d-two-images": "columns",
  "d-headline-image": "image",
  "d-split-headline": "columns",
  "d-brand-pair": "columns",
  "d-big-type": "hero-headline",
  "d-collage": "masonry",
  "d-about": "about-cv",
  "d-contact-me": "contact-form",
  "d-logo-wall": "logo-wall",
};

export const designKinds: BlockKind[] = (Object.keys(DESIGN_ICONS) as DesignKey[]).map((key) => ({
  key,
  type: "free",
  group: "freeform",
  icon: DESIGN_ICONS[key],
  pro: plansConfig.proBlocks.keys.includes(key),
  make: (l) => designBlock(key, l),
}));
blockKinds.push(...designKinds);

export type LibraryGroup = "intro" | "work" | "images" | "text" | "about" | "media" | "blank";

/** What the library shows, in this order. Older block kinds still work on existing pages. */
export const LIBRARY: Array<{ group: LibraryGroup; keys: string[] }> = [
  { group: "intro", keys: ["d-cover", "d-title", "d-statement"] },
  { group: "work", keys: ["grid", "masonry", "slider"] },
  {
    group: "images",
    keys: ["d-image-caption", "d-grid-4", "d-two-images", "d-headline-image", "d-split-headline", "d-brand-pair", "d-big-type", "d-collage"],
  },
  { group: "text", keys: ["d-info", "d-long-text", "d-project-info", "d-resume", "quote"] },
  { group: "about", keys: ["d-about", "d-contact-me", "contact", "hire", "social", "credits", "d-logo-wall"] },
  { group: "media", keys: ["reel", "video", "loop", "beforeAfter", "pdf"] },
  { group: "blank", keys: ["free-blank"] },
];

export const kindByKey = (key: string) => blockKinds.find((k) => k.key === key);

/** Is this block on the page one of the Pro showpieces? */
export const isProBlock = (b: Block) =>
  b.type === "free" && !!b.design && plansConfig.proBlocks.keys.includes(b.design);

/** The catalogue entry for a block on the page (galleries map back to their layout). */
export function kindOf(b: Block): BlockKind {
  if (b.type === "free" && b.design) return blockKinds.find((k) => k.key === b.design) ?? blockKinds[0];
  if (b.type === "gallery") return blockKinds.find((k) => k.key === (b.layout === "fullscreen" ? "grid" : b.layout))!;
  return blockKinds.find((k) => k.type === b.type)!;
}

export const SOCIAL_NETWORKS = [
  "instagram",
  "artstation",
  "behance",
  "linkedin",
  "youtube",
  "vimeo",
  "x",
  "tiktok",
  "facebook",
  "website",
];

/** True when the about text was changed from the starter wording (for the Get-hired checklist). */
export function aboutWritten(pages: { blocks: Block[] }[]): boolean {
  const starters = [copy.en.aboutText, copy.ar.aboutText];
  return pages.some((p) =>
    p.blocks.some(
      (b) =>
        b.type === "about" &&
        b.text.trim().length > 40 &&
        !starters.includes(b.text.trim()) &&
        !/Write a few lines|اكتب بضعة أسطر/.test(b.text),
    ),
  );
}
