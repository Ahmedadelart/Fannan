// The design blocks in the editor's library (phase 8, round 3): ready-made sections in the spirit of
// Carbonmade's block list, built from free-form elements so every piece can be moved, resized and
// turned on the page. A few showpiece ones are Pro (config/plans.json → proBlocks).
import type { Locale } from "@/i18n/locales";
import { freeItem } from "./free";
import { newId } from "./ids";
import { sampleTone } from "./samples";
import type { Block, FreeItem, FreeKind, FreePlace } from "./types";

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
  | "d-logo-wall";

const W = {
  en: {
    cover: "GRAPHIC DESIGN",
    by: "by Your Name",
    title: "YOUR TITLE",
    intro: "A little intro text",
    statement: "Work with a story behind it.",
    info: "INFO",
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
    headline: "YOUR HEADLINE",
    description: "A short description of the work.",
    big: "CUT",
    about: "Your Name",
    aboutText: "A few lines about you: what you do, where you are, and the kind of work you’d love to do next.",
    contactTitle: "CONTACT ME",
    contactText: "Your Name\nWhat you do\nYour city\nyou@email.com",
    clients: "SELECTED CLIENTS",
    selected: "Selected work",
  },
  ar: {
    cover: "تصميم جرافيك",
    by: "بقلم اسمك",
    title: "عنوانك",
    intro: "مقدمة قصيرة",
    statement: "أعمال وراءها حكاية.",
    info: "معلومات",
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
    headline: "عنوانك هنا",
    description: "وصف قصير للعمل.",
    big: "قص",
    about: "اسمك",
    aboutText: "بضعة أسطر عنك: ما تعمله، وأين أنت، ونوع الأعمال التي تحب أن تعملها بعد ذلك.",
    contactTitle: "تواصل معي",
    contactText: "اسمك\nما تعمله\nمدينتك\nyou@email.com",
    clients: "عملاء مختارون",
    selected: "أعمال مختارة",
  },
};

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

  let rows = 12;
  let items: FreeItem[] = [];
  let background: string | null = null;
  switch (key) {
    case "d-cover":
      background = "#1E1E22";
      items = [
        img(P(0, 0, 24, 18), 1, { opacity: 70 }),
        heading(P(2, 9, 16, 5), w.cover, 110, { color: "#FFFFFF" }),
        text(P(2, 14, 10, 2), w.by, 30),
      ];
      rows = 18;
      break;
    case "d-title":
      items = [heading(P(3, 2, 18, 3), w.title, 64, { align: "center" }), text(P(6, 5, 12, 2), w.intro, 20, { align: "center" })];
      rows = 8;
      break;
    case "d-statement":
      items = [heading(P(2, 2, 20, 5), w.statement, 96, { align: "center" }), el("line", P(9, 8, 6, 1))];
      rows = 10;
      break;
    case "d-info":
      items = [heading(P(1, 1, 6, 2), w.info, 44), text(P(8, 1, 15, 5), w.infoText, 20)];
      rows = 7;
      break;
    case "d-long-text":
      items = [text(P(4, 1, 16, 8), w.long, 20)];
      rows = 10;
      break;
    case "d-project-info":
      items = [text(P(1, 1, 5, 8), w.metaLabels, 14), text(P(8, 1, 15, 6), w.metaText, 20)];
      rows = 10;
      break;
    case "d-resume":
      items = w.resume.flatMap(([h, body], i) => [
        heading(P(1 + i * 6, 1, 5, 1), h, 16),
        text(P(1 + i * 6, 3, 5, 6), body, 14),
      ]);
      rows = 10;
      break;
    case "d-image-caption":
      items = [img(P(0, 0, 24, 13), 2), text(P(3, 14, 18, 2), w.caption, 15, { align: "center" })];
      rows = 16;
      break;
    case "d-grid-4":
      items = [img(P(0, 0, 12, 9), 0), img(P(12, 0, 12, 9), 1), img(P(0, 9, 12, 9), 2), img(P(12, 9, 12, 9), 3)];
      rows = 18;
      break;
    case "d-two-images":
      items = [
        img(P(1, 0, 10, 12), 4),
        img(P(13, 0, 10, 12), 5),
        heading(P(1, 13, 10, 1), w.headline, 18, { align: "center" }),
        heading(P(13, 13, 10, 1), w.headline, 18, { align: "center" }),
        text(P(2, 15, 8, 2), w.description, 14, { align: "center" }),
        text(P(14, 15, 8, 2), w.description, 14, { align: "center" }),
      ];
      rows = 18;
      break;
    case "d-headline-image":
      items = [
        heading(P(2, 5, 10, 2), w.headline, 30, { align: "center" }),
        text(P(3, 7, 8, 2), w.description, 16, { align: "center" }),
        img(P(14, 1, 8, 11), 6),
      ];
      rows = 13;
      break;
    case "d-split-headline":
      items = [
        heading(P(1, 5, 9, 2), w.headline, 34, { align: "center" }),
        text(P(2, 7, 7, 3), w.description, 16, { align: "center" }),
        img(P(12, 0, 12, 14), 7),
      ];
      rows = 14;
      break;
    case "d-brand-pair":
      items = [img(P(0, 0, 12, 12), 3, { fit: "contain" }), img(P(12, 0, 12, 12), 0)];
      rows = 12;
      break;
    case "d-big-type":
      items = [img(P(11, 1, 8, 12), 2, { z: 1 }), heading(P(1, 4, 16, 6), w.big, 220, { z: 2 })];
      rows = 14;
      break;
    case "d-collage":
      items = [
        img(P(1, 1, 9, 11), 0, { rotate: -4 }),
        img(P(8, 4, 9, 10), 2, { rotate: 3 }),
        img(P(15, 0, 8, 9), 3, { rotate: -2 }),
        heading(P(14, 11, 10, 3), w.selected, 56),
      ];
      rows = 15;
      break;
    case "d-about":
      items = [
        img(P(3, 1, 5, 5), 5, { radius: 999 }),
        heading(P(9, 1, 12, 2), w.about, 34),
        text(P(9, 3, 12, 3), w.aboutText, 17),
      ];
      rows = 7;
      break;
    case "d-contact-me":
      items = [
        heading(P(7, 1, 10, 1), w.contactTitle, 16, { align: "center" }),
        text(P(7, 3, 10, 4), w.contactText, 16, { align: "center" }),
      ];
      rows = 8;
      break;
    case "d-logo-wall":
      items = [
        heading(P(7, 1, 10, 1), w.clients, 14, { align: "center" }),
        ...[0, 1, 2, 3, 4, 5].map((n) => img(P(3 + (n % 3) * 6, 3 + Math.floor(n / 3) * 4, 6, 3), n, { fit: "contain" })),
      ];
      rows = 11;
      break;
  }
  return { id: newId(), type: "free", rows, background, bgMediaId: null, items, design: key };
}
