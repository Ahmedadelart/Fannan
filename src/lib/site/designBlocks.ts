// The design blocks in the editor's library (phase 8, round 3): ready-made sections in the spirit of
// Carbonmade's block list, built from free-form elements so every piece can be moved, resized and
// turned on the page. A few showpiece ones are Pro (config/plans.json → proBlocks).
import type { Locale } from "@/i18n/locales";
import { freeItem } from "./free";
import { newId } from "./ids";
import { decoDefaults, defaultDeco } from "./deco";
import { sectionStyle } from "./style";
import { sampleTone } from "./samples";
import type { Block, FreeDeco, FreeItem, FreeKind, FreePlace, SectionStyle } from "./types";

export type DesignKey =
  | "d-cover"
  | "d-title"
  | "d-statement"
  | "d-info"
  | "d-long-text"
  | "d-project-info"
  | "d-resume"
  | "d-image-caption"
  | "d-grid-4"
  | "d-two-images"
  | "d-headline-image"
  | "d-split-headline"
  | "d-brand-pair"
  | "d-big-type"
  | "d-collage"
  | "d-about"
  | "d-contact-me"
  | "d-logo-wall"
  // Round 7 (inspired by Jackie Droujko's site):
  | "d-hero-split"
  | "d-hero-photo"
  | "d-about-circle"
  | "d-cta-banner"
  | "d-before-after";

const W = {
  en: {
    cover: "GRAPHIC DESIGN",
    by: "by Your Name",
    title: "Selected work",
    intro: "A little intro text",
    statement: "Work with a story behind it.",
    info: "The idea",
    infoText:
      "Use this block for a short note about you or a project. To change the words, just click right here.\n\nTIP: duplicate this block to build a longer layout.",
    long:
      "Tell the story of this piece: the brief, the idea, how you made it and what came out of it. A few honest lines help the people who hire understand how you think.\n\nClick anywhere in this text to edit it.",
    metaLabels: "PROJECT\nClient name\n\nROLE\nArt direction\n\nYEAR\n2026",
    metaText:
      "Describe the project: what was asked, what you did, the tools and the team. Keep it short and specific; details like the client and your role are what studios look for first.",
    resume: [
      ["Work history", "Studio name\n2023 – now\n\nAgency name\n2020 – 2023"],
      ["Selected clients", "Client one\nClient two\nClient three"],
      ["Awards", "Award name, 2025\nFestival, 2024"],
      ["Contact", "you@email.com\nInstagram\nLinkedIn"],
    ],
    caption: "Project title · a short caption about this image",
    headline: "A headline\nfor your *work*",
    description: "A short description of the work.",
    big: "DRAW.",
    about: "Your Name",
    aboutText: "A few lines about you: what you do, where you are, and the kind of work you’d love to do next.",
    contactTitle: "Let's make something *together*",
    contactText: "hello@yourname.com",
    clients: "Studios I've worked with",
    selected: "Selected work",
    heroName: "Your Name",
    heroRole: "Character designer\n& *animator*",
    heroText: "I design characters and tell stories for film, TV and games.",
    heroButton: "See my work",
    photoTitle: "STORIES WITH\n*CHARACTER*",
    hi: "Hi, I'm *Your Name*",
    hiText: "A few lines about you: what you make, where you're based, and the studios you've worked with.",
    more: "More about me",
    cta: "Want to work *together*?",
    ctaText: "For character design, collaborations or teaching, write to me.",
    ctaButton: "Get in touch",
    before: "Before",
    after: "After",
    challenge: "Object → *Character*",
    eyebrowWork: "PORTFOLIO · 2026",
    eyebrowAbout: "ABOUT ME",
    eyebrowProject: "THE PROJECT",
    eyebrowStory: "THE STORY",
    eyebrowContact: "SAY HELLO",
    eyebrowClients: "TRUSTED BY",
    eyebrowProcess: "THE PROCESS",
    story: "How it was made",
    experience: "Experience",
    projectTitle: "Project title",
    meta: [
      ["CLIENT", "Studio name"],
      ["ROLE", "Art direction"],
      ["YEAR", "2026"],
    ],
    imageTitle: "Project title",
    contactMore: "Based in Cairo · open to remote work",
  },
  ar: {
    cover: "تصميم جرافيك",
    by: "بقلم اسمك",
    title: "أعمال مختارة",
    intro: "مقدمة قصيرة",
    statement: "أعمال وراءها حكاية.",
    info: "الفكرة",
    infoText: "استخدم هذا القسم لنبذة قصيرة عنك أو عن مشروع. لتغيير الكلمات اضغط هنا مباشرة.\n\nنصيحة: كرّر هذا القسم لتبني تصميمًا أطول.",
    long: "احكِ قصة هذا العمل: المطلوب، والفكرة، وكيف صنعته، وما الذي نتج عنه. بضعة أسطر صادقة تساعد من يوظّفون على فهم طريقة تفكيرك.\n\nاضغط في أي مكان من النص لتعديله.",
    metaLabels: "المشروع\nاسم العميل\n\nالدور\nإدارة فنية\n\nالسنة\n٢٠٢٦",
    metaText: "صف المشروع: ما الذي طُلب، وما الذي فعلته، والأدوات والفريق. اجعله قصيرًا ومحددًا؛ فالعميل ودورك أول ما تبحث عنه الاستوديوهات.",
    resume: [
      ["الخبرات", "اسم الاستوديو\n٢٠٢٣ – الآن\n\nاسم الوكالة\n٢٠٢٠ – ٢٠٢٣"],
      ["عملاء مختارون", "العميل الأول\nالعميل الثاني\nالعميل الثالث"],
      ["جوائز", "اسم الجائزة، ٢٠٢٥\nمهرجان، ٢٠٢٤"],
      ["تواصل", "you@email.com\nإنستجرام\nلينكدإن"],
    ],
    caption: "اسم المشروع · وصف قصير لهذه الصورة",
    headline: "عنوان كبير\nيليق *بعملك*",
    description: "وصف قصير للعمل.",
    big: "ارسم.",
    about: "اسمك",
    aboutText: "بضعة أسطر عنك: ما تعمله، وأين أنت، ونوع الأعمال التي تحب أن تعملها بعد ذلك.",
    contactTitle: "تعال نصنع شيئًا *معًا*",
    contactText: "hello@yourname.com",
    clients: "استوديوهات عملت معها",
    selected: "أعمال مختارة",
    heroName: "اسمك",
    heroRole: "مصمم شخصيات\nو*محرّك*",
    heroText: "أصمم الشخصيات وأحكي القصص للأفلام والتلفزيون والألعاب.",
    heroButton: "شاهد أعمالي",
    photoTitle: "حكايات\n*بشخصيات*",
    hi: "أهلًا، أنا *اسمك*",
    hiText: "بضعة أسطر عنك: ماذا تصنع، وأين أنت، والاستوديوهات التي عملت معها.",
    more: "المزيد عني",
    cta: "هل نعمل *معًا*؟",
    ctaText: "لتصميم الشخصيات أو التعاون أو التدريس، راسلني.",
    ctaButton: "تواصل معي",
    before: "قبل",
    after: "بعد",
    challenge: "شيء ← *شخصية*",
    eyebrowWork: "معرض الأعمال · ٢٠٢٦",
    eyebrowAbout: "عني",
    eyebrowProject: "المشروع",
    eyebrowStory: "الحكاية",
    eyebrowContact: "قل مرحبًا",
    eyebrowClients: "عملت مع",
    eyebrowProcess: "طريقة العمل",
    story: "كيف صنعته",
    experience: "الخبرات",
    projectTitle: "اسم المشروع",
    meta: [
      ["العميل", "اسم الاستوديو"],
      ["الدور", "إدارة فنية"],
      ["السنة", "٢٠٢٦"],
    ],
    imageTitle: "اسم المشروع",
    contactMore: "مقيم في القاهرة · متاح للعمل عن بُعد",
  },
};

/** The sample words, so the guided setup can swap them for the artist's own (round 8). */
export const designWords = W;

// Sample drawings (public/samples) in a pleasing order for side-by-side pictures.
const TONES = [1, 5, 11, 2, 12, 14, 6, 10].map((n) => sampleTone(n - 1));

export function designBlock(key: DesignKey, language: Locale): Extract<Block, { type: "free" }> {
  const w = W[language];
  let z = 0;
  const el = (kind: FreeKind, place: FreePlace, extra: Partial<FreeItem> = {}) =>
    freeItem(kind, language, place, { z: ++z, ...extra });
  const img = (place: FreePlace, n: number, extra: Partial<FreeItem> = {}) => el("image", place, { tone: TONES[n % TONES.length], ...extra });
  const heading = (place: FreePlace, text: string, size: number, extra: Partial<FreeItem> = {}) =>
    el("heading", place, { text, size, ...extra });
  const text = (place: FreePlace, value: string, size = 18, extra: Partial<FreeItem> = {}) =>
    el("text", place, { text: value, size, ...extra });
  const P = (x: number, y: number, wd: number, h: number): FreePlace => ({ x, y, w: wd, h });
  // Decorations with their own drawing options (round 7).
  const dec = (kind: FreeKind, place: FreePlace, deco: Partial<FreeDeco> = {}, extra: Partial<FreeItem> = {}) =>
    el(kind, place, { deco: { ...defaultDeco(), ...decoDefaults(kind), ...deco }, ...extra });
  let style: SectionStyle | undefined;

  let rows = 12;
  let items: FreeItem[] = [];
  let background: string | null = null;
  // Round 12 design pass: big confident type, small uppercase labels above headings, large
  // pictures on a clear grid, generous space (inspired by Carbonmade and Squarespace).
  const eyebrow = (place: FreePlace, value: string, extra: Partial<FreeItem> = {}) =>
    text(place, value, 13, { weight: 700, upper: true, tracking: 18, opacity: 65, ...extra });
  switch (key) {
    case "d-cover":
      background = "#1E1E22";
      items = [
        img(P(0, 0, 24, 18), 1, { opacity: 70 }),
        eyebrow(P(2, 7, 10, 1), w.eyebrowWork, { color: "#FFFFFF", opacity: 80 }),
        heading(P(2, 8, 20, 6), w.cover, 128, { color: "#FFFFFF", lineHeight: 92 }),
        text(P(2, 14, 12, 2), w.by, 30, { color: "#FFFFFF", opacity: 85 }),
      ];
      rows = 18;
      break;
    case "d-title":
      items = [
        eyebrow(P(6, 2, 12, 1), w.eyebrowWork, { align: "center" }),
        heading(P(1, 3, 22, 4), w.title, 120, { align: "center", lineHeight: 95 }),
        dec("underline", P(9, 7, 6, 1), { style: "wave", amp: 55, freq: 5, stroke: 5 }, { hideOnPhone: true }),
        text(P(6, 8, 12, 2), w.intro, 20, { align: "center", opacity: 80 }),
      ];
      rows = 11;
      break;
    case "d-statement":
      items = [
        eyebrow(P(6, 2, 12, 1), w.eyebrowAbout, { align: "center" }),
        heading(P(1, 3, 22, 6), w.statement, 112, { align: "center", lineHeight: 95 }),
        dec("underline", P(8, 9, 8, 1), { style: "scribble", amp: 60, freq: 4, stroke: 6 }),
      ];
      rows = 11;
      style = sectionStyle({ bg: { kind: "gradient", color: "#FFF4D6", color2: "#FFFFFF" }, padTop: 40, padBottom: 40 });
      break;
    case "d-info":
      items = [
        eyebrow(P(1, 1, 8, 1), w.eyebrowProject),
        heading(P(1, 2, 9, 4), w.info, 64, { lineHeight: 100 }),
        text(P(12, 2, 11, 6), w.infoText, 20, { lineHeight: 170 }),
      ];
      rows = 9;
      break;
    case "d-long-text":
      items = [
        eyebrow(P(5, 1, 14, 1), w.eyebrowStory),
        heading(P(5, 2, 14, 2), w.story, 56),
        text(P(5, 5, 14, 8), w.long, 20, { lineHeight: 175 }),
      ];
      rows = 13;
      break;
    case "d-project-info":
      items = [
        eyebrow(P(1, 1, 10, 1), w.eyebrowProject),
        heading(P(1, 2, 11, 3), w.projectTitle, 72, { lineHeight: 95 }),
        ...w.meta.flatMap(([label, value], i) => [
          eyebrow(P(1 + i * 4, 6, 4, 1), label),
          text(P(1 + i * 4, 7, 4, 1), value, 18, { weight: 600 }),
        ]),
        text(P(14, 2, 9, 7), w.metaText, 20, { lineHeight: 170 }),
      ];
      rows = 10;
      break;
    case "d-resume":
      items = [
        eyebrow(P(1, 1, 10, 1), w.eyebrowAbout),
        heading(P(1, 2, 12, 2), w.experience, 64),
        ...w.resume.flatMap(([h, body], i) => [
          eyebrow(P(1 + i * 6, 6, 5, 1), h, { opacity: 90 }),
          el("divider", P(1 + i * 6, 7, 5, 1), { deco: { ...defaultDeco(), ...decoDefaults("divider"), style: "solid", stroke: 1 } }),
          text(P(1 + i * 6, 8, 5, 6), body, 17, { lineHeight: 170 }),
        ]),
      ];
      rows = 14;
      break;
    case "d-image-caption":
      items = [img(P(0, 0, 24, 14), 2), heading(P(0, 15, 12, 1), w.imageTitle, 24), text(P(0, 16, 14, 2), w.caption, 16, { opacity: 75 })];
      rows = 18;
      break;
    case "d-grid-4":
      items = [img(P(0, 0, 12, 10), 0), img(P(12, 0, 12, 10), 1), img(P(0, 10, 12, 10), 2), img(P(12, 10, 12, 10), 3)];
      rows = 20;
      break;
    case "d-two-images":
      items = [
        img(P(0, 0, 11, 14), 4),
        img(P(13, 0, 11, 14), 5),
        heading(P(0, 15, 11, 1), w.imageTitle, 24),
        heading(P(13, 15, 11, 1), w.imageTitle, 24),
        text(P(0, 16, 10, 2), w.description, 16, { opacity: 75 }),
        text(P(13, 16, 10, 2), w.description, 16, { opacity: 75 }),
      ];
      rows = 18;
      break;
    case "d-headline-image":
      items = [
        eyebrow(P(1, 4, 10, 1), w.eyebrowProject),
        heading(P(1, 5, 11, 4), w.headline, 72, { lineHeight: 95 }),
        text(P(1, 9, 10, 2), w.description, 19, { opacity: 80 }),
        el("button", P(1, 12, 5, 2), { text: w.heroButton, link: "/", deco: { ...defaultDeco(), arrow: true } }),
        img(P(13, 0, 11, 17), 6),
      ];
      rows = 17;
      break;
    case "d-split-headline":
      items = [
        img(P(0, 0, 12, 17), 7),
        eyebrow(P(14, 5, 9, 1), w.eyebrowProcess),
        heading(P(14, 6, 10, 4), w.headline, 64, { lineHeight: 95 }),
        text(P(14, 10, 9, 3), w.description, 19, { opacity: 80 }),
      ];
      rows = 17;
      break;
    case "d-brand-pair":
      items = [
        img(P(0, 0, 12, 13), 3, { fit: "contain" }),
        img(P(12, 0, 12, 13), 0),
        eyebrow(P(0, 14, 10, 1), w.imageTitle),
        eyebrow(P(12, 14, 10, 1), w.imageTitle),
      ];
      rows = 15;
      break;
    case "d-big-type":
      items = [
        img(P(13, 0, 9, 14), 2, { z: 1 }),
        heading(P(0, 3, 24, 7), w.big, 260, { z: 2, lineHeight: 85 }),
        text(P(1, 11, 9, 2), w.description, 19, { z: 3, opacity: 80 }),
      ];
      rows = 14;
      break;
    case "d-collage":
      items = [
        img(P(0, 1, 10, 12), 0, { rotate: -4 }),
        img(P(8, 4, 9, 11), 2, { rotate: 3 }),
        img(P(16, 0, 8, 10), 3, { rotate: -2 }),
        eyebrow(P(15, 11, 9, 1), w.eyebrowWork),
        heading(P(15, 12, 9, 3), w.selected, 72, { lineHeight: 95 }),
      ];
      rows = 16;
      break;
    case "d-about":
      items = [
        img(P(1, 0, 9, 12), 5, { deco: { ...defaultDeco(), mask: "arch", backdrop: "blob" } }),
        eyebrow(P(12, 2, 10, 1), w.eyebrowAbout),
        heading(P(12, 3, 11, 2), w.about, 64),
        dec("underline", P(12, 5, 6, 1), { style: "wave", amp: 50, freq: 4, stroke: 5 }, { hideOnPhone: true }),
        text(P(12, 6, 11, 4), w.aboutText, 20, { lineHeight: 165 }),
        el("button", P(12, 10, 5, 2), { text: w.more, link: "/about", variant: "outline" }),
      ];
      rows = 13;
      break;
    case "d-contact-me":
      items = [
        eyebrow(P(6, 1, 12, 1), w.eyebrowContact, { align: "center", color: "#1A1C16", opacity: 75 }),
        heading(P(2, 2, 20, 5), w.contactTitle, 84, { align: "center", color: "#1A1C16", lineHeight: 95 }),
        el("button", P(8, 8, 8, 2), { text: w.contactText, link: "mailto:hello@yourname.com", fill: "#1A1C16", color: "#FFFFFF", size: 20 }),
        text(P(6, 11, 12, 1), w.contactMore, 16, { align: "center", color: "#1A1C16", opacity: 75 }),
      ];
      rows = 13;
      style = sectionStyle({
        bg: { kind: "color", color: "#FF8A3D" },
        edgeTop: { shape: "wave", height: 50, flip: false },
        edgeBottom: { shape: "wave", height: 50, flip: true },
        padTop: 48,
        padBottom: 48,
        text: "#1A1C16",
      });
      break;
    case "d-logo-wall":
      items = [
        eyebrow(P(6, 1, 12, 1), w.eyebrowClients, { align: "center" }),
        heading(P(3, 2, 18, 2), w.clients, 48, { align: "center" }),
        ...[0, 1, 2, 3, 4, 5].map((n) => img(P(1 + (n % 3) * 8, 5 + Math.floor(n / 3) * 5, 6, 4), n, { fit: "contain", radius: 16 })),
      ];
      rows = 15;
      break;
    case "d-hero-split":
      items = [
        heading(P(1, 3, 11, 2), w.heroName, 26),
        heading(P(1, 5, 12, 5), w.heroRole, 80, { lineHeight: 95 }),
        text(P(1, 10, 10, 2), w.heroText, 19, { opacity: 85 }),
        el("button", P(1, 13, 5, 2), { text: w.heroButton, link: "/", deco: { ...defaultDeco(), arrow: true } }),
        dec("arrow", P(6, 12, 4, 3), { style: "curved", curve: -60, stroke: 5 }, { flipX: false } as Partial<FreeItem>),
        img(P(14, 1, 9, 15), 9, { deco: { ...defaultDeco(), mask: "arch", backdrop: "blob" } }),
        dec("doodle", P(13, 1, 2, 2), { style: "sparkle" }),
        dec("doodle", P(21, 14, 2, 2), { style: "sparkle", filled: false, stroke: 4 }),
      ];
      rows = 17;
      style = sectionStyle({ bg: { kind: "gradient", color: "#FFF4D6", color2: "#FFFFFF" }, padTop: 24, padBottom: 24 });
      break;
    case "d-hero-photo":
      items = [
        img(P(0, 0, 24, 16), 0, { opacity: 100 }),
        el("shape", P(0, 0, 24, 16), { fill: "#000000", opacity: 40, z: 2 } as Partial<FreeItem>),
        eyebrow(P(2, 5, 10, 1), w.eyebrowWork, { color: "#FFFFFF", opacity: 85, z: 3 }),
        heading(P(2, 6, 18, 6), w.photoTitle, 112, { color: "#FFFFFF", z: 3, lineHeight: 92, deco: { ...defaultDeco(), textShadow: true } }),
        el("button", P(2, 13, 5, 2), { text: w.heroButton, link: "/", z: 4, deco: { ...defaultDeco(), arrow: true } }),
      ];
      rows = 16;
      style = sectionStyle({ width: "full", padTop: 0, padBottom: 0 });
      break;
    case "d-about-circle":
      items = [
        img(P(2, 1, 8, 8), 13, { deco: { ...defaultDeco(), mask: "circle", backdrop: "circle" } }),
        dec("doodle", P(1, 1, 2, 2), { style: "sparkle" }),
        eyebrow(P(12, 1, 10, 1), w.eyebrowAbout),
        heading(P(12, 2, 11, 2), w.hi, 56),
        dec("underline", P(12, 4, 6, 1), { style: "wave", amp: 55, freq: 5, stroke: 4 }, { hideOnPhone: true }),
        text(P(12, 5, 11, 3), w.hiText, 19, { lineHeight: 165 }),
        el("button", P(12, 8, 5, 2), { text: w.more, link: "/about", variant: "outline" }),
      ];
      rows = 11;
      break;
    case "d-cta-banner":
      items = [
        heading(P(1, 1, 14, 3), w.cta, 56, { lineHeight: 100 }),
        text(P(1, 4, 13, 2), w.ctaText, 19, { opacity: 80 }),
        el("button", P(17, 2, 6, 2), { text: w.ctaButton, link: "/contact", size: 18, deco: { ...defaultDeco(), arrow: true } }),
      ];
      rows = 7;
      style = sectionStyle({
        bg: { kind: "pattern", color: "#FFF4D6", pattern: "doodles", patternColor: "#D98A62", patternOpacity: 22 },
        card: { on: true, color: null, radius: 28, shadow: true, padding: 40 },
        padTop: 64,
        padBottom: 64,
      });
      break;
    case "d-before-after":
      items = [
        eyebrow(P(6, 0, 12, 1), w.eyebrowProcess, { align: "center" }),
        heading(P(3, 1, 18, 2), w.challenge, 56, { align: "center" }),
        img(P(0, 4, 10, 11), 5, { deco: { ...defaultDeco(), frame: "sticker" }, rotate: -2 }),
        dec("arrow", P(10, 8, 4, 3), { style: "curved", curve: 40, stroke: 6, head: "filled" }),
        img(P(14, 4, 10, 11), 12, { deco: { ...defaultDeco(), frame: "sticker" }, rotate: 2 }),
        eyebrow(P(0, 16, 10, 1), w.before, { align: "center", opacity: 90 }),
        eyebrow(P(14, 16, 10, 1), w.after, { align: "center", opacity: 90 }),
      ];
      rows = 17;
      break;
  }
  return { id: newId(), type: "free", rows, background, bgMediaId: null, items, design: key, ...(style ? { style } : {}) };
}
