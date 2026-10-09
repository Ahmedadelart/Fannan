"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { moveTo, startSortDrag } from "@/components/editor/sortDrag";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { arabicFonts, bodyFonts, headingFonts, siteFontVars } from "@/components/site/fonts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlays";
import { useToast } from "@/components/ui/Toast";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { imageSources } from "@/lib/media";
import { kindByKey, kindOf, LIBRARY, networkName, newId, SOCIAL_NETWORKS, type BlockKind, type LibraryGroup } from "@/lib/site/blocks";
import { CONTACT_WORDS, contactFormOf, type LegacyContactFields } from "@/lib/site/contact";
import { normalizeFooter, normalizeHeader } from "@/lib/site/normalize";
import { toneBase } from "@/lib/site/samples";
import { presetIds, themes } from "@/lib/site/starter";
import { freeBottom } from "@/lib/site/free";
import type {
  Block,
  BlockOf,
  ContactForm as ContactFormShape,
  FooterSettings,
  FreeItem,
  HeaderSettings,
  NavLayout,
  PageDraft,
  PageType,
  SiteDraft,
  Theme,
} from "@/lib/site/types";
import { parseVideoLink } from "@/lib/video";
import { beginUpload, completeUpload, newProject } from "../(dash)/projects/actions";
import { saveSiteSettings } from "../(dash)/settings/actions";

/* ---------- small form pieces (Editor.dc.html right panel) ---------- */

const inputCls =
  "h-10 w-full rounded-[10px] border border-line bg-paper px-3 text-[14px] font-normal text-ink outline-none focus:border-ink";
const areaCls =
  "min-h-[96px] w-full resize-y rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px] font-normal text-ink outline-none focus:border-ink";

export function Label({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="text-ink flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      {children}
      {hint && <span className="text-muted font-normal">{hint}</span>}
    </label>
  );
}

function Text({
  title,
  value,
  onChange,
  dir,
  placeholder,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr";
  placeholder?: string;
}) {
  return (
    <Label title={title}>
      <input
        className={inputCls}
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Label>
  );
}

function Area({
  title,
  value,
  onChange,
  hint,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Label title={title} hint={hint}>
      <textarea className={areaCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </Label>
  );
}

function Choice<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      <div
        role="radiogroup"
        aria-label={title}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}
      >
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={v === value}
            onClick={() => onChange(v)}
            className={cx(
              "h-9 rounded-[8px] px-2 text-[12px] font-semibold",
              v === value ? "bg-ink text-white" : "border-line bg-paper text-ink hover:bg-mist border",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Range({
  title,
  value,
  min,
  max,
  unit = "",
  onChange,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-semibold">
      <span className="flex justify-between">
        {title}
        <span className="text-muted font-normal tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="fannan-range"
        style={{ ["--pct" as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
    </label>
  );
}

function Switch({ title, checked, onChange }: { title: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span>{title}</span>
      <Toggle label={title} hideLabel checked={checked} onChange={onChange} />
    </div>
  );
}

function ColorField({
  title,
  value,
  themeLabel,
  onChange,
}: {
  title: string;
  value: string | null;
  themeLabel: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={cx(
            "h-9 rounded-[8px] px-3 text-[12px] font-semibold",
            value === null ? "bg-ink text-white" : "border-line bg-paper hover:bg-mist border",
          )}
        >
          {themeLabel}
        </button>
        <input
          type="color"
          aria-label={title}
          value={value ?? "#141414"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="border-line h-9 w-12 cursor-pointer rounded-[8px] border bg-white p-1"
        />
      </div>
    </div>
  );
}

/* ---------- media ---------- */

export type MediaKind = "image" | "loop" | "pdf";
const accepts: Record<MediaKind, string[]> = {
  image: ["image", "gif", "svg"],
  loop: ["gif", "loop"],
  pdf: ["pdf"],
};
const uploadTypes: Record<MediaKind, string> = {
  image: ".jpg,.jpeg,.png,.gif,.webp,.svg,image/*",
  loop: ".gif,.mp4,image/gif,video/mp4",
  pdf: ".pdf,application/pdf",
};
const EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
};

function Thumb({ m, className }: { m?: SiteMedia; className?: string }) {
  const src = m ? imageSources(m, 400) : null;
  if (!src) {
    return (
      <span className={cx("bg-mist text-muted flex items-center justify-center", className)}>
        <Icon name="image" size={20} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src.src} alt={m?.alt ?? ""} className={cx("object-cover", className)} />;
}

export function MediaPicker({
  open,
  kind,
  media,
  onClose,
  onPick,
  onUploaded,
}: {
  open: boolean;
  kind: MediaKind;
  media: Record<string, SiteMedia>;
  onClose: () => void;
  onPick: (id: string) => void;
  onUploaded: (m: SiteMedia) => void;
}) {
  const t = useTranslations("editor.picker");
  const tp = useTranslations("projects");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const items = Object.values(media).filter((m) => accepts[kind].includes(m.type));

  async function upload(file: File) {
    setBusy(true);
    setProblem(null);
    const type = EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
    const start = await beginUpload("_library", { name: file.name, type, size: file.size });
    if (!start.ok) {
      setBusy(false);
      return setProblem(
        tp.has(`errors.${start.error}`) ? tp(`errors.${start.error}`, { image: 30, pdf: 50 }) : tp("errors.error"),
      );
    }
    const put = await fetch(start.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": start.contentType },
      body: file,
    }).catch(() => null);
    if (!put?.ok) {
      setBusy(false);
      return setProblem(tp("errors.error"));
    }
    const done = await completeUpload(start.mediaId);
    setBusy(false);
    if (!done.ok)
      return setProblem(
        tp.has(`errors.${done.error}`) ? tp(`errors.${done.error}`, { image: 30, pdf: 50 }) : tp("errors.error"),
      );
    const m = done.media;
    const sm: SiteMedia = {
      id: m.id,
      type: m.type,
      variants: m.variants,
      poster: m.poster,
      loop: m.loop,
      width: m.width,
      height: m.height,
      alt: m.alt,
      caption: m.caption,
      pages: m.pages,
    };
    onUploaded(sm);
    onPick(m.id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={t("close")}
      footer={
        <>
          <input
            ref={input}
            type="file"
            accept={uploadTypes[kind]}
            className="sr-only"
            data-testid="picker-file"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <Button variant="lime" icon="upload" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? t("uploading") : t("upload")}
          </Button>
        </>
      }
    >
      {problem && <p className="text-ink mb-2 font-semibold">{problem}</p>}
      {items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto">
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              className="hover:border-ink overflow-hidden rounded-md border-2 border-transparent"
              data-testid="picker-item"
            >
              <Thumb m={m} className="aspect-square w-full" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function MediaField({
  title,
  id,
  kind,
  media,
  onChange,
  openPicker,
}: {
  title: string;
  id: string | null;
  kind: MediaKind;
  media: Record<string, SiteMedia>;
  onChange: (id: string | null) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
}) {
  const t = useTranslations("editor.fields");
  const m = id ? media[id] : undefined;
  return (
    <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      <div className="flex items-center gap-2.5">
        <Thumb m={m} className="size-14 flex-none rounded-md" />
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => openPicker(kind, onChange)}>
            {m ? t("replace") : t("choose")}
          </Button>
          {m && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              {t("clear")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Blocks tab: a list of real previews, dragged onto the page (Carbonmade-style) ---------- */

/** About how tall a block is on a 1200px page, so its preview isn't cropped or empty. */
function previewHeight(b: Block): number {
  switch (b.type) {
    case "free":
      return Math.round(b.rows * 47 + 40);
    case "gallery":
      return b.layout === "slider" ? 520 : 720;
    case "credits":
    case "contact":
      return 560;
    case "hire":
    case "social":
    case "quote":
      return 300;
    default:
      return 560;
  }
}

function BlockPreview({
  kind,
  draft,
  media,
  projects,
}: {
  kind: BlockKind;
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  projects: GalleryProject[];
}) {
  // One sample of the block in the artist's own theme, made once.
  const [sample] = useState(() => kind.make(draft.language));
  const site: SiteDraft = {
    ...draft,
    pages: [{ id: "preview", slug: "", title: "", type: "custom", showInNav: false, blocks: [sample] }],
  };
  return (
    <ScaledSite width={1200} height={previewHeight(sample)}>
      <SiteRender site={site} pageId="preview" media={media} projects={projects} editing bare />
    </ScaledSite>
  );
}

export function BlocksTab({
  onAdd,
  draft,
  media,
  projects,
}: {
  onAdd: (k: BlockKind) => void;
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  projects: GalleryProject[];
}) {
  const t = useTranslations("editor");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<LibraryGroup | "all">("all");
  const match = (k: BlockKind) => !q || t(`blocks.${k.key}`).toLowerCase().includes(q.toLowerCase());
  const chip = (on: boolean) =>
    cx(
      "h-8 flex-none rounded-pill px-3 text-[12px] font-semibold transition-colors",
      on ? "bg-lime text-on-lime" : "bg-mist text-ink-soft hover:text-ink",
    );
  return (
    <div className="flex flex-col gap-4 px-3 pt-3 pb-6" data-tip="blocks">
      <label className="border-line text-muted flex h-10 items-center gap-2 rounded-[10px] border px-3">
        <Icon name="search" size={18} />
        <input
          className="text-ink min-w-0 flex-1 bg-transparent outline-none focus-visible:shadow-none"
          placeholder={t("searchBlocks")}
          aria-label={t("searchBlocks")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {/* Categories: one tap shows just that kind of section. */}
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" role="group" aria-label={t("library.label")}>
        <button type="button" aria-pressed={only === "all"} className={chip(only === "all")} onClick={() => setOnly("all")}>
          {t("library.all")}
        </button>
        {LIBRARY.map(({ group }) => (
          <button key={group} type="button" aria-pressed={only === group} className={chip(only === group)} onClick={() => setOnly(group)}>
            {t(`library.${group}`)}
          </button>
        ))}
      </div>
      <p className="text-muted -mt-2 text-[12px]">{t("dragHint")}</p>
      {LIBRARY.filter(({ group }) => only === "all" || only === group).map(({ group, keys }) => {
        const items = keys.map(kindByKey).filter((k): k is BlockKind => !!k && match(k));
        if (!items.length) return null;
        return (
          <section key={group} className="flex flex-col gap-2.5" aria-label={t(`library.${group}`)}>
            <h3 className="bg-paper text-ink sticky top-0 z-10 -mx-3 flex items-baseline justify-between px-3 pt-3 pb-2 text-[14px] font-semibold">
              {t(`library.${group}`)}
              <span className="text-muted text-[12px] font-medium">{items.length}</span>
            </h3>
            {items.map((k) => (
              <button
                key={k.key}
                type="button"
                draggable
                data-block-key={k.key}
                data-testid={`add-${k.key}`}
                aria-label={`${t(`blocks.${k.key}`)}${k.pro ? " (Pro)" : ""}`}
                onDragStart={(e: DragEvent) => {
                  e.dataTransfer.setData("application/x-fannan-block", k.key);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAdd(k)}
                className="group border-line hover:border-lime relative flex w-full cursor-grab flex-col overflow-hidden rounded-[12px] border bg-[#141414] text-start transition-colors active:cursor-grabbing"
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 160px" }}
              >
                <BlockPreview kind={k} draft={draft} media={media} projects={projects} />
                <span className="text-ink flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold">
                  {t(`blocks.${k.key}`)}
                  <Icon name="add" size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                {k.pro && (
                  <span className="bg-lime text-on-lime absolute end-2 top-2 rounded-pill px-2 py-0.5 text-[10px] font-bold tracking-[0.06em]">
                    PRO
                  </span>
                )}
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Little drawings of each navigation layout, so the choice is visual. */
function NavSketch({ nav }: { nav: NavLayout }) {
  const bar = "block h-1 rounded-[2px] bg-current opacity-80";
  const dot = "block h-1 w-3 rounded-[2px] bg-current opacity-40";
  const links = (
    <span className="flex gap-1">
      <span className={dot} />
      <span className={dot} />
      <span className={dot} />
    </span>
  );
  switch (nav) {
    case "top":
      return (
        <span className="flex w-full items-center justify-between">
          <span className={`${bar} w-6`} />
          {links}
        </span>
      );
    case "centered":
      return (
        <span className="flex w-full flex-col items-center gap-1">
          <span className={`${bar} w-8`} />
          {links}
        </span>
      );
    case "split":
      return (
        <span className="flex w-full items-center justify-between">
          <span className={dot} />
          <span className={`${bar} w-6`} />
          <span className={dot} />
        </span>
      );
    case "sidebar":
      return (
        <span className="flex w-full gap-2">
          <span className="flex flex-col gap-1">
            <span className={`${bar} w-5`} />
            <span className={dot} />
            <span className={dot} />
          </span>
          <span className="bg-current/15 block h-6 flex-1 rounded-[2px] opacity-20" />
        </span>
      );
    case "minimal":
      return (
        <span className="flex w-full items-center justify-between">
          <span className={`${bar} w-4`} />
          <span className="flex flex-col gap-[3px]">
            <span className="block h-[2px] w-3 bg-current" />
            <span className="block h-[2px] w-3 bg-current" />
          </span>
        </span>
      );
  }
}

export type DesignSection = "logo" | "nav" | "styles" | "footer";

export function StyleTab({
  draft,
  media,
  setDraft,
  openPicker,
  section,
  credit,
}: {
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  setDraft: (fn: (d: SiteDraft) => SiteDraft, key?: string) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
  section: DesignSection;
  credit?: boolean;
}) {
  const t = useTranslations("editor.style");
  const th = draft.theme;
  const setTheme = (patch: Partial<Theme>, key?: string) =>
    setDraft((d) => ({ ...d, theme: { ...d.theme, ...patch } }), key);

  if (section === "logo") {
    return (
      <div className="flex flex-col gap-4">
        <Text title={t("siteTitle")} value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }), "title")} />
        <Text title={t("tagline")} value={draft.tagline} onChange={(v) => setDraft((d) => ({ ...d, tagline: v }), "tagline")} />
        <MediaField
          title={t("logo")}
          id={th.logoMediaId}
          kind="image"
          media={media}
          onChange={(id) => setTheme({ logoMediaId: id })}
          openPicker={openPicker}
        />
        <MediaField
          title={t("favicon")}
          id={th.faviconMediaId}
          kind="image"
          media={media}
          onChange={(id) => setTheme({ faviconMediaId: id })}
          openPicker={openPicker}
        />
      </div>
    );
  }

  if (section === "nav") {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("nav")}>
          {(["top", "centered", "sidebar", "split", "minimal"] as NavLayout[]).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={th.nav === n}
              aria-label={t(`navNames.${n}`)}
              onClick={() => setTheme({ nav: n })}
              className={cx(
                "bg-paper flex flex-col items-stretch gap-2 rounded-[10px] p-2.5 text-[11px] font-semibold",
                th.nav === n ? "border-lime border-2" : "border-line border",
              )}
            >
              <span className="bg-mist flex h-10 items-center rounded-[6px] px-2">
                <NavSketch nav={n} />
              </span>
              {t(`navNames.${n}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (section === "footer") {
    return (
      <div className="flex flex-col gap-3 text-[13px]">
        <p className="text-ink-soft">{t("footerAbout")}</p>
        {credit && <p className="text-muted">{t("footerCredit")}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">{t("presets")}</div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("presets")}>
          {presetIds.map((id) => {
            const p = themes[id];
            const on = th.preset === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTheme({ ...p, logoMediaId: th.logoMediaId, faviconMediaId: th.faviconMediaId })}
                className={cx(
                  "bg-paper flex flex-col gap-1.5 rounded-[10px] p-1.5",
                  on ? "border-lime border-2" : "border-line border",
                )}
              >
                <span
                  className="block h-[30px] rounded-[6px] border border-black/10"
                  style={{ background: `linear-gradient(90deg, ${p.colors.background} 0 70%, ${p.colors.accent} 70%)` }}
                />
                <span className="text-[11px] font-semibold">{t(`presetNames.${id}`)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-[12px] font-semibold">{t("colours")}</div>
        <div className="grid grid-cols-3 gap-2">
          {(["background", "text", "accent"] as const).map((c) => (
            <label key={c} className="text-muted flex flex-col gap-1 text-[11px]">
              <input
                type="color"
                value={th.colors[c]}
                onChange={(e) => setTheme({ colors: { ...th.colors, [c]: e.target.value.toUpperCase() } }, `color-${c}`)}
                className="border-line h-9 w-full cursor-pointer rounded-[8px] border p-0.5"
              />
              {t(c)}
            </label>
          ))}
        </div>
      </div>
      <Label title={t("headingFont")}>
        <select
          className={inputCls}
          value={th.fonts.heading}
          onChange={(e) => setTheme({ fonts: { ...th.fonts, heading: e.target.value as Theme["fonts"]["heading"] } })}
        >
          {Object.entries(headingFonts).map(([id, f]) => (
            <option key={id} value={id}>
              {f.label}
            </option>
          ))}
        </select>
      </Label>
      <Label title={t("bodyFont")}>
        <select
          className={inputCls}
          value={th.fonts.body}
          onChange={(e) => setTheme({ fonts: { ...th.fonts, body: e.target.value as Theme["fonts"]["body"] } })}
        >
          {Object.entries(bodyFonts).map(([id, f]) => (
            <option key={id} value={id}>
              {f.label}
            </option>
          ))}
        </select>
      </Label>
      {/* Arabic fonts, each shown in its own letters. */}
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("arabicFont")}>
        <span className="text-[13px] font-semibold">{t("arabicFont")}</span>
        <div className={cx("grid grid-cols-2 gap-2", siteFontVars)}>
          {Object.entries(arabicFonts).map(([id, f]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={th.fonts.arabic === id}
              aria-label={f.label}
              onClick={() => setTheme({ fonts: { ...th.fonts, arabic: id as Theme["fonts"]["arabic"] } })}
              className={cx(
                "flex flex-col items-start gap-1 rounded-[10px] border px-3 py-2 text-start",
                th.fonts.arabic === id ? "border-lime border-2" : "border-line hover:border-line-strong",
              )}
            >
              <span dir="rtl" className="w-full text-[20px] leading-tight" style={{ fontFamily: f.family, fontWeight: 700 }}>
                فنان
              </span>
              <span className="text-muted text-[11px]">{f.label}</span>
            </button>
          ))}
        </div>
      </div>
      <Range title={t("radius")} value={th.radius} min={0} max={24} unit="px" onChange={(v) => setTheme({ radius: v }, "radius")} />
      <Choice
        title={t("language")}
        value={draft.language}
        options={[
          ["en", t("languages.en")],
          ["ar", t("languages.ar")],
        ]}
        onChange={(v) => setDraft((d) => ({ ...d, language: v }))}
      />
    </div>
  );
}

/* ---------- Pages tab ---------- */

export function PagesTab({
  draft,
  pageId,
  setPageId,
  setDraft,
  canPassword,
  onPassword,
  part = "all",
}: {
  /** "list": the page switcher (drag to reorder, add pages); "settings": the current page's settings. */
  part?: "all" | "list" | "settings";
  draft: SiteDraft;
  pageId: string;
  setPageId: (id: string) => void;
  setDraft: (fn: (d: SiteDraft) => SiteDraft, key?: string) => void;
  canPassword: boolean;
  onPassword: (pageId: string, pw: string) => Promise<boolean>;
}) {
  const t = useTranslations("editor.pages");
  const locale = useLocale() as Locale;
  const [pw, setPw] = useState("");
  const page = draft.pages.find((p) => p.id === pageId) ?? draft.pages[0];
  const index = draft.pages.indexOf(page);
  const setPage = (patch: Partial<PageDraft>, key?: string) =>
    setDraft((d) => ({ ...d, pages: d.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)) }), key);
  // The home page stays first; the others are dragged into the order they appear in the menu.
  const list = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState<number | null>(null);
  const movePage = (id: string, toIndex: number) =>
    setDraft((d) => {
      const [home, ...rest] = d.pages;
      return { ...d, pages: [home, ...moveTo(rest, id, toIndex)] };
    });
  const dragPage = (e: React.PointerEvent, id: string) =>
    startSortDrag(e, {
      dragId: id,
      items: () =>
        [...(list.current?.querySelectorAll<HTMLElement>("[data-page-id]") ?? [])]
          .filter((el) => el.dataset.home !== "1")
          .map((el) => ({ id: el.dataset.pageId!, el })),
      onMark: (m) => {
        const top = list.current?.getBoundingClientRect().top ?? 0;
        setMark(m ? m.y - top : null);
      },
      onDrop: (i) => movePage(id, i),
    });
  const add = (type: PageType) => {
    const id = newId();
    const title = t(`newTitles.${type}`);
    void locale;
    setDraft((d) => ({
      ...d,
      pages: [
        ...d.pages,
        {
          id,
          type,
          title,
          slug: `${
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "page"
          }-${d.pages.length}`,
          showInNav: true,
          blocks: [],
          ...(type === "link" ? { url: "" } : {}),
        },
      ],
    }));
    setPageId(id);
  };

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-4 pb-6">
      {part !== "settings" && (
        <ul ref={list} className="relative flex flex-col gap-1" data-testid="page-list">
          {draft.pages.map((p, i) => (
            <li
              key={p.id}
              data-page-id={p.id}
              data-home={i === 0 ? "1" : undefined}
              className="flex items-center gap-1"
            >
              {i === 0 ? (
                <span className="w-7 flex-none" aria-hidden />
              ) : (
                <button
                  type="button"
                  aria-label={t("drag", { page: p.title })}
                  title={t("drag", { page: p.title })}
                  className="text-muted hover:text-ink flex h-[42px] w-7 flex-none cursor-grab touch-none items-center justify-center"
                  onPointerDown={(e) => dragPage(e, p.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const others = draft.pages.slice(1).map((x) => x.id);
                    const at = others.indexOf(p.id) + (e.key === "ArrowUp" ? -1 : 1);
                    if (at >= 0 && at < others.length) movePage(p.id, at);
                  }}
                >
                  <Icon name="drag" size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setPageId(p.id)}
                aria-current={p.id === page.id}
                className={cx(
                  "flex h-[42px] min-w-0 flex-1 items-center justify-between rounded-[10px] px-2.5 text-start",
                  p.id === page.id ? "bg-mist font-semibold" : "hover:bg-mist/60",
                )}
              >
                <span className="truncate">{p.title}</span>
                <span className="text-muted text-[12px]">
                  {i === 0 ? t("home") : p.hasPassword ? "🔒" : t(`types.${p.type}`)}
                </span>
              </button>
            </li>
          ))}
          {mark !== null && (
            <li
              aria-hidden
              className="bg-ink pointer-events-none absolute inset-x-0 h-1 rounded"
              style={{ top: mark - 3 }}
            />
          )}
        </ul>
      )}

      {part !== "list" && (
        <div className="border-line flex flex-col gap-3 rounded-md border p-3">
          <Text title={t("name")} value={page.title} onChange={(v) => setPage({ title: v }, `page-title-${page.id}`)} />
          {index > 0 && page.type !== "link" && (
            <Text
              title={t("slug")}
              dir="ltr"
              value={page.slug}
              onChange={(v) => setPage({ slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "") }, `page-slug-${page.id}`)}
            />
          )}
          {page.type === "link" && (
            <Text
              title={t("url")}
              dir="ltr"
              placeholder="https://"
              value={page.url ?? ""}
              onChange={(v) => setPage({ url: v }, `page-url-${page.id}`)}
            />
          )}
          <Switch title={t("inNav")} checked={page.showInNav} onChange={(v) => setPage({ showInNav: v })} />
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              icon="delete"
              disabled={draft.pages.length <= 1 || index === 0}
              onClick={() => {
                setDraft((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== page.id) }));
                setPageId(draft.pages[0].id);
              }}
            >
              {t("delete")}
            </Button>
          </div>
          {page.type !== "link" && (
            <div className="border-line flex flex-col gap-1.5 border-t pt-3">
              {canPassword ? (
                <form
                  className="flex flex-col gap-1.5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await onPassword(page.id, pw)) setPw("");
                  }}
                >
                  <Label title={t("password")} hint={page.hasPassword ? t("passwordSet") : undefined}>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputCls}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                    />
                  </Label>
                  <div className="flex gap-1.5">
                    <Button size="sm" type="submit" variant="outline" disabled={!pw}>
                      {t("savePassword")}
                    </Button>
                    {page.hasPassword && (
                      <Button size="sm" variant="ghost" onClick={() => onPassword(page.id, "")}>
                        {t("removePassword")}
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
                <p className="text-muted flex items-center gap-2 text-[12px]">
                  <Badge variant="brand">Pro</Badge> {t("proOnly")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {part !== "settings" && (
        <>
          <div className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">{t("add")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["gallery", "custom", "about", "link"] as PageType[]).map((type) => (
              <Button key={type} size="sm" variant="outline" onClick={() => add(type)}>
                {t(`types.${type}`)}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Block settings (right panel) ---------- */

/* ---------- the header and footer, clicked on the canvas (round 4) ---------- */

/** Site-wide settings the editor shows: social links and CV (footer), older contact fields. */
export interface EditorSiteSettings {
  social: Array<{ network: string; url: string }>;
  cvMediaId: string | null;
  contact: LegacyContactFields;
}

export function SitePartSettings({
  part,
  draft,
  setDraft,
  media,
  openPicker,
  credit,
  siteSettings,
  onSiteSettings,
}: {
  part: "header" | "footer";
  draft: SiteDraft;
  setDraft: (fn: (d: SiteDraft) => SiteDraft, key?: string) => void;
  media: Record<string, SiteMedia>;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
  credit: boolean;
  siteSettings: EditorSiteSettings;
  onSiteSettings: (s: EditorSiteSettings) => void;
}) {
  const t = useTranslations("editor.parts");
  const st = useTranslations("editor.style");
  const toast = useToast();
  const header = draft.header ?? normalizeHeader(null);
  const footer = draft.footer ?? normalizeFooter(null);
  const setHeader = (patch: Partial<HeaderSettings>, key?: string) =>
    setDraft((d) => ({ ...d, header: { ...(d.header ?? normalizeHeader(null)), ...patch } }), key);
  const setFooter = (patch: Partial<FooterSettings>, key?: string) =>
    setDraft((d) => ({ ...d, footer: { ...(d.footer ?? normalizeFooter(null)), ...patch } }), key);

  // Social links and the CV apply straight away (they're site settings, not part of the draft).
  const [social, setSocial] = useState(siteSettings.social);
  async function saveSettings(patch: Pick<Partial<EditorSiteSettings>, "social" | "cvMediaId">) {
    const next = { ...siteSettings, ...patch };
    onSiteSettings(next);
    const r = await saveSiteSettings(patch).catch(() => ({ ok: false as const }));
    if (!r.ok) toast(t("notSaved"), "close");
  }

  if (part === "header") {
    const bg = header.background;
    return (
      <div className="flex flex-col gap-5" data-testid="header-settings">
        <h3 className="text-[15px] font-semibold">{t("header")}</h3>
        <StyleTab section="nav" draft={draft} media={media} setDraft={setDraft} openPicker={openPicker} />
        <StyleTab section="logo" draft={draft} media={media} setDraft={setDraft} openPicker={openPicker} />
        <Switch title={t("showTagline")} checked={header.tagline} onChange={(v) => setHeader({ tagline: v })} />
        <div className="border-line flex flex-col gap-3 border-t pt-4">
          <span className="text-[13px] font-semibold">{t("menu")}</span>
          {draft.pages.map((pg) => (
            <Switch
              key={pg.id}
              title={pg.title || "—"}
              checked={pg.showInNav}
              onChange={(v) =>
                setDraft((d) => ({ ...d, pages: d.pages.map((x) => (x.id === pg.id ? { ...x, showInNav: v } : x)) }))
              }
            />
          ))}
          <p className="text-muted text-[12px]">{t("menuHint")}</p>
        </div>
        <div className="border-line flex flex-col gap-3 border-t pt-4">
          <span className="text-[13px] font-semibold">{t("hire")}</span>
          <Choice
            title={t("hireShow")}
            value={header.hire.on === null ? "auto" : header.hire.on ? "on" : "off"}
            options={[
              ["auto", t("hireAuto")],
              ["on", t("hireOn")],
              ["off", t("hireOff")],
            ]}
            onChange={(v) => setHeader({ hire: { ...header.hire, on: v === "auto" ? null : v === "on" } })}
          />
          <Text
            title={t("hireLabel")}
            value={header.hire.label}
            placeholder={draft.language === "ar" ? "وظّفني" : "Hire me"}
            onChange={(v) => setHeader({ hire: { ...header.hire, label: v } }, "hire-label")}
          />
          <Text
            title={t("hireLink")}
            value={header.hire.link}
            dir="ltr"
            placeholder="/contact"
            onChange={(v) => setHeader({ hire: { ...header.hire, link: v } }, "hire-link")}
          />
        </div>
        <div className="border-line flex flex-col gap-3 border-t pt-4">
          <Choice
            title={t("background")}
            value={bg === "none" || bg === "surface" ? bg : "colour"}
            options={[
              ["none", t("bgNone")],
              ["surface", t("bgSoft")],
              ["colour", t("bgColour")],
            ]}
            onChange={(v) => setHeader({ background: v === "colour" ? (bg.startsWith("#") ? bg : "#F4F4F2") : v })}
          />
          {bg.startsWith("#") && (
            <input
              type="color"
              aria-label={t("bgColour")}
              value={bg}
              onChange={(e) => setHeader({ background: e.target.value.toUpperCase() }, "header-bg")}
              className="border-line h-9 w-full cursor-pointer rounded-[8px] border bg-white p-1"
            />
          )}
          <Switch title={t("sticky")} checked={header.sticky} onChange={(v) => setHeader({ sticky: v })} />
          <p className="text-muted text-[12px]">{t("stickyHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="footer-settings">
      <h3 className="text-[15px] font-semibold">{t("footer")}</h3>
      <Area title={t("footerText")} value={footer.text} onChange={(v) => setFooter({ text: v }, "footer-text")} hint={t("footerTextHint")} />
      <Choice
        title={t("align")}
        value={footer.align}
        options={[
          ["center", t("alignCenter")],
          ["start", t("alignStart")],
        ]}
        onChange={(v) => setFooter({ align: v })}
      />
      <div className="border-line flex flex-col gap-3 border-t pt-4">
        <Switch title={t("showSocial")} checked={footer.social} onChange={(v) => setFooter({ social: v })} />
        {social.map((l, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select
              aria-label={t("network")}
              className={cx(inputCls, "w-[42%] flex-none px-2")}
              value={l.network}
              onChange={(e) => {
                const next = social.map((x, j) => (j === i ? { ...x, network: e.target.value } : x));
                setSocial(next);
                void saveSettings({ social: next });
              }}
            >
              {SOCIAL_NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {networkName(n, "https://" + n)}
                </option>
              ))}
            </select>
            <input
              aria-label={t("linkUrl")}
              className={inputCls}
              dir="ltr"
              placeholder="https://"
              value={l.url}
              onChange={(e) => setSocial(social.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              onBlur={() => void saveSettings({ social })}
            />
            <button
              type="button"
              aria-label={t("removeLink")}
              className="text-muted hover:text-ink flex size-9 flex-none items-center justify-center"
              onClick={() => {
                const next = social.filter((_, j) => j !== i);
                setSocial(next);
                void saveSettings({ social: next });
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        {social.length < 12 && (
          <Button size="sm" variant="outline" icon="add" onClick={() => setSocial([...social, { network: "instagram", url: "" }])}>
            {t("addLink")}
          </Button>
        )}
      </div>
      <div className="border-line flex flex-col gap-3 border-t pt-4">
        <Switch title={t("showCv")} checked={footer.cv} onChange={(v) => setFooter({ cv: v })} />
        <MediaField
          title={t("cv")}
          id={siteSettings.cvMediaId}
          kind="pdf"
          media={media}
          onChange={(id) => void saveSettings({ cvMediaId: id })}
          openPicker={openPicker}
        />
        <p className="text-muted text-[12px]">{t("rightAway")}</p>
      </div>
      {credit && <p className="text-muted text-[12px]">{st("footerCredit")}</p>}
    </div>
  );
}

export function BlockSettings({
  block,
  media,
  categories,
  update,
  openPicker,
  freeItem = null,
  onFreeItem,
  contactFallback,
  language,
}: {
  /** Site-wide contact settings from before contact sections had their own. */
  contactFallback?: LegacyContactFields;
  /** The site's language: default field names on the contact form follow it. */
  language: Locale;
  freeItem?: string | null;
  onFreeItem?: (id: string | null) => void;
  block: Block;
  media: Record<string, SiteMedia>;
  categories: Record<string, string>;
  update: (patch: Partial<Block>, key?: string) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
}) {
  const t = useTranslations("editor");
  const f = useTranslations("editor.fields");
  const g = useTranslations("editor.gallery");
  const fr = useTranslations("editor.free");
  const c = useTranslations("editor.contactForm");
  const k = (name: string) => `${block.id}-${name}`;
  const set = <T extends Block>(patch: Partial<T>, key?: string) => update(patch as Partial<Block>, key);
  const mediaField = (title: string, id: string | null, kind: MediaKind, apply: (id: string | null) => void) => (
    <MediaField title={title} id={id} kind={kind} media={media} onChange={apply} openPicker={openPicker} />
  );
  const align = (b: { align: "start" | "center" }) => (
    <Choice
      title={f("align")}
      value={b.align}
      options={[
        ["start", f("alignStart")],
        ["center", f("alignCenter")],
      ]}
      onChange={(v) => set({ align: v } as never)}
    />
  );

  const list = <T,>(
    items: T[],
    render: (item: T, change: (patch: Partial<T>) => void) => ReactNode,
    blank: T,
    max = 30,
  ) => (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] font-semibold">{f("items")}</div>
      {items.map((item, i) => (
        <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
          {render(item, (patch) =>
            set({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) } as never, k(`item-${i}`)),
          )}
          <Button
            size="sm"
            variant="ghost"
            icon="delete"
            onClick={() => set({ items: items.filter((_, j) => j !== i) } as never)}
          >
            {f("removeItem")}
          </Button>
        </div>
      ))}
      {items.length < max && (
        <Button size="sm" variant="outline" icon="add" onClick={() => set({ items: [...items, blank] } as never)}>
          {f("addItem")}
        </Button>
      )}
    </div>
  );

  let body: ReactNode = null;
  switch (block.type) {
    case "cover":
      body = (
        <>
          {mediaField(f("image"), block.mediaId, "image", (id) => set({ mediaId: id }))}
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Text title={f("subheading")} value={block.subheading} onChange={(v) => set({ subheading: v }, k("s"))} />
          <Choice
            title={f("height")}
            value={block.height}
            options={[
              ["large", f("heightLarge")],
              ["full", f("heightFull")],
            ]}
            onChange={(v) => set({ height: v })}
          />
          <Label title={f("colour")}>
            <input
              type="color"
              value={toneBase(block.tone)}
              onChange={(e) => set({ tone: e.target.value.toUpperCase() }, k("tone"))}
              className="border-line h-9 w-full rounded-[8px] border p-0.5"
            />
          </Label>
        </>
      );
      break;
    case "text":
      body = (
        <>
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          {align(block)}
          <Choice
            title={f("size")}
            value={block.size}
            options={[
              ["body", f("sizeBody")],
              ["large", f("sizeLarge")],
            ]}
            onChange={(v) => set({ size: v })}
          />
        </>
      );
      break;
    case "hero":
      body = (
        <>
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          {align(block)}
        </>
      );
      break;
    case "columns":
      body = list(
        block.items,
        (c, change) => (
          <>
            <Text title={f("heading")} value={c.heading} onChange={(v) => change({ heading: v })} />
            <Area title={f("text")} value={c.text} onChange={(v) => change({ text: v })} />
          </>
        ),
        { heading: "", text: "" },
        4,
      );
      break;
    case "gallery": {
      const b = block as BlockOf<"gallery">;
      body = (
        <>
          <Label title={g("source")}>
            <select className={inputCls} value={b.source} onChange={(e) => set({ source: e.target.value })}>
              <option value="all">{g("all")}</option>
              {Object.entries(categories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Label>
          <Choice
            title={g("layout")}
            value={b.layout}
            options={(["grid", "masonry", "slider", "fullscreen"] as const).map((l) => [l, g(`layouts.${l}`)])}
            onChange={(v) => set({ layout: v })}
          />
          <Range
            title={g("columns")}
            value={b.columns}
            min={1}
            max={6}
            onChange={(v) => set({ columns: v }, k("cols"))}
          />
          <Range
            title={g("spacing")}
            value={b.gap}
            min={0}
            max={40}
            unit="px"
            onChange={(v) => set({ gap: v }, k("gap"))}
          />
          <Label title={g("shape")}>
            <select
              className={inputCls}
              value={b.ratio}
              onChange={(e) => set({ ratio: e.target.value as BlockOf<"gallery">["ratio"] })}
            >
              {(["16:9", "4:3", "1:1", "2:3"] as const).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="original">{g("original")}</option>
            </select>
          </Label>
          <fieldset className="border-line flex flex-col gap-2.5 border-t pt-3">
            <legend className="mb-1 text-[12px] font-semibold">{g("options")}</legend>
            <Switch title={g("lightbox")} checked={b.lightbox} onChange={(v) => set({ lightbox: v })} />
            <Switch title={g("captions")} checked={b.captions} onChange={(v) => set({ captions: v })} />
            <Switch title={g("credits")} checked={b.credits} onChange={(v) => set({ credits: v })} />
            <Switch title={g("hoverPlay")} checked={b.hoverPlay} onChange={(v) => set({ hoverPlay: v })} />
            <Switch title={g("filter")} checked={b.filter} onChange={(v) => set({ filter: v })} />
          </fieldset>
          <p className="text-muted text-[12px]">{g("samples")}</p>
        </>
      );
      break;
    }
    case "image":
      body = (
        <>
          {mediaField(f("image"), block.mediaId, "image", (id) => set({ mediaId: id }))}
          <Text title={f("caption")} value={block.caption} onChange={(v) => set({ caption: v }, k("c"))} />
          <Switch title={f("fullWidth")} checked={block.fullWidth} onChange={(v) => set({ fullWidth: v })} />
        </>
      );
      break;
    case "video":
      body = (
        <>
          <Label title={f("url")} hint={block.url && !parseVideoLink(block.url) ? f("urlBad") : undefined}>
            <input
              className={inputCls}
              dir="ltr"
              placeholder="https://vimeo.com/…"
              value={block.url}
              onChange={(e) => set({ url: e.target.value }, k("u"))}
            />
          </Label>
          <Text title={f("caption")} value={block.caption} onChange={(v) => set({ caption: v }, k("c"))} />
        </>
      );
      break;
    case "loop":
      body = (
        <>
          {mediaField(f("media"), block.mediaId, "loop", (id) => set({ mediaId: id }))}
          <Text title={f("caption")} value={block.caption} onChange={(v) => set({ caption: v }, k("c"))} />
        </>
      );
      break;
    case "before-after":
      body = (
        <>
          {mediaField(f("before"), block.beforeId, "image", (id) => set({ beforeId: id }))}
          {mediaField(f("after"), block.afterId, "image", (id) => set({ afterId: id }))}
          <Text title={f("beforeLabel")} value={block.beforeLabel} onChange={(v) => set({ beforeLabel: v }, k("bl"))} />
          <Text title={f("afterLabel")} value={block.afterLabel} onChange={(v) => set({ afterLabel: v }, k("al"))} />
        </>
      );
      break;
    case "pdf":
      body = (
        <>
          {mediaField(f("pdf"), block.mediaId, "pdf", (id) => set({ mediaId: id }))}
          <Text title={f("label")} value={block.label} onChange={(v) => set({ label: v }, k("l"))} />
        </>
      );
      break;
    case "reel":
      body = (
        <>
          <Text title={f("title")} value={block.title} onChange={(v) => set({ title: v }, k("t"))} />
          <Label title={f("url")} hint={block.url && !parseVideoLink(block.url) ? f("urlBad") : undefined}>
            <input
              className={inputCls}
              dir="ltr"
              placeholder="https://vimeo.com/…"
              value={block.url}
              onChange={(e) => set({ url: e.target.value }, k("u"))}
            />
          </Label>
          {mediaField(f("orLoop"), block.mediaId, "loop", (id) => set({ mediaId: id }))}
        </>
      );
      break;
    case "credits":
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          {list(
            block.items,
            (c, change) => (
              <>
                <div className="grid grid-cols-[72px_1fr] gap-2">
                  <Text title={f("year")} value={c.year} onChange={(v) => change({ year: v })} />
                  <Text title={f("title")} value={c.title} onChange={(v) => change({ title: v })} />
                </div>
                <Text title={f("role")} value={c.role} onChange={(v) => change({ role: v })} />
                <Text title={f("studio")} value={c.studio} onChange={(v) => change({ studio: v })} />
              </>
            ),
            { year: String(new Date().getFullYear()), title: "", role: "", studio: "" },
            60,
          )}
        </>
      );
      break;
    case "logos":
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          {list(
            block.items,
            (l, change) => (
              <>
                <Text title={f("name")} value={l.name} onChange={(v) => change({ name: v })} />
                <MediaField
                  title={f("logo")}
                  id={l.mediaId}
                  kind="image"
                  media={media}
                  onChange={(id) => change({ mediaId: id })}
                  openPicker={openPicker}
                />
              </>
            ),
            { name: "", mediaId: null },
            40,
          )}
        </>
      );
      break;
    case "about":
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          {mediaField(f("photo"), block.photoId, "image", (id) => set({ photoId: id }))}
          {mediaField(f("cv"), block.cvId, "pdf", (id) => set({ cvId: id }))}
        </>
      );
      break;
    case "contact": {
      const form = contactFormOf(block, contactFallback);
      const words = CONTACT_WORDS[language];
      const setForm = (patch: Partial<ContactFormShape>, key?: string) => set({ form: { ...form, ...patch } }, key);
      const setLabel = (name: keyof ContactFormShape["labels"], v: string) =>
        setForm({ labels: { ...form.labels, [name]: v } }, k(`l-${name}`));
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <Choice
            title={c("layout")}
            value={form.layout}
            options={[
              ["stacked", c("stacked")],
              ["split", c("split")],
            ]}
            onChange={(v) => setForm({ layout: v })}
          />
          <div className="border-line flex flex-col gap-3 border-t pt-4">
            <span className="text-[13px] font-semibold">{c("fields")}</span>
            <Text title={c("nameLabel")} value={form.labels.name} placeholder={words.name} onChange={(v) => setLabel("name", v)} />
            <Text title={c("emailLabel")} value={form.labels.email} placeholder={words.email} onChange={(v) => setLabel("email", v)} />
            <Text
              title={c("messageLabel")}
              value={form.labels.message}
              placeholder={words.message}
              onChange={(v) => setLabel("message", v)}
            />
            <Switch title={words.projectType} checked={form.projectType} onChange={(v) => setForm({ projectType: v })} />
            <Switch title={words.budget} checked={form.budget} onChange={(v) => setForm({ budget: v })} />
            <Switch title={words.deadline} checked={form.deadline} onChange={(v) => setForm({ deadline: v })} />
            <Text
              title={c("custom")}
              value={form.custom}
              placeholder={c("customPlaceholder")}
              onChange={(v) => setForm({ custom: v }, k("custom"))}
            />
          </div>
          <div className="border-line flex flex-col gap-3 border-t pt-4">
            <Text title={f("button")} value={block.button} onChange={(v) => set({ button: v }, k("b"))} />
            <Text title={c("success")} value={form.success} placeholder={words.sent} onChange={(v) => setForm({ success: v }, k("ok"))} />
            <p className="text-muted text-[12px]">{f("contactNote")}</p>
          </div>
        </>
      );
      break;
    }
    case "hire":
      body = (
        <>
          <Text title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <p className="text-muted text-[12px]">{f("hireNote")}</p>
        </>
      );
      break;
    case "social":
      body = (
        <div className="flex flex-col gap-2">
          {block.links.map((l, i) => (
            <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
              <Label title={f("network")}>
                <select
                  className={inputCls}
                  value={l.network}
                  onChange={(e) =>
                    set({ links: block.links.map((x, j) => (j === i ? { ...x, network: e.target.value } : x)) })
                  }
                >
                  {SOCIAL_NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Label>
              <Text
                title={f("link")}
                dir="ltr"
                placeholder="https://"
                value={l.url}
                onChange={(v) =>
                  set({ links: block.links.map((x, j) => (j === i ? { ...x, url: v } : x)) }, k(`l${i}`))
                }
              />
              <Button
                size="sm"
                variant="ghost"
                icon="delete"
                onClick={() => set({ links: block.links.filter((_, j) => j !== i) })}
              >
                {f("removeItem")}
              </Button>
            </div>
          ))}
          {block.links.length < 12 && (
            <Button
              size="sm"
              variant="outline"
              icon="add"
              onClick={() => set({ links: [...block.links, { network: "website", url: "" }] })}
            >
              {f("addItem")}
            </Button>
          )}
        </div>
      );
      break;
    case "quote":
      body = (
        <>
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <Text title={f("author")} value={block.author} onChange={(v) => set({ author: v }, k("a"))} />
        </>
      );
      break;
    case "free": {
      const it = block.items.find((i) => i.id === freeItem) ?? null;
      if (!it) {
        body = (
          <>
            <p className="text-muted text-[12px]">{fr("sectionHint")}</p>
            <Range
              title={fr("height")}
              value={block.rows}
              min={Math.max(2, freeBottom(block.items))}
              max={160}
              onChange={(v) => set<BlockOf<"free">>({ rows: v }, k("rows"))}
            />
            <ColorField
              title={fr("background")}
              value={block.background}
              themeLabel={fr("theme")}
              onChange={(v) => set<BlockOf<"free">>({ background: v }, k("bg"))}
            />
            {mediaField(fr("backgroundImage"), block.bgMediaId, "image", (id) =>
              set<BlockOf<"free">>({ bgMediaId: id }),
            )}
            <p className="text-muted text-[12px]">{fr("phoneHint")}</p>
          </>
        );
        break;
      }
      const setItem = (patch: Partial<FreeItem>, key?: string) =>
        set<BlockOf<"free">>({ items: block.items.map((i) => (i.id === it.id ? { ...i, ...patch } : i)) }, key);
      const ik = (name: string) => `${it.id}-${name}`;
      const textual = it.kind === "text" || it.kind === "heading" || it.kind === "button";
      const pictureLike = it.kind === "image" || it.kind === "button" || it.kind === "shape" || it.kind === "video";
      const linkable = it.kind === "image" || it.kind === "button" || it.kind === "shape";
      body = (
        <>
          <button
            type="button"
            onClick={() => onFreeItem?.(null)}
            className="text-ink-soft hover:text-ink self-start text-[12px] font-semibold"
          >
            {fr("backToSection")}
          </button>
          <div className="text-[14px] font-semibold">{fr(`kinds.${it.kind}`)}</div>
          {textual &&
            (it.kind === "button" ? (
              <Text title={fr("label")} value={it.text} onChange={(v) => setItem({ text: v }, ik("t"))} />
            ) : (
              <Area title={fr("text")} value={it.text} onChange={(v) => setItem({ text: v }, ik("t"))} />
            ))}
          {textual && (
            <Range
              title={fr("size")}
              value={it.size}
              min={8}
              max={160}
              unit="px"
              onChange={(v) => setItem({ size: v }, ik("size"))}
            />
          )}
          {textual && (
            <Choice
              title={f("align")}
              value={it.align}
              options={[
                ["start", f("alignStart")],
                ["center", f("alignCenter")],
                ["end", fr("alignEnd")],
              ]}
              onChange={(v) => setItem({ align: v })}
            />
          )}
          {textual && (
            <ColorField
              title={fr("textColor")}
              value={it.color}
              themeLabel={fr("theme")}
              onChange={(v) => setItem({ color: v }, ik("color"))}
            />
          )}
          {it.kind === "image" && mediaField(f("image"), it.mediaId, "image", (id) => setItem({ mediaId: id }))}
          {it.kind === "image" && (
            <Choice
              title={fr("fit")}
              value={it.fit}
              options={[
                ["cover", fr("fill")],
                ["contain", fr("fitWhole")],
              ]}
              onChange={(v) => setItem({ fit: v })}
            />
          )}
          {it.kind === "shape" && (
            <Choice
              title={fr("shape")}
              value={it.shape}
              options={[
                ["rect", fr("rect")],
                ["circle", fr("circle")],
              ]}
              onChange={(v) => setItem({ shape: v })}
            />
          )}
          {(it.kind === "button" || it.kind === "shape" || it.kind === "line") && (
            <ColorField
              title={fr("color")}
              value={it.fill}
              themeLabel={fr("theme")}
              onChange={(v) => setItem({ fill: v }, ik("fill"))}
            />
          )}
          {it.kind === "line" && (
            <Range
              title={fr("thickness")}
              value={it.size}
              min={8}
              max={160}
              onChange={(v) => setItem({ size: v }, ik("size"))}
            />
          )}
          {pictureLike && (
            <Range
              title={fr("corners")}
              value={Math.min(it.radius, 200)}
              min={0}
              max={200}
              unit="px"
              onChange={(v) => setItem({ radius: v }, ik("radius"))}
            />
          )}
          {linkable && (
            <Text
              title={fr("link")}
              dir="ltr"
              placeholder={fr("linkPlaceholder")}
              value={it.link}
              onChange={(v) => setItem({ link: v }, ik("link"))}
            />
          )}
          {it.kind === "video" && (
            <Text
              title={fr("videoLink")}
              dir="ltr"
              placeholder="https://youtu.be/"
              value={it.url}
              onChange={(v) => setItem({ url: v }, ik("url"))}
            />
          )}
          <Range
            title={fr("rotate")}
            value={it.rotate}
            min={-180}
            max={180}
            unit="°"
            onChange={(v) => setItem({ rotate: v }, ik("rot"))}
          />
          <Range
            title={fr("opacity")}
            value={it.opacity}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => setItem({ opacity: v }, ik("op"))}
          />
          <Switch title={fr("hideOnPhone")} checked={it.hideOnPhone} onChange={(v) => setItem({ hideOnPhone: v })} />
          <p className="text-muted text-[12px]">{fr("itemHint")}</p>
        </>
      );
      break;
    }
  }

  const kind = kindOf(block);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="bg-lime flex rounded-sm p-1">
          <Icon name={kind.icon} size={20} />
        </span>
        <div className="font-heading font-heading-weight text-[18px]">
          {block.type === "gallery" ? g("title") : t(`blocks.${kind.key}`)}
        </div>
      </div>
      {body}
    </div>
  );
}

/* ---------- Projects panel (rail) ---------- */

export function ProjectsPanel({
  projects,
  media,
  onOpen,
}: {
  projects: Array<{ id: string; title: string; coverId: string | null }>;
  media: Record<string, SiteMedia>;
  /** Opens a project in the editor's wide panel. */
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("editor.projectsPanel");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-muted text-[11px] font-semibold tracking-[0.1em] uppercase">{t("title")}</h2>
      <form
        className="bg-mist flex flex-col gap-2.5 rounded-[12px] p-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await newProject(title);
          setBusy(false);
          if (r.ok) {
            setTitle("");
            onOpen(r.id);
          }
        }}
      >
        <span className="font-heading font-heading-weight text-[20px] leading-tight">{t("create")}</span>
        <span className="text-muted text-[12px]">{t("createHint")}</span>
        <Text title={t("projectTitle")} value={title} onChange={setTitle} />
        <Button type="submit" variant="lime" size="sm" disabled={busy} className="self-start">
          {busy ? t("creating") : t("createButton")}
        </Button>
      </form>
      {projects.length === 0 && <p className="text-muted text-[13px]">{t("empty")}</p>}
      <ul className="flex flex-col gap-1.5">
        {projects.map((p) => (
          <li key={p.id}>
            <a
              href={`/projects/${p.id}`}
              onClick={(e) => {
                e.preventDefault();
                onOpen(p.id);
              }}
              className="hover:bg-mist flex items-center gap-3 rounded-[10px] p-1.5"
            >
              <Thumb m={p.coverId ? media[p.coverId] : undefined} className="h-10 w-14 flex-none rounded-[8px]" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.title}</span>
              <Icon name="site-editor" size={16} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
