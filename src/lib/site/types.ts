// The shape of an artist's site. The draft lives in Firestore (sites/{id} + pages);
// "Publish" freezes a copy into sites/{id}/published/{version}, which the public renderer reads.

import type { Locale } from "@/i18n/locales";

export type LayoutId = "reel" | "grid" | "storyteller" | "minimalist";
export type ThemePreset = "gallery" | "studio" | "paper" | "lime" | "night" | "sand" | "orange";
/** Font ids from config/fonts.json (round 12: 60 fonts). Headings and body take Latin fonts. */
export type HeadingFont = string;
export type BodyFont = string;
export type ArabicFont = string;
// "inline": the links sit right after the logo; social icons and the button on the far side.
export type NavLayout = "top" | "centered" | "sidebar" | "split" | "minimal" | "inline";

export interface Theme {
  preset: ThemePreset;
  colors: { background: string; text: string; accent: string };
  fonts: {
    heading: HeadingFont;
    body: BodyFont;
    /** Arabic headings (and Arabic body text when arabicBody isn't set). */
    arabic: ArabicFont;
    /** Round 12: a separate Arabic font for body text. */
    arabicBody?: ArabicFont;
    /** Round 12: heading fine-tuning. */
    headingWeight?: number;
    headingUpper?: boolean;
    headingScale?: "s" | "m" | "l";
  };
  /** Corner radius in px, 0–24. */
  radius: number;
  nav: NavLayout;
  logoMediaId: string | null;
  faviconMediaId: string | null;
}

/** Placeholder artwork until the artist picks real media: just a colour and a shape. */
export interface SampleArt {
  tone: string;
  ratio: "16/9" | "4/3" | "1/1" | "3/4";
}

/* ---------- how a section looks (round 7): band, edges, spacing, card ---------- */

export type EdgeShape = "none" | "wave" | "curve" | "slant" | "torn" | "zigzag" | "scallop";
export type PatternId = "dots" | "grid" | "waves" | "sparkles" | "doodles" | "custom";

export interface SectionEdge {
  shape: EdgeShape;
  /** px on a 1200px-wide page. */
  height: number;
  flip: boolean;
}

export interface SectionStyle {
  bg: {
    kind: "none" | "color" | "gradient" | "image" | "pattern";
    color: string;
    color2: string;
    color3: string | null;
    angle: number;
    radial: boolean;
    /** Background picture (image) or the artist's own pattern tile (pattern + custom). */
    mediaId: string | null;
    overlay: string;
    overlayOpacity: number;
    /** Background picture blurred by this many px (0: sharp). */
    blur?: number;
    pattern: PatternId;
    patternColor: string;
    patternOpacity: number;
    patternScale: number;
  };
  edgeTop: SectionEdge;
  edgeBottom: SectionEdge;
  padTop: number;
  padBottom: number;
  width: "narrow" | "medium" | "normal" | "full";
  /** Round 14: an exact content width in px; not set: the width above decides. */
  maxWidth?: number;
  card: { on: boolean; color: string | null; radius: number; shadow: boolean; padding: number };
  /** Text colour; null picks a readable one for the background. */
  text: string | null;
  /** For in-page links (#name) and the sub-navigation section. */
  anchor: string;
  /** Pro: how the section comes in as visitors scroll. */
  animate: "none" | "fade" | "slide" | "zoom";
  /** Round 13: where the section's text sits (not set: the section's own default). */
  align?: "start" | "center" | "end";
}

type B<T extends string, P> = { id: string; type: T; style?: SectionStyle } & P;

/** Round 13: how a placed picture is framed (the file itself never changes). x/y: focus point in %, zoom: 1–3. */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

/** Round 13: one picture in an Images section. */
export interface ImageItem {
  id: string;
  mediaId: string | null;
  tone: string;
  caption: string;
  crop?: Crop;
}

export type ImagesLayout = "grid" | "masonry" | "rows" | "slideshow";

// Round 13: alternate (tall and short), featured (one big, Pro) and rows (every cover keeps its shape).
export type GalleryLayout = "grid" | "masonry" | "slider" | "fullscreen" | "alternate" | "featured" | "rows";
export type ThumbHover = "none" | "zoom" | "title" | "lift";
export type ThumbRatio = "16:9" | "4:3" | "1:1" | "4:5" | "3:4" | "2:3" | "original";

export type Block =
  | B<
      "cover",
      {
        mediaId: string | null;
        tone: string;
        heading: string;
        subheading: string;
        height: "full" | "large";
        crop?: Crop;
        /** Small line above the heading ("Cairo · Animation"). */
        eyebrow?: string;
        /** A round button at the bottom ("Watch reel") and where it goes. */
        button?: string;
        link?: string;
        /** Inside the page width with rounded corners, instead of edge to edge. */
        inset?: boolean;
        /** Round 14: edge to edge with rounded bottom corners. */
        roundBottom?: boolean;
        /** Heading size: a small line, medium or big. */
        size?: "s" | "m" | "l";
      }
    >
  | B<
      "header",
      {
        /** Optional section number ("01"), shown small in the accent colour. */
        number: string;
        title: string;
        subtitle: string;
        /** A logo shown in place of the title (the title stays as its alt text). */
        logoId: string | null;
        /** A small pill ("Directed by me"). */
        badge: string;
        divider: boolean;
        size: "m" | "l";
        /** Title in the accent colour, in capitals, with a short accent line under it. */
        accent?: boolean;
        upper?: boolean;
        underline?: boolean;
      }
    >
  | B<
      "feature",
      {
        /** One project shown inline: its video, logos, role, words, laurels and tools. */
        projectId: string | null;
        words: "all" | "short" | "none";
        logos: boolean;
        laurels: boolean;
        tools: boolean;
        credits: boolean;
        /** Picture behind the whole block (white words over it). */
        bgMediaId: string | null;
        /** Video on the start side or the end side. */
        side: "start" | "end";
      }
    >
  | B<"text", { text: string; align: "start" | "center"; size: "body" | "large" }>
  | B<"hero", { text: string; align: "start" | "center" }>
  | B<"columns", { items: Array<{ heading: string; text: string }> }>
  | B<
      "gallery",
      {
        layout: GalleryLayout;
        /** "all" or a project category id. */
        source: string;
        columns: number;
        gap: number;
        ratio: ThumbRatio;
        lightbox: boolean;
        captions: boolean;
        credits: boolean;
        hoverPlay: boolean;
        /** Round 13: what a cover does under the pointer. Not set: a light fade. */
        hover?: ThumbHover;
        /** Caption lines under each cover, in order (not set: the older title + credits switches). */
        lines?: Array<"network" | "client" | "role" | "studio" | "year">;
        /** Show the role line in the accent colour. */
        accentRole?: boolean;
        /** Grid: posters in one row, landscape covers in the next (wideColumns across). */
        split?: boolean;
        wideColumns?: number;
        /** Loops on covers: play under the pointer (default) or all the time. */
        loopPlay?: "hover" | "always";
        /** "accent": the title in the accent colour, the network small in capitals. */
        captionStyle?: "plain" | "accent";
        /** Round 14: caption text size (not set: medium). */
        captionSize?: "s" | "m" | "l";
        filter: boolean;
        /** Round 8: each project's own card size and text, instead of one size for all. */
        cardSizes?: boolean;
        /** Round 8: only these projects, in this order (empty: all of them). */
        picks?: string[];
        /** Shown while the artist has no projects yet. */
        samples: SampleArt[];
      }
    >
  | B<"image", { mediaId: string | null; tone: string; caption: string; fullWidth: boolean; crop?: Crop; showCaption?: boolean }>
  | B<
      "images",
      {
        heading: string;
        items: ImageItem[];
        layout: ImagesLayout;
        columns: number;
        /** Space between pictures, px. */
        gap: number;
        ratio: ThumbRatio;
        captions: boolean;
        /** A coloured frame around each picture (null: none). */
        frame?: string | null;
      }
    >
  | B<"video", { url: string; caption: string }>
  | B<"loop", { mediaId: string | null; caption: string }>
  | B<"before-after", { beforeId: string | null; afterId: string | null; beforeLabel: string; afterLabel: string }>
  | B<"pdf", { mediaId: string | null; label: string }>
  | B<"reel", { url: string; mediaId: string | null; title: string; tone: string }>
  | B<"credits", { heading: string; items: Array<{ year: string; title: string; role: string; studio: string }> }>
  | B<
      "logos",
      {
        heading: string;
        items: Array<{ name: string; mediaId: string | null }>;
        /** A colour band behind the logos (null: none). */
        band?: string | null;
        /** Logos as they are, or all white / all black. */
        tint?: "original" | "white" | "black";
        /** All logos in one even row. */
        oneRow?: boolean;
        /** How big the logos are, and how many per row (0: as many as fit). */
        size?: "s" | "m" | "l" | "xl";
        columns?: number;
      }
    >
  | B<"about", { heading: string; text: string; photoId: string | null; cvId: string | null }>
  | B<"contact", { heading: string; text: string; button: string; form?: ContactForm; /** An illustration beside the form. */ mediaId?: string | null; /** No panel behind it. */ flat?: boolean; /** Round 14: heading size (not set: large) and colour. */ headingSize?: "s" | "m" | "l"; accent?: boolean }>
  | B<"hire", { text: string }>
  | B<"social", { links: Array<{ network: string; url: string }> }>
  | B<"quote", { text: string; author: string }>
  | B<"free", FreeSection>
  | B<"cards", CardsSection>
  | B<"links", LinksSection>;

/* ---------- link page (round 9, like Linktree) ---------- */

export type LinkKind = "link" | "header" | "embed";
export type LinkHighlight = "none" | "wiggle" | "pulse" | "glow" | "shine";

export interface LinkItem {
  id: string;
  kind: LinkKind;
  title: string;
  /** Web address (links and embeds). */
  url: string;
  /** A small picture on the button. */
  mediaId: string | null;
  /** Or an icon: a social network's or one of ours. */
  icon: string;
  hidden: boolean;
  /** Pro: makes the link stand out. */
  highlight: LinkHighlight;
  /** Pro: shown only between these dates (YYYY-MM-DD, inclusive). */
  from: string;
  until: string;
}

export interface LinksSection {
  photoId: string | null;
  name: string;
  bio: string;
  /** The site's social links as a row of icons. */
  social: boolean;
  items: LinkItem[];
  button: {
    style: "fill" | "outline" | "soft" | "shadow";
    shape: "square" | "rounded" | "pill";
    /** null: the theme's text colour. */
    color: string | null;
    /** null: readable on the button colour. */
    textColor: string | null;
  };
  /** A share button (copy link, or the phone's share sheet). */
  share: boolean;
}

/* ---------- card sections (round 7) ---------- */

export type CardVariant =
  | "icons"
  | "images"
  | "tiles"
  | "stats"
  | "faq"
  | "mosaic"
  | "nav"
  | "marquee"
  | "testimonials"
  | "timeline"
  | "press"
  | "films"
  | "offers";

export interface CardItem {
  title: string;
  text: string;
  /** Small line: a role, a date, "Step 1", a badge like "Popular". */
  meta: string;
  icon: string;
  mediaId: string | null;
  tone: string;
  link: string;
  button: string;
  /** Testimonials: 0–5. */
  stars: number;
  price: string;
  /** Films: YouTube or Vimeo address. */
  url: string;
}

export interface CardsSection {
  /** Which library entry it came from ("c-…"); Pro ones hide on Free sites. */
  design: string;
  variant: CardVariant;
  heading: string;
  intro: string;
  columns: number;
  align: "start" | "center";
  /** One button for the whole section (the mosaic's "See more"). */
  button: string;
  link: string;
  /** One picture for the whole section (press: the book cover). */
  mediaId: string | null;
  tone: string;
  /** Picture cards without a panel behind them. */
  flat?: boolean;
  /** Category tiles: their shape, and the title in a corner or in the middle (in capitals). */
  tileRatio?: "4/5" | "16/9" | "1/1" | "4/3";
  tileText?: "corner" | "center";
  items: CardItem[];
}

/* ---------- free-form sections (phase 8C) ---------- */

/** What a free-form block shows. Every item carries every field, so editing and checking stay simple. */
export type FreeKind =
  | "text"
  | "heading"
  | "image"
  | "button"
  | "shape"
  | "line"
  | "video"
  // Round 5 (Squarespace-style items):
  | "social"
  | "quote"
  | "list"
  | "map"
  | "audio"
  | "project"
  // Round 7 decorations:
  | "underline"
  | "arrow"
  | "highlight"
  | "doodle"
  | "badge"
  | "icon"
  | "divider"
  | "panel"
  // Round 11: a doodle drawn by hand in the editor.
  | "drawing";

/** Doodle brushes (round 11). Neon, chalk, watercolour and glitch are Pro. */
export type BrushId = "pen" | "marker" | "pencil" | "crayon" | "neon" | "chalk" | "watercolor" | "glitch";

export interface DrawStroke {
  brush: BrushId;
  color: string;
  /** Width in drawing units. */
  size: number;
  opacity: number;
  /** Stabilisation, 0–100: smooths shaky lines. */
  smoothing: number;
  /** Drawn with a pressure pen (false: width follows speed, for mice and fingers). */
  pressure: boolean;
  /** x, y, pressure (0–100) for each point, in drawing units. */
  points: number[];
}

export interface Drawing {
  /** The drawing's own size (its strokes are in these units). */
  w: number;
  h: number;
  strokes: DrawStroke[];
  /** "Boiling" lines: redrawn slightly differently a few times a second, like hand-drawn animation. */
  boil: { on: boolean; amount: number; speed: number };
}

/** Options for decorations, and extra looks for pictures, buttons and text (round 7). */
export interface FreeDeco {
  /** Which drawing: wave / curved / sparkle / an icon name... (per kind). */
  style: string;
  /** Wave height, 0–100. */
  amp: number;
  /** Waves, zigzags, star points. */
  freq: number;
  /** Arrow curve (-100–100), star sharpness, highlight slant. */
  curve: number;
  /** Line thickness in px on a 1200px page. */
  stroke: number;
  head: "none" | "open" | "filled" | "both";
  headSize: number;
  dashed: boolean;
  /** Hand-drawn jitter, 0 (clean) – 100. */
  wobble: number;
  flipX: boolean;
  flipY: boolean;
  round: boolean;
  filled: boolean;
  /** Icons: a circle or rounded square behind. */
  backing: "none" | "circle" | "square";
  /** Pictures. */
  mask: "none" | "circle" | "arch" | "blob" | "rounded";
  frame: "none" | "sticker" | "polaroid";
  filter: "none" | "grayscale" | "duotone";
  duo1: string;
  duo2: string;
  backdrop: "none" | "circle" | "blob";
  /** Buttons: an arrow after the words. */
  arrow: boolean;
  /** Text: a soft shadow. */
  textShadow: boolean;
}

/**
 * Where an item sits on the section's grid: 24 columns on desktop, square cells, counted from the
 * reading start (left in English, right in Arabic). On phones items stack in reading order.
 */
export interface FreePlace {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FreeItem {
  id: string;
  kind: FreeKind;
  place: FreePlace;
  /** Stacking order: higher is in front. */
  z: number;
  /** Degrees, -180…180. */
  rotate: number;
  /** 0–100. */
  opacity: number;
  hideOnPhone: boolean;
  /** Text, heading and button label. */
  text: string;
  /** Font size in px on a 1200px-wide page; it scales with the page. */
  size: number;
  align: "start" | "center" | "end";
  /** Text colour; null follows the theme. */
  color: string | null;
  /** Shape fill, button background, line colour; null follows the theme. */
  fill: string | null;
  mediaId: string | null;
  /** Round 13: framing of the picture (image items). */
  crop?: Crop;
  fit: "cover" | "contain";
  /** Corner radius in px. */
  radius: number;
  shape: "rect" | "circle" | "pill" | "triangle" | "arch";
  /** Where an image or button goes (https://…, mailto:…, or a page address like /about). */
  link: string;
  /** YouTube or Vimeo address for video items. */
  url: string;
  /** Shown when sample art stands in for a missing picture. */
  tone: string;
  /** Hidden from the layers list: not on the live site, faint in the editor. */
  hidden: boolean;
  /** Typography (text, heading, button, quote, list). */
  font: "body" | "heading";
  weight: number;
  /** Line height in percent. */
  lineHeight: number;
  /** Letter spacing in hundredths of an em (Latin only; Arabic letters join). */
  tracking: number;
  upper: boolean;
  italic: boolean;
  /** Frame: images, shapes, buttons, video, project cards. */
  borderWidth: number;
  borderColor: string | null;
  shadow: boolean;
  /** Buttons: filled, outlined or plain text. */
  variant: "filled" | "outline" | "text";
  /** Image caption, quote author. */
  caption: string;
  /** List (FAQ / accordion) rows. */
  entries: Array<{ title: string; body: string }>;
  /** Project card: which project. */
  projectId: string | null;
  /** Round 7: decoration options and extra looks. */
  deco: FreeDeco;
  /** Second colour: gradient for shapes, panels and buttons; backing or backdrop colour. */
  fill2: string | null;
  /** Round 11: the doodle (drawing items only). */
  drawing?: Drawing;
}

export interface FreeSection {
  /** Which library design it started from (e.g. "d-cover"); Pro designs are hidden on Free sites. */
  design?: string;
  /** Height in grid rows (one row = one column width). */
  rows: number;
  background: string | null;
  bgMediaId: string | null;
  items: FreeItem[];
}

export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

/** "folder" is a menu item that only opens a dropdown of the pages inside it. */
export type PageType = "gallery" | "custom" | "about" | "link" | "folder" | "project" | "links";

/** A project card's size in a gallery that follows each project's own size (round 8). */
export type CardSize = "m" | "l" | "wide";
/** What a project card shows under its cover. */
export type CardText = "none" | "title" | "details";
export interface ProjectCard {
  size: CardSize;
  text: CardText;
}

export interface PageDraft {
  id: string;
  slug: string;
  title: string;
  type: PageType;
  /** External link pages only. */
  url?: string;
  /** "project" menu items only: the project this menu item opens. */
  projectId?: string;
  showInNav: boolean;
  /** Shown in this top-level page's dropdown in the menu, instead of in the menu itself. */
  parentId?: string | null;
  /** Set on the server; the password itself never reaches the browser. */
  hasPassword?: boolean;
  blocks: Block[];
}

/** The contact form's shape, set from the contact section's settings (round 4). */
export interface ContactForm {
  projectType: boolean;
  budget: boolean;
  deadline: boolean;
  /** An extra question of the artist's own; empty means none. */
  custom: string;
  /** Own words for the built-in fields; empty uses the default. */
  labels: { name: string; email: string; message: string };
  /** Shown after sending; empty uses the default. */
  success: string;
  /** Text beside the form, or above it. */
  layout: "stacked" | "split";
}

/** The site header, edited by clicking it on the canvas (round 4). */
export interface HeaderSettings {
  sticky: boolean;
  /** "none" sits on the page; "surface" is a soft band; or a #hex colour. */
  background: string;
  tagline: boolean;
  /** The Hire me button. `on` null follows the "available for work" switch. */
  hire: { on: boolean | null; label: string; link: string; style: "filled" | "outline" };
  /** Round 5 (Squarespace-style header settings). */
  linkGap: number;
  /** Extra space above and below, px. */
  padding: number;
  /** Round 14: the header's height as the space above and below it, px (null: the older spacing above). */
  space?: number | null;
  width: "full" | "inset";
  border: boolean;
  shadow: boolean;
  /** Text and link colour; null follows the theme. */
  textColor: string | null;
  /** Social link icons in the header. */
  social: boolean;
  logoSize: number;
  titleSize: number;
  /** Round 8: the font of the name when there's no logo picture (null: the site's heading font). */
  logoFont: HeadingFont | ArabicFont | null;
  upperLinks: boolean;
  /** With a colour background: fades to this colour (round 7). */
  gradientTo: string | null;
}

/** The site footer, edited by clicking it on the canvas (round 4). */
export interface FooterSettings {
  text: string;
  align: "center" | "start";
  social: boolean;
  cv: boolean;
  /** One column; name / links / email in three columns; or columns of links (round 7). */
  layout: "stack" | "columns" | "links";
  /** Link columns (layout "links"): a title and a few links each. */
  groups: Array<{ title: string; links: Array<{ label: string; link: string }> }>;
  background: string | null;
  textColor: string | null;
  showTitle: boolean;
  email: string;
  backToTop: boolean;
  /** Round 14: the logo picture instead of the site name, and the name, email and arrow in the accent colour. */
  logo?: boolean;
  accent?: boolean;
  socialStyle: "icons" | "text";
  border: boolean;
  padding: number;
  /** With a background colour: fades to this colour (round 7). */
  gradientTo: string | null;
}

export interface SiteDraft {
  language: Locale;
  title: string;
  tagline: string;
  theme: Theme;
  pages: PageDraft[];
  header?: HeaderSettings;
  footer?: FooterSettings;
  /** The password page's words and background (round 7, like Jackie's NDA page). */
  lock?: { title: string; text: string; style: SectionStyle };
  /** Which starter it came from (sign-up step 4). */
  layout?: LayoutId;
}
