// Card sections (round 7): repeating content in one structured section with variants — a feature
// row with icons, image cards, stats, FAQ, an image mosaic with a button, in-page navigation, and the
// Pro showpieces (logo marquee, testimonials, timeline, press, films, offers). Inspired by the kinds
// of sections on Jackie Droujko's site. Each library entry is a key ("c-…") kept on the block, so Pro
// rules work like the free-form showpieces.
import type { Locale } from "@/i18n/locales";
import { newId } from "./ids";
import { sampleTone } from "./samples";
import type { Block, CardItem, CardVariant } from "./types";

export type CardKey =
  | "c-icons"
  | "c-cards"
  | "c-stats"
  | "c-faq"
  | "c-mosaic"
  | "c-nav"
  | "c-marquee"
  | "c-testimonials"
  | "c-timeline"
  | "c-press"
  | "c-films"
  | "c-offers";

export const CARD_VARIANT: Record<CardKey, CardVariant> = {
  "c-icons": "icons",
  "c-cards": "images",
  "c-stats": "stats",
  "c-faq": "faq",
  "c-mosaic": "mosaic",
  "c-nav": "nav",
  "c-marquee": "marquee",
  "c-testimonials": "testimonials",
  "c-timeline": "timeline",
  "c-press": "press",
  "c-films": "films",
  "c-offers": "offers",
};

export function cardItem(extra: Partial<CardItem> = {}): CardItem {
  return {
    title: "",
    text: "",
    meta: "",
    icon: "sparkle",
    mediaId: null,
    tone: sampleTone(0),
    link: "",
    button: "",
    stars: 0,
    price: "",
    url: "",
    ...extra,
  };
}

const W = {
  en: {
    icons: {
      heading: "What I do",
      items: [
        ["brush", "Character design", "Shapes, silhouettes and personalities that fit the story."],
        ["film", "Animation", "Keys, roughs and acting that make characters feel alive."],
        ["pen", "Storyboards", "Clear shots and staging that tell the story quickly."],
        ["book", "Teaching", "Workshops and mentoring for artists who want to grow."],
      ],
    },
    cards: {
      heading: "Learn from me",
      items: [
        ["Workshops", "Small live classes on character design.", "Find out more"],
        ["Mentorship", "One-to-one feedback on your portfolio.", "Apply"],
        ["Tutorials", "Step-by-step guides you can follow anytime.", "Browse"],
      ],
    },
    stats: { heading: "", items: [["12+", "years in animation"], ["40", "productions"], ["120+", "students mentored"], ["8", "short films"]] },
    faq: {
      heading: "Frequently asked questions",
      items: [
        ["Are you available for freelance work?", "Yes. Tell me about your project, timeline and budget through the contact form."],
        ["Which tools do you use?", "Mostly Photoshop, Procreate and Toon Boom Harmony."],
        ["Do you work with studios abroad?", "Yes, remotely, in English and Arabic."],
      ],
    },
    mosaic: { heading: "", button: "See more sketches" },
    nav: { items: [["Work", "work"], ["About", "about"], ["Contact", "contact"]] },
    marquee: { heading: "Studios I've worked with", items: ["Studio One", "Animation House", "Film Co.", "Kids TV", "Games Lab", "Story Works"] },
    testimonials: {
      heading: "What people say",
      items: [
        ["Mona Fathy", "Art director, Studio One", "Fast, thoughtful and a joy to work with. The characters were exactly right."],
        ["Karim Adel", "Producer, Animation House", "Brought our show to life with real personality."],
        ["Sara Nabil", "Student", "The feedback changed how I approach design."],
      ],
    },
    timeline: {
      heading: "How a character comes together",
      items: [
        ["Step 1", "Concepts", "Loose ideas, shapes and silhouettes."],
        ["Step 2", "Lineup", "Choosing the strongest direction."],
        ["Step 3", "Turnaround", "The character from every side."],
        ["Step 4", "Expressions", "Poses and faces that show who they are."],
      ],
    },
    press: {
      heading: "Publications & features",
      items: [
        ["The Art of My Characters", "Art book · 2026"],
        ["Character Design Quarterly", "Cover artist · Interview"],
        ["Animation Podcast", "Guest · Episode 42"],
      ],
    },
    films: {
      heading: "Watch my short films",
      items: [
        ["Night Market", "A short about a girl who sells stars. Written, directed and animated by me."],
        ["The Last Bus", "Two strangers and one very late bus."],
      ],
    },
    offers: {
      heading: "Ways to work together",
      items: [
        ["Character sheet", "From $400", "Turnaround\nThree expressions\nColour", "Book", ""],
        ["Full package", "From $1,200", "Everything in the sheet\nFive poses\nProps and costumes", "Book", "Popular"],
        ["Portfolio review", "$90", "One hour call\nWritten notes", "Book", ""],
      ],
    },
  },
  ar: {
    icons: {
      heading: "ما أقدمه",
      items: [
        ["brush", "تصميم الشخصيات", "أشكال وظلال وشخصيات تناسب القصة."],
        ["film", "الرسوم المتحركة", "حركة وأداء يجعلان الشخصيات تنبض بالحياة."],
        ["pen", "القصص المصورة", "لقطات واضحة تحكي القصة بسرعة."],
        ["book", "التدريس", "ورش عمل وإرشاد للفنانين الذين يريدون التطور."],
      ],
    },
    cards: {
      heading: "تعلّم معي",
      items: [
        ["ورش العمل", "دروس مباشرة صغيرة في تصميم الشخصيات.", "اعرف المزيد"],
        ["الإرشاد", "ملاحظات فردية على أعمالك.", "قدّم الآن"],
        ["الدروس", "شروحات خطوة بخطوة في أي وقت.", "تصفّح"],
      ],
    },
    stats: { heading: "", items: [["+١٢", "سنة في الرسوم المتحركة"], ["٤٠", "إنتاجًا"], ["+١٢٠", "طالبًا"], ["٨", "أفلام قصيرة"]] },
    faq: {
      heading: "أسئلة شائعة",
      items: [
        ["هل أنت متاح للعمل الحر؟", "نعم. أخبرني عن مشروعك وموعده وميزانيته من نموذج التواصل."],
        ["ما البرامج التي تستخدمها؟", "غالبًا فوتوشوب وبروكريت وتون بوم هارموني."],
        ["هل تعمل مع استوديوهات في الخارج؟", "نعم، عن بُعد، بالعربية والإنجليزية."],
      ],
    },
    mosaic: { heading: "", button: "شاهد المزيد من الاسكتشات" },
    nav: { items: [["الأعمال", "work"], ["نبذة", "about"], ["تواصل", "contact"]] },
    marquee: { heading: "استوديوهات عملت معها", items: ["استوديو واحد", "بيت الأنيميشن", "شركة أفلام", "تلفزيون الأطفال", "معمل الألعاب", "ورشة الحكايات"] },
    testimonials: {
      heading: "ماذا يقولون",
      items: [
        ["منى فتحي", "مديرة فنية، استوديو واحد", "سريع ومتأنٍ ومتعة في العمل. الشخصيات كانت كما أردنا تمامًا."],
        ["كريم عادل", "منتج، بيت الأنيميشن", "أعطى مسلسلنا روحًا حقيقية."],
        ["سارة نبيل", "طالبة", "ملاحظاته غيّرت طريقتي في التصميم."],
      ],
    },
    timeline: {
      heading: "كيف تكتمل الشخصية",
      items: [
        ["الخطوة ١", "أفكار", "أشكال وظلال أولية."],
        ["الخطوة ٢", "التشكيلة", "اختيار أقوى اتجاه."],
        ["الخطوة ٣", "الدوران", "الشخصية من كل الجهات."],
        ["الخطوة ٤", "التعبيرات", "وضعيات ووجوه تكشف من هي."],
      ],
    },
    press: {
      heading: "منشورات ومقابلات",
      items: [
        ["فن شخصياتي", "كتاب فني · ٢٠٢٦"],
        ["مجلة تصميم الشخصيات", "فنان الغلاف · مقابلة"],
        ["بودكاست الأنيميشن", "ضيف · الحلقة ٤٢"],
      ],
    },
    films: {
      heading: "شاهد أفلامي القصيرة",
      items: [
        ["سوق الليل", "فيلم قصير عن فتاة تبيع النجوم. كتابة وإخراج وتحريك."],
        ["آخر أتوبيس", "غريبان وأتوبيس متأخر جدًا."],
      ],
    },
    offers: {
      heading: "طرق العمل معي",
      items: [
        ["ورقة شخصية", "من ٤٠٠$", "دوران كامل\nثلاثة تعبيرات\nتلوين", "احجز", ""],
        ["الباقة الكاملة", "من ١٢٠٠$", "كل ما في الورقة\nخمس وضعيات\nإكسسوارات وأزياء", "احجز", "الأكثر طلبًا"],
        ["مراجعة الأعمال", "٩٠$", "مكالمة ساعة\nملاحظات مكتوبة", "احجز", ""],
      ],
    },
  },
};

export function cardsBlock(key: CardKey, language: Locale): Extract<Block, { type: "cards" }> {
  const w = W[language];
  const variant = CARD_VARIANT[key];
  let heading = "";
  let items: CardItem[] = [];
  let columns = 3;
  let button = "";
  switch (variant) {
    case "icons":
      heading = w.icons.heading;
      items = w.icons.items.map(([icon, title, text]) => cardItem({ icon, title, text }));
      columns = 4;
      break;
    case "images":
      heading = w.cards.heading;
      items = w.cards.items.map(([title, text, b], i) => cardItem({ title, text, button: b, tone: sampleTone(i + 2) }));
      break;
    case "stats":
      items = w.stats.items.map(([title, text]) => cardItem({ title, text }));
      columns = 4;
      break;
    case "faq":
      heading = w.faq.heading;
      items = w.faq.items.map(([title, text]) => cardItem({ title, text }));
      columns = 1;
      break;
    case "mosaic":
      items = Array.from({ length: 8 }, (_, i) => cardItem({ tone: sampleTone(i) }));
      button = w.mosaic.button;
      columns = 4;
      break;
    case "nav":
      items = w.nav.items.map(([title, link]) => cardItem({ title, link: `#${link}` }));
      break;
    case "marquee":
      heading = w.marquee.heading;
      items = w.marquee.items.map((title) => cardItem({ title }));
      break;
    case "testimonials":
      heading = w.testimonials.heading;
      items = w.testimonials.items.map(([title, meta, text], i) => cardItem({ title, meta, text, stars: 5, tone: sampleTone(i + 5) }));
      break;
    case "timeline":
      heading = w.timeline.heading;
      items = w.timeline.items.map(([meta, title, text], i) => cardItem({ meta, title, text, tone: sampleTone(i + 1) }));
      columns = 1;
      break;
    case "press":
      heading = w.press.heading;
      items = w.press.items.map(([title, meta]) => cardItem({ title, meta }));
      columns = 1;
      break;
    case "films":
      heading = w.films.heading;
      items = w.films.items.map(([title, text], i) => cardItem({ title, text, tone: sampleTone(i + 8) }));
      columns = 2;
      break;
    case "offers":
      heading = w.offers.heading;
      items = w.offers.items.map(([title, price, text, b, meta]) => cardItem({ title, price, text, button: b, meta }));
      break;
  }
  return {
    id: newId(),
    type: "cards",
    design: key,
    variant,
    heading,
    intro: "",
    columns,
    align: variant === "icons" || variant === "stats" ? "center" : "start",
    button,
    link: "",
    mediaId: null,
    tone: sampleTone(3),
    items,
  };
}
