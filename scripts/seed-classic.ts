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

/** His current site (Aug 2026): red, Londrina Solid headings in capitals, Montserrat text. */
const RED = "#FC221C";
const BLACK = "#000000";
const st = (patch: Parameters<typeof sectionStyle>[0] = {}): SectionStyle => sectionStyle(patch);
const dark = (patch: Parameters<typeof sectionStyle>[0] = {}) => st({ bg: { kind: "color", color: BLACK }, padTop: 56, padBottom: 56, ...patch });
const centre = (patch: Parameters<typeof sectionStyle>[0] = {}) => st({ align: "center", ...patch });
/** Content widths measured on the old site at 1920px wide (its page margins leave 1672px). */
const W = { page: 1672, wide: 1612, ventures: 1530, sheets: 1450, broadcast: 1388, directing: 1175, form: 980, video: 840 };
const at = (maxWidth: number, patch: Parameters<typeof sectionStyle>[0] = {}) => st({ maxWidth, ...patch } as never);
const darkAt = (maxWidth: number, patch: Parameters<typeof sectionStyle>[0] = {}) => dark({ maxWidth, ...patch } as never);
/** An orange band right across the page (the section's own background, square like the old site). */
const redBand = (patch: Parameters<typeof sectionStyle>[0] = {}) => at(W.page, { bg: { kind: "color", color: RED }, padTop: 48, padBottom: 48, ...patch } as never);

/** A centred section title like the old site's: orange, often in capitals, with a short line under it. */
function title(text: string, opts: { accent?: boolean; upper?: boolean; underline?: boolean; subtitle?: string; divider?: boolean; line?: string; style?: Parameters<typeof sectionStyle>[0] } = {}): Block {
  return {
    id: newId(),
    type: "header",
    number: "",
    title: text,
    subtitle: opts.subtitle ?? "",
    logoId: null,
    badge: "",
    divider: !!opts.divider,
    // Section titles are 46px on his site.
    accent: opts.accent ?? true,
    upper: !!opts.upper,
    underline: opts.line ? false : (opts.underline ?? false),
    ...(opts.line ? { lineId: opts.line } : {}),
    size: "l",
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
  const heroText = "Director, Animator & Character Designer.";
  // His site opens on a video; until he sends the file, the Long Night key art stands in.
  const hero = await t.lib("2d-animation/08_graduation-film-header-background-image-/001_Untitled-1 copy.jpg", "Long Night, key art");
  const warrior = await t.lib("home/05_intro/001_afsdsadf.png", "Key art: a warrior between two giant cats");
  // Hand-drawn lines under the titles (animated GIFs that draw themselves).
  const squiggle = await t.lib("home/04_broadcast-film/001_IMG_5633.GIF", "");
  const zigWhite = await t.lib("home/11_ventures-ips/001_IMG_5635.GIF", "");
  const zigRed = await t.lib("home/12_portfolio-heading/001_IMG_5636.GIF", "");
  const zigDirect = await t.lib("home/06_independent-directing/001_IMG_5634.GIF", "");
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
  // His current site shows 15 of them (no Sinai, Dulcis, Luneverse, IE or Qudrat).
  const clients = (await t.logoItems(clientFiles)).filter((_, i) => ![10, 15, 16, 17, 19].includes(i));
  const ventures = [
    { title: "Sweet & Sour", role: "Co-Creator", file: "home/11_ventures-ips/003_cairocomixpost.jpg" },
    { title: "ART GYM", role: "Co-Founder / Community Manager", file: "home/11_ventures-ips/002_Animationyasta11-ezgif.com-optimize (1).gif" },
    { title: "BIG BOX Merchandise", role: "FOUNDER", file: "home/11_ventures-ips/004_Logo intro.gif" },
  ];
  // One at a time: two big animations at once can run the media processor out of memory.
  const ventureIds: string[] = [];
  for (const v of ventures) ventureIds.push(await t.lib(v.file, v.title));
  const tiles = [
    { title: "Character Design", link: "/character-design", file: "home/13_portfolio-category-tiles/001_0000000mrAR000000000GL-9.jpeg" },
    { title: "Illustration", link: "/illustration", file: "home/13_portfolio-category-tiles/003_0000000mrAR000000000FC-18.jpeg" },
    { title: "2D Animation", link: "/2d-animation", file: "home/13_portfolio-category-tiles/002_0000000mrAR000000000FC-12.jpeg" },
    { title: "Storyboard", link: "/storyboard", file: "home/13_portfolio-category-tiles/004_IMG_5563.JPG" },
  ];
  const tileIds = await Promise.all(tiles.map((x) => t.lib(x.file, x.title)));

  const card = (title: string, text: string, mediaId: string, link = "") => ({ title, text, meta: "", icon: "sparkle", mediaId, tone: sampleTone(0), link, button: "", stars: 0, price: "", url: "" });
  const intro = free(
    10,
    [
      fi("image", { x: 0, y: 0, w: 12, h: 8 }, { mediaId: warrior, fit: "contain", tone: sampleTone(2) }),
      fi("heading", { x: 12, y: 1, w: 11, h: 1 }, { text: "Hello, I’m Ahmed!", size: 33, color: RED }),
      fi("image", { x: 12, y: 2, w: 5, h: 1 }, { mediaId: squiggle, fit: "contain", tone: sampleTone(1) }),
      fi("text", { x: 12, y: 3, w: 11, h: 2 }, {
        text: "I’m an <b>Animation Director</b> and <b>Character Designer</b>.<br><br>While my focus is on leading creative teams and directing campaigns, I’m still a hands-on <b>Animator</b> and <b>Character Designer</b> at heart. I love telling stories through design, bringing short films to life, and sharing what I’ve learned with the community.",
        size: 12,
      }),
      fi("button", { x: 19, y: 5, w: 4, h: 1 }, { text: "LEARN MORE ABOUT ME", link: "/about", size: 10, fill: RED, color: "#FFFFFF" }),
    ],
    at(W.page, { padTop: 8, padBottom: 8 }),
  );

  const commercialOrder = ["bc-ralphs", "bc-sinai", "u-animatex", "bc-sharmoofers", "u-dulcis", "bc-naseej", "bc-alula", "u-luneverse", "u-ie", "bc-osn", "c-ahlmasr", "u-safer", "c-euro", "c-sff9", "c-sff10", "u-qudrat", "c-riot", "c-mlbb", "bc-fund", "c-da7ee7"];
  const home: Block[] = [
    { id: newId(), type: "cover", mediaId: hero, tone: "#1A1714", heading: heroText, subheading: "", height: "full", roundBottom: true, size: "m" },
    title("Credits in", { style: { padTop: 16, padBottom: 60 } }),
    // His credits glide by, right to left, in an endless row.
    logos(credits, { tint: "white", size: "l", moving: true }, st({ width: "full", bg: { kind: "color", color: RED }, padTop: 30, padBottom: 30 })),
    title("Broadcast & Film", { line: squiggle }),
    gallery(
      { source: "tag:broadcast", split: true, wideColumns: 2, lines: ["network", "role"], captionStyle: "accent", captionSize: "xl", ratio: "3:4", gap: 36 },
      at(W.broadcast, { align: "center" }),
    ),
    intro,
    title("Independent Directing", { accent: false, line: zigDirect, style: { bg: { kind: "color", color: BLACK }, padTop: 56, padBottom: 0 } }),
    gallery(
      { picks: ["long-night", "final-smoke", "sweet-potato", "qahwet-al-foqara", "can-you-feel-it", "where-do-lovers-go"].map(t.project), columns: 3, lines: ["role"], captionStyle: "heading", captionSize: "xl", gap: 100 },
      darkAt(W.directing, { padTop: 24, padBottom: 72, align: "center" }),
    ),
    {
      ...title("Commercial Leadership at BIG CAT Animation", { underline: false, subtitle: "Co-Founder ,CEO and Director driving high-end commercial animation, brand campaigns, and festival-selected films." }),
    },
    logos([{ name: "Big Cat Animation", mediaId: bigCat }], { size: "xl" }, centre({ padTop: 24, padBottom: 24 })),
    { id: newId(), type: "video", url: "https://vimeo.com/1153052104", caption: "", style: at(W.form) },
    title("Clients"),
    logos(clients, { tint: "white", oneRow: false, columns: 5, size: "xl" }, redBand({ padTop: 56, padBottom: 56 })),
    title("Commercial Projects", { line: squiggle }),
    gallery({ picks: commercialOrder.map(t.project), columns: 4, ratio: "4:5", captions: false, credits: false, gap: 20, loopPlay: "always", coverLogo: true }, at(W.wide, { align: "center" })),
    title("Ventures & IPs", { accent: false, line: zigWhite, style: { bg: { kind: "color", color: BLACK }, padTop: 48, padBottom: 0 } }),
    {
      id: newId(),
      type: "cards",
      design: "c-cards",
      variant: "images",
      flat: true,
      bigTitles: true,
      heading: "",
      intro: "",
      columns: 3,
      align: "start",
      button: "",
      link: "",
      mediaId: null,
      tone: sampleTone(0),
      items: ventures.map((v, i) => card(v.title, v.role, ventureIds[i])),
      style: darkAt(W.ventures, { padTop: 24, padBottom: 72 }),
    },
    title("Portfolio", { line: zigRed }),
    {
      id: newId(),
      type: "cards",
      design: "c-tiles",
      variant: "tiles",
      tileRatio: "4/3",
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
      style: at(W.page),
    },
    contact("GET IN TOUCH", cat, at(W.page, { anchor: "contact", padTop: 64, padBottom: 72 })),
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
        fi("image", { x: 3, y: 0, w: 6, h: 7 }, { mediaId: portrait, deco: { ...fi("image", {}).deco, mask: "rounded" } }),
        fi("heading", { x: 12, y: 0, w: 11, h: 1 }, { text: "Hello, I’m Ahmed !", size: 33, color: RED }),
        fi("image", { x: 12, y: 1, w: 5, h: 1 }, { mediaId: squiggle, fit: "contain", tone: sampleTone(1) }),
        fi("text", { x: 12, y: 2, w: 11, h: 5 }, {
          text:
            "I'm an <b>Animation Director, Supervisor, and Visual Storyteller</b> with over 10 years of experience, based in Cairo, Egypt.<br><br>I hold a Bachelor's Degree in “Animation Directing” from the <b>High Cinema Institute</b>. While my focus is on leading creative teams and directing campaigns, I am still a hands-on <b>Animator</b> and <b>Character Designer</b> at heart. I love telling stories through design, bringing short films to life, and sharing what I've learned with the community.<br><br><i>My professional work includes projects for</i> <b>Netflix</b> (<i>Fever Dreams</i>), <b>Cartoon Network &amp; HBO</b> (<i>The Heroic Quest of the Valiant Prince Ivandoe</i>), <b>Majid TV</b> (<i>Zakia Al Zakia</i>), and <b>MBC</b> (<i>Hakawati Nation</i>).<br><br>Don’t hesitate to <a href=\"/contact\">contact me</a> for any inquiries.",
          size: 11,
        }),
        fi("button", { x: 19, y: 7, w: 4, h: 1 }, { text: "DOWNLOAD RESUME", link: "", size: 10, fill: RED, color: "#FFFFFF" }),
      ],
      at(W.page, { padTop: 48, padBottom: 48 }),
    ),
    { ...title("Teams I’ve worked with!", { line: squiggle }), size: "m" } as Block,
    logos(teams, { tint: "white", oneRow: false, columns: 6, size: "xl" }, redBand({ padTop: 56, padBottom: 56 })),
    { ...title("Community participation & Mentorship", { line: squiggle }), size: "m" } as Block,
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
      bigTitles: true,
      accentTitles: true,
      tileRatio: "16/9",
      items: community.map((c, i) => card(c.title, c.text, communityIds[i])),
      style: at(W.page, { padBottom: 72 }),
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
    pictures(await t.libs(t.filesOf("illustration/02_gallery-30-pieces-lightbox"), "Illustration"), { layout: "masonry", columns: 3, gap: 8 }, at(W.page)),
  ];

  /* ---------- 2D Animation ---------- */
  const anim: Block[] = [title("2D Animation", { accent: false, upper: true, underline: false, style: { padBottom: 24 } })];
  const banner = (bgId: string | null, color = BLACK) =>
    at(W.page, { padTop: 96, padBottom: 96, bg: bgId ? { kind: "image", mediaId: bgId, overlay: "#000000", overlayOpacity: 8 } : { kind: "color", color } });
  const roleRow = (role: string, col1: string, col2 = "", rows = 3) =>
    free(
      rows,
      [
        fi("heading", { x: 0, y: 0, w: 9, h: 2 }, { text: role, size: 22 }),
        fi("text", { x: 11, y: 0, w: 6, h: rows }, { text: col1, size: 10 }),
        ...(col2 ? [fi("text", { x: 18, y: 0, w: 6, h: rows }, { text: col2, size: 10 })] : []),
      ],
      at(W.page, { padTop: 56, padBottom: 32 }),
    );
  const cover = async (id: string) => {
    const p = (content.projects as Any[]).find((x) => x.id === id);
    return p?.cover ? (await t.projectPics(id, t.filesOf(p.cover), p.title))[0] : null;
  };
  const z = "2d-animation/02_header-logos-zakia-al-zakia-majid-tv-jum";
  anim.push(
    logos(await L(z, ["002", "003", "001"]), { size: "xl", tint: "original" }, banner(await cover("zakia-al-zakia"))),
    roleRow(
      "Animation Supervisor & Team Lead",
      "I worked with <b>Jump</b> as an <b>Animation Supervisor</b> and <b>Team lead</b> for <b>2.5 Years</b> on this <b>26 episodes</b> TV Series<br><br>it’s currently airing and ongoing on <b>MAJID TV</b> channel &amp; <b>MAJID APP.</b>",
      "I was responsible for supervising and leading the animation team consisting of 8 full-time animators and more freelance animators when needed. while also animating traditional/cutout shots",
    ),
    video("[Zakia Al Zakia: paste the video link]", at(W.video)),
  );
  const iv = "2d-animation/04_header-logos-valiant-prince-ivandoe-cart";
  anim.push(
    logos(await L(iv, ["002", "003", "001"]), { size: "xl" }, banner(await cover("ivandoe"))),
    roleRow(
      "Senior Key & Rough Animator",
      "I had the chance to work with <b>SunCreature Studio</b> on this amazing upcoming tv show for <b>Cartoon Network</b> and <b>HBO.</b><br><br>I worked with them remotely as a <b>Senior Key &amp; Rough Animator</b> for 3 months full-time contract.",
      "It was really late in the production and I had to join and adapt very quickly to the style and process of the show ,and it was an amazing experience overall and such a great team to work with!",
    ),
    video("[The Heroic Quest of the Valiant Prince Ivandoe: paste the video link]", at(W.video)),
  );
  const gn = "2d-animation/06_header-logos-the-grand-night-giraffics-j";
  anim.push(
    logos(await L(gn, ["001", "003", "002"]), { size: "xl" }, banner(null)),
    roleRow("2D Traditional/Cutout Animator", "I was asked to animate a lot of the shots for this POC trailer produce by <b>Giraffics Studio</b> with <b>JUMP ANIMATION STUDIO</b>"),
    video("[The Grand Night: paste the video link]", at(W.video)),
  );
  const ln = "2d-animation/08_graduation-film-header-background-image-";
  const lnBg = await t.lib(`${ln}/001_Untitled-1 copy.jpg`, "Long Night");
  anim.push(
    logos(await L(ln, ["002", "003", "004", "005", "007", "006"]), { size: "xl" }, banner(lnBg)),
    roleRow(
      "Director and creator",
      "This Graduation short film was a whole new experience for me since I decided to make it completely in 3D for the first time using a VR headset which was a very challenging yet very enjoyable new industry process<br><br>The film is more about the technical new process that I always wanted to try out, and less about the story itself (which went through many iterations because of the deadline and graduation purposes)",
      "Tools :<br>Quill VR (Oculus Quest 2)<br>Blender<br>Adobe After effects<br>Adobe Photoshop",
      6,
    ),
    video("[Long Night: paste the video link]", at(W.video)),
  );

  /* ---------- Storyboards & Animatics ---------- */
  const sb: Block[] = [
    title("Storyboards & Animatics", { accent: false, upper: true, underline: false, divider: true, style: { padBottom: 24 } }),
    logos(await L("storyboard/11_client-header-logos", ["002", "003", "001"]), { size: "l" }),
    pictures(await t.libs(t.filesOf("storyboard/12"), "Client storyboard"), { columns: 3, gap: 16 }, at(W.sheets)),
    video("[Client board 1: paste the video link]", at(W.video)),
    video("[Client board 2: paste the video link]", at(W.video)),
    logos(await L("storyboard/02"), { size: "l" }, dark({ padBottom: 0 })),
    title("Graduation Projects", { accent: false, upper: true, underline: false, style: { bg: { kind: "color", color: BLACK }, padTop: 8, padBottom: 8 } }),
    pictures(await t.libs(t.pick("storyboard/04_long-night", ["001"]), "Long Night poster"), { columns: 1 }, darkAt(400, { padTop: 8, padBottom: 8 })),
    pictures(await t.libs(t.pick("storyboard/04_long-night", ["002", "003", "004", "005", "006"]), "Long Night storyboard"), { columns: 2, gap: 8 }, darkAt(1256, { padTop: 8 })),
    video("[Graduation animatic: paste the video link]", at(W.video)),
    pictures(await t.libs(t.pick("storyboard/03", ["003", "004", "005"]), "Graduation project storyboard"), { columns: 3, gap: 8 }, at(W.sheets)),
    pictures(await t.libs(t.pick("storyboard/03", ["002", "001"]), "Graduation project characters"), { columns: 2, gap: 8 }, at(W.sheets)),
    title("Personal Boards", { accent: false, upper: true, underline: false, divider: true }),
    pictures(await t.libs(t.filesOf("storyboard/06"), "Personal storyboard"), { columns: 1 }, at(560)),
    video("[Personal board 1: paste the video link]", at(W.video)),
    video("[Personal board 2: paste the video link]", darkAt(W.form, { padBottom: 8 })),
    pictures(await t.libs(t.filesOf("storyboard/07"), "Personal storyboard"), { columns: 1 }, darkAt(560, { padTop: 8 })),
    pictures(await t.libs(t.filesOf("storyboard/08"), "Personal storyboard"), { columns: 1 }, at(560)),
    video("[Personal board 3: paste the video link]", at(W.video)),
    pictures(await t.libs(t.filesOf("storyboard/09"), "Personal storyboard"), { columns: 2, gap: 8 }, darkAt(W.sheets)),
    pictures(await t.libs(t.filesOf("storyboard/10"), "Personal storyboard"), { columns: 2, gap: 24 }, at(W.sheets)),
  ];

  /* ---------- Contact ---------- */
  const armsUp = await t.lib("contact/01/002_2.jpg", "Ahmed drawn as a cartoon with an orange cat on his head");
  const contactPage: Block[] = [
    { ...contact("Have a project in mind? Drop me a note below and let’s create something cool together!", armsUp, at(W.page, { padTop: 64, padBottom: 72 })), button: "SEND" } as Block,
  ];

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
    accent: true,
    form: { projectType: false, budget: false, deadline: false, custom: "", labels: { name: "Name", email: "Email", message: "Message" }, success: "", layout: "stacked" } as never,
    style,
  };
}
