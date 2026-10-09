import type { CSSProperties, ReactNode } from "react";
import { dirFor, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { imageSources, posterSources, type MediaLike } from "@/lib/media";
import type {
  ArabicFont,
  Block,
  BlockOf,
  FreeItem,
  HeadingFont,
  PageDraft,
  ProjectCard,
  SectionStyle,
  SiteDraft,
  ThumbRatio,
} from "@/lib/site/types";
import { parseVideoLink, videoPoster } from "@/lib/video";
import { InlineText } from "@/components/editor/InlineText";
import { CONTACT_WORDS, contactFormOf, type LegacyContactFields } from "@/lib/site/contact";
import { normalizeFooter, normalizeHeader } from "@/lib/site/normalize";
import { isSampleTone, toneFill } from "@/lib/site/samples";
import { arabicFonts, bodyFonts, headingFonts, siteFontVars } from "./fonts";
import { socialPath } from "./socialIcons";
import { EDGE_PATHS } from "./edges";
import { patternCss } from "./patterns";
import { DecoLabel, DecoSvg } from "./deco";
import { iconBodies, type IconName } from "@/components/ui/icons.generated";

// Renders an artist site from its draft (or a published snapshot). Artist sites use the artist's
// theme, never Fannan's brand. Layout reacts to the width of its own box (container queries), so
// the same markup works in the editor's phone preview and on a real phone.
// Pure: no hooks or handlers, so it renders on the server too. The editor selects blocks through
// their data-block-id.

export interface SiteMedia extends MediaLike {
  id: string;
  alt?: string;
  caption?: string;
  pages?: number | null;
  embed?: { poster: string | null; url?: string; title?: string; provider?: string } | null;
}

export interface GalleryProject {
  id: string;
  slug: string;
  title: string;
  category: string;
  client: string;
  role: string;
  visibility: "public" | "password" | "hidden";
  coverId: string | null;
  mature: boolean;
  card?: ProjectCard;
}

export interface SiteRenderProps {
  site: SiteDraft;
  /** Which page to show; the first by default. */
  pageId?: string;
  media?: Record<string, SiteMedia>;
  projects?: GalleryProject[];
  /** Where media files are served from. */
  mediaBase?: string;
  available?: { on: boolean; label: string; hire: string };
  /** Editor and dashboard previews: show sample art and placeholders for empty blocks. */
  editing?: boolean;
  selectedBlockId?: string | null;
  /** Editor canvas: text is typed in place. Path is the field inside the block, e.g. "items.2.title". */
  onText?: (blockId: string, path: string, value: string) => void;
  /** Editor canvas: the site name and tagline in the header, and the footer text, typed in place. */
  onSiteText?: (field: "title" | "tagline" | "footer", value: string) => void;
  /** Placeholder for empty text fields on the editor canvas ("Type here"). */
  typeHere?: string;
  /** Only the blocks, without header and footer (block previews in the editor's library). */
  bare?: boolean;
  /** Editor canvas: draws free-form sections with move/resize/rotate handles. */
  renderFree?: (b: BlockOf<"free">) => ReactNode;
  /** "Made with Fannan" footer credit on the Free plan. */
  credit?: string | null;
  /** Social links and CV from Settings, shown in the footer. */
  footerLinks?: Array<{ href: string; label: string; download?: boolean; kind?: "social" | "cv" }>;
  /** Social links from Settings (social link items, header and footer icons). */
  social?: Array<{ network: string; url: string }>;
  /** Site-wide contact form settings, for contact sections made before they had their own. */
  contactFallback?: LegacyContactFields | null;
  /** "Report this site" (live sites only). */
  report?: { href: string; label: string } | null;
  categoryLabel?: (id: string) => string;
  /** Public site: real links between pages and projects, lightbox and hover-play markers. */
  live?: boolean;
  /** Public site: the working contact form in place of the picture of one. */
  renderContact?: (b: BlockOf<"contact">) => ReactNode;
  /** Address of the contact form on the live site (Hire me button). */
  contactHref?: string;
  /** Replaces the page's blocks (project pages, password screens) while keeping the site's header and theme. */
  content?: ReactNode;
  /** A band around `content` (the password page's own background). */
  contentStyle?: SectionStyle;
}

const RATIO_CSS: Record<ThumbRatio, string | undefined> = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "1:1": "1 / 1",
  "2:3": "2 / 3",
  original: undefined,
};

/** Dark or light text, whichever reads better on this colour. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#141414" : "#FFFFFF";
}

/* ---------- pieces ---------- */

function Picture({
  m,
  base,
  tone,
  ratio,
  alt,
  want = 1600,
  className,
  still,
  eager,
  sizes = "(min-width: 1200px) 1200px, 100vw",
}: {
  m?: SiteMedia | null;
  base: string;
  tone?: string;
  ratio?: string;
  alt?: string;
  want?: number;
  className?: string;
  still?: boolean;
  /** Pictures near the top load straight away (and the first one first). */
  eager?: boolean;
  sizes?: string;
}) {
  const src = m ? (still ? posterSources(m, want, base) : imageSources(m, want, base)) : null;
  if (!src) {
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={className}
        style={{
          aspectRatio: ratio ?? "4 / 3",
          background: toneFill(tone) ?? "var(--site-surface)",
          borderRadius: "var(--site-radius)",
        }}
      />
    );
  }
  return (
    <picture className={cx("block overflow-hidden", className)} style={{ borderRadius: "var(--site-radius)" }}>
      {src.avifSet && <source type="image/avif" srcSet={src.avifSet} sizes={sizes} />}
      <img
        src={src.src}
        srcSet={src.srcSet}
        sizes={sizes}
        alt={alt ?? m?.alt ?? ""}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className="block h-full w-full object-cover"
        style={{ aspectRatio: ratio ?? (m?.width && m?.height ? `${m.width} / ${m.height}` : undefined) }}
      />
    </picture>
  );
}

function Empty({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <div
      className="flex min-h-[120px] items-center justify-center border-2 border-dashed p-6 text-center text-[14px]"
      style={{ borderColor: "var(--site-line)", color: "var(--site-muted)", borderRadius: "var(--site-radius)" }}
    >
      {children}
    </div>
  );
}

function PlayMark() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full"
      style={{ background: "rgba(20,20,20,.55)" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

const heading = (size: number): CSSProperties => ({
  fontFamily: "var(--site-heading)",
  fontWeight: "var(--site-heading-weight)" as unknown as number,
  fontSize: size,
  lineHeight: 1.1,
  letterSpacing: "-0.01em",
  margin: 0,
});

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p, i) => (
      <p key={i} className="m-0 whitespace-pre-line">
        {p}
      </p>
    ));
}

/* ---------- blocks ---------- */

function GalleryView({ b, ctx }: { b: BlockOf<"gallery">; ctx: Ctx }) {
  const shown = (ctx.projects ?? []).filter(
    (p) => p.visibility !== "hidden" && (b.source === "all" || p.category === b.source),
  );
  // Picked projects keep the order they were picked in.
  const projects = b.picks?.length
    ? (b.picks.map((id) => shown.find((p) => p.id === id)).filter(Boolean) as GalleryProject[])
    : shown;
  const ownSizes = !!b.cardSizes && b.layout === "grid";
  const fullscreen = b.layout === "fullscreen";
  const cols = Math.max(1, Math.min(6, b.columns));
  const ratio = RATIO_CSS[b.ratio];
  const tiles: Array<{
    key: string;
    slug?: string;
    title?: string;
    meta?: string;
    m?: SiteMedia | null;
    tone?: string;
    locked?: boolean;
    ratio?: string;
    card?: ProjectCard;
  }> = projects.length
    ? projects.map((p, i) => ({
        key: p.id,
        slug: p.slug,
        title: p.title,
        meta: [p.client, p.role].filter(Boolean).join(" · "),
        m: p.coverId ? ctx.media[p.coverId] : null,
        // Projects without a cover yet show sample art in the editor.
        tone: ctx.editing && !p.coverId ? (b.samples[i % Math.max(1, b.samples.length)]?.tone ?? "sample:01") : undefined,
        locked: p.visibility === "password",
        card: p.card,
      }))
    : ctx.editing
      ? b.samples.map((s, i) => ({ key: String(i), tone: s.tone, ratio: s.ratio.replace("/", " / ") }))
      : [];
  if (!tiles.length) return null;

  const tile = (t: (typeof tiles)[number]) => {
    const size = ownSizes ? (t.card?.size ?? "m") : "m";
    const showTitle = ownSizes ? (t.card?.text ?? "title") !== "none" : b.captions;
    const showMeta = ownSizes ? t.card?.text === "details" : b.credits;
    // Wide cards are as tall as the others, so their picture is twice as wide.
    const tileRatio =
      size === "wide" && ratio && ratio !== "auto"
        ? ratio.replace(/^(\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?)$/, (_, w, h) => `${Number(w) * 2} / ${h}`)
        : ratio;
    const inner = (
      <>
        <div
          className="relative"
          data-hover-loop={ctx.live && b.hoverPlay && t.m?.loop ? `${ctx.base}${t.m.loop}` : undefined}
        >
          <Picture
            m={t.m}
            base={ctx.base}
            tone={t.tone}
            ratio={tileRatio ?? t.ratio}
            alt={showTitle ? "" : t.title}
            want={b.columns <= 2 ? 1600 : 800}
            sizes={`(min-width: 1200px) ${Math.round(1200 / cols)}px, ${cols > 1 ? "50vw" : "100vw"}`}
            eager={(ctx.index ?? 9) <= 1 && tiles.indexOf(t) < cols}
            still={!b.hoverPlay || !!t.m?.loop}
          />
          {t.locked && (
            <span
              className="absolute end-2 top-2 rounded-[6px] px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: "var(--site-text)", color: "var(--site-bg)" }}
            >
              🔒
            </span>
          )}
        </div>
        {(showTitle || showMeta) && t.title && (
          <figcaption className="flex flex-col gap-0.5" style={fullscreen ? { padding: "0 12px" } : undefined}>
            {showTitle && <span className="font-semibold">{t.title}</span>}
            {showMeta && t.meta && (
              <span className="text-[14px]" style={{ color: "var(--site-muted)" }}>
                {t.meta}
              </span>
            )}
          </figcaption>
        )}
      </>
    );
    const style =
      b.layout === "masonry" ? { breakInside: "avoid" as const, marginBottom: b.gap, display: "flex" } : undefined;
    const span = size === "l" ? "site-span-l" : size === "wide" ? "site-span-wide" : undefined;
    return ctx.live && t.slug ? (
      <a
        key={t.key}
        href={`/${t.slug}`}
        className={cx("site-tile m-0 flex flex-col gap-2 no-underline", span)}
        style={{ color: "inherit", ...style }}
        data-card-size={ownSizes ? size : undefined}
      >
        {inner}
      </a>
    ) : (
      <figure key={t.key} className={cx("m-0 flex flex-col gap-2", span)} style={style} data-card-size={ownSizes ? size : undefined}>
        {inner}
      </figure>
    );
  };

  const categories = [...new Set(projects.map((p) => p.category).filter(Boolean))];
  return (
    <div
      className="flex flex-col gap-4"
      style={fullscreen ? { marginInline: "calc(var(--site-pad) * -1)" } : undefined}
    >
      {b.filter && categories.length > 1 && (
        <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
          {["all", ...categories].map((c, i) => (
            <span
              key={c}
              className="rounded-full px-3 py-1"
              style={
                i === 0
                  ? { background: "var(--site-text)", color: "var(--site-bg)" }
                  : { border: "1px solid var(--site-line)" }
              }
            >
              {c === "all" ? "·" : (ctx.categoryLabel?.(c) ?? c)}
            </span>
          ))}
        </div>
      )}
      {b.layout === "slider" ? (
        <div className="flex snap-x snap-mandatory overflow-x-auto pb-2" style={{ gap: b.gap }}>
          {tiles.map((t) => (
            <div
              key={t.key}
              className="flex-none snap-start"
              style={{ width: `calc((100% - ${(cols - 1) * b.gap}px) / ${cols} * 0.92)` }}
            >
              {tile(t)}
            </div>
          ))}
        </div>
      ) : b.layout === "masonry" ? (
        <div className="site-masonry" style={{ columnCount: cols, columnGap: b.gap, ["--cols" as string]: cols }}>
          {tiles.map(tile)}
        </div>
      ) : (
        <div
          className={cx("site-grid grid", ownSizes && "grid-flow-row-dense")}
          style={{ gap: fullscreen ? 0 : b.gap, ["--cols" as string]: cols }}
        >
          {tiles.map(tile)}
        </div>
      )}
    </div>
  );
}

function VideoView({
  url,
  caption,
  title,
  ctx,
  tone,
  mediaId,
}: {
  url: string;
  caption?: string;
  title?: string;
  ctx: Ctx;
  tone?: string;
  mediaId?: string | null;
}) {
  const loop = mediaId ? ctx.media[mediaId] : null;
  if (loop?.loop) {
    const poster = posterSources(loop, 1600, ctx.base)?.src;
    return (
      <figure className="m-0 flex flex-col gap-2">
        <video
          src={`${ctx.base}${loop.loop}`}
          poster={poster}
          muted
          loop
          autoPlay
          playsInline
          className="block w-full"
          style={{ borderRadius: "var(--site-radius)" }}
        />
        {caption && <figcaption style={{ color: "var(--site-muted)" }}>{caption}</figcaption>}
      </figure>
    );
  }
  const v = url ? parseVideoLink(url) : null;
  if (!v) return <Empty show={ctx.editing}>▶ YouTube / Vimeo</Empty>;
  const poster = videoPoster(v);
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        className="relative overflow-hidden"
        data-video={url}
        style={{ aspectRatio: "16 / 9", background: toneFill(tone) ?? "#141414", borderRadius: "var(--site-radius)" }}
      >
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={title ?? ""} loading="lazy" className="block h-full w-full object-cover" />
        )}
        <PlayMark />
      </div>
      {(caption || title) && <figcaption style={{ color: "var(--site-muted)" }}>{caption || title}</figcaption>}
    </figure>
  );
}

/* ---------- free-form sections (phase 8C) ---------- */

/** Grid placement and look of one free-form item, as CSS variables (see .site-free in globals.css). */
export function freeItemStyle(it: FreeItem, order: number): CSSProperties {
  return {
    ["--x" as string]: it.place.x + 1,
    ["--y" as string]: it.place.y + 1,
    ["--w" as string]: it.place.w,
    ["--h" as string]: it.place.h,
    ["--fs" as string]: it.size,
    ["--ord" as string]: order,
    zIndex: it.z,
    opacity: it.opacity / 100,
    transform: it.rotate ? `rotate(${it.rotate}deg)` : undefined,
  };
}

/** Reading order for phones: top to bottom, then from the reading start. */
export function freeOrder(items: FreeItem[]): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.place.y - b.place.y || a.place.x - b.place.x);
  return new Map(sorted.map((it, i) => [it.id, i]));
}

/** Words in *stars* take the accent colour; ==double equals== get a marker highlight (round 7). */
export function accentText(text: string): ReactNode {
  if (!/[*=]/.test(text)) return text;
  const parts = text.split(/(\*[^*\n]+\*|==[^=\n]+==)/g);
  return parts.map((p, i) =>
    p.startsWith("==") && p.endsWith("==") && p.length > 4 ? (
      <mark
        key={i}
        style={{
          background: "linear-gradient(transparent 40%, color-mix(in srgb, var(--site-accent) 55%, transparent) 40%)",
          color: "inherit",
          padding: "0 .1em",
        }}
      >
        {p.slice(2, -2)}
      </mark>
    ) : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
      <span key={i} style={{ color: "var(--site-accent)" }}>
        {p.slice(1, -1)}
      </span>
    ) : (
      p
    ),
  );
}

/** A colour, or a gradient from it to a second colour (shapes, panels, buttons). */
const paint = (a: string, b: string | null) => (b ? `linear-gradient(135deg, ${a}, ${b})` : a);

/** Typography shared by the text-like items (text, heading, button, quote, list). */
function itemType(it: FreeItem): CSSProperties {
  return {
    fontFamily: it.font === "heading" ? "var(--site-heading)" : "var(--site-body)",
    fontWeight: it.weight,
    lineHeight: it.lineHeight / 100,
    // Arabic letters join, so letter spacing only applies to Latin text (the site sets lang).
    letterSpacing: it.tracking ? `${it.tracking / 100}em` : undefined,
    textTransform: it.upper ? "uppercase" : undefined,
    fontStyle: it.italic ? "italic" : undefined,
    textShadow: it.deco.textShadow ? "0 2px 12px rgba(0,0,0,.35)" : undefined,
  };
}

/** The frame around pictures, shapes, buttons, videos and cards. */
function itemFrame(it: FreeItem): CSSProperties {
  return {
    border: it.borderWidth ? `${it.borderWidth}px solid ${it.borderColor ?? "var(--site-text)"}` : undefined,
    boxShadow: it.shadow ? "0 10px 30px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.12)" : undefined,
  };
}

/** Shape outlines beyond corner radius. */
const SHAPE_CLIP: Record<FreeItem["shape"], string | undefined> = {
  rect: undefined,
  circle: undefined,
  pill: undefined,
  triangle: "polygon(50% 0, 100% 100%, 0 100%)",
  arch: undefined,
};

/** SoundCloud and Spotify links become their players. */
function audioEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (/(^|\.)soundcloud\.com$/.test(u.hostname))
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23141414&visual=false`;
    if (u.hostname === "open.spotify.com") return `https://open.spotify.com/embed${u.pathname}`;
  } catch {}
  return null;
}

export interface FreeExtras {
  social?: Array<{ network: string; url: string }>;
  projects?: GalleryProject[];
}

/** What a free-form item shows. `text` lets the editor swap in text typed in place. */
export function FreeItemContent({
  it,
  media,
  base,
  live,
  text,
  extras = {},
}: {
  it: FreeItem;
  media: Record<string, SiteMedia>;
  base: string;
  live: boolean;
  text?: ReactNode;
  extras?: FreeExtras;
}) {
  const align = { start: "start", center: "center", end: "end" }[it.align] as CSSProperties["textAlign"];
  const justify = { start: "flex-start", center: "center", end: "flex-end" }[it.align];
  const wrapLink = (node: ReactNode) =>
    live && it.link ? (
      <a href={it.link} className="block h-full w-full" style={{ color: "inherit" }}>
        {node}
      </a>
    ) : (
      node
    );
  switch (it.kind) {
    case "text":
    case "heading":
      return (
        <div
          className={cx("site-free-text h-full w-full", it.kind === "heading" && "site-free-heading")}
          style={{ textAlign: align, color: it.color ?? undefined, ...itemType(it) }}
        >
          {text ?? <span className="whitespace-pre-line">{accentText(it.text)}</span>}
        </div>
      );
    case "image": {
      const m = it.mediaId ? (media[it.mediaId] ?? null) : null;
      const dc = it.deco;
      const maskRadius =
        dc.mask === "circle"
          ? "50%"
          : dc.mask === "arch"
            ? "9999px 9999px 0 0"
            : dc.mask === "rounded"
              ? "18%"
              : dc.mask === "blob"
                ? "46% 54% 58% 42% / 52% 44% 56% 48%"
                : it.radius;

      const filter =
        dc.filter === "grayscale" ? "grayscale(1)" : dc.filter === "duotone" ? "grayscale(1) contrast(1.1)" : undefined;
      const framed =
        dc.frame === "sticker"
          ? { border: "6px solid #FFFFFF", boxShadow: "0 8px 24px rgba(0,0,0,.18)" }
          : dc.frame === "polaroid"
            ? { background: "#FFFFFF", padding: "5% 5% 16%", boxShadow: "0 10px 30px rgba(0,0,0,.18)" }
            : itemFrame(it);
      const pic = (
        <div className="relative h-full w-full">
          {dc.backdrop !== "none" && (
            <div
              aria-hidden
              className="absolute"
              style={{
                inset: "-6%",
                background: it.fill2 ?? "var(--site-accent)",
                borderRadius: dc.backdrop === "circle" ? "50%" : "46% 54% 58% 42% / 52% 44% 56% 48%",
              }}
            />
          )}
          <div
            className="relative h-full w-full overflow-hidden"
            style={{ borderRadius: dc.frame === "polaroid" ? 4 : maskRadius, ...framed }}
          >
            <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: dc.frame === "polaroid" ? 2 : undefined }}>
              <Picture
                m={m}
                base={base}
                tone={it.tone}
                ratio="auto"
                want={1600}
                className={cx("h-full w-full !rounded-none", it.fit === "contain" && "[&_img]:!object-contain")}
                alt={m?.alt}
              />
              {filter && <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backdropFilter: filter }} />}
              {dc.filter === "duotone" && (
                <>
                  <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: dc.duo2, mixBlendMode: "multiply" }} />
                  <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: dc.duo1, mixBlendMode: "lighten" }} />
                </>
              )}
            </div>
          </div>
        </div>
      );
      if (!it.caption) return wrapLink(pic);
      return (
        <figure className="m-0 flex h-full w-full flex-col gap-2">
          <div className="min-h-0 flex-1">{wrapLink(pic)}</div>
          <figcaption className="site-free-text" style={{ ["--fs" as string]: 14, color: "var(--site-muted)", textAlign: align }}>
            {it.caption}
          </figcaption>
        </figure>
      );
    }
    case "button": {
      const inner = text ?? it.text;
      const filled = it.variant === "filled";
      const style: CSSProperties = {
        background: filled ? paint(it.fill ?? "var(--site-accent)", it.fill2) : "transparent",
        color:
          it.color ??
          (filled ? (it.fill ? readableOn(it.fill) : "var(--site-on-accent)") : (it.fill ?? "var(--site-text)")),
        borderRadius: it.radius,
        border: it.variant === "outline" ? `${Math.max(1, it.borderWidth || 2)}px solid ${it.fill ?? "var(--site-text)"}` : itemFrame(it).border,
        boxShadow: itemFrame(it).boxShadow,
        textDecoration: it.variant === "text" ? "underline" : undefined,
        textUnderlineOffset: "0.25em",
        ...itemType(it),
      };
      return (
        <div className="flex h-full w-full items-center" style={{ justifyContent: justify }}>
          {live && it.link ? (
            <a href={it.link} className="site-free-button gap-[0.5em]" style={style}>
              {inner}
              {it.deco.arrow && <span aria-hidden className="rtl:-scale-x-100">→</span>}
            </a>
          ) : (
            <span className="site-free-button gap-[0.5em]" style={style}>
              {inner}
              {it.deco.arrow && <span aria-hidden className="rtl:-scale-x-100">→</span>}
            </span>
          )}
        </div>
      );
    }
    case "shape":
      return wrapLink(
        <div
          className="h-full w-full"
          style={{
            background: paint(it.fill ?? "var(--site-text)", it.fill2),
            borderRadius:
              it.shape === "circle" ? "50%" : it.shape === "pill" ? 9999 : it.shape === "arch" ? "9999px 9999px 0 0" : it.radius,
            clipPath: SHAPE_CLIP[it.shape],
            ...(it.shape === "triangle" ? {} : itemFrame(it)),
          }}
        />,
      );
    case "line":
      return (
        <div className="flex h-full w-full items-center">
          <div className="site-free-line w-full" style={{ background: it.fill ?? "var(--site-text)" }} />
        </div>
      );
    case "video":
      return it.url ? (
        <div className="h-full w-full overflow-hidden" style={{ borderRadius: it.radius, ...itemFrame(it) }}>
          <VideoView url={it.url} caption="" ctx={{ media, base, editing: !live, live } as Ctx} />
        </div>
      ) : (
        <div className="h-full w-full" style={{ background: toneFill(it.tone), borderRadius: it.radius }} />
      );
    case "social": {
      const links = extras.social ?? [];
      const shown = links.length ? links : live ? [] : [{ network: "instagram", url: "#" }, { network: "behance", url: "#" }, { network: "linkedin", url: "#" }];
      return (
        <div
          className="flex h-full w-full flex-wrap items-center"
          style={{ justifyContent: justify, gap: "calc(var(--fs) * 100cqi / 1200 * 0.7)", color: it.color ?? "var(--site-text)" }}
          data-testid="social-item"
        >
          {shown.map((l, i) => {
            const icon = (
              <svg viewBox="0 0 24 24" aria-hidden className="block" style={{ width: "max(16px, calc(var(--fs) * 100cqi / 1200))", height: "max(16px, calc(var(--fs) * 100cqi / 1200))", fill: "currentColor" }}>
                <path d={socialPath(l.network)} />
              </svg>
            );
            return live ? (
              <a key={i} href={l.url} target="_blank" rel="me noopener" aria-label={l.network} style={{ color: "inherit" }}>
                {icon}
              </a>
            ) : (
              <span key={i}>{icon}</span>
            );
          })}
        </div>
      );
    }
    case "quote":
      return (
        <figure className="m-0 flex h-full w-full flex-col gap-3" style={{ textAlign: align, color: it.color ?? undefined }}>
          <blockquote className="site-free-text m-0" style={itemType(it)}>
            {text ?? <span className="whitespace-pre-line">“{accentText(it.text)}”</span>}
          </blockquote>
          {it.caption && (
            <figcaption className="site-free-text" style={{ ["--fs" as string]: Math.max(12, Math.round(it.size * 0.45)), color: "var(--site-muted)" }}>
              {it.caption}
            </figcaption>
          )}
        </figure>
      );
    case "list":
      return (
        <div className="site-free-text flex h-full w-full flex-col" style={{ color: it.color ?? undefined, textAlign: align }}>
          {it.entries.map((e, i) => (
            <details
              key={i}
              open={!live || i === 0}
              className="py-3"
              style={{ borderBottom: "1px solid var(--site-line)" }}
            >
              <summary className="cursor-pointer list-none font-semibold" style={itemType(it)}>
                {e.title}
              </summary>
              <p className="mt-2 mb-0 whitespace-pre-line" style={{ color: "var(--site-muted)" }}>
                {e.body}
              </p>
            </details>
          ))}
        </div>
      );
    case "map":
      return (
        <div className="h-full w-full overflow-hidden" style={{ borderRadius: it.radius, ...itemFrame(it) }}>
          {it.text ? (
            <iframe
              title={it.text}
              src={`https://www.google.com/maps?q=${encodeURIComponent(it.text)}&output=embed`}
              className="h-full w-full border-0"
              loading="lazy"
              style={{ pointerEvents: live ? undefined : "none" }}
            />
          ) : (
            <div className="h-full w-full" style={{ background: "var(--site-surface)" }} />
          )}
        </div>
      );
    case "audio": {
      const src = it.url ? audioEmbed(it.url) : null;
      return src ? (
        <iframe
          title="Audio"
          src={src}
          className="h-full w-full border-0"
          loading="lazy"
          allow="autoplay; encrypted-media"
          style={{ borderRadius: it.radius, pointerEvents: live ? undefined : "none" }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center gap-3 px-4"
          style={{ background: "var(--site-surface)", borderRadius: it.radius, color: "var(--site-muted)" }}
        >
          <span className="size-9 flex-none rounded-full" style={{ background: "var(--site-accent)" }} />
          <span className="h-1.5 flex-1 rounded-full" style={{ background: "var(--site-line)" }} />
        </div>
      );
    }
    case "underline":
    case "arrow":
    case "divider":
    case "icon":
      return <DecoSvg it={it} color={it.fill ?? (it.kind === "icon" ? "var(--site-text)" : "var(--site-accent)")} />;
    case "highlight":
      // A marker swash; new ones are placed behind the other items (see addFreeItem).
      return <DecoSvg it={it} color={it.fill ?? "#F5E663"} />;
    case "doodle":
      return (
        <div className="relative h-full w-full">
          <DecoSvg it={it} color={it.fill ?? "var(--site-accent)"} />
          <DecoLabel
            it={it}
            style={{
              ...itemType(it),
              fontSize: `calc(${it.size} * 100cqi / 1200)`,
              color: it.color ?? (it.fill ? readableOn(it.fill) : "var(--site-on-accent)"),
            }}
          />
        </div>
      );
    case "badge": {
      const outline = it.variant === "outline";
      return (
        <div className="flex h-full w-full items-center" style={{ justifyContent: justify }}>
          <span
            className="site-free-text inline-flex items-center px-[0.9em] py-[0.35em] whitespace-nowrap"
            style={{
              ...itemType(it),
              background: outline ? "transparent" : paint(it.fill ?? "var(--site-accent)", it.fill2),
              color: it.color ?? (outline ? (it.fill ?? "var(--site-text)") : it.fill ? readableOn(it.fill) : "var(--site-on-accent)"),
              border: outline ? `1.5px solid ${it.fill ?? "var(--site-text)"}` : undefined,
              borderRadius: it.radius,
            }}
          >
            {it.text}
          </span>
        </div>
      );
    }
    case "panel":
      return (
        <div
          className="h-full w-full"
          style={{
            background: paint(it.fill ?? "var(--site-surface)", it.fill2),
            borderRadius: it.radius,
            ...itemFrame(it),
            boxShadow: it.shadow ? "0 18px 50px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)" : undefined,
          }}
        />
      );
    case "project": {
      const pr = extras.projects?.find((x) => x.id === it.projectId) ?? (live ? null : extras.projects?.[0]);
      const m = pr?.coverId ? (media[pr.coverId] ?? null) : null;
      const card = (
        <div className="flex h-full w-full flex-col gap-2">
          <div className="min-h-0 flex-1 overflow-hidden" style={{ borderRadius: it.radius, ...itemFrame(it) }}>
            <Picture m={m} base={base} tone={it.tone} ratio="auto" want={1200} className="h-full w-full !rounded-none" alt={pr?.title} />
          </div>
          <span className="site-free-text font-semibold" style={{ ...itemType(it), textAlign: align, color: it.color ?? undefined }}>
            {pr?.title ?? ""}
          </span>
        </div>
      );
      return live && pr && pr.visibility !== "hidden" ? (
        <a href={`/${pr.slug}`} className="block h-full w-full" style={{ color: "inherit", textDecoration: "none" }}>
          {card}
        </a>
      ) : (
        card
      );
    }
  }
}

/* ---------- card sections (round 7) ---------- */

function CardIcon({ name, size = 40 }: { name: string; size?: number }) {
  const body = iconBodies[(name in iconBodies ? name : "sparkle") as IconName];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      aria-hidden
      className="block flex-none"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

function CardsView({ b, ctx }: { b: BlockOf<"cards">; ctx: Ctx }) {
  const m = (id: string | null) => (id ? (ctx.media[id] ?? null) : null);
  const center = b.align === "center";
  const cols = Math.max(1, Math.min(6, b.columns));
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  const tx = (n: number, field: "title" | "text" | "meta" | "button" | "price", props: Partial<Parameters<typeof T>[0]> = {}) => (
    <T ctx={ctx} path={`items.${n}.${field}`} value={b.items[n][field]} {...props} />
  );
  const link = (href: string, children: ReactNode, cls: string, style?: CSSProperties) =>
    ctx.live && href ? (
      <a href={href} className={cls} style={{ textDecoration: "none", ...style }}>
        {children}
      </a>
    ) : (
      <span className={cls} style={style}>
        {children}
      </span>
    );
  const head =
    b.heading || b.intro || ctx.onText ? (
      <div className={cx("flex flex-col gap-3", center && "items-center text-center")}>
        <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(36)} />
        <T ctx={ctx} path="intro" value={b.intro} as="p" className="m-0 max-w-[640px]" style={{ color: "var(--site-muted)" }} multiline />
      </div>
    ) : null;
  const card = { background: "var(--site-surface)", borderRadius: "calc(var(--site-radius) * 2)" };

  let body: ReactNode = null;
  switch (b.variant) {
    case "icons":
      body = (
        <div className="site-cards-grid grid gap-8" style={grid}>
          {b.items.map((it, n) => (
            <div key={n} className={cx("flex flex-col gap-3", center && "items-center text-center")}>
              <span style={{ color: "var(--site-accent)" }}>
                <CardIcon name={it.icon} size={44} />
              </span>
              {tx(n, "title", { as: "h3", style: heading(20) })}
              {tx(n, "text", { as: "p", className: "m-0 text-[15px]", style: { color: "var(--site-muted)" }, multiline: true })}
            </div>
          ))}
        </div>
      );
      break;
    case "images":
      body = (
        <div className="site-cards-grid grid gap-6" style={grid}>
          {b.items.map((it, n) => (
            <div key={n} className="flex flex-col overflow-hidden" style={card}>
              <Picture m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="4 / 3" className="!rounded-none" />
              <div className="flex flex-1 flex-col items-start gap-2 p-6">
                {tx(n, "title", { as: "h3", style: heading(22) })}
                {tx(n, "text", { as: "p", className: "m-0 text-[15px]", style: { color: "var(--site-muted)" }, multiline: true })}
                {(it.button || ctx.onText) && link(it.link, tx(n, "button"), "site-button mt-auto text-[14px]")}
              </div>
            </div>
          ))}
        </div>
      );
      break;
    case "stats":
      body = (
        <div className="site-cards-grid grid gap-8" style={grid}>
          {b.items.map((it, n) => (
            <div key={n} className={cx("flex flex-col gap-1", center && "items-center text-center")}>
              {tx(n, "title", { as: "div", style: { ...heading(56), color: "var(--site-accent)" } })}
              {tx(n, "text", { as: "p", className: "m-0 text-[15px]", style: { color: "var(--site-muted)" } })}
            </div>
          ))}
        </div>
      );
      break;
    case "faq":
      body = (
        <div className="mx-auto flex w-full max-w-[820px] flex-col">
          {b.items.map((it, n) => (
            <details key={n} open={!ctx.live} className="py-4" style={{ borderBottom: "1px solid var(--site-line)" }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-semibold">
                {tx(n, "title")}
                <span aria-hidden style={{ color: "var(--site-accent)" }}>
                  +
                </span>
              </summary>
              {tx(n, "text", { as: "p", className: "mt-2 mb-0", style: { color: "var(--site-muted)" }, multiline: true })}
            </details>
          ))}
        </div>
      );
      break;
    case "mosaic":
      body = (
        <div className="relative">
          <div className="site-cards-grid grid" style={grid}>
            {b.items.map((it, n) => (
              <Picture key={n} m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="1 / 1" className="!rounded-none" />
            ))}
          </div>
          {(b.button || ctx.onText) && (
            <div className="absolute inset-0 flex items-center justify-center">
              {link(b.link, <T ctx={ctx} path="button" value={b.button} />, "rounded-full px-8 py-3 text-[14px] font-semibold shadow-lg", {
                background: "var(--site-bg)",
                color: "var(--site-text)",
              })}
            </div>
          )}
        </div>
      );
      break;
    case "nav":
      body = (
        <nav
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-3 text-[15px] font-semibold"
          style={{ position: ctx.live ? "sticky" : undefined, top: 0 }}
          data-testid="section-nav"
        >
          {b.items.map((it, n) => (
            <span key={n}>{link(it.link, tx(n, "title"), "", { color: "inherit" })}</span>
          ))}
        </nav>
      );
      break;
    case "marquee": {
      // Two copies roll by; it stops for visitors who prefer less motion.
      const row = b.items.map((it, n) => (
        <span key={n} className="flex flex-none items-center px-8" style={{ color: "var(--site-muted)" }}>
          {it.mediaId ? (
            <span className="block h-10 w-32">
              <Picture m={m(it.mediaId)} base={ctx.base} ratio="auto" className="h-full [&_img]:object-contain" />
            </span>
          ) : (
            <span style={{ ...heading(26), color: "inherit" }}>{it.title}</span>
          )}
        </span>
      ));
      body = (
        <div className="site-marquee overflow-hidden" data-testid="marquee">
          <div className="site-marquee-track flex w-max">
            {row}
            <span aria-hidden className="flex">
              {row}
            </span>
          </div>
        </div>
      );
      break;
    }
    case "testimonials":
      body = (
        <div className="site-snap -mx-[var(--site-pad)] flex snap-x snap-mandatory gap-5 overflow-x-auto px-[var(--site-pad)] pb-2">
          {b.items.map((it, n) => (
            <figure
              key={n}
              className="m-0 flex w-[min(360px,80%)] flex-none snap-start flex-col gap-4 p-7"
              style={{ ...card, border: "1px solid var(--site-line)" }}
            >
              <span aria-label={`${it.stars}/5`} style={{ color: "var(--site-accent)", letterSpacing: "0.15em" }}>
                {"★".repeat(it.stars)}
              </span>
              {tx(n, "text", { as: "p", className: "m-0 text-[17px]", multiline: true })}
              <figcaption className="mt-auto flex items-center gap-3">
                <span className="block size-11 flex-none overflow-hidden rounded-full">
                  <Picture m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="1 / 1" className="!rounded-full" />
                </span>
                <span className="flex flex-col">
                  {tx(n, "title", { className: "font-semibold" })}
                  {tx(n, "meta", { className: "text-[13px]", style: { color: "var(--site-muted)" } })}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      );
      break;
    case "timeline":
      body = (
        <div className="site-timeline relative mx-auto flex w-full max-w-[1000px] flex-col gap-10">
          <span aria-hidden className="site-timeline-line absolute inset-y-0 start-1/2 w-[2px] -translate-x-1/2" style={{ background: "var(--site-line)" }} />
          {b.items.map((it, n) => (
            <div key={n} className={cx("site-timeline-row relative grid grid-cols-2 items-center gap-12", n % 2 === 1 && "site-timeline-flip")}>
              <div className={cx(n % 2 ? "order-2" : "order-1")}>
                <Picture m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="4 / 3" />
              </div>
              <div className={cx("flex flex-col gap-2", n % 2 ? "order-1 items-end text-end" : "order-2")}>
                {tx(n, "meta", { className: "text-[13px] font-semibold tracking-[0.06em] uppercase", style: { color: "var(--site-accent)" } })}
                {tx(n, "title", { as: "h3", style: heading(26) })}
                {tx(n, "text", { as: "p", className: "m-0", style: { color: "var(--site-muted)" }, multiline: true })}
              </div>
              <span aria-hidden className="absolute start-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "var(--site-accent)", boxShadow: "0 0 0 6px var(--site-bg)" }} />
            </div>
          ))}
        </div>
      );
      break;
    case "press":
      body = (
        <div className="site-cards-grid grid items-center gap-12" style={{ gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }}>
          <Picture m={m(b.mediaId)} base={ctx.base} tone={b.tone} ratio="4 / 5" />
          <div className="flex flex-col">
            {b.items.map((it, n) => (
              <div key={n}>
                {link(
                  it.link,
                  <span className="flex items-center justify-between gap-4 py-4" style={{ borderBottom: "1px solid var(--site-line)" }}>
                    <span className="flex flex-col">
                      {tx(n, "title", { className: "text-[18px] font-semibold" })}
                      {tx(n, "meta", { className: "text-[14px]", style: { color: "var(--site-muted)" } })}
                    </span>
                    <span aria-hidden className="rtl:-scale-x-100" style={{ color: "var(--site-accent)" }}>
                      →
                    </span>
                  </span>,
                  "block",
                  { color: "inherit" },
                )}
              </div>
            ))}
          </div>
        </div>
      );
      break;
    case "films":
      body = (
        <div className="site-cards-grid grid gap-8" style={grid}>
          {b.items.map((it, n) => (
            <div key={n} className="flex flex-col gap-3">
              {it.url ? (
                <VideoView url={it.url} caption="" ctx={ctx} />
              ) : (
                <Picture m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="16 / 9" />
              )}
              {tx(n, "title", { as: "h3", style: heading(22) })}
              {tx(n, "text", { as: "p", className: "m-0 text-[15px]", style: { color: "var(--site-muted)" }, multiline: true })}
            </div>
          ))}
        </div>
      );
      break;
    case "offers":
      body = (
        <div className="site-cards-grid grid items-stretch gap-6" style={grid}>
          {b.items.map((it, n) => {
            const hot = !!it.meta;
            return (
              <div
                key={n}
                className="relative flex flex-col gap-4 p-7"
                style={{ ...card, border: hot ? "2px solid var(--site-accent)" : "1px solid var(--site-line)" }}
              >
                {hot && (
                  <span className="absolute -top-3 start-6 rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: "var(--site-accent)", color: "var(--site-on-accent)" }}>
                    {it.meta}
                  </span>
                )}
                {tx(n, "title", { as: "h3", style: heading(22) })}
                {tx(n, "price", { as: "div", style: heading(34) })}
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
                  {it.text.split("\n").filter(Boolean).map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden style={{ color: "var(--site-accent)" }}>
                        ✓
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                {(it.button || ctx.onText) && link(it.link, tx(n, "button"), "site-button mt-auto justify-center text-[14px]")}
              </div>
            );
          })}
        </div>
      );
      break;
  }
  return (
    <div className="flex flex-col gap-10" data-testid={`cards-${b.variant}`}>
      {b.variant !== "nav" && head}
      {body}
    </div>
  );
}

function FreeSectionView({ b, ctx }: { b: BlockOf<"free">; ctx: Ctx }) {
  const bg = b.bgMediaId ? (ctx.media[b.bgMediaId] ?? null) : null;
  const order = freeOrder(b.items);
  return (
    <div className="site-free-band relative" style={{ background: b.background ?? undefined }}>
      {bg && (
        <div className="absolute inset-0" aria-hidden>
          <Picture m={bg} base={ctx.base} want={2560} ratio="auto" className="h-full w-full !rounded-none" />
        </div>
      )}
      <div className="site-free relative">
        <div className="site-free-grid" style={{ ["--rows" as string]: b.rows }}>
          {b.items
            .filter((it) => !it.hidden)
            .map((it) => (
              <div
                key={it.id}
                className={cx("site-free-item", `site-free-${it.kind}`)}
                data-phone-hidden={it.hideOnPhone || undefined}
                style={freeItemStyle(it, order.get(it.id) ?? 0)}
              >
                <FreeItemContent
                  it={it}
                  media={ctx.media}
                  base={ctx.base}
                  live={ctx.live}
                  extras={{ social: ctx.social, projects: ctx.projects }}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function BlockView({ b, ctx }: { b: Block; ctx: Ctx }) {
  const m = (id: string | null) => (id ? (ctx.media[id] ?? null) : null);
  switch (b.type) {
    case "cards":
      return <CardsView b={b} ctx={ctx} />;
    case "cover": {
      const img = m(b.mediaId);
      return (
        <div
          className="relative flex flex-col justify-end overflow-hidden"
          style={{
            minHeight: b.height === "full" ? "min(88vh, 900px)" : "min(60vh, 560px)",
            marginInline: "calc(var(--site-pad) * -1)",
            background: toneFill(b.tone),
          }}
        >
          {img && (
            <div className="absolute inset-0">
              <Picture m={img} base={ctx.base} want={2560} className="h-full w-full !rounded-none" ratio="auto" />
            </div>
          )}
          <div
            className="relative flex flex-col gap-3 p-[var(--site-pad)]"
            style={{
              // On a picture or a sample drawing: white words over a soft shade.
              color: img || isSampleTone(b.tone) ? "#FFFFFF" : readableOn(b.tone),
              background: img || isSampleTone(b.tone) ? "linear-gradient(transparent, rgba(0,0,0,.45))" : undefined,
            }}
          >
            <T ctx={ctx} path="heading" value={b.heading} as="h1" style={heading(52)} className="@max-2xl:!text-[34px]" />
            <T ctx={ctx} path="subheading" value={b.subheading} as="p" className="m-0 text-[18px] opacity-85" />
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div
          className="flex max-w-[760px] flex-col gap-4"
          style={{
            fontSize: b.size === "large" ? 22 : 18,
            lineHeight: 1.6,
            textAlign: b.align === "center" ? "center" : undefined,
            marginInline: b.align === "center" ? "auto" : undefined,
          }}
        >
          {ctx.onText ? (
            <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="text" value={b.text} as="div" multiline />
          ) : b.text ? (
            paragraphs(b.text)
          ) : (
            <Empty show={ctx.editing}>¶</Empty>
          )}
        </div>
      );
    case "hero":
      return (
        <h2
          style={{
            ...heading(56),
            maxWidth: 900,
            textAlign: b.align === "center" ? "center" : undefined,
            marginInline: b.align === "center" ? "auto" : undefined,
          }}
          className="@max-2xl:!text-[36px]"
        >
          {ctx.onText ? <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="text" value={b.text} /> : b.text}
        </h2>
      );
    case "columns":
      return (
        <div className="site-grid grid gap-8" style={{ ["--cols" as string]: Math.max(1, b.items.length) }}>
          {b.items.map((c, i) => (
            <div key={i} className="flex flex-col gap-2">
              <T ctx={ctx} path={`items.${i}.heading`} value={c.heading} as="h3" style={heading(22)} />
              <T
                ctx={ctx}
                path={`items.${i}.text`}
                value={c.text}
                as="p"
                className="m-0"
                style={{ color: "var(--site-muted)" }}
                multiline
              />
            </div>
          ))}
        </div>
      );
    case "gallery":
      return <GalleryView b={b} ctx={ctx} />;
    case "image": {
      const img = m(b.mediaId);
      if (!img && !ctx.editing) return null;
      return (
        <figure
          className="m-0 flex flex-col gap-2"
          style={b.fullWidth ? { marginInline: "calc(var(--site-pad) * -1)" } : undefined}
          data-lightbox={ctx.live && img ? imageSources(img, 2560, ctx.base)?.src : undefined}
          data-lightbox-caption={ctx.live ? b.caption || img?.alt || undefined : undefined}
        >
          <Picture
            m={img}
            base={ctx.base}
            tone={b.tone}
            ratio={img ? undefined : "16 / 9"}
            want={2560}
            eager={(ctx.index ?? 9) <= 1}
            className={b.fullWidth ? "!rounded-none" : undefined}
          />
          <T
            ctx={ctx}
            path="caption"
            value={b.caption}
            as="figcaption"
            style={{ color: "var(--site-muted)", padding: b.fullWidth ? "0 var(--site-pad)" : undefined }}
          />
        </figure>
      );
    }
    case "video":
      return <VideoView url={b.url} caption={b.caption} ctx={ctx} />;
    case "loop": {
      const loop = m(b.mediaId);
      if (!loop) return <Empty show={ctx.editing}>GIF / MP4</Empty>;
      if (loop.type === "loop") return <VideoView url="" mediaId={b.mediaId} caption={b.caption} ctx={ctx} />;
      return (
        <figure className="m-0 flex flex-col gap-2">
          <Picture m={loop} base={ctx.base} />
          <T ctx={ctx} path="caption" value={b.caption} as="figcaption" style={{ color: "var(--site-muted)" }} />
        </figure>
      );
    }
    case "before-after": {
      const before = m(b.beforeId);
      const after = m(b.afterId);
      if (!before && !after && !ctx.editing) return null;
      return (
        <div className="relative overflow-hidden" data-before-after style={{ borderRadius: "var(--site-radius)" }}>
          <Picture m={after} base={ctx.base} tone="sample:06" ratio={after ? undefined : "16 / 9"} />
          <div className="absolute inset-y-0 start-0 w-1/2 overflow-hidden">
            <div className="h-full" style={{ width: "200%" }}>
              <Picture
                m={before}
                base={ctx.base}
                tone="sample:03"
                ratio={after ? undefined : "16 / 9"}
                className="h-full"
              />
            </div>
          </div>
          <span aria-hidden className="absolute inset-y-0 start-1/2 w-0.5 bg-white" />
          <T
            ctx={ctx}
            path="beforeLabel"
            value={b.beforeLabel}
            className="absolute start-3 bottom-3 rounded-[6px] bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white"
          />
          <T
            ctx={ctx}
            path="afterLabel"
            value={b.afterLabel}
            className="absolute end-3 bottom-3 rounded-[6px] bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white"
          />
        </div>
      );
    }
    case "pdf": {
      const doc = m(b.mediaId);
      if (!doc) return <Empty show={ctx.editing}>PDF</Empty>;
      return (
        <div className="flex flex-wrap items-center gap-5">
          <div
            className="w-[180px] flex-none overflow-hidden"
            style={{ border: "1px solid var(--site-line)", borderRadius: "var(--site-radius)" }}
          >
            <Picture m={doc} base={ctx.base} want={400} ratio="3 / 4" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">{doc.caption || doc.alt || "PDF"}</span>
            {doc.pages ? <span style={{ color: "var(--site-muted)" }}>{doc.pages} p.</span> : null}
            <T ctx={ctx} path="label" value={b.label} className="site-button self-start" />
          </div>
        </div>
      );
    }
    case "reel":
      return <VideoView url={b.url} mediaId={b.mediaId} title={b.title} tone={b.tone} ctx={ctx} />;
    case "credits":
      return (
        <div className="flex flex-col gap-4">
          <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(28)} />
          <ul className="m-0 flex list-none flex-col p-0">
            {b.items
              .filter((c) => c.title || ctx.editing)
              .map((c, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[72px_1fr] gap-4 py-3 @max-xl:grid-cols-[56px_1fr]"
                  style={{ borderTop: "1px solid var(--site-line)" }}
                >
                  {ctx.onText ? (
                    <>
                      <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path={`items.${i}.year`} value={c.year} style={{ color: "var(--site-muted)" }} />
                      <span className="flex flex-col">
                        <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path={`items.${i}.title`} value={c.title} className="font-semibold" />
                        <span className="flex flex-wrap gap-x-1.5" style={{ color: "var(--site-muted)" }}>
                          <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path={`items.${i}.role`} value={c.role} />
                          <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path={`items.${i}.studio`} value={c.studio} />
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--site-muted)" }}>{c.year}</span>
                      <span className="flex flex-col">
                        <span className="font-semibold">{c.title || "—"}</span>
                        <span style={{ color: "var(--site-muted)" }}>{[c.role, c.studio].filter(Boolean).join(" · ")}</span>
                      </span>
                    </>
                  )}
                </li>
              ))}
          </ul>
        </div>
      );
    case "logos":
      return (
        <div className="flex flex-col gap-5">
          <T ctx={ctx} path="heading" value={b.heading} as="h2" style={{ ...heading(20), color: "var(--site-muted)" }} />
          <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
            {b.items.map((l, i) => {
              const logo = m(l.mediaId);
              return logo ? (
                <span key={i} className="block h-10 w-28">
                  <Picture
                    m={logo}
                    base={ctx.base}
                    want={400}
                    ratio="auto"
                    className="h-full [&_img]:object-contain"
                    alt={l.name}
                  />
                </span>
              ) : (
                <T
                  key={i}
                  ctx={{ ...ctx, selectedBlockId: ctx.blockId }}
                  path={`items.${i}.name`}
                  value={l.name}
                  style={{ ...heading(22), opacity: 0.75 }}
                />
              );
            })}
          </div>
        </div>
      );
    case "about": {
      const photo = m(b.photoId);
      const cv = m(b.cvId);
      return (
        <div className="site-about grid gap-8">
          <div className="flex flex-col gap-4">
            <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(32)} />
            {photo && <Picture m={photo} base={ctx.base} ratio="4 / 5" want={800} className="max-w-[280px]" />}
          </div>
          <div className="flex flex-col gap-4 text-[18px] leading-[1.6]">
            {ctx.onText ? <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="text" value={b.text} as="div" multiline /> : paragraphs(b.text)}
            {cv && <span className="site-button self-start">CV · PDF ↓</span>}
          </div>
        </div>
      );
    }
    case "contact": {
      const form = contactFormOf(b, ctx.contactFallback);
      const words = CONTACT_WORDS[ctx.language];
      const split = form.layout === "split";
      const intro = ctx.live ? (
        <div className="flex flex-col items-start gap-3">
          <h2 style={heading(32)}>{b.heading}</h2>
          {b.text && (
            <p className="m-0" style={{ color: "var(--site-muted)" }}>
              {b.text}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(32)} />
          <T ctx={ctx} path="text" value={b.text} as="p" className="m-0" style={{ color: "var(--site-muted)" }} multiline />
        </div>
      );
      const boxStyle = {
        border: "1px solid var(--site-line)",
        borderRadius: "var(--site-radius)",
        background: "var(--site-bg)",
      };
      const fake = (label: string, tall?: boolean) => (
        <span key={label} className="grid gap-1.5 text-[14px] font-semibold">
          {label}
          <span className={cx("block", tall ? "h-24" : "h-11")} style={boxStyle} />
        </span>
      );
      const formPart =
        ctx.live && ctx.renderContact ? (
          ctx.renderContact(b)
        ) : (
          <div className="flex w-full max-w-[560px] flex-col items-start gap-3" data-testid="contact-preview">
            <div className="grid w-full gap-3" aria-hidden>
              {fake(form.labels.name || words.name)}
              {fake(form.labels.email || words.email)}
              {form.projectType && fake(words.projectType)}
              {form.budget && fake(words.budget)}
              {form.deadline && fake(words.deadline)}
              {form.custom && fake(form.custom)}
              {fake(form.labels.message || words.message, true)}
            </div>
            <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="button" value={b.button} className="site-button mt-1" />
          </div>
        );
      return (
        <div
          id={ctx.live ? "contact" : undefined}
          className={cx("gap-8 p-10 @max-xl:p-6", split ? "grid grid-cols-2 items-start @max-2xl:grid-cols-1" : "flex flex-col items-start gap-3")}
          style={{ background: "var(--site-surface)", borderRadius: "calc(var(--site-radius) * 2)" }}
        >
          {intro}
          {formPart}
        </div>
      );
    }
    case "hire":
      if (!ctx.available?.on) {
        return <Empty show={ctx.editing}>{ctx.available?.label ?? "Available for work"} · off</Empty>;
      }
      return (
        <div
          className="flex flex-wrap items-center justify-between gap-4 p-6"
          style={{
            background: "var(--site-accent)",
            color: "var(--site-on-accent)",
            borderRadius: "calc(var(--site-radius) * 2)",
          }}
        >
          <span className="flex items-center gap-3 text-[18px] font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: "currentColor" }} />
            {ctx.onText ? <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="text" value={b.text} /> : b.text}
          </span>
          <span
            className="rounded-full px-5 py-2.5 font-semibold"
            style={{ background: "var(--site-on-accent)", color: "var(--site-accent)" }}
          >
            {ctx.available.hire}
          </span>
        </div>
      );
    case "social":
      return (
        <div className="flex flex-wrap gap-3">
          {b.links
            .filter((l) => l.url || ctx.editing)
            .map((l, i) => (
              <span
                key={i}
                className="rounded-full px-4 py-2 text-[14px] font-semibold capitalize"
                style={{ border: "1px solid var(--site-line)" }}
              >
                {l.network}
              </span>
            ))}
        </div>
      );
    case "free":
      return ctx.renderFree ? ctx.renderFree(b) : <FreeSectionView b={b} ctx={ctx} />;
    case "quote":
      return (
        <blockquote className="m-0 flex max-w-[820px] flex-col gap-3">
          <p style={heading(30)} className="m-0 @max-2xl:!text-[24px]">
            “{ctx.onText ? <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="text" value={b.text} /> : b.text}”
          </p>
          <T ctx={ctx} path="author" value={b.author} as="cite" className="not-italic" style={{ color: "var(--site-muted)" }} />
        </blockquote>
      );
  }
}

interface Ctx {
  media: Record<string, SiteMedia>;
  projects?: GalleryProject[];
  base: string;
  editing: boolean;
  available?: SiteRenderProps["available"];
  categoryLabel?: (id: string) => string;
  live: boolean;
  renderContact?: SiteRenderProps["renderContact"];
  contactHref?: string;
  /** Position of the block on the page (0 = first). */
  index?: number;
  blockId?: string;
  selectedBlockId?: string | null;
  onText?: SiteRenderProps["onText"];
  onSiteText?: SiteRenderProps["onSiteText"];
  typeHere?: string;
  renderFree?: SiteRenderProps["renderFree"];
  contactFallback?: LegacyContactFields | null;
  language: Locale;
  social?: Array<{ network: string; url: string }>;
}

/**
 * A piece of text. On the editor canvas it's typed in place (empty fields only show on the selected
 * block, with a placeholder); everywhere else it's plain text, and empty text renders nothing.
 */
function T({
  ctx,
  path,
  value,
  as: Tag = "span",
  className,
  style,
  multiline,
}: {
  ctx: Ctx;
  path: string;
  value: string;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div" | "figcaption" | "cite";
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
}) {
  const { onText, blockId } = ctx;
  if (onText && blockId) {
    if (!value && ctx.selectedBlockId !== blockId) return null;
    return (
      <InlineText
        as={Tag}
        value={value}
        multiline={multiline}
        placeholder={ctx.typeHere ?? "Type here"}
        className={className}
        style={style}
        onChange={(v) => onText(blockId, path, v)}
      />
    );
  }
  if (!value) return null;
  return (
    <Tag className={className} style={style}>
      {accentText(value)}
    </Tag>
  );
}

/* ---------- a section's band: background, shaped edges, spacing, inset card (round 7) ---------- */

const WIDTHS: Record<SectionStyle["width"], number | undefined> = { narrow: 720, medium: 960, normal: undefined, full: undefined };

/** Colours that read on a section's background: text, muted text, lines and soft surfaces. */
function inkVars(text: string, base: string): CSSProperties {
  return {
    ["--site-text" as string]: text,
    ["--site-muted" as string]: `color-mix(in srgb, ${text} 72%, ${base})`,
    ["--site-line" as string]: `color-mix(in srgb, ${text} 18%, ${base})`,
    ["--site-surface" as string]: `color-mix(in srgb, ${text} 7%, ${base})`,
    color: text,
  };
}

/** Does a section have a coloured band (background or shaped edges)? */
function isBanded(b?: Block): boolean {
  const s = b?.style;
  return !!s && (s.bg.kind !== "none" || s.edgeTop.shape !== "none" || s.edgeBottom.shape !== "none");
}

function SectionBand({
  b,
  ctx,
  selected,
  prevBanded,
  nextBanded,
  children,
}: {
  b: Block;
  ctx: Ctx;
  selected: boolean;
  /** Next to a plain section, an edge gets room of its own instead of covering that section's content. */
  prevBanded: boolean;
  nextBanded: boolean;
  children: ReactNode;
}) {
  const s = b.style;
  const cls = cx(ctx.editing && "site-block", selected && "site-block-selected");
  if (!s) {
    return (
      <section data-block-id={b.id} className={cls}>
        {children}
      </section>
    );
  }
  const bg = s.bg;
  const banded = bg.kind !== "none" || s.edgeTop.shape !== "none" || s.edgeBottom.shape !== "none";
  const gradient = `${bg.radial ? "radial-gradient(circle at 50% 35%, " : `linear-gradient(${bg.angle}deg, `}${bg.color}, ${bg.color2}${bg.color3 ? `, ${bg.color3}` : ""})`;
  // The colour the edges are drawn in, and the one text has to read on.
  const topColor = bg.kind === "image" ? bg.overlay : bg.color;
  const bottomColor = bg.kind === "gradient" ? (bg.color3 ?? bg.color2) : topColor;
  const base =
    bg.kind === "image" ? (bg.overlayOpacity >= 35 ? bg.overlay : "#808080") : bg.kind === "none" ? null : bg.color;
  const text = s.text ?? (base ? readableOn(base) : null);
  const media = bg.mediaId ? (ctx.media[bg.mediaId] ?? null) : null;
  const pattern = bg.kind === "pattern" ? patternCss(bg.pattern, bg.patternColor, bg.patternScale) : null;
  const tile = bg.kind === "pattern" && bg.pattern === "custom" && media ? imageSources(media, 800, ctx.base)?.src : null;

  const style: CSSProperties = {
    position: "relative",
    paddingTop: banded ? s.padTop : undefined,
    paddingBottom: banded ? s.padBottom : undefined,
    // Unbanded sections keep today's spacing; their sliders add or take away from it.
    marginTop: banded
      ? s.edgeTop.shape !== "none" && !prevBanded
        ? `calc(var(--section-gap) / -2 + ${s.edgeTop.height} * 100cqi / 1200)`
        : "calc(var(--section-gap) / -2)"
      : s.padTop - 48,
    marginBottom: banded
      ? s.edgeBottom.shape !== "none" && !nextBanded
        ? `calc(var(--section-gap) / -2 + ${s.edgeBottom.height} * 100cqi / 1200)`
        : "calc(var(--section-gap) / -2)"
      : s.padBottom - 48,
    ...(banded || s.width === "full"
      ? {
          marginInline: "calc(var(--site-pad) * -1)",
          paddingInline: s.width === "full" ? 0 : "var(--site-pad)",
        }
      : {}),
    background:
      bg.kind === "color" || bg.kind === "pattern"
        ? bg.color
        : bg.kind === "gradient"
          ? gradient
          : bg.kind === "image"
            ? bg.overlay
            : undefined,
    ...(text && (banded || s.text) ? inkVars(text, base ?? "#FFFFFF") : {}),
  };

  const edge = (where: "top" | "bottom") => {
    const e = where === "top" ? s.edgeTop : s.edgeBottom;
    if (e.shape === "none") return null;
    const flipX = e.flip ? -1 : 1;
    return (
      <svg
        aria-hidden
        className="pointer-events-none absolute start-0 z-[2] block w-full"
        style={{
          height: `calc(${e.height} * 100cqi / 1200)`,
          [where]: `calc(${e.height} * -100cqi / 1200 + 1px)`,
          transform: where === "top" ? `scaleX(${flipX})` : `scale(${flipX}, -1)`,
        }}
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
        data-edge={where}
      >
        <path d={EDGE_PATHS[e.shape]} fill={where === "top" ? topColor : bottomColor} />
      </svg>
    );
  };

  const inner = s.card.on ? (
    <div
      className="relative"
      style={{
        maxWidth: WIDTHS[s.width],
        marginInline: "auto",
        background: s.card.color ?? "var(--site-bg)",
        borderRadius: s.card.radius,
        boxShadow: s.card.shadow ? "0 18px 50px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)" : undefined,
        padding: s.card.padding,
        ...(s.card.color
          ? inkVars(readableOn(s.card.color), s.card.color)
          : {
              ["--site-text" as string]: "var(--site-theme-text)",
              ["--site-muted" as string]: "var(--site-theme-muted)",
              color: "var(--site-theme-text)",
            }),
      }}
      data-testid="section-card"
    >
      {children}
    </div>
  ) : (
    <div className="relative" style={{ maxWidth: WIDTHS[s.width], marginInline: WIDTHS[s.width] ? "auto" : undefined }}>
      {children}
    </div>
  );

  return (
    <section
      data-block-id={b.id}
      id={ctx.live && s.anchor ? s.anchor : undefined}
      data-animate={ctx.live && s.animate !== "none" ? s.animate : undefined}
      data-band={banded || undefined}
      className={cls}
      style={style}
    >
      {bg.kind === "image" && media && (
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <Picture m={media} base={ctx.base} want={2560} ratio="auto" className="h-full w-full !rounded-none" />
          <div className="absolute inset-0" style={{ background: bg.overlay, opacity: bg.overlayOpacity / 100 }} />
        </div>
      )}
      {(pattern || tile) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: pattern?.image ?? `url("${tile}")`,
            backgroundSize: pattern?.size ?? `${Math.round(3.2 * bg.patternScale)}px auto`,
            opacity: bg.patternOpacity / 100,
          }}
          data-testid="section-pattern"
        />
      )}
      {edge("top")}
      {inner}
      {edge("bottom")}
    </section>
  );
}

/* ---------- the site ---------- */

function Footer({
  site,
  ctx,
  links: all,
  credit,
  report,
}: {
  site: SiteDraft;
  ctx: Ctx;
  links: NonNullable<SiteRenderProps["footerLinks"]>;
  credit?: string | null;
  report?: SiteRenderProps["report"];
}) {
  const settings = site.footer ?? normalizeFooter(null);
  const selected = ctx.selectedBlockId === "__footer";
  const links = all.filter((l) => (l.kind === "cv" ? settings.cv : settings.social));
  const editable = !!ctx.onSiteText;
  if (!editable && !credit && !links.length && !report && !settings.text && !settings.showTitle && !settings.email) return null;
  const start = settings.align === "start";
  const columns = settings.layout === "columns";
  const band = !!settings.background || settings.border;
  const iconFor = (href: string) => ctx.social?.find((x) => x.url === href)?.network;
  const linkRow = links.length > 0 && (
    <nav
      className={cx("flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]", start || columns ? "justify-start" : "justify-center")}
      data-testid="footer-links"
    >
      {links.map((l) => {
        const net = l.kind === "social" ? iconFor(l.href) : undefined;
        const label =
          settings.socialStyle === "icons" && net ? (
            <svg viewBox="0 0 24 24" aria-label={l.label} role="img" className="block size-5" style={{ fill: "currentColor" }}>
              <path d={socialPath(net)} />
            </svg>
          ) : (
            l.label
          );
        return ctx.live ? (
          <a
            key={l.href}
            href={l.href}
            rel={l.download ? undefined : "me noopener"}
            target={l.download ? undefined : "_blank"}
            style={{ color: settings.textColor ?? "var(--site-text)" }}
          >
            {label}
          </a>
        ) : (
          <span key={l.href} style={{ color: settings.textColor ?? "var(--site-text)" }}>
            {label}
          </span>
        );
      })}
    </nav>
  );
  const textPart =
    editable && (settings.text || selected) ? (
      <InlineText
        as="p"
        value={settings.text}
        multiline
        placeholder={ctx.typeHere ?? "Type here"}
        className="m-0 text-[14px]"
        style={{ color: settings.textColor ?? "var(--site-text)" }}
        onChange={(v) => ctx.onSiteText!("footer", v)}
      />
    ) : (
      settings.text && (
        <p className="m-0 text-[14px]" style={{ color: settings.textColor ?? "var(--site-text)", whiteSpace: "pre-line" }}>
          {settings.text}
        </p>
      )
    );
  const title = settings.showTitle && (
    <span style={{ ...heading(22), color: settings.textColor ?? "var(--site-text)" }}>{site.title}</span>
  );
  const email = settings.email && (
    <a
      href={ctx.live ? `mailto:${settings.email}` : undefined}
      dir="ltr"
      className="text-[15px] font-semibold underline underline-offset-4"
      style={{ color: settings.textColor ?? "var(--site-text)" }}
    >
      {settings.email}
    </a>
  );
  const toTop = settings.backToTop && (
    <a
      href={ctx.live ? "#" : undefined}
      aria-label="↑"
      className="flex size-10 items-center justify-center rounded-full text-[18px]"
      style={{ border: "1.5px solid currentColor", color: settings.textColor ?? "var(--site-text)" }}
    >
      ↑
    </a>
  );
  return (
    <footer
      data-site-part="footer"
      className={cx(
        "flex flex-col gap-3 text-[12px]",
        !columns && (start ? "items-start text-start" : "items-center text-center"),
        ctx.editing && "site-block",
        selected && "site-block-selected",
      )}
      style={{
        color: settings.textColor ?? "var(--site-muted)",
        paddingTop: settings.padding,
        ...(band
          ? {
              background: settings.background
                ? settings.gradientTo
                  ? `linear-gradient(180deg, ${settings.background}, ${settings.gradientTo})`
                  : settings.background
                : undefined,
              borderTop: settings.border ? "1px solid var(--site-line)" : undefined,
              margin: "0 calc(var(--site-pad) * -1) calc(var(--site-pad) * -1)",
              padding: `${settings.padding}px var(--site-pad) var(--site-pad)`,
            }
          : {}),
      }}
    >
      {settings.layout === "links" ? (
        // Like Jackie's footer: the name, a line and the social links, then columns of links.
        <div
          className="grid w-full gap-8 @max-2xl:grid-cols-2"
          style={{ gridTemplateColumns: `minmax(0, 1.4fr) repeat(${Math.max(1, settings.groups.length)}, minmax(0, 1fr))` }}
          data-testid="footer-groups"
        >
          <div className="flex flex-col gap-2 @max-2xl:col-span-2">
            <span style={{ ...heading(20), color: settings.textColor ?? "var(--site-text)" }}>{site.title}</span>
            {textPart}
            {email}
            {linkRow}
          </div>
          {settings.groups.map((g, i) => (
            <div key={i} className="flex flex-col gap-2 text-[14px]">
              <span className="text-[12px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--site-accent)" }}>
                {g.title}
              </span>
              {g.links.map((l, j) =>
                ctx.live && l.link ? (
                  <a key={j} href={l.link} style={{ color: settings.textColor ?? "var(--site-text)", textDecoration: "none" }}>
                    {l.label}
                  </a>
                ) : (
                  <span key={j} style={{ color: settings.textColor ?? "var(--site-text)" }}>
                    {l.label}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      ) : columns ? (
        <div className="grid w-full grid-cols-3 items-center gap-6 @max-2xl:grid-cols-1">
          <div className="flex flex-col gap-1">
            {title}
            {textPart}
          </div>
          <div className="flex justify-center @max-2xl:justify-start">{linkRow}</div>
          <div className="flex items-center justify-end gap-4 @max-2xl:justify-start">
            {email}
            {toTop}
          </div>
        </div>
      ) : (
        <>
          {title}
          {textPart}
          {linkRow}
          {(email || toTop) && (
            <div className="flex items-center gap-4">
              {email}
              {toTop}
            </div>
          )}
        </>
      )}
      {(credit || report) && (
        <span className={cx("flex flex-wrap gap-x-4 gap-y-1", start || columns ? "justify-start" : "justify-center")}>
          {credit &&
            (ctx.live ? (
              <a href="https://fannan.net" style={{ color: "inherit" }}>
                {credit}
              </a>
            ) : (
              credit
            ))}
          {report && (
            <a href={report.href} rel="nofollow" style={{ color: "inherit" }}>
              {report.label}
            </a>
          )}
        </span>
      )}
    </footer>
  );
}

function Nav({ site, page, ctx }: { site: SiteDraft; page: PageDraft; ctx: Ctx }) {
  const { theme } = site;
  const settings = site.header ?? normalizeHeader(null);
  const selected = ctx.selectedBlockId === "__header";
  // On the canvas the header is clicked like a section; its settings open beside it.
  const band =
    settings.background !== "none" ||
    settings.border ||
    settings.shadow ||
    settings.padding > 0 ||
    (settings.sticky && ctx.live && theme.nav !== "sidebar");
  const bandColor =
    settings.background === "surface"
      ? "var(--site-surface)"
      : settings.background.startsWith("#")
        ? settings.gradientTo
          ? `linear-gradient(180deg, ${settings.background}, ${settings.gradientTo})`
          : settings.background
        : "var(--site-bg)";
  const part = {
    "data-site-part": "header",
    style: band
      ? ({
          background: bandColor,
          color: settings.textColor ?? (settings.background.startsWith("#") ? readableOn(settings.background) : undefined),
          margin: "calc(var(--site-pad) * -1) calc(var(--site-pad) * -1) 0",
          padding: `${20 + settings.padding}px var(--site-pad)`,
          borderBottom: settings.border ? "1px solid var(--site-line)" : undefined,
          boxShadow: settings.shadow ? "0 6px 20px rgba(0,0,0,.08)" : undefined,
          ...(settings.sticky && ctx.live && theme.nav !== "sidebar" ? { position: "sticky", top: 0, zIndex: 30 } : {}),
          ...(settings.width === "inset" ? { paddingInline: "max(var(--site-pad), calc((100% - 1100px) / 2))" } : {}),
        } as CSSProperties)
      : settings.textColor
        ? { color: settings.textColor }
        : undefined,
  };
  const linkColor = settings.textColor ?? "var(--site-muted)";
  const socialIcons =
    settings.social && (ctx.social?.length || !ctx.live) ? (
      <span className="flex items-center" style={{ gap: Math.max(10, settings.linkGap * 0.7) }} data-testid="header-social">
        {(ctx.social?.length ? ctx.social : [{ network: "instagram", url: "#" }, { network: "behance", url: "#" }]).map((l, i) => {
          const icon = (
            <svg viewBox="0 0 24 24" aria-hidden className="block size-[18px]" style={{ fill: "currentColor" }}>
              <path d={socialPath(l.network)} />
            </svg>
          );
          return ctx.live ? (
            <a key={i} href={l.url} target="_blank" rel="me noopener" aria-label={l.network} style={{ color: "inherit" }}>
              {icon}
            </a>
          ) : (
            <span key={i}>{icon}</span>
          );
        })}
      </span>
    ) : null;
  const partClass = cx(ctx.editing && "site-block", selected && "site-block-selected");
  const logo = theme.logoMediaId ? ctx.media[theme.logoMediaId] : null;
  const logoFont = settings.logoFont
    ? settings.logoFont in headingFonts
      ? { fontFamily: headingFonts[settings.logoFont as HeadingFont].family, fontWeight: headingFonts[settings.logoFont as HeadingFont].weight }
      : { fontFamily: arabicFonts[settings.logoFont as ArabicFont].family, fontWeight: 700 }
    : null;
  const titleStyle = (size: number): CSSProperties => ({ ...heading(size), ...logoFont });
  // Project menu items open the project; they disappear while the project is hidden or deleted.
  const projectSlug = (p: PageDraft) => ctx.projects?.find((x) => x.id === p.projectId && x.visibility !== "hidden")?.slug;
  const links = site.pages.filter((p) => p.showInNav && (p.type !== "project" || !ctx.live || !!projectSlug(p)));
  // Pages inside another page show in its dropdown, not in the menu itself.
  const top = links.filter((p) => !p.parentId || !links.some((x) => x.id === p.parentId));
  const navLink = (p: PageDraft, style?: CSSProperties) => {
    if (!ctx.live || p.type === "folder") {
      return (
        <span key={p.id} style={style}>
          {p.title}
        </span>
      );
    }
    const href = p.type === "link" ? p.url || "#" : p.type === "project" ? `/${projectSlug(p)}` : `/${p.slug}`;
    return (
      <a
        key={p.id}
        href={href}
        style={{ color: "inherit", textDecoration: "none", ...style }}
        aria-current={p.id === page.id ? "page" : undefined}
        {...(p.type === "link" ? { target: "_blank", rel: "noopener" } : {})}
      >
        {p.title}
      </a>
    );
  };
  const brandInner = logo ? (
    <span className="block" style={{ height: settings.logoSize, width: settings.logoSize * 3.6 }}>
      <Picture
        m={logo}
        base={ctx.base}
        want={400}
        ratio="auto"
        alt={site.title}
        className="h-full [&_img]:object-contain [&_img]:object-left"
      />
    </span>
  ) : (
    <span className="flex flex-col gap-0.5">
      {ctx.onSiteText ? (
        <InlineText
          value={site.title}
          placeholder={ctx.typeHere ?? "Type here"}
          style={titleStyle(theme.nav === "minimal" ? Math.round(settings.titleSize * 0.77) : settings.titleSize)}
          onChange={(v) => ctx.onSiteText!("title", v)}
        />
      ) : (
        <span style={titleStyle(theme.nav === "minimal" ? Math.round(settings.titleSize * 0.77) : settings.titleSize)} data-testid="site-name">
          {site.title}
        </span>
      )}
      {settings.tagline &&
        theme.nav !== "minimal" &&
        (ctx.onSiteText && (site.tagline || selected) ? (
          <InlineText
            value={site.tagline}
            placeholder={ctx.typeHere ?? "Type here"}
            className="text-[14px]"
            style={{ color: "var(--site-muted)" }}
            onChange={(v) => ctx.onSiteText!("tagline", v)}
          />
        ) : (
          site.tagline && (
            <span className="text-[14px]" style={{ color: "var(--site-muted)" }}>
              {site.tagline}
            </span>
          )
        ))}
    </span>
  );
  const brand = ctx.live ? (
    <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
      {brandInner}
    </a>
  ) : (
    brandInner
  );
  const linkList = (
    <span
      className="flex flex-wrap items-center gap-y-1 text-[15px]"
      style={{
        color: linkColor,
        columnGap: settings.linkGap,
        textTransform: settings.upperLinks ? "uppercase" : undefined,
        letterSpacing: settings.upperLinks ? "0.04em" : undefined,
      }}
    >
      {top.map((p) => {
        const kids = links.filter((c) => c.parentId === p.id);
        const current = p.id === page.id || kids.some((c) => c.id === page.id);
        const style = current ? { color: settings.textColor ?? "var(--site-text)", fontWeight: 600 } : undefined;
        if (!kids.length) return navLink(p, style);
        // A dropdown: hover or focus shows the pages inside (no script needed on the live site).
        return (
          <span key={p.id} className="group/dd relative inline-flex items-center" data-testid="nav-dropdown">
            {p.type === "folder" || !ctx.live ? (
              <button
                type="button"
                className="inline-flex items-center gap-1"
                style={{ ...style, color: style?.color ?? "inherit", font: "inherit", background: "none", border: 0, padding: 0, cursor: "pointer" }}
                aria-haspopup="true"
              >
                {p.title}
                <span aria-hidden className="text-[0.7em]">▾</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                {navLink(p, style)}
                <span aria-hidden className="text-[0.7em]">▾</span>
              </span>
            )}
            <span
              className={cx(
                "z-40 flex-col gap-0.5 py-2",
                theme.nav === "sidebar"
                  ? "flex ps-3 pt-1"
                  : "absolute start-0 top-full hidden min-w-[180px] group-focus-within/dd:flex group-hover/dd:flex",
              )}
              style={
                theme.nav === "sidebar"
                  ? undefined
                  : {
                      background: "var(--site-bg)",
                      border: "1px solid var(--site-line)",
                      borderRadius: "calc(var(--site-radius) + 4px)",
                      boxShadow: "0 12px 30px rgba(0,0,0,.12)",
                      padding: 8,
                      textTransform: "none",
                      letterSpacing: "normal",
                    }
              }
              data-testid="nav-dropdown-menu"
            >
              {kids.map((c) => (
                <span key={c.id} className="block rounded-[6px] px-3 py-1.5 whitespace-nowrap">
                  {navLink(c, c.id === page.id ? { color: "var(--site-text)", fontWeight: 600 } : { color: "var(--site-text)" })}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
  const hireStyle =
    settings.hire.style === "outline"
      ? { background: "transparent", color: "inherit", border: "1.5px solid currentColor", textDecoration: "none" }
      : { background: "var(--site-accent)", color: "var(--site-on-accent)", textDecoration: "none" };
  // The Hire me button: shown when "available for work" is on, unless the header settings say otherwise.
  const hireOn = settings.hire.on ?? !!ctx.available?.on;
  const hireLabel = settings.hire.label || ctx.available?.hire || "Hire me";
  const hireHref = settings.hire.link || ctx.contactHref;
  const hire = hireOn ? (
    ctx.live && hireHref ? (
      <a href={hireHref} className="rounded-full px-4 py-2 text-[14px] font-semibold" style={hireStyle} data-hire>
        {hireLabel}
      </a>
    ) : (
      <span className="rounded-full px-4 py-2 text-[14px] font-semibold" style={hireStyle}>
        {hireLabel}
      </span>
    )
  ) : null;

  if (theme.nav === "centered") {
    return (
      <header {...part} className={cx("flex flex-col items-center gap-3 text-center", partClass)}>
        {brand}
        {linkList}
        {socialIcons}
        {hire}
      </header>
    );
  }
  if (theme.nav === "minimal") {
    return (
      <header {...part} className={cx("flex items-center justify-between gap-4", partClass)}>
        {brand}
        <span className="flex items-center gap-4 text-[15px] font-semibold">
          {socialIcons}
          {hire}
          <span>☰</span>
        </span>
      </header>
    );
  }
  return (
    <header
      {...part}
      className={cx("flex flex-wrap items-center justify-between gap-4", theme.nav === "sidebar" && "site-sidebar-nav", partClass)}
    >
      {brand}
      {theme.nav === "split" ? (
        <>
          <span className="@max-2xl:hidden">{linkList}</span>
          <span className="flex items-center gap-4">
            {socialIcons}
            {hire}
          </span>
        </>
      ) : (
        <span className="flex flex-wrap items-center gap-5">
          {linkList}
          {socialIcons}
          {hire}
        </span>
      )}
    </header>
  );
}

export function SiteRender({
  site,
  pageId,
  media = {},
  projects,
  mediaBase = "/api/media/",
  available,
  editing = false,
  selectedBlockId,
  credit,
  footerLinks = [],
  report = null,
  categoryLabel,
  live = false,
  renderContact,
  contactHref,
  content,
  onText,
  onSiteText,
  typeHere,
  renderFree,
  bare = false,
  contactFallback,
  social,
  contentStyle,
}: SiteRenderProps) {
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const { theme } = site;
  const ctx: Ctx = {
    media,
    projects,
    base: mediaBase,
    editing,
    available,
    categoryLabel,
    live,
    renderContact,
    contactHref,
    selectedBlockId,
    onText,
    onSiteText,
    typeHere,
    renderFree,
    contactFallback,
    language: site.language,
    social,
  };
  const arabic = site.language === "ar";
  const h = headingFonts[theme.fonts.heading];
  const vars = {
    "--site-bg": theme.colors.background,
    "--site-text": theme.colors.text,
    "--site-accent": theme.colors.accent,
    "--site-on-accent": readableOn(theme.colors.accent),
    "--site-muted": `color-mix(in srgb, ${theme.colors.text} 62%, ${theme.colors.background})`,
    "--site-line": `color-mix(in srgb, ${theme.colors.text} 16%, ${theme.colors.background})`,
    "--site-surface": `color-mix(in srgb, ${theme.colors.text} 6%, ${theme.colors.background})`,
    // The theme's own colours, for inset cards inside coloured sections.
    "--site-theme-text": theme.colors.text,
    "--site-theme-muted": `color-mix(in srgb, ${theme.colors.text} 62%, ${theme.colors.background})`,
    "--site-radius": `${theme.radius}px`,
    // The chosen Arabic font is always in the stack: Arabic sites lead with it, and on English
    // sites any Arabic words fall through the Latin font (which has no Arabic letters) to it.
    "--site-heading": arabic
      ? `${arabicFonts[theme.fonts.arabic].family}, ${h.family}, sans-serif`
      : `${h.family}, ${arabicFonts[theme.fonts.arabic].family}, system-ui, sans-serif`,
    "--site-heading-weight": arabic ? 700 : h.weight,
    "--site-body": arabic
      ? `${arabicFonts[theme.fonts.arabic].family}, ${bodyFonts[theme.fonts.body].family}, system-ui`
      : `${bodyFonts[theme.fonts.body].family}, ${arabicFonts[theme.fonts.arabic].family}, system-ui, sans-serif`,
  } as CSSProperties;

  const body = content ? (
    <main className="flex flex-col gap-10" style={{ ["--section-gap" as string]: "48px" }}>
      {contentStyle ? (
        <SectionBand
          b={{ id: "lock", type: "hire", text: "", style: { ...contentStyle, padTop: Math.max(contentStyle.padTop, 96), padBottom: Math.max(contentStyle.padBottom, 160) } }}
          ctx={ctx}
          selected={false}
          prevBanded={false}
          nextBanded={false}
        >
          {content}
        </SectionBand>
      ) : (
        content
      )}
    </main>
  ) : (
    <main
      className="flex flex-col"
      style={{ gap: theme.nav === "minimal" ? 72 : 48, ["--section-gap" as string]: `${theme.nav === "minimal" ? 72 : 48}px` }}
    >
      {page.blocks.map((b, i) => (
        <SectionBand
          key={b.id}
          b={b}
          ctx={ctx}
          selected={selectedBlockId === b.id}
          prevBanded={isBanded(page.blocks[i - 1])}
          nextBanded={isBanded(page.blocks[i + 1])}
        >
          <BlockView b={b} ctx={{ ...ctx, index: i, blockId: b.id }} />
        </SectionBand>
      ))}
      {editing && page.blocks.length === 0 && <Empty show>+</Empty>}
    </main>
  );

  return (
    <div
      dir={dirFor(site.language)}
      lang={site.language}
      className={cx("site-root @container min-h-full", live && "min-h-dvh", siteFontVars)}
      style={{
        ...vars,
        background: "var(--site-bg)",
        color: "var(--site-text)",
        fontFamily: "var(--site-body)",
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <div className={cx("flex flex-col gap-12 p-[var(--site-pad)]", theme.nav === "sidebar" && "site-with-sidebar")}>
        {!bare && <Nav site={site} page={page} ctx={ctx} />}
        {body}
        {!bare && <Footer site={site} ctx={ctx} links={footerLinks} credit={credit} report={report} />}
      </div>
    </div>
  );
}
