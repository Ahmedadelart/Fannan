import type { CSSProperties, ReactNode } from "react";
import { dirFor } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { imageSources, posterSources, type MediaLike } from "@/lib/media";
import type { Block, BlockOf, PageDraft, SiteDraft, ThumbRatio } from "@/lib/site/types";
import { parseVideoLink, videoPoster } from "@/lib/video";
import { InlineText } from "@/components/editor/InlineText";
import { arabicFonts, bodyFonts, headingFonts, siteFontVars } from "./fonts";

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
  /** Editor canvas: the site name and tagline in the header, typed in place. */
  onSiteText?: (field: "title" | "tagline", value: string) => void;
  /** Placeholder for empty text fields on the editor canvas ("Type here"). */
  typeHere?: string;
  /** "Made with Fannan" footer credit on the Free plan. */
  credit?: string | null;
  /** Social links and CV from Settings, shown in the footer of live sites. */
  footerLinks?: Array<{ href: string; label: string; download?: boolean }>;
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
          background: tone ?? "var(--site-surface)",
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
  const projects = (ctx.projects ?? []).filter(
    (p) => p.visibility !== "hidden" && (b.source === "all" || p.category === b.source),
  );
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
  }> = projects.length
    ? projects.map((p) => ({
        key: p.id,
        slug: p.slug,
        title: p.title,
        meta: [p.client, p.role].filter(Boolean).join(" · "),
        m: p.coverId ? ctx.media[p.coverId] : null,
        locked: p.visibility === "password",
      }))
    : ctx.editing
      ? b.samples.map((s, i) => ({ key: String(i), tone: s.tone, ratio: s.ratio.replace("/", " / ") }))
      : [];
  if (!tiles.length) return null;

  const tile = (t: (typeof tiles)[number]) => {
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
            ratio={ratio ?? t.ratio}
            alt={b.captions ? "" : t.title}
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
        {(b.captions || b.credits) && t.title && (
          <figcaption className="flex flex-col gap-0.5" style={fullscreen ? { padding: "0 12px" } : undefined}>
            {b.captions && <span className="font-semibold">{t.title}</span>}
            {b.credits && t.meta && (
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
    return ctx.live && t.slug ? (
      <a
        key={t.key}
        href={`/${t.slug}`}
        className="site-tile m-0 flex flex-col gap-2 no-underline"
        style={{ color: "inherit", ...style }}
      >
        {inner}
      </a>
    ) : (
      <figure key={t.key} className="m-0 flex flex-col gap-2" style={style}>
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
        <div className="site-grid grid" style={{ gap: fullscreen ? 0 : b.gap, ["--cols" as string]: cols }}>
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
        style={{ aspectRatio: "16 / 9", background: tone ?? "#141414", borderRadius: "var(--site-radius)" }}
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

function BlockView({ b, ctx }: { b: Block; ctx: Ctx }) {
  const m = (id: string | null) => (id ? (ctx.media[id] ?? null) : null);
  switch (b.type) {
    case "cover": {
      const img = m(b.mediaId);
      return (
        <div
          className="relative flex flex-col justify-end overflow-hidden"
          style={{
            minHeight: b.height === "full" ? "min(88vh, 900px)" : "min(60vh, 560px)",
            marginInline: "calc(var(--site-pad) * -1)",
            background: b.tone,
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
              color: readableOn(b.tone),
              background: img ? "linear-gradient(transparent, rgba(0,0,0,.45))" : undefined,
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
          <Picture m={after} base={ctx.base} tone="#D8C7B8" ratio={after ? undefined : "16 / 9"} />
          <div className="absolute inset-y-0 start-0 w-1/2 overflow-hidden">
            <div className="h-full" style={{ width: "200%" }}>
              <Picture
                m={before}
                base={ctx.base}
                tone="#5B3A2E"
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
    case "contact":
      if (ctx.live && ctx.renderContact) {
        return (
          <div
            id="contact"
            className="flex flex-col items-start gap-3 p-10 @max-xl:p-6"
            style={{ background: "var(--site-surface)", borderRadius: "calc(var(--site-radius) * 2)" }}
          >
            <h2 style={heading(32)}>{b.heading}</h2>
            {b.text && (
              <p className="m-0" style={{ color: "var(--site-muted)" }}>
                {b.text}
              </p>
            )}
            {ctx.renderContact(b)}
          </div>
        );
      }
      return (
        <div
          className="flex flex-col items-start gap-3 p-10 @max-xl:p-6"
          style={{ background: "var(--site-surface)", borderRadius: "calc(var(--site-radius) * 2)" }}
        >
          <T ctx={ctx} path="heading" value={b.heading} as="h2" style={heading(32)} />
          <T ctx={ctx} path="text" value={b.text} as="p" className="m-0" style={{ color: "var(--site-muted)" }} multiline />
          <div className="mt-2 grid w-full max-w-[520px] gap-2.5" aria-hidden>
            {[0, 1].map((i) => (
              <span
                key={i}
                className="block h-11"
                style={{
                  border: "1px solid var(--site-line)",
                  borderRadius: "var(--site-radius)",
                  background: "var(--site-bg)",
                }}
              />
            ))}
            <span
              className="block h-24"
              style={{
                border: "1px solid var(--site-line)",
                borderRadius: "var(--site-radius)",
                background: "var(--site-bg)",
              }}
            />
          </div>
          <T ctx={{ ...ctx, selectedBlockId: ctx.blockId }} path="button" value={b.button} className="site-button mt-1" />
        </div>
      );
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
      {value}
    </Tag>
  );
}

/* ---------- the site ---------- */

function Nav({ site, page, ctx }: { site: SiteDraft; page: PageDraft; ctx: Ctx }) {
  const { theme } = site;
  const logo = theme.logoMediaId ? ctx.media[theme.logoMediaId] : null;
  const links = site.pages.filter((p) => p.showInNav);
  const brandInner = logo ? (
    <span className="block h-10 w-36">
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
          style={heading(theme.nav === "minimal" ? 20 : 26)}
          onChange={(v) => ctx.onSiteText!("title", v)}
        />
      ) : (
        <span style={heading(theme.nav === "minimal" ? 20 : 26)}>{site.title}</span>
      )}
      {site.tagline && theme.nav !== "minimal" && (
        <span className="text-[14px]" style={{ color: "var(--site-muted)" }}>
          {site.tagline}
        </span>
      )}
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
    <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px]" style={{ color: "var(--site-muted)" }}>
      {links.map((p) => {
        const style = p.id === page.id ? { color: "var(--site-text)", fontWeight: 600 } : undefined;
        if (!ctx.live) {
          return (
            <span key={p.id} style={style}>
              {p.title}
            </span>
          );
        }
        const href = p.type === "link" ? p.url || "#" : `/${p.slug}`;
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
      })}
    </span>
  );
  const hireStyle = { background: "var(--site-accent)", color: "var(--site-on-accent)", textDecoration: "none" };
  const hire = ctx.available?.on ? (
    ctx.live && ctx.contactHref ? (
      <a
        href={ctx.contactHref}
        className="rounded-full px-4 py-2 text-[14px] font-semibold"
        style={hireStyle}
        data-hire
      >
        {ctx.available.hire}
      </a>
    ) : (
      <span className="rounded-full px-4 py-2 text-[14px] font-semibold" style={hireStyle}>
        {ctx.available.hire}
      </span>
    )
  ) : null;

  if (theme.nav === "centered") {
    return (
      <header className="flex flex-col items-center gap-3 text-center">
        {brand}
        {linkList}
        {hire}
      </header>
    );
  }
  if (theme.nav === "minimal") {
    return (
      <header className="flex items-center justify-between gap-4">
        {brand}
        <span className="flex items-center gap-4 text-[15px] font-semibold">
          {hire}
          <span>☰</span>
        </span>
      </header>
    );
  }
  return (
    <header
      className={cx("flex flex-wrap items-center justify-between gap-4", theme.nav === "sidebar" && "site-sidebar-nav")}
    >
      {brand}
      {theme.nav === "split" ? (
        <>
          <span className="@max-2xl:hidden">{linkList}</span>
          {hire ?? <span />}
        </>
      ) : (
        <span className="flex flex-wrap items-center gap-5">
          {linkList}
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
    "--site-radius": `${theme.radius}px`,
    "--site-heading": arabic
      ? `${arabicFonts[theme.fonts.arabic].family}, ${h.family}`
      : `${h.family}, system-ui, sans-serif`,
    "--site-heading-weight": arabic ? 700 : h.weight,
    "--site-body": arabic
      ? `${arabicFonts[theme.fonts.arabic].family}, ${bodyFonts[theme.fonts.body].family}, system-ui`
      : `${bodyFonts[theme.fonts.body].family}, system-ui, sans-serif`,
  } as CSSProperties;

  const body = content ? (
    <main className="flex flex-col gap-10">{content}</main>
  ) : (
    <main className="flex flex-col" style={{ gap: theme.nav === "minimal" ? 72 : 48 }}>
      {page.blocks.map((b, i) => (
        <section
          key={b.id}
          data-block-id={b.id}
          className={cx(editing && "site-block", selectedBlockId === b.id && "site-block-selected")}
        >
          <BlockView b={b} ctx={{ ...ctx, index: i, blockId: b.id }} />
        </section>
      ))}
      {editing && page.blocks.length === 0 && <Empty show>+</Empty>}
    </main>
  );

  return (
    <div
      dir={dirFor(site.language)}
      lang={site.language}
      className={cx("site-root @container min-h-full", siteFontVars)}
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
        <Nav site={site} page={page} ctx={ctx} />
        {body}
        {(credit || footerLinks.length > 0 || report) && (
          <footer
            className="flex flex-col items-center gap-3 pt-8 text-center text-[12px]"
            style={{ color: "var(--site-muted)" }}
          >
            {footerLinks.length > 0 && (
              <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[14px]" data-testid="footer-links">
                {footerLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    rel={l.download ? undefined : "me noopener"}
                    target={l.download ? undefined : "_blank"}
                    style={{ color: "var(--site-text)" }}
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            )}
            {(credit || report) && (
              <span className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                {credit &&
                  (live ? (
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
        )}
      </div>
    </div>
  );
}
