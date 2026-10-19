/*
 * Ahmed's pages as they are on his current site (ahmedadel.art, Squarespace): same sections, same order,
 * same words (from the page captures in his folder), built from ordinary Fannan blocks.
 * Called by seed-site.ts after the projects exist.
 */

import { newId } from "@/lib/site/ids";
import { freeItem } from "@/lib/site/free";
import { sampleTone } from "@/lib/site/samples";
import { sectionStyle } from "@/lib/site/style";
import type { Block, FreeItem, FreePlace, PageDraft, SectionStyle } from "@/lib/site/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
type Lib = (spec: string, alt: string) => Promise<string>;
type LogoItems = (files: string[]) => Promise<Array<{ name: string; mediaId: string }>>;

export interface ClassicTools {
  lib: Lib;
  /** Several files to the library, in order. */
  libs: (files: string[], alt: string) => Promise<string[]>;
  logoItems: LogoItems;
  filesOf: (spec: string) => string[];
  pick: (folder: string, nums: string[]) => string[];
  /** Project ids by content id. */
  project: (id: string) => string;
  /** A project's own pictures (uploaded with it), by file. */
  projectPics: (contentId: string, files: string[], alt: string) => Promise<string[]>;
}

/* ---------- building blocks ---------- */

const ORANGE = "#FF5A1F";
const BLACK = "#000000";
const st = (patch: Parameters<typeof sectionStyle>[0] = {}): SectionStyle => sectionStyle(patch);
const dark = (patch: Parameters<typeof sectionStyle>[0] = {}) => st({ bg: { kind: "color", color: BLACK }, padTop: 56, padBottom: 56, ...patch });
const centre = (patch: Parameters<typeof sectionStyle>[0] = {}) => st({ align: "center", ...patch });

/** A centred section title like the old site's: orange, often in capitals, with a short line under it. */
function title(text: string, opts: { accent?: boolean; upper?: boolean; underline?: boolean; subtitle?: string; divider?: boolean; style?: Parameters<typeof sectionStyle>[0] } = {}): Block {
  return {
    id: newId(),
    type: "header",
    number: "",
    title: text,
    subtitle: opts.subtitle ?? "",
    logoId: null,
    badge: "",
    divider: !!opts.divider,
    size: "m",
    accent: opts.accent ?? true,
    upper: !!opts.upper,
    underline: opts.underline ?? true,
    style: centre({ padTop: 64, padBottom: 36, ...(opts.style ?? {}) }),
  };
}

const logos = (items: Array<{ name: string; mediaId: string }>, extra: Partial<Extract<Block, { type: "logos" }>> = {}, style?: SectionStyle): Block => ({
  id: newId(),
  type: "logos",
  heading: "",
  items,
  oneRow: true,
  ...extra,
  ...(style ? { style } : {}),
});

const pictures = (ids: string[], extra: Partial<Extract<Block, { type: "images" }>> = {}, style?: SectionStyle): Block => ({
  id: newId(),
  type: "images",
  heading: "",
  items: ids.map((mediaId, i) => ({ id: newId(), mediaId, tone: sampleTone(i), caption: "" })),
  layout: "grid",
  columns: Math.min(4, Math.max(1, ids.length)),
  gap: 8,
  ratio: "original",
  captions: false,
  ...extra,
  ...(style ? { style } : {}),
});

const video = (note: string, style?: SectionStyle): Block => ({ id: newId(), type: "video", url: "", caption: note, ...(style ? { style } : {}) });

function gallery(extra: Partial<Extract<Block, { type: "gallery" }>>, style?: SectionStyle): Block {
  return {
    id: newId(),
    type: "gallery",
    layout: "grid",
    source: "all",
    columns: 4,
    gap: 12,
    ratio: "2:3",
    lightbox: false,
    captions: true,
    credits: false,
    hoverPlay: true,
    filter: false,
    samples: [],
    ...extra,
    ...(style ? { style } : {}),
  };
}

function free(rows: number, items: FreeItem[], style?: SectionStyle): Block {
  return { id: newId(), type: "free", rows, background: null, bgMediaId: null, items, ...(style ? { style } : {}) };
}
const fi = (kind: Parameters<typeof freeItem>[0], place: Partial<FreePlace>, extra: Partial<FreeItem> = {}) => freeItem(kind, "en", place, extra);

/* ---------- the pages ---------- */

export async function classicPages(content: Any, t: ClassicTools): Promise<{ pages: PageDraft[]; logoId: string; shareId: string; heroText: string }> {
  const logoId = await t.lib("_site/logo.png", "Ahmed Adel");
  const shareId = await t.lib("_site/social-share-image.jpeg", "Ahmed Adel");
  const cat = await t.lib("home/14_get-in-touch/001_Group 3 copy.png", "Ahmed drawn as a cartoon holding an orange cat");

  /* ---------- Home ---------- */
  const heroText = "Animation Director, Supervisor & Visual Storyteller.";
  const hero = await t.lib("home/05_intro/001_afsdsadf.png", "Key art: a warrior between two giant cats");
  const credits = (await t.logoItems(t.filesOf("home/03_network-logos-hbo-cartoon-network-netfli"))).filter((l) => l.name !== "MBC Academy");
  const bigCat = await t.lib("home/07_commercial-leadership/001_Comp 2.gif", "Big Cat Animation");
  const clientFiles = [
    ...t.filesOf("home/09_client-logos-sharmoofers-ralph-s-coffee-").slice(0, 10),
    ...t.pick("home/10_commercial-projects-thumbnail-client-log", ["011"]),
    ...t.filesOf("home/09_client-logos-sharmoofers-ralph-s-coffee-").slice(10, 14),
    ...t.pick("home/10_commercial-projects-thumbnail-client-log", ["005", "034", "007"]),
    ...t.filesOf("home/09_client-logos-sharmoofers-ralph-s-coffee-").slice(14),
    ...t.pick("home/10_commercial-projects-thumbnail-client-log", ["029"]),
  ];
  const clients = await t.logoItems(clientFiles);
  const ventures = [
    { title: "Sweet & Sour", role: "Co-Creator", file: "home/11_ventures-ips/003_cairocomixpost.jpg" },
    { title: "ART GYM", role: "Co-Founder / Community Manager", file: "home/11_ventures-ips/001_IMG_5635.GIF" },
    { title: "BIG BOX Merchandise", role: "FOUNDER", file: "home/11_ventures-ips/004_Logo intro.gif" },
  ];
  const ventureIds = await Promise.all(ventures.map((v) => t.lib(v.file, v.title)));
  const tiles = [
    { title: "Character Design", link: "/character-design", file: "home/13_portfolio-category-tiles/001_0000000mrAR000000000GL-9.jpeg" },
    { title: "Illustration", link: "/illustration", file: "home/13_portfolio-category-tiles/002_0000000mrAR000000000FC-12.jpeg" },
    { title: "2D Animation", link: "/2d-animation", file: "home/13_portfolio-category-tiles/003_0000000mrAR000000000FC-18.jpeg" },
    { title: "Storyboard", link: "/storyboard", file: "home/13_portfolio-category-tiles/004_IMG_5563.JPG" },
  ];
  const tileIds = await Promise.all(tiles.map((x) => t.lib(x.file, x.title)));

  const card = (title: string, text: string, mediaId: string, link = "") => ({ title, text, meta: "", icon: "sparkle", mediaId, tone: sampleTone(0), link, button: "", stars: 0, price: "", url: "" });
  const intro = free(
    10,
    [
      fi("image", { x: 3, y: 0, w: 7, h: 10 }, { mediaId: cat, fit: "contain", tone: sampleTone(2) }),
      fi("heading", { x: 12, y: 1, w: 11, h: 2 }, { text: "Hello, I’m Ahmed", size: 30, color: "#E8501A" }),
      fi("text", { x: 12, y: 3, w: 11, h: 4 }, {
        text: "I’m a <b>Director</b>, <b>Animator</b>, and <b>Character Designer</b> working in animation.<br><br>I help tell stories through design, direct short films, and teach what I’ve learned along the way through Workshops, Panels, and Online content.",
        size: 16,
      }),
      fi("button", { x: 12, y: 7, w: 6, h: 1 }, { text: "LEARN MORE ABOUT ME", link: "/about", size: 13, fill: ORANGE, color: "#141414" }),
    ],
    st({ width: "medium", padTop: 32 }),
  );

  const commercialOrder = ["bc-ralphs", "bc-sinai", "u-animatex", "bc-sharmoofers", "u-dulcis", "bc-naseej", "bc-alula", "u-luneverse", "u-ie", "bc-osn", "c-ahlmasr", "u-safer", "c-euro", "c-sff9", "c-sff10", "u-qudrat", "c-riot", "c-mlbb", "bc-fund", "c-da7ee7"];
  const home: Block[] = [
    { id: newId(), type: "cover", mediaId: hero, tone: "#1A1714", heading: heroText, subheading: "", height: "large", inset: true, size: "s" },
    title("Credits in", { upper: true }),
    logos(credits, { band: ORANGE, tint: "white", size: "m" }, st({ width: "full", padTop: 24 })),
    title("Broadcast Work"),
    gallery({ source: "tag:broadcast", split: true, wideColumns: 2, lines: ["network", "role"], captionStyle: "accent", gap: 10 }, st({ width: "narrow" })),
    intro,
    title("Independent Directing", { accent: false, style: { bg: { kind: "color", color: BLACK }, padTop: 56, padBottom: 0 } }),
    gallery(
      { picks: ["long-night", "final-smoke", "sweet-potato", "qahwet-al-foqara", "can-you-feel-it", "where-do-lovers-go"].map(t.project), columns: 3, lines: ["role"], gap: 24 },
      dark({ width: "narrow", padTop: 16 }),
    ),
    {
      ...title("Commercial Leadership at BIG CAT Animation", { underline: false, subtitle: "Co-Founder ,CEO and Director driving high-end commercial animation, brand campaigns, and festival-selected films." }),
    },
    logos([{ name: "Big Cat Animation", mediaId: bigCat }], { size: "xl" }, centre({ padTop: 24, padBottom: 24 })),
    video("[Big Cat 2025 Showreel: paste the Vimeo link]", st({ width: "narrow" })),
    title("Clients", { upper: true }),
    logos(clients, { band: ORANGE, tint: "white", oneRow: false, columns: 5, size: "l" }, st({ width: "full", padTop: 24 })),
    title("Commercial Projects", { upper: true }),
    gallery({ picks: commercialOrder.map(t.project), columns: 4, ratio: "4:5", captions: false, credits: false, gap: 10, loopPlay: "always" }, st({ width: "medium" })),
    title("Ventures & IPs", { accent: false, style: { bg: { kind: "color", color: BLACK }, padTop: 48, padBottom: 0 } }),
    {
      id: newId(),
      type: "cards",
      design: "c-cards",
      variant: "images",
      flat: true,
      heading: "",
      intro: "",
      columns: 3,
      align: "start",
      button: "",
      link: "",
      mediaId: null,
      tone: sampleTone(0),
      items: ventures.map((v, i) => card(v.title, v.role, ventureIds[i])),
      style: dark({ width: "medium", padTop: 16 }),
    },
    title("Portfolio", { upper: true }),
    {
      id: newId(),
      type: "cards",
      design: "c-tiles",
      variant: "tiles",
      tileRatio: "16/9",
      tileText: "center",
      heading: "",
      intro: "",
      columns: 4,
      align: "start",
      button: "",
      link: "",
      mediaId: null,
      tone: sampleTone(0),
      items: tiles.map((x, i) => card(x.title, "", tileIds[i], x.link)),
      style: st({ width: "medium" }),
    },
    contact("GET IN TOUCH", cat, st({ width: "medium", anchor: "contact" })),
  ];

  /* ---------- About ---------- */
  const portrait = await t.lib("about/01_bio/001_ِِAhmed Adel - Profile Picture.jpg", "Portrait of Ahmed Adel");
  const teams = await t.logoItems(t.filesOf("about/03_studio-logos-big-cat-jump-animation-sun-"));
  const community = [
    { title: "ART GYM (Co-Founder)", text: "Helped mentoring +150 students in Animation principles and industry pipelines.", file: "about/04_community-mentorship/002_THE MEET-UP_20260115_173751_0000.png" },
    { title: "Helwan University (Instructor)", text: "Developed and led field training programs for emerging animation talent.", file: "about/04_community-mentorship/003_IMG_20251223_151213_2.jpg" },
    { title: "Animatex (Speaker & Instructor)", text: "Gave Animation Principles Workshop & Spoke at a panel on animation education, industry standards, and the future of the medium.", file: "about/04_community-mentorship/004_IMG-20260212-WA0054.jpg" },
  ];
  const communityIds = await Promise.all(community.map((c) => t.lib(c.file, c.title)));
  const about: Block[] = [
    free(
      10,
      [
        fi("image", { x: 2, y: 0, w: 8, h: 9 }, { mediaId: portrait, deco: { ...fi("image", {}).deco, mask: "rounded" } }),
        fi("heading", { x: 12, y: 0, w: 11, h: 2 }, { text: "Hello, I’m Ahmed", size: 30, color: "#E8501A" }),
        fi("text", { x: 12, y: 2, w: 11, h: 6 }, {
          text:
            "I’m a <b>Director</b> ,<b>Animator</b> and <b>Character Designer</b> with over 9 years of experience based in Egypt.<br><br>I have a Bachelor Degree in “Animation Directing” from the HIGH CINEMA INSTITUTE ,And I’m very enthusiastic when it comes to animation in all it’s forms and mediums ,and I especially love animation for films and music.<br><br>My professional work includes projects for <b>Netflix</b> (<i>Fever Dreams</i>), <b>Cartoon Network &amp; HBO</b> (<i>The Heroic Quest of the Valiant Prince Ivandoe</i>), <b>Majid TV</b> (<i>Zakia Al Zakia</i>), and <b>MBC</b> (<i>Hakawati Nation</i>).<br><br>Don’t hesitate to <a href=\"/contact\">contact me</a> for any inquiries.",
          size: 14,
        }),
        fi("button", { x: 12, y: 8, w: 5, h: 1 }, { text: "VIEW RESUME", link: "", size: 13, fill: ORANGE, color: "#141414" }),
      ],
      st({ width: "medium", padTop: 24 }),
    ),
    title("Teams I’ve worked with!", { underline: false }),
    logos(teams, { band: ORANGE, tint: "white", oneRow: false, columns: 6, size: "l" }, st({ width: "full", padTop: 24 })),
    title("Community participation & Mentorship", { underline: false }),
    {
      id: newId(),
      type: "cards",
      design: "c-cards",
      variant: "images",
      flat: true,
      heading: "",
      intro: "",
      columns: 3,
      align: "start",
      button: "",
      link: "",
      mediaId: null,
      tone: sampleTone(0),
      items: community.map((c, i) => card(c.title, c.text, communityIds[i])),
      style: st({ width: "medium" }),
    },
  ];

  /* ---------- Character Design ---------- */
  const L = (folder: string, nums?: string[]) => t.logoItems(nums ? t.pick(folder, nums) : t.filesOf(folder));
  const cd: Block[] = [title("Character Design", { upper: true, underline: false, style: { padBottom: 24 } })];
  // Fever Dreams: black, three logos then the title, sheets in red frames, six across.
  const fd = "character-design/02_project-header-logos-fever-dreams-netfli";
  cd.push(
    logos(await L(fd, ["001", "003", "002"]), { size: "m" }, dark({ padBottom: 8 })),
    logos(await L(fd, ["004"]), { size: "xl" }, dark({ padTop: 0, padBottom: 16 })),
    pictures(await t.projectPics("fever-dreams", t.filesOf("character-design/03_fever-dreams-gallery"), "Fever Dreams"), { columns: 6, gap: 4, frame: "#E0261B" }, dark({ padTop: 0 })),
  );
  // Hakawati Nation: logos either side of the title, a masonry of sheets.
  const hk = "character-design/04_project-header-logos-hakawati-nation-mbc";
  cd.push(
    logos(await L(hk, ["002", "003", "001"]), { size: "m" }, st({ padTop: 48, padBottom: 24 })),
    pictures(await t.projectPics("hakawati-nation", t.filesOf("character-design/05_hakawati-nation-gallery"), "Hakawati Nation"), { layout: "masonry", columns: 6, gap: 4 }, st({ padTop: 24 })),
  );
  // Mobile Legends (BUG Studio): black, logos stacked.
  const bug = "character-design/06_project-header-logos-bug-studio-1";
  cd.push(
    logos(await L(bug, ["001"]), { size: "m" }, dark({ padBottom: 0 })),
    logos(await L(bug, ["002"]), { size: "l" }, dark({ padTop: 8, padBottom: 16 })),
    pictures(await t.projectPics("c-mlbb", t.filesOf("character-design/07"), "Mobile Legends: Bang Bang"), { columns: 2, gap: 24 }, dark({ padTop: 0 })),
  );
  // Saudi Film Festival (Zaini Studios).
  const sff = "character-design/08_project-header-logos";
  cd.push(
    logos(await L(sff, ["001"]), { size: "m" }, st({ padTop: 48, padBottom: 16 })),
    logos(await L(sff, ["002"]), { size: "l" }, st({ padTop: 16, padBottom: 24 })),
    pictures(await t.projectPics("c-sff10", t.filesOf("character-design/09"), "Saudi Film Festival"), { columns: 3, gap: 24 }, st({ padTop: 16, padBottom: 48 })),
  );
  // Sweet & Sour.
  cd.push(
    logos(await L("character-design/10_project-header-logo"), { size: "xl" }, st({ padTop: 64, padBottom: 24 })),
    pictures(await t.libs(t.filesOf("character-design/11_merch-stickers-tote-bag-keychains-cairo-"), "Sweet & Sour"), { layout: "masonry", columns: 4, gap: 4 }, st({ padTop: 16 })),
  );
  // Graduation project.
  cd.push(
    logos(await L("character-design/12"), { size: "l" }, dark({ padBottom: 0 })),
    title("Graduation Project", { accent: false, upper: true, underline: false, style: { bg: { kind: "color", color: BLACK }, padTop: 8, padBottom: 8 } }),
    pictures(await t.libs(t.filesOf("character-design/13"), "Graduation project"), { columns: 2, gap: 8 }, dark({ padTop: 8 })),
  );
  // Personal work: each folder stays a group.
  cd.push(title("Personal Work", { accent: false, upper: true, underline: false, divider: true }));
  for (const f of ["15", "16", "17", "18", "19", "20", "21", "22", "23"]) {
    const files = t.filesOf(`character-design/${f}`);
    const ids = await t.libs(files, "Personal work");
    cd.push(pictures(ids, files.length > 4 ? { layout: "masonry", columns: 4, gap: 6 } : { columns: Math.min(4, files.length), gap: 12 }, st({ padTop: 24, padBottom: 24 })));
  }

  /* ---------- Illustration ---------- */
  const ill: Block[] = [
    title("Illustrations", { upper: true, underline: false, divider: true, style: { padBottom: 24 } }),
    pictures(await t.libs(t.filesOf("illustration/02_gallery-30-pieces-lightbox"), "Illustration"), { layout: "masonry", columns: 3, gap: 6 }, st({ width: "medium" })),
  ];

  /* ---------- 2D Animation ---------- */
  const anim: Block[] = [title("2D Animation", { accent: false, upper: true, underline: false, style: { padBottom: 24 } })];
  const banner = (bgId: string | null, color = BLACK) =>
    st({ width: "full", padTop: 24, padBottom: 24, bg: bgId ? { kind: "image", mediaId: bgId, overlay: "#000000", overlayOpacity: 25, blur: 14 } : { kind: "color", color } });
  const roleRow = (role: string, col1: string, col2 = "", rows = 3) =>
    free(
      rows,
      [
        fi("heading", { x: 1, y: 0, w: 9, h: 2 }, { text: role, size: 24 }),
        fi("text", { x: 12, y: 0, w: 5, h: rows }, { text: col1, size: 12 }),
        ...(col2 ? [fi("text", { x: 18, y: 0, w: 5, h: rows }, { text: col2, size: 12 })] : []),
      ],
      st({ padTop: 40, padBottom: 24 }),
    );
  const cover = async (id: string) => {
    const p = (content.projects as Any[]).find((x) => x.id === id);
    return p?.cover ? (await t.projectPics(id, t.filesOf(p.cover), p.title))[0] : null;
  };
  const z = "2d-animation/02_header-logos-zakia-al-zakia-majid-tv-jum";
  anim.push(
    logos(await L(z, ["002", "003", "001"]), { size: "l", tint: "original" }, banner(await cover("zakia-al-zakia"))),
    roleRow(
      "Animation Supervisor & Team Lead",
      "I worked with <b>Jump</b> as an <b>Animation Supervisor</b> and <b>Team lead</b> for <b>2.5 Years</b> on this <b>26 episodes</b> TV Series<br><br>it’s currently airing and ongoing on <b>MAJID TV</b> channel &amp; <b>MAJID APP.</b>",
      "I was responsible for supervising and leading the animation team consisting of 8 full-time animators and more freelance animators when needed. while also animating traditional/cutout shots",
    ),
    video("[Zakia Al Zakia: paste the video link]", st({ width: "narrow" })),
  );
  const iv = "2d-animation/04_header-logos-valiant-prince-ivandoe-cart";
  anim.push(
    logos(await L(iv, ["002", "003", "001"]), { size: "l" }, banner(await cover("ivandoe"))),
    roleRow(
      "Senior Key & Rough Animator",
      "I had the chance to work with <b>SunCreature Studio</b> on this amazing upcoming tv show for <b>Cartoon Network</b> and <b>HBO.</b><br><br>I worked with them remotely as a <b>Senior Key &amp; Rough Animator</b> for 3 months full-time contract.",
      "It was really late in the production and I had to join and adapt very quickly to the style and process of the show ,and it was an amazing experience overall and such a great team to work with!",
    ),
    video("[The Heroic Quest of the Valiant Prince Ivandoe: paste the video link]", st({ width: "narrow" })),
  );
  const gn = "2d-animation/06_header-logos-the-grand-night-giraffics-j";
  anim.push(
    logos(await L(gn, ["001", "003", "002"]), { size: "l" }, banner(null)),
    roleRow("2D Traditional/Cutout Animator", "I was asked to animate a lot of the shots for this POC trailer produce by <b>Giraffics Studio</b> with <b>JUMP ANIMATION STUDIO</b>"),
    video("[The Grand Night: paste the video link]", st({ width: "narrow" })),
  );
  const ln = "2d-animation/08_graduation-film-header-background-image-";
  const lnBg = await t.lib(`${ln}/001_Untitled-1 copy.jpg`, "Long Night");
  anim.push(
    logos(await L(ln, ["002", "003", "004", "005", "007", "006"]), { size: "l" }, banner(lnBg)),
    roleRow(
      "Director and creator",
      "This Graduation short film was a whole new experience for me since I decided to make it completely in 3D for the first time using a VR headset which was a very challenging yet very enjoyable new industry process<br><br>The film is more about the technical new process that I always wanted to try out, and less about the story itself (which went through many iterations because of the deadline and graduation purposes)",
      "Tools :<br>Quill VR (Oculus Quest 2)<br>Blender<br>Adobe After effects<br>Adobe Photoshop",
      6,
    ),
    video("[Long Night: paste the video link]", st({ width: "narrow" })),
  );

  /* ---------- Storyboards & Animatics ---------- */
  const sb: Block[] = [
    title("Storyboards & Animatics", { accent: false, upper: true, underline: false, divider: true, style: { padBottom: 24 } }),
    logos(await L("storyboard/11_client-header-logos", ["002", "003", "001"]), { size: "l" }),
    pictures(await t.libs(t.filesOf("storyboard/12"), "Client storyboard"), { columns: 3, gap: 16 }, st({ width: "medium" })),
    video("[Client board 1: paste the video link]", st({ width: "narrow" })),
    video("[Client board 2: paste the video link]", st({ width: "narrow" })),
    logos(await L("storyboard/02"), { size: "l" }, dark({ padBottom: 0 })),
    title("Graduation Projects", { accent: false, upper: true, underline: false, style: { bg: { kind: "color", color: BLACK }, padTop: 8, padBottom: 8 } }),
    pictures(await t.libs(t.pick("storyboard/04_long-night", ["001"]), "Long Night poster"), { columns: 1 }, dark({ width: "narrow", padTop: 8, padBottom: 8 })),
    pictures(await t.libs(t.pick("storyboard/04_long-night", ["002", "003", "004", "005", "006"]), "Long Night storyboard"), { columns: 2, gap: 8 }, dark({ width: "medium", padTop: 8 })),
    video("[Graduation animatic: paste the video link]", st({ width: "narrow" })),
    pictures(await t.libs(t.pick("storyboard/03", ["003", "004", "005"]), "Graduation project storyboard"), { columns: 3, gap: 8 }, st({ width: "medium" })),
    pictures(await t.libs(t.pick("storyboard/03", ["002", "001"]), "Graduation project characters"), { columns: 2, gap: 8 }, st({ width: "medium" })),
    title("Personal Boards", { accent: false, upper: true, underline: false, divider: true }),
    pictures(await t.libs(t.filesOf("storyboard/06"), "Personal storyboard"), { columns: 1 }, st({ width: "narrow" })),
    video("[Personal board 1: paste the video link]", st({ width: "narrow" })),
    video("[Personal board 2: paste the video link]", dark({ width: "narrow", padBottom: 8 })),
    pictures(await t.libs(t.filesOf("storyboard/07"), "Personal storyboard"), { columns: 1 }, dark({ width: "narrow", padTop: 8 })),
    pictures(await t.libs(t.filesOf("storyboard/08"), "Personal storyboard"), { columns: 1 }, st({ width: "narrow" })),
    video("[Personal board 3: paste the video link]", st({ width: "narrow" })),
    pictures(await t.libs(t.filesOf("storyboard/09"), "Personal storyboard"), { columns: 2, gap: 8 }, dark({ width: "medium" })),
    pictures(await t.libs(t.filesOf("storyboard/10"), "Personal storyboard"), { columns: 2, gap: 24 }, st({ width: "medium" })),
  ];

  /* ---------- Contact ---------- */
  const armsUp = await t.lib("contact/01/002_2.jpg", "Ahmed drawn as a cartoon with an orange cat on his head");
  const contactPage: Block[] = [contact("GET IN TOUCH", armsUp, st({ width: "medium" }))];

  /* ---------- menu: PORTFOLIO ▾ · About · Contact ---------- */
  const page = (slug: string, titleText: string, blocks: Block[], extra: Partial<PageDraft> = {}): PageDraft => ({ id: newId(), slug, title: titleText, type: "custom", showInNav: true, blocks, ...extra });
  const folder = page("portfolio", "PORTFOLIO", [], { type: "folder" });
  const pages: PageDraft[] = [
    page("", "Home", home, { showInNav: false }),
    folder,
    page("character-design", "Character Design", cd, { parentId: folder.id }),
    page("illustration", "Illustration", ill, { parentId: folder.id }),
    page("2d-animation", "2D Animation", anim, { parentId: folder.id }),
    page("storyboard", "Storyboard", sb, { parentId: folder.id }),
    page("about", "About", about, { type: "about" }),
    page("contact", "Contact", contactPage),
  ];
  return { pages, logoId, shareId, heroText };
}

function contact(heading: string, mediaId: string, style: SectionStyle): Block {
  return {
    id: newId(),
    type: "contact",
    heading,
    text: "",
    button: "SUBMIT",
    mediaId,
    flat: true,
    form: { projectType: false, budget: false, deadline: false, custom: "", labels: { name: "Name", email: "Email", message: "Message" }, success: "", layout: "stacked" } as never,
    style,
  };
}
