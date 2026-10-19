import type { CSSProperties, ReactNode } from "react";
import { dirFor, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { imageSources, posterSources, type MediaLike } from "@/lib/media";
import type {
  Block,
  BlockOf,
  Crop,
  FreeItem,
  LinkItem,
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
import { isRich, richHtml } from "@/lib/site/richtext";
import type { ProjectExtras } from "@/lib/site/projectExtras";
import { isSampleTone, toneFill } from "@/lib/site/samples";
import { FONTS, fontOf, fontStack, siteFontVars } from "./fonts";
import { SOCIAL_PATHS, socialPath } from "./socialIcons";
import { embedSrc, linkShowsOn, networkOf, todayKey } from "@/lib/site/links";
import { networkName } from "@/lib/site/blocks";
import { EDGE_PATHS } from "./edges";
import { patternCss } from "./patterns";
import { DecoLabel, DecoSvg } from "./deco";
import { DrawingSvg } from "./DrawingSvg";
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

export interface GalleryProject extends ProjectExtras {
  id: string;
  slug: string;
  title: string;
  category: string;
  client: string;
  role: string;
  /** Richer project data for captions, the project feature block and project grids by tag. */
  studio?: string;
  year?: string;
  tags?: string[];
  description?: string;
  mediaIds?: string[];
  logoIds?: string[];
  laurelIds?: string[];
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
  "4:5": "4 / 5",
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
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Whichever reads better: near-black (#141414, luminance ≈ 0.007) or white.
  return (l + 0.05) / 0.057 >= 1.05 / (l + 0.05) ? "#141414" : "#FFFFFF";
}

/** The cover's round button: a link when it has somewhere to go, otherwise just the label. */
function CoverButton({ href, children }: { href?: string; children: ReactNode }) {
  const cls = "inline-flex h-14 items-center gap-3 rounded-full ps-2 pe-6 font-semibold no-underline";
  const style = { background: "#FFFFFF", color: "#111111" };
  return href ? (
    <a href={href} className={cls} style={style}>
      {children}
    </a>
  ) : (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/**
 * The accent, darkened (or lightened on dark pages) just enough to read as text on the background
 * (4.5:1). Bright accents like orange stay the colour of buttons and bands; words use this shade.
 */
export function accentInk(accent: string, bg: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(accent) || !/^#[0-9a-f]{6}$/i.test(bg)) return accent;
  if (contrast(accent, bg) >= 4.5) return accent;
  const toward = lum(bg) > 0.4 ? 0 : 255;
  const n = parseInt(accent.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let t = 0.05; t <= 1; t += 0.05) {
    const hex = `#${rgb.map((c) => Math.round(c + (toward - c) * t).toString(16).padStart(2, "0")).join("")}`;
    if (contrast(hex, bg) >= 4.5) return hex.toUpperCase();
  }
  return toward ? "#FFFFFF" : "#141414";
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
  crop,
  pic,
  frame,
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
  /** Round 13: what part of the picture shows, and how close. */
  crop?: Crop;
  /** Editor only: "blockId|path" so a dropped file or the hover tools know where the picture goes. */
  pic?: string;
  /** A coloured frame around the picture. */
  frame?: string;
}) {
  // GIFs are stored as muted looping videos; they play wherever the picture is shown (not in "still" places).
  // A picture asked to fit inside its box (logos) keeps its whole frame.
  const contain = !!className?.includes("object-contain");
  if (m?.type === "gif" && m.loop && !still) {
    return (
      <video
        data-loop-src={`${base}${m.loop}`}
        poster={posterSources(m, want, base)?.src}
        muted
        loop
        playsInline
        preload="none"
        aria-label={alt ?? m.alt ?? undefined}
        className={cx("block h-full w-full", contain ? "object-contain" : "object-cover", className)}
        style={{
          borderRadius: "var(--site-radius)",
          aspectRatio: ratio ?? (m.width && m.height ? `${m.width} / ${m.height}` : undefined),
          ...(crop ? { objectPosition: `${crop.x}% ${crop.y}%` } : {}),
        }}
        data-pic={pic}
      />
    );
  }
  const src = m ? (still ? posterSources(m, want, base) : imageSources(m, want, base)) : null;
  if (!src) {
    return (
      <div
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={className}
        data-pic={pic}
        style={{
          aspectRatio: ratio ?? "4 / 3",
          background: toneFill(tone) ?? "var(--site-surface)",
          borderRadius: "var(--site-radius)",
        }}
      />
    );
  }
  return (
    <picture className={cx("block overflow-hidden", className)} style={{ borderRadius: "var(--site-radius)", ...(frame ? { border: `4px solid ${frame}` } : {}) }} data-pic={pic} data-crop={pic && crop ? `${crop.x},${crop.y},${crop.zoom}` : undefined}>
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
        style={{
          aspectRatio: ratio ?? (m?.width && m?.height ? `${m.width} / ${m.height}` : undefined),
          ...(crop ? { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` } : {}),
        }}
      />
    </picture>
  );
}

const LOGO_SIZE = { s: "h-8", m: "h-12", l: "h-20", xl: "h-32" } as const;
const LOGO_WIDTH = { s: "w-24", m: "w-36", l: "w-52", xl: "w-80" } as const;

/* ---------- round 13: Images section (the artist's own pictures, not projects) ---------- */

const SAMPLE_RATIOS = [4 / 5, 4 / 3, 1, 3 / 4, 16 / 10, 4 / 3];

function ImagesView({ b, ctx }: { b: BlockOf<"images">; ctx: Ctx }) {
  const shown = b.items.map((it, n) => ({ it, n, pic: it.mediaId ? (ctx.media[it.mediaId] ?? null) : null })).filter((x) => x.pic || ctx.editing);
  if (!shown.length) return null;
  const fixed = b.ratio === "original" ? null : b.ratio.replace(":", " / ");
  const natural = (x: (typeof shown)[number]) =>
    x.pic?.width && x.pic?.height ? x.pic.width / x.pic.height : SAMPLE_RATIOS[x.n % SAMPLE_RATIOS.length];
  const cols = b.columns;
  const tile = (x: (typeof shown)[number], ratio: string | undefined, style?: CSSProperties, className?: string) => (
    <figure
      key={x.it.id}
      className={cx("m-0 flex min-w-0 flex-col gap-2", className)}
      style={style}
      data-lightbox={ctx.live && x.pic ? imageSources(x.pic, 2560, ctx.base)?.src : undefined}
      data-lightbox-caption={ctx.live ? x.it.caption || x.pic?.alt || undefined : undefined}
    >
      <Picture
        m={x.pic}
        base={ctx.base}
        tone={x.it.tone}
        ratio={ratio}
        want={b.layout === "slideshow" || cols === 1 ? 2560 : 1600}
        sizes={b.layout === "slideshow" ? "(min-width: 1200px) 1200px, 100vw" : `(min-width: 1200px) ${Math.round(1200 / cols)}px, 50vw`}
        crop={x.it.crop}
        pic={ctx.editing ? `${ctx.blockId}|items.${x.n}.mediaId` : undefined}
        className={cx(b.layout === "rows" && "h-full", b.frame && "!rounded-none")}
        frame={b.frame ?? undefined}
      />
      {b.captions &&
        (ctx.onText ? (
          <T ctx={ctx} path={`items.${x.n}.caption`} value={x.it.caption} as="figcaption" className="text-[14px]" style={{ color: "var(--site-muted)" }} />
        ) : x.it.caption ? (
          <figcaption className="text-[14px]" style={{ color: "var(--site-muted)" }}>
            {x.it.caption}
          </figcaption>
        ) : null)}
    </figure>
  );
  let body: ReactNode;
  if (b.layout === "masonry") {
    body = (
      <div className={cx(cols > 2 && "@max-2xl:!columns-2", "@max-md:!columns-1")} style={{ columns: cols, columnGap: b.gap }}>
        {shown.map((x) => tile(x, fixed ?? `${natural(x)}`, { breakInside: "avoid", marginBottom: b.gap }))}
      </div>
    );
  } else if (b.layout === "rows") {
    // Smart rows: every picture keeps its shape; rows fill the width.
    const h = Math.round(960 / cols);
    body = (
      <div className="flex flex-wrap" style={{ gap: b.gap }}>
        {shown.map((x) => {
          const ar = natural(x);
          return tile(x, `${ar}`, { flex: `${ar} 1 ${Math.round(ar * h)}px` }, "@max-md:!basis-full");
        })}
        <span aria-hidden style={{ flex: "10 1 0px" }} />
      </div>
    );
  } else if (b.layout === "slideshow") {
    body = (
      <div className="site-slides flex snap-x snap-mandatory overflow-x-auto" style={{ gap: b.gap, scrollbarWidth: "thin" }} data-testid="images-slideshow">
        {shown.map((x) => tile(x, fixed ?? "16 / 10", { flex: "0 0 86%" }, "snap-center"))}
      </div>
    );
  } else {
    body = (
      <div
        className={cx("grid", cols > 2 && "@max-2xl:!grid-cols-2", cols > 1 && "@max-md:!grid-cols-1")}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: b.gap }}
      >
        {shown.map((x) => tile(x, fixed ?? `${natural(x)}`))}
      </div>
    );
  }
  return (
    <div className={cx("flex flex-col gap-6", alignCol(ctx.align))} data-pic={ctx.editing ? `${ctx.blockId}|+` : undefined} data-testid="images-section">
      {b.heading && <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(48)} />}
      <div className="w-full">{body}</div>
    </div>
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

/** Round 12: empty media sections in the editor show sample art and what goes there, not a grey box. */
function SampleMedia({ show, tone, label, ratio = "16 / 9", play }: { show: boolean; tone: string; label: string; ratio?: string; play?: boolean }) {
  if (!show) return null;
  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: ratio, background: toneFill(tone), borderRadius: "var(--site-radius)" }}>
      {play && <PlayMark />}
      <span className="absolute start-4 bottom-4 rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "rgba(20,20,20,.65)", color: "#FFFFFF" }}>
        {label}
      </span>
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
  fontSize: `calc(${size}px * var(--site-heading-scale, 1))`,
  textTransform: "var(--site-heading-case, none)" as CSSProperties["textTransform"],
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
  // Source: all projects, one category, or one tag ("tag:broadcast").
  const tag = b.source.startsWith("tag:") ? b.source.slice(4).toLowerCase() : null;
  const shown = (ctx.projects ?? []).filter(
    (p) =>
      p.visibility !== "hidden" &&
      (b.source === "all" || (tag ? (p.tags ?? []).some((x) => x.toLowerCase() === tag) : p.category === b.source)),
  );
  // Picked projects keep the order they were picked in.
  const projects = b.picks?.length
    ? (b.picks.map((id) => shown.find((p) => p.id === id)).filter(Boolean) as GalleryProject[])
    : shown;
  const ownSizes = !!b.cardSizes && b.layout === "grid";
  const hover = b.hover ?? "fade";
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
    p?: GalleryProject;
  }> = projects.length
    ? projects.map((p, i) => ({
        p,
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

  const tile = (t: (typeof tiles)[number], forceRatio?: string, extra?: CSSProperties) => {
    const size = ownSizes ? (t.card?.size ?? "m") : b.layout === "featured" && tiles.indexOf(t) === 0 ? "l" : "m";
    const showTitle = ownSizes ? (t.card?.text ?? "title") !== "none" : b.captions;
    const showMeta = ownSizes ? t.card?.text === "details" : b.credits;
    // Wide cards are as tall as the others, so their picture is twice as wide.
    const tileRatio =
      forceRatio ??
      (size === "wide" && ratio && ratio !== "auto"
        ? ratio.replace(/^(\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?)$/, (_, w, h) => `${Number(w) * 2} / ${h}`)
        : ratio);
    const inner = (
      <>
        <div
          className={cx("site-thumb relative overflow-hidden", (b.layout === "rows" || size === "l") && "h-full")}
          style={{ borderRadius: "var(--site-radius)" }}
          data-hover-loop={ctx.live && b.hoverPlay && b.loopPlay !== "always" && t.m?.loop ? `${ctx.base}${t.m.loop}` : undefined}
        >
          {b.loopPlay === "always" && t.m?.loop ? (
            <video
              data-loop-src={`${ctx.base}${t.m.loop}`}
              poster={posterSources(t.m, 800, ctx.base)?.src}
              muted
              loop
              playsInline
              preload="none"
              aria-label={t.title}
              className="block h-full w-full object-cover"
              style={{ aspectRatio: tileRatio ?? t.ratio ?? (t.m.width && t.m.height ? `${t.m.width} / ${t.m.height}` : undefined) }}
            />
          ) : (
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
          )}
          {hover === "title" && t.title && (
            <span className="site-thumb-title" aria-hidden>
              <span className="font-semibold">{t.title}</span>
              {t.meta && <span className="text-[14px] opacity-80">{t.meta}</span>}
            </span>
          )}
          {t.locked && (
            <span
              className="absolute end-2 top-2 rounded-[6px] px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: "var(--site-text)", color: "var(--site-bg)" }}
            >
              🔒
            </span>
          )}
        </div>
        {b.lines?.length && t.p && hover !== "title" ? (
          <figcaption className="flex flex-col gap-0.5 text-[14px]" style={fullscreen ? { padding: "0 12px" } : undefined}>
            {showTitle && (
              <span className="text-[16px] font-semibold" style={b.captionStyle === "accent" ? { color: "var(--site-accent-ink)", fontWeight: 700, lineHeight: 1.2 } : undefined}>
                {t.title}
              </span>
            )}
            {b.lines.map((line) => {
              const v = captionLine(t.p!, line);
              if (!v) return null;
              const accent = line === "role" && b.accentRole;
              const small = b.captionStyle === "accent";
              return (
                <span
                  key={line}
                  style={{
                    color: accent ? "var(--site-accent-ink)" : "var(--site-muted)",
                    fontWeight: accent ? 500 : undefined,
                    ...(small ? { fontSize: line === "network" ? 11 : 12, textTransform: line === "network" ? ("uppercase" as const) : undefined, letterSpacing: line === "network" ? ".04em" : undefined } : {}),
                  }}
                >
                  {v}
                </span>
              );
            })}
          </figcaption>
        ) : null}
        {!b.lines?.length && (showTitle || showMeta) && t.title && hover !== "title" && (
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
    const style = {
      ...(b.layout === "masonry" ? { breakInside: "avoid" as const, marginBottom: b.gap, display: "flex" } : {}),
      ...extra,
    };
    const span = size === "l" ? "site-span-l" : size === "wide" ? "site-span-wide" : undefined;
    return ctx.live && t.slug ? (
      <a
        key={t.key}
        href={`/${t.slug}`}
        className={cx("site-tile m-0 flex flex-col gap-2 no-underline", `site-hover-${hover}`, span)}
        style={{ color: "inherit", ...style }}
        data-card-size={ownSizes ? size : undefined}
      >
        {inner}
      </a>
    ) : (
      <figure key={t.key} className={cx("site-tile m-0 flex flex-col gap-2", `site-hover-${hover}`, span)} style={style} data-card-size={ownSizes ? size : undefined}>
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
          {tiles.map((t) => tile(t))}
        </div>
      ) : b.layout === "alternate" ? (
        // Tall and short covers take turns, so neighbouring columns never line up.
        <div className="site-alternate flex" style={{ gap: b.gap }} data-layout="alternate">
          {Array.from({ length: Math.min(cols, tiles.length) }, (_, c) => (
            <div key={c} className="flex min-w-0 flex-1 flex-col" style={{ gap: b.gap }}>
              {tiles
                .filter((_, i) => i % cols === c)
                .map((t, j) => tile(t, (c + j) % 2 === 0 ? "4 / 5" : "5 / 4"))}
            </div>
          ))}
        </div>
      ) : b.layout === "rows" ? (
        <div className="flex flex-wrap" style={{ gap: b.gap }} data-layout="rows">
          {tiles.map((t, i) => {
            const ar = t.m?.width && t.m?.height ? t.m.width / t.m.height : [4 / 3, 3 / 4, 16 / 10, 1, 4 / 5][i % 5];
            return tile(t, `${ar}`, { flex: `${ar} 1 ${Math.round((ar * 900) / cols)}px`, minWidth: 0 });
          })}
          <span aria-hidden style={{ flex: "10 1 0px" }} />
        </div>
      ) : (
        b.split && (b.layout === "grid" || b.layout === "fullscreen") ? (
          // Posters in one row, landscape in the next: nothing is cropped into the wrong shape.
          (() => {
            const shapeOf = (t: (typeof tiles)[number]) => (t.m?.width && t.m?.height ? t.m.width / t.m.height : t.ratio === "3 / 4" ? 0.75 : 1.4);
            const posters = tiles.filter((t) => shapeOf(t) < 0.95);
            const wides = tiles.filter((t) => shapeOf(t) >= 0.95);
            const real = b.ratio === "original";
            return (
              <div className="flex flex-col" style={{ gap: Math.max(b.gap, 24) + 16 }} data-layout="split">
                {posters.length > 0 && (
                  <div className="site-grid grid" style={{ gap: b.gap, ["--cols" as string]: cols }} data-phone={cols >= 3 ? "2" : undefined}>
                    {posters.map((t) => tile(t, real ? undefined : "2 / 3"))}
                  </div>
                )}
                {wides.length > 0 && (
                  <div className="site-grid grid" style={{ gap: b.gap, ["--cols" as string]: Math.max(1, Math.min(4, b.wideColumns ?? 2)) }}>
                    {wides.map((t) => tile(t, real ? undefined : "16 / 9"))}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
        <div
          className={cx("site-grid grid", (ownSizes || b.layout === "featured") && "grid-flow-row-dense")}
          style={{ gap: fullscreen ? 0 : b.gap, ["--cols" as string]: cols }}
          data-layout={b.layout}
          data-phone={cols >= 4 && !ownSizes ? "2" : undefined}
        >
          {tiles.map((t) => tile(t))}
        </div>
        )
      )}
    </div>
  );
}

/** One caption line under a project cover. "network" falls back to the client. */
function captionLine(p: GalleryProject, line: NonNullable<BlockOf<"gallery">["lines"]>[number]): string {
  switch (line) {
    case "network":
      return p.network || p.client;
    case "client":
      return p.client;
    case "role":
      return p.role;
    case "studio":
      return p.studio ?? "";
    case "year":
      return p.year ?? "";
  }
}

/* ---------- one project inline (project feature block) ---------- */

function FeatureView({ b, ctx }: { b: BlockOf<"feature">; ctx: Ctx }) {
  const p = (ctx.projects ?? []).find((x) => x.id === b.projectId);
  const m = (id: string | null | undefined) => (id ? (ctx.media[id] ?? null) : null);
  const words = ctx.language === "ar" ? FEATURE_WORDS.ar : FEATURE_WORDS.en;
  if (!p) return ctx.editing ? <Empty show>{words.noProject}</Empty> : null;
  const bg = m(b.bgMediaId);
  const paragraphs = (p.description ?? "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const shown = b.words === "none" ? [] : b.words === "short" ? paragraphs.slice(0, 2) : paragraphs;
  const cover = m(p.coverId);
  const video = p.video ? (
    <VideoView url={p.video} title={p.title} ctx={ctx} />
  ) : (
    <div className="relative">
      <Picture m={cover} base={ctx.base} tone="sample:05" ratio="16 / 9" want={1600} alt={p.title} />
      {ctx.editing && (
        <span className="absolute start-4 bottom-4 rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "rgba(20,20,20,.75)", color: "#FFFFFF" }} title={words.soonHint} data-testid="video-soon">
          {words.soon}
        </span>
      )}
    </div>
  );
  const rows = (title: string, list?: Array<{ label: string; value: string }>) =>
    list?.length ? (
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold tracking-[.08em] uppercase" style={{ color: "var(--site-muted)" }}>
          {title}
        </span>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
          {list.map((r, i) => (
            <div key={i} className="contents">
              <dt style={{ color: "var(--site-muted)" }}>{r.label}</dt>
              <dd className="m-0">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    ) : null;
  const text = (
    <div className="flex flex-col gap-4">
      {b.logos && !!p.logoIds?.length && (
        <div className="flex flex-wrap items-center gap-6">
          {p.logoIds.map((id) => (
            <span key={id} className="block h-9">
              <Picture m={m(id)} base={ctx.base} want={400} ratio="auto" className="h-full !rounded-none [&_img]:!h-full [&_img]:!w-auto [&_img]:object-contain" />
            </span>
          ))}
        </div>
      )}
      <h2 className="m-0" style={heading(36)}>
        {ctx.live ? (
          <a href={`/${p.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
            {p.title}
          </a>
        ) : (
          p.title
        )}
      </h2>
      {p.role && (
        <span className="w-fit rounded-full px-3.5 py-1.5 text-[14px] font-semibold" style={{ background: "var(--site-accent)", color: "var(--site-on-accent)" }}>
          {p.role}
        </span>
      )}
      {(p.network || p.studio) && (
        <span className="text-[15px]" style={{ color: "var(--site-muted)" }}>
          {[p.network || p.client, p.studio].filter(Boolean).join(" · ")}
        </span>
      )}
      {shown.map((t, i) => (
        <p key={i} className="m-0 text-[17px] leading-[1.65]">
          {t}
        </p>
      ))}
      {b.laurels && !!p.laurelIds?.length && (
        <div className="flex flex-wrap items-center gap-5">
          {p.laurelIds.map((id) => (
            <span key={id} className="block h-16">
              <Picture m={m(id)} base={ctx.base} want={400} ratio="auto" className="h-full !rounded-none [&_img]:!h-full [&_img]:!w-auto [&_img]:object-contain" />
            </span>
          ))}
        </div>
      )}
      {b.tools && !!p.tools?.length && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold tracking-[.08em] uppercase" style={{ color: "var(--site-muted)" }}>
            {words.tools}
          </span>
          <div className="flex flex-wrap gap-2">
            {p.tools.map((t) => (
              <span key={t} className="rounded-full px-3 py-1 text-[13px]" style={{ border: "1px solid var(--site-line)" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {b.credits && rows(words.credits, p.credits)}
      {b.credits && rows(words.thanks, p.thanks)}
      {ctx.live && (
        <a href={`/${p.slug}`} className="w-fit text-[15px] font-semibold" style={{ color: "var(--site-accent-ink)" }}>
          {words.view} →
        </a>
      )}
    </div>
  );
  const body = (
    <div className={cx("grid grid-cols-2 items-center gap-12 @max-2xl:grid-cols-1", b.side === "end" && "[&>*:first-child]:order-2 @max-2xl:[&>*:first-child]:order-none")}>
      <div className="min-w-0">{video}</div>
      {text}
    </div>
  );
  if (!bg) return <div data-testid="project-feature">{body}</div>;
  return (
    <div className="relative overflow-hidden p-12 @max-xl:p-6" style={{ borderRadius: "calc(var(--site-radius) * 2.3)", color: "#FFFFFF", ["--site-muted" as string]: "rgba(255,255,255,.75)", ["--site-line" as string]: "rgba(255,255,255,.3)", ["--site-accent-ink" as string]: "#FFFFFF" }} data-testid="project-feature">
      <div className="absolute inset-0">
        <Picture m={bg} base={ctx.base} want={2560} ratio="auto" className="h-full w-full !rounded-none" alt="" />
        <div className="absolute inset-0" style={{ background: "rgba(10,8,6,.62)" }} />
      </div>
      <div className="relative">{body}</div>
    </div>
  );
}

const FEATURE_WORDS = {
  en: { noProject: "Choose a project in the settings.", soon: "Video coming soon", soonHint: "Add the YouTube or Vimeo link in the project. Only you see this note.", tools: "Tools", credits: "Credits", thanks: "Special thanks", view: "View project" },
  ar: { noProject: "اختر مشروعًا من الإعدادات.", soon: "الفيديو قريبًا", soonHint: "أضف رابط يوتيوب أو فيميو في المشروع. هذه الملاحظة تظهر لك فقط.", tools: "الأدوات", credits: "فريق العمل", thanks: "شكر خاص", view: "شاهد المشروع" },
};

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
  if (!v) return <SampleMedia show={ctx.editing} tone={tone ?? "sample:15"} label="YouTube / Vimeo" play />;
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
    // Headings follow the theme's heading size (Design → Fonts → size).
    ["--fs" as string]: it.font === "heading" ? `calc(${it.size} * var(--site-heading-scale, 1))` : it.size,
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
/** Round 13: text that may carry per-word formatting (cleaned again here, whatever was saved). */
function RichSpan({ value, className }: { value: string; className?: string }) {
  return isRich(value) ? (
    <span className={className} dangerouslySetInnerHTML={{ __html: richHtml(value) }} />
  ) : (
    <span className={className}>{accentText(value)}</span>
  );
}

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
    // "heading" / "body" follow the theme; any other value is a chosen font (round 12).
    fontFamily: it.font === "heading" ? "var(--site-heading)" : it.font === "body" ? "var(--site-body)" : `${fontStack(fontOf(it.font, "inter"))}, var(--site-body)`,
    fontWeight: it.weight,
    textTransform: it.upper ? "uppercase" : it.font === "heading" ? ("var(--site-heading-case, none)" as CSSProperties["textTransform"]) : undefined,
    lineHeight: it.lineHeight / 100,
    // Arabic letters join, so letter spacing only applies to Latin text (the site sets lang).
    letterSpacing: it.tracking ? `${it.tracking / 100}em` : undefined,
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
          {text ?? <RichSpan value={it.text} className="whitespace-pre-line" />}
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
                crop={it.fit === "contain" ? undefined : it.crop}
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
            {text ?? (
              <span className="whitespace-pre-line">
                “<RichSpan value={it.text} />”
              </span>
            )}
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
    case "drawing":
      // A doodle (round 11). An empty one shows a dashed box in the editor.
      return it.drawing && it.drawing.strokes.length ? (
        wrapLink(<DrawingSvg drawing={it.drawing} id={`dw-${it.id}`} className="block h-full w-full" />)
      ) : live ? null : (
        <div className="flex h-full w-full items-center justify-center rounded-[12px] border-2 border-dashed text-[13px]" style={{ borderColor: "var(--site-line)", color: "var(--site-muted)" }}>
          ✎
        </div>
      );
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


/* ---------- the link page (round 9, like Linktree) ---------- */

const LINK_RADIUS = { square: 4, rounded: 14, pill: 999 } as const;

function LinksView({ b, ctx }: { b: BlockOf<"links">; ctx: Ctx }) {
  const m = b.photoId ? ctx.media[b.photoId] : null;
  const today = todayKey();
  const items = b.items.filter((it) => !it.hidden && (!ctx.live || linkShowsOn(it, today)) && (it.kind === "header" || it.title || it.url || ctx.editing));
  // Buttons follow the page's own background (its band), so they read on it: dark on light, light on dark.
  const bg = b.style?.bg;
  const bandText = bg && bg.kind !== "none" ? (b.style?.text ?? readableOn(bg.kind === "image" ? bg.overlay : bg.color)) : null;
  const fill = b.button.color ?? bandText ?? "var(--site-text)";
  const ink = b.button.textColor ?? (b.button.color ? readableOn(b.button.color) : bandText ? readableOn(bandText) : "var(--site-bg)");
  const radius = LINK_RADIUS[b.button.shape];
  const buttonStyle: CSSProperties =
    b.button.style === "outline"
      ? { border: `2px solid ${fill}`, color: b.button.color ?? "var(--site-text)", background: "transparent" }
      : b.button.style === "soft"
        ? { background: `color-mix(in srgb, ${fill} 12%, transparent)`, color: b.button.color ?? "var(--site-text)" }
        : b.button.style === "shadow"
          ? { background: ink, color: fill, border: `2px solid ${fill}`, boxShadow: `4px 4px 0 ${fill}` }
          : { background: fill, color: ink };
  const social = b.social ? (ctx.social?.length ? ctx.social : ctx.live ? [] : [{ network: "instagram", url: "#" }, { network: "behance", url: "#" }, { network: "youtube", url: "#" }]) : [];

  const thumb = (it: LinkItem) => {
    const pic = it.mediaId ? ctx.media[it.mediaId] : null;
    if (pic)
      return (
        <span className="absolute start-1.5 top-1/2 size-11 -translate-y-1/2 overflow-hidden" style={{ borderRadius: Math.min(radius, 12) }}>
          <Picture m={pic} base={ctx.base} want={400} ratio="1 / 1" alt="" className="h-full" />
        </span>
      );
    const icon = it.icon || (it.url ? networkOf(it.url) : "");
    if (!icon) return null;
    return (
      <span className="absolute start-4 top-1/2 -translate-y-1/2" aria-hidden>
        {icon in SOCIAL_PATHS ? (
          <svg viewBox="0 0 24 24" className="block size-5" style={{ fill: "currentColor" }}>
            <path d={socialPath(icon)} />
          </svg>
        ) : (
          <CardIcon name={icon} size={20} />
        )}
      </span>
    );
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[580px] flex-col items-center gap-4 px-5 text-center"
      style={{ minHeight: ctx.live ? "calc(100dvh - 112px)" : 760 }}
      data-testid="link-page"
    >
      {b.share && (
        <span className="flex w-full justify-end">
          {ctx.live ? (
            <button
              type="button"
              data-share
              aria-label="Share"
              className="flex size-10 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--site-text) 10%, transparent)", color: "inherit", border: 0, cursor: "pointer" }}
            >
              <CardIcon name="publish" size={18} />
            </button>
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--site-text) 10%, transparent)" }}>
              <CardIcon name="publish" size={18} />
            </span>
          )}
        </span>
      )}
      {(m || ctx.editing) && (
        <span className="block size-24 overflow-hidden rounded-full" style={{ background: "var(--site-surface)" }}>
          {m ? <Picture m={m} base={ctx.base} want={400} ratio="1 / 1" alt={b.name} className="h-full" eager /> : <span className="block h-full w-full" style={{ background: toneFill("sample:11") }} />}
        </span>
      )}
      <T ctx={ctx} path="name" value={b.name} as="h1" style={{ ...heading(26), lineHeight: 1.15 }} />
      <T ctx={ctx} path="bio" value={b.bio} as="p" multiline className="m-0 max-w-[440px] text-[16px] whitespace-pre-line" style={{ color: "var(--site-muted)" }} />
      {social.length > 0 && (
        <span className="flex flex-wrap justify-center gap-4" data-testid="link-social">
          {social.map((l, i) => {
            const icon = (
              <svg viewBox="0 0 24 24" aria-hidden className="block size-6" style={{ fill: "currentColor" }}>
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
      )}
      <div className="mt-2 flex w-full flex-col gap-3">
        {items.map((it) => {
          if (it.kind === "header")
            return (
              <h2 key={it.id} className="m-0 pt-3 text-[15px] font-semibold tracking-[0.06em] uppercase" style={{ color: "var(--site-muted)" }}>
                {it.title}
              </h2>
            );
          const cls = cx("site-link relative flex min-h-[58px] w-full items-center justify-center px-16 py-3 text-[16px] font-semibold no-underline", it.highlight !== "none" && `site-link-${it.highlight}`);
          const label = <span className="line-clamp-2">{it.title || it.url || "…"}</span>;
          if (it.kind === "embed") {
            const e = embedSrc(it.url);
            // A button that opens the player under it; no script needed.
            return (
              <details key={it.id} className="w-full" data-link-id={it.id}>
                <summary className={cx(cls, "cursor-pointer list-none")} style={{ ...buttonStyle, borderRadius: radius }}>
                  {thumb({ ...it, icon: it.icon || "film" })}
                  {label}
                </summary>
                {e && ctx.live && (
                  <iframe
                    src={e.src}
                    title={it.title || "Player"}
                    loading="lazy"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="mt-2 block w-full border-0"
                    style={{ height: e.height || undefined, aspectRatio: e.height ? undefined : "16 / 9", borderRadius: Math.min(radius, 16) }}
                  />
                )}
              </details>
            );
          }
          const inner = (
            <>
              {thumb(it)}
              {label}
            </>
          );
          return ctx.live && it.url ? (
            <a
              key={it.id}
              href={it.url}
              data-link-id={it.id}
              className={cls}
              style={{ ...buttonStyle, borderRadius: radius }}
              {...(/^https?:/i.test(it.url) ? { target: "_blank", rel: "noopener" } : {})}
            >
              {inner}
            </a>
          ) : (
            <span key={it.id} className={cls} style={{ ...buttonStyle, borderRadius: radius }}>
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}

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
  const center = ctx.align ? ctx.align === "center" : b.align === "center";
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
        <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(52)} />
        <T ctx={ctx} path="intro" value={b.intro} as="p" className="m-0 max-w-[640px] text-[18px]" style={{ color: "var(--site-muted)" }} multiline />
      </div>
    ) : null;
  const card = { background: "var(--site-surface)", borderRadius: "calc(var(--site-radius) * 2)" };

  let body: ReactNode = null;
  switch (b.variant) {
    case "tiles":
      // Picture tiles with the title over them, each linking to a page (portfolio categories).
      body = (
        <div className="site-cards-grid grid gap-5" style={grid}>
          {b.items.map((it, n) => (
            <div key={n} className="contents">
              {link(
              it.link,
              <>
                <Picture
                  m={m(it.mediaId)}
                  base={ctx.base}
                  tone={it.tone}
                  ratio={(b.tileRatio ?? "4/5").replace("/", " / ")}
                  want={800}
                  className="absolute inset-0 h-full !rounded-none"
                  alt=""
                  pic={ctx.editing ? `${ctx.blockId}|items.${n}.mediaId` : undefined}
                />
                <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: b.tileText === "center" ? "rgba(10,8,6,.3)" : "linear-gradient(0deg, rgba(10,8,6,.7) 0%, rgba(10,8,6,0) 50%)" }} />
                <span
                  className={cx(
                    "pointer-events-none absolute flex gap-3",
                    b.tileText === "center" ? "inset-0 items-center justify-center text-center" : "inset-x-5 bottom-[18px] items-baseline justify-between",
                  )}
                  style={{ color: "#FFFFFF", textShadow: b.tileText === "center" ? "0 2px 12px rgba(0,0,0,.45)" : undefined }}
                >
                  <span className="pointer-events-auto">
                    {tx(n, "title", { style: b.tileText === "center" ? { fontSize: 24, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.1 } : { fontSize: 20, fontWeight: 700 } })}
                  </span>
                  {(it.meta || ctx.onText) && <span className="pointer-events-auto text-[13px] opacity-85">{tx(n, "meta")}</span>}
                </span>
              </>,
              cx("site-tile relative block overflow-hidden", b.tileRatio === "16/9" ? "aspect-[16/9]" : b.tileRatio === "1/1" ? "aspect-square" : "aspect-[4/5]"),
              { borderRadius: "calc(var(--site-radius) * 1.3)", color: "#FFFFFF" },
              )}
            </div>
          ))}
        </div>
      );
      break;
    case "icons":
      body = (
        <div className="site-cards-grid grid gap-8" style={grid}>
          {b.items.map((it, n) => (
            <div key={n} className={cx("flex flex-col gap-3", center && "items-center text-center")}>
              <span style={{ color: "var(--site-accent)" }}>
                <CardIcon name={it.icon} size={52} />
              </span>
              {tx(n, "title", { as: "h3", style: heading(26) })}
              {tx(n, "text", { as: "p", className: "m-0 text-[17px] leading-[1.6]", style: { color: "var(--site-muted)" }, multiline: true })}
            </div>
          ))}
        </div>
      );
      break;
    case "images":
      body = (
        <div className="site-cards-grid grid gap-6" style={grid}>
          {b.items.map((it, n) => (
            <div key={n} className={cx("flex flex-col overflow-hidden", b.flat && "gap-3")} style={b.flat ? undefined : card}>
              <Picture
                m={m(it.mediaId)}
                base={ctx.base}
                tone={it.tone}
                ratio={b.flat ? "1 / 1" : "4 / 3"}
                className={b.flat ? undefined : "!rounded-none"}
                pic={ctx.editing ? `${ctx.blockId}|items.${n}.mediaId` : undefined}
              />
              <div className={cx("flex flex-1 flex-col items-start gap-2", b.flat ? "gap-1" : "p-6")}>
                {tx(n, "title", { as: "h3", style: heading(b.flat ? 18 : 26) })}
                {tx(n, "text", { as: "p", className: "m-0 text-[16px] leading-[1.6]", style: { color: "var(--site-muted)" }, multiline: true })}
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
              <Picture key={n} m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="1 / 1" className="!rounded-none" pic={ctx.editing ? `${ctx.blockId}|items.${n}.mediaId` : undefined} />
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
                  <Picture m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="1 / 1" className="!rounded-full" pic={ctx.editing ? `${ctx.blockId}|items.${n}.mediaId` : undefined} />
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
                <Picture m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="4 / 3" pic={ctx.editing ? `${ctx.blockId}|items.${n}.mediaId` : undefined} />
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
          <Picture m={m(b.mediaId)} base={ctx.base} tone={b.tone} ratio="4 / 5" pic={ctx.editing ? `${ctx.blockId}|mediaId` : undefined} />
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
                <Picture m={m(it.mediaId)} base={ctx.base} tone={it.tone} ratio="16 / 9" pic={ctx.editing ? `${ctx.blockId}|items.${n}.mediaId` : undefined} />
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
    case "links":
      return <LinksView b={b} ctx={ctx} />;
    case "cards":
      return <CardsView b={b} ctx={ctx} />;
    case "cover": {
      const img = m(b.mediaId);
      return (
        <div
          className="relative flex flex-col justify-end overflow-hidden"
          data-pic={ctx.editing && !img ? `${ctx.blockId}|mediaId` : undefined}
          style={{
            minHeight: b.inset
              ? b.height === "full"
                ? "min(80vh, 760px)"
                : "min(56vh, 540px)"
              : b.height === "full"
                ? "min(88vh, 900px)"
                : "min(60vh, 560px)",
            ...(b.inset ? { borderRadius: "calc(var(--site-radius) * 2.3)" } : { marginInline: "calc(var(--site-pad) * -1)" }),
            background: toneFill(b.tone),
          }}
        >
          {img && (
            <div className="absolute inset-0">
              <Picture m={img} base={ctx.base} want={2560} className="h-full w-full !rounded-none" ratio="auto" crop={b.crop} eager={(ctx.index ?? 9) <= 1} pic={ctx.editing ? `${ctx.blockId}|mediaId` : undefined} />
            </div>
          )}
          <div
            className="relative flex flex-wrap items-end justify-between gap-5 p-[var(--site-pad)] @max-xl:p-6"
            style={{
              // On a picture or a sample drawing: white words over a soft shade.
              color: img || isSampleTone(b.tone) ? "#FFFFFF" : readableOn(b.tone),
              background: img || isSampleTone(b.tone) ? "linear-gradient(transparent, rgba(10,8,6,.7))" : undefined,
            }}
          >
            <div className="flex max-w-[820px] flex-col gap-3">
              {(b.eyebrow || (ctx.onText && ctx.selectedBlockId === ctx.blockId)) && (
                <T ctx={ctx} path="eyebrow" value={b.eyebrow ?? ""} className="text-[13px] font-medium tracking-[.14em] uppercase opacity-85" />
              )}
              <T
                ctx={ctx}
                path="heading"
                value={b.heading}
                as="h1"
                style={{ ...heading(b.size === "s" ? 22 : b.size === "m" ? 40 : 56), lineHeight: b.size === "s" ? 1.3 : 1.02 }}
                className={b.size === "s" ? undefined : "@max-2xl:!text-[34px]"}
              />
              <T ctx={ctx} path="subheading" value={b.subheading} as="p" className="m-0 text-[18px] opacity-85" />
            </div>
            {(b.button || (ctx.onText && ctx.selectedBlockId === ctx.blockId)) && (
              <CoverButton href={ctx.live ? b.link : undefined}>
                <span className="flex size-[42px] items-center justify-center rounded-full" style={{ background: "var(--site-accent)" }} aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M8 5l12 7-12 7z" fill="var(--site-on-accent)" />
                  </svg>
                </span>
                <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="button" value={b.button ?? ""} />
              </CoverButton>
            )}
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
            ...((a) => (a === "center" ? { textAlign: "center" as const, marginInline: "auto" } : a === "end" ? { textAlign: "end" as const, marginInlineStart: "auto" } : {}))(ctx.align ?? b.align),
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
            ...((a) => (a === "center" ? { textAlign: "center" as const, marginInline: "auto" } : a === "end" ? { textAlign: "end" as const, marginInlineStart: "auto" } : {}))(ctx.align ?? b.align),
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
            crop={b.crop}
            pic={ctx.editing ? `${ctx.blockId}|mediaId` : undefined}
          />
          {b.showCaption !== false && (
            <T
              ctx={ctx}
              path="caption"
              value={b.caption}
              as="figcaption"
              style={{ color: "var(--site-muted)", padding: b.fullWidth ? "0 var(--site-pad)" : undefined, textAlign: ctx.align === "center" ? "center" : ctx.align === "end" ? "end" : undefined }}
            />
          )}
        </figure>
      );
    }
    case "images":
      return <ImagesView b={b} ctx={ctx} />;
    case "video":
      return <VideoView url={b.url} caption={b.caption} ctx={ctx} />;
    case "loop": {
      const loop = m(b.mediaId);
      if (!loop) return <SampleMedia show={ctx.editing} tone="sample:02" label="GIF / MP4" />;
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
      if (!doc)
        return ctx.editing ? (
          <div className="flex flex-wrap items-center gap-6">
            <div className="w-[200px] flex-none">
              <SampleMedia show tone="sample:07" label="PDF" ratio="3 / 4" />
            </div>
            <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="label" value={b.label} className="site-button self-center" />
          </div>
        ) : null;
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
          <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(48)} />
          <ul className="m-0 flex list-none flex-col p-0 text-[18px]">
            {b.items
              .filter((c) => c.title || ctx.editing)
              .map((c, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[96px_1fr] gap-6 py-5 @max-xl:grid-cols-[64px_1fr]"
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
    case "logos": {
      const tint = b.tint === "white" ? "brightness(0) invert(1)" : b.tint === "black" ? "brightness(0)" : undefined;
      return (
        <div className="flex flex-col gap-5">
          <T ctx={ctx} path="heading" value={b.heading} as="h2" style={{ ...heading(20), color: "var(--site-muted)" }} />
          <div
            className={cx(
              b.oneRow || b.columns ? "grid items-center justify-items-center gap-9 @max-xl:!grid-cols-3 @max-xl:gap-6" : cx("flex flex-wrap items-center gap-x-10 gap-y-5", alignRow(ctx.align)),
              b.band && "px-12 py-8 @max-xl:px-6",
            )}
            style={{
              ...(b.oneRow || b.columns ? { gridTemplateColumns: `repeat(${Math.max(1, b.columns || b.items.length)}, minmax(0, 1fr))` } : {}),
              ...(b.band ? { background: b.band, borderRadius: "calc(var(--site-radius) * 1.6)" } : {}),
            }}
            data-testid="logo-wall"
          >
            {b.items.map((l, i) => {
              const logo = m(l.mediaId);
              return logo ? (
                <span
                  key={i}
                  className={cx("block", LOGO_SIZE[b.size ?? "m"], b.oneRow || b.columns ? "w-full" : LOGO_WIDTH[b.size ?? "m"])}
                  style={tint ? { filter: tint } : undefined}
                >
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
                  style={{ ...heading(22), opacity: 0.75, color: b.band ? readableOn(b.band) : undefined }}
                />
              );
            })}
          </div>
        </div>
      );
    }
    case "header": {
      const logo = m(b.logoId);
      const centred = ctx.align === "center";
      return (
        <div
          className={cx("flex flex-wrap gap-4", centred ? "flex-col items-center text-center" : "items-baseline justify-between", ctx.align === "end" && "flex-row-reverse")}
          style={b.divider ? { borderBottom: "1px solid var(--site-line)", paddingBottom: 18 } : undefined}
          data-testid="section-header"
        >
          <h2
            className={cx("m-0 flex flex-wrap items-center gap-4", centred && "justify-center")}
            style={{
              ...heading(b.size === "l" ? 44 : 30),
              ...(b.accent ? { color: "var(--site-accent-ink)" } : {}),
              ...(b.upper ? { textTransform: "uppercase" as const } : {}),
              ...(b.underline ? { paddingBottom: 10, backgroundImage: "linear-gradient(var(--site-accent), var(--site-accent))", backgroundSize: "64px 2px", backgroundRepeat: "no-repeat", backgroundPosition: centred ? "center bottom" : "left bottom" } : {}),
            }}
          >
            {(b.number || (ctx.onText && ctx.selectedBlockId === ctx.blockId)) && (
              <T ctx={ctx} path="number" value={b.number} style={{ fontSize: 15, fontWeight: 600, color: "var(--site-accent-ink)", fontFamily: "var(--site-body)" }} />
            )}
            {logo ? (
              <span className="block h-[30px]" title={b.title}>
                <Picture m={logo} base={ctx.base} want={400} ratio="auto" alt={b.title} className="h-full !rounded-none [&_img]:!h-full [&_img]:!w-auto [&_img]:object-contain" />
              </span>
            ) : (
              <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="title" value={b.title} />
            )}
          </h2>
          {(b.badge || b.subtitle || (ctx.onText && ctx.selectedBlockId === ctx.blockId)) && (
            <span className="flex flex-wrap items-center gap-2.5 text-[14px]" style={{ color: "var(--site-muted)" }}>
              {(b.badge || (ctx.onText && ctx.selectedBlockId === ctx.blockId)) && (
                <T
                  ctx={ctx}
                  path="badge"
                  value={b.badge}
                  className="rounded-full px-3 py-1 text-[13px] font-semibold"
                  style={{ background: "var(--site-text)", color: "var(--site-bg)" }}
                />
              )}
              <T ctx={ctx} path="subtitle" value={b.subtitle} />
            </span>
          )}
        </div>
      );
    }
    case "feature":
      return <FeatureView b={b} ctx={ctx} />;
    case "about": {
      const photo = m(b.photoId);
      const cv = m(b.cvId);
      return (
        <div className="site-about grid gap-8">
          <div className="flex flex-col gap-4">
            <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(48)} />
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
          <h2 style={heading(48)}>{b.heading}</h2>
          {b.text && (
            <p className="m-0" style={{ color: "var(--site-muted)" }}>
              {b.text}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(48)} />
          <T ctx={ctx} path="text" value={b.text} as="p" className="m-0 text-[18px]" style={{ color: "var(--site-muted)" }} multiline />
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
      const art = m(b.mediaId ?? null);
      const inner = (
        <>
          {intro}
          {formPart}
        </>
      );
      return (
        <div
          id={ctx.live ? "contact" : undefined}
          className={cx(
            "gap-8 p-10 @max-xl:p-6",
            art ? "grid grid-cols-[minmax(0,320px)_1fr] items-center gap-14 p-14 @max-2xl:grid-cols-1" : split ? "grid grid-cols-2 items-start @max-2xl:grid-cols-1" : "flex flex-col items-start gap-3",
          )}
          style={b.flat ? { padding: 0 } : { background: "var(--site-surface)", borderRadius: "calc(var(--site-radius) * 2.3)" }}
        >
          {art ? (
            <>
              <Picture m={art} base={ctx.base} want={800} ratio="1 / 1" className="[&_img]:mix-blend-multiply" pic={ctx.editing ? `${ctx.blockId}|mediaId` : undefined} />
              <div className={cx("flex flex-col gap-6", split && "grid grid-cols-2 items-start @max-2xl:grid-cols-1")}>{inner}</div>
            </>
          ) : (
            inner
          )}
        </div>
      );
    }
    case "hire":
      if (!ctx.available?.on && !ctx.editing) return null;
      return (
        <div
          className={cx("flex flex-wrap items-center gap-4 p-8", ctx.align ? alignRow(ctx.align) : "justify-between")}
          title={!ctx.available?.on ? `${ctx.available?.label ?? "Available for work"} · off` : undefined}
          style={{
            background: "var(--site-accent)",
            color: "var(--site-on-accent)",
            borderRadius: "calc(var(--site-radius) * 2)",
            opacity: ctx.available?.on ? 1 : 0.45,
          }}
        >
          <span className="flex items-center gap-3" style={heading(32)}>
            <span className="size-2.5 rounded-full" style={{ background: "currentColor" }} />
            {ctx.onText ? <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="text" value={b.text} /> : b.text}
          </span>
          <span
            className="rounded-full px-5 py-2.5 font-semibold"
            style={{ background: "var(--site-on-accent)", color: "var(--site-accent)" }}
          >
            {ctx.available?.hire ?? "Hire me"}
          </span>
        </div>
      );
    case "social":
      return (
        <div className={cx("flex flex-wrap gap-3", alignRow(ctx.align))}>
          {b.links
            .filter((l) => l.url || ctx.editing)
            .map((l, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2.5 rounded-full px-5 py-3 text-[16px] font-semibold"
                style={{ border: "1.5px solid var(--site-line)" }}
              >
                <svg viewBox="0 0 24 24" aria-hidden className="block size-5" style={{ fill: "currentColor" }}>
                  <path d={socialPath(l.network)} />
                </svg>
                {networkName(l.network, l.url)}
              </span>
            ))}
        </div>
      );
    case "free":
      return ctx.renderFree ? ctx.renderFree(b) : <FreeSectionView b={b} ctx={ctx} />;
    case "quote":
      return (
        <blockquote className={cx("m-0 flex max-w-[900px] flex-col gap-5 py-6", alignCol(ctx.align))}>
          <span aria-hidden style={{ ...heading(120), lineHeight: 0.6, color: "var(--site-accent)" }}>“</span>
          <p style={{ ...heading(44), lineHeight: 1.2 }} className="m-0 @max-2xl:!text-[28px]">
            {ctx.onText ? <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="text" value={b.text} /> : b.text}
          </p>
          <T ctx={ctx} path="author" value={b.author} as="cite" className="not-italic" style={{ color: "var(--site-muted)" }} />
        </blockquote>
      );
  }
}

interface Ctx {
  media: Record<string, SiteMedia>;
  /** The theme's accent, so coloured bands can work out a readable accent for their text. */
  accent?: string;
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
  /** Round 13: the section's alignment (Settings → left / centre / right). */
  align?: "start" | "center" | "end";
}

/** Classes for a column that follows the section's alignment. */
const alignCol = (a: Ctx["align"]) => (a === "center" ? "items-center text-center mx-auto" : a === "end" ? "items-end text-end ms-auto" : "items-start");
const alignRow = (a: Ctx["align"]) => (a === "center" ? "justify-center" : a === "end" ? "justify-end" : "justify-start");

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
        rich
        placeholder={ctx.typeHere ?? "Type here"}
        className={className}
        style={style}
        onChange={(v) => onText(blockId, path, v)}
      />
    );
  }
  if (!value) return null;
  if (isRich(value)) return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: richHtml(value) }} />;
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
    ...(base && ctx.accent && banded ? { ["--site-accent-ink" as string]: accentInk(ctx.accent, base) } : {}),
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
          <Picture
            m={media}
            base={ctx.base}
            want={bg.blur ? 800 : 2560}
            ratio="auto"
            className="h-full w-full !rounded-none"
            still={!!bg.blur}
          />
          {!!bg.blur && <div className="absolute inset-0" style={{ backdropFilter: `blur(${bg.blur}px)` }} />}
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
  const lf = settings.logoFont ? FONTS[settings.logoFont] : null;
  const logoFont = lf ? { fontFamily: fontStack(lf), fontWeight: lf.headingWeight, textTransform: "none" as const } : null;
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
        // Links to other websites open in a new tab; links within the site (like /#broadcast) don't.
        {...(p.type === "link" && /^https?:/i.test(href) ? { target: "_blank", rel: "noopener" } : {})}
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
  if (theme.nav === "inline") {
    return (
      <header {...part} className={cx("flex flex-wrap items-center justify-between gap-4", partClass)}>
        <span className="flex flex-wrap items-center gap-x-8 gap-y-2">
          {brand}
          <span className="text-[13px]">{linkList}</span>
        </span>
        <span className="flex items-center gap-4">
          {socialIcons}
          {hire}
        </span>
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
    accent: theme.colors.accent,
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
  const h = fontOf(theme.fonts.heading, "space-grotesk");
  const b = fontOf(theme.fonts.body, "plex");
  const ar = fontOf(theme.fonts.arabic, "plex-arabic");
  const arBody = fontOf(theme.fonts.arabicBody ?? theme.fonts.arabic, "plex-arabic");
  const vars = {
    "--site-bg": theme.colors.background,
    "--site-text": theme.colors.text,
    "--site-accent": theme.colors.accent,
    "--site-on-accent": readableOn(theme.colors.accent),
    "--site-accent-ink": accentInk(theme.colors.accent, theme.colors.background),
    "--site-muted": `color-mix(in srgb, ${theme.colors.text} 62%, ${theme.colors.background})`,
    "--site-line": `color-mix(in srgb, ${theme.colors.text} 16%, ${theme.colors.background})`,
    "--site-surface": `color-mix(in srgb, ${theme.colors.text} 6%, ${theme.colors.background})`,
    // The theme's own colours, for inset cards inside coloured sections.
    "--site-theme-text": theme.colors.text,
    "--site-theme-muted": `color-mix(in srgb, ${theme.colors.text} 62%, ${theme.colors.background})`,
    "--site-radius": `${theme.radius}px`,
    // The chosen Arabic font is always in the stack: Arabic sites lead with it, and on English
    // sites any Arabic words fall through the Latin font (which has no Arabic letters) to it.
    "--site-heading": arabic ? `${ar.family}, ${h.family}, sans-serif` : `${h.family}, ${ar.family}, ${fontStack(h)}`,
    "--site-heading-weight": arabic ? ar.headingWeight : (theme.fonts.headingWeight ?? h.headingWeight),
    "--site-heading-case": theme.fonts.headingUpper && !arabic ? "uppercase" : "none",
    "--site-heading-scale": { s: 0.85, m: 1, l: 1.18 }[theme.fonts.headingScale ?? "m"],
    "--site-body": arabic ? `${arBody.family}, ${b.family}, system-ui` : `${b.family}, ${arBody.family}, ${fontStack(b)}`,
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
          <BlockView b={b} ctx={{ ...ctx, index: i, blockId: b.id, align: b.style?.align }} />
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
      {page.type === "links" && !content ? (
        // A link page (round 9): no menu or footer, one band from top to bottom.
        <div className="flex min-h-full flex-col" style={{ ["--site-pad" as string]: "0px" }}>
          {body}
          {(credit || report) && (
            <span className="flex justify-center gap-4 py-4 text-[12px]" style={{ color: "var(--site-muted)" }}>
              {credit && (ctx.live ? <a href="https://fannan.net" style={{ color: "inherit" }}>{credit}</a> : credit)}
              {report && (
                <a href={report.href} rel="nofollow" style={{ color: "inherit" }}>
                  {report.label}
                </a>
              )}
            </span>
          )}
        </div>
      ) : (
        <div className={cx("flex flex-col gap-12 p-[var(--site-pad)]", theme.nav === "sidebar" && "site-with-sidebar")}>
          {!bare && <Nav site={site} page={page} ctx={ctx} />}
          {body}
          {!bare && <Footer site={site} ctx={ctx} links={footerLinks} credit={credit} report={report} />}
        </div>
      )}
    </div>
  );
}
