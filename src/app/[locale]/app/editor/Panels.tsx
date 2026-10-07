"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SiteMedia } from "@/components/site/SiteRender";
import { arabicFonts, bodyFonts, headingFonts } from "@/components/site/fonts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlays";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { imageSources } from "@/lib/media";
import { blockGroups, blockKinds, kindOf, newId, SOCIAL_NETWORKS, type BlockKind } from "@/lib/site/blocks";
import { presetIds, themes } from "@/lib/site/starter";
import type { Block, BlockOf, NavLayout, PageDraft, PageType, SiteDraft, Theme } from "@/lib/site/types";
import { parseVideoLink } from "@/lib/video";
import { beginUpload, completeUpload } from "../(dash)/projects/actions";

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

/* ---------- Blocks tab ---------- */

export function BlocksTab({ onAdd }: { onAdd: (k: BlockKind) => void }) {
  const t = useTranslations("editor");
  const [q, setQ] = useState("");
  const match = (k: BlockKind) => !q || t(`blocks.${k.key}`).toLowerCase().includes(q.toLowerCase());
  return (
    <div className="flex flex-col gap-[18px] px-3 pt-3.5 pb-6" data-tip="blocks">
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
      <p className="text-muted -mt-2 text-[12px]">{t("addHint")}</p>
      {blockGroups.map((g) => {
        const items = blockKinds.filter((k) => k.group === g && match(k));
        if (!items.length) return null;
        return (
          <div key={g} className="flex flex-col gap-2">
            <div className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">{t(`groups.${g}`)}</div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  draggable
                  onDragStart={(e: DragEvent) => {
                    e.dataTransfer.setData("application/x-fannan-block", k.key);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onAdd(k)}
                  className="border-line bg-paper hover:bg-mist flex min-h-[52px] cursor-grab items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-start"
                  data-testid={`add-${k.key}`}
                >
                  <Icon name={k.icon} size={24} />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-[12px] leading-tight font-semibold">
                    {t(`blocks.${k.key}`)}
                    {k.fannan && <Badge variant="brand">{t("fannanTag")}</Badge>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Style tab ---------- */

export function StyleTab({
  draft,
  media,
  setDraft,
  openPicker,
}: {
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  setDraft: (fn: (d: SiteDraft) => SiteDraft, key?: string) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
}) {
  const t = useTranslations("editor.style");
  const th = draft.theme;
  const setTheme = (patch: Partial<Theme>, key?: string) =>
    setDraft((d) => ({ ...d, theme: { ...d.theme, ...patch } }), key);
  return (
    <div className="flex flex-col gap-5 px-3.5 pt-4 pb-6">
      <Text
        title={t("siteTitle")}
        value={draft.title}
        onChange={(v) => setDraft((d) => ({ ...d, title: v }), "title")}
      />
      <Text
        title={t("tagline")}
        value={draft.tagline}
        onChange={(v) => setDraft((d) => ({ ...d, tagline: v }), "tagline")}
      />
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
                  on ? "border-ink border-2" : "border-line border",
                )}
              >
                <span
                  className="block h-[30px] rounded-[6px] border border-[#EFEFEC]"
                  style={{ background: `linear-gradient(90deg, ${p.colors.background} 0 70%, ${p.colors.accent} 70%)` }}
                />
                <span className="text-[11px] font-semibold">{t(`presetNames.${id}`)}</span>
              </button>
            );
          })}
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
      <Label title={t("arabicFont")}>
        <select
          className={inputCls}
          value={th.fonts.arabic}
          onChange={(e) => setTheme({ fonts: { ...th.fonts, arabic: e.target.value as Theme["fonts"]["arabic"] } })}
        >
          {Object.entries(arabicFonts).map(([id, f]) => (
            <option key={id} value={id}>
              {f.label}
            </option>
          ))}
        </select>
      </Label>
      <div className="flex flex-col gap-2">
        <div className="text-[12px] font-semibold">{t("colours")}</div>
        <div className="grid grid-cols-3 gap-2">
          {(["background", "text", "accent"] as const).map((c) => (
            <label key={c} className="text-muted flex flex-col gap-1 text-[11px]">
              <input
                type="color"
                value={th.colors[c]}
                onChange={(e) =>
                  setTheme({ colors: { ...th.colors, [c]: e.target.value.toUpperCase() } }, `color-${c}`)
                }
                className="border-line h-9 w-full cursor-pointer rounded-[8px] border p-0.5"
              />
              {t(c)}
            </label>
          ))}
        </div>
      </div>
      <Range
        title={t("radius")}
        value={th.radius}
        min={0}
        max={24}
        unit="px"
        onChange={(v) => setTheme({ radius: v }, "radius")}
      />
      <div className="flex flex-col gap-2">
        <div className="text-[12px] font-semibold">{t("nav")}</div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("nav")}>
          {(["top", "centered", "sidebar", "split", "minimal"] as NavLayout[]).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={th.nav === n}
              onClick={() => setTheme({ nav: n })}
              className={cx(
                "bg-paper rounded-[10px] px-2 py-2 text-[11px] font-semibold",
                th.nav === n ? "border-ink border-2" : "border-line border",
              )}
            >
              {t(`navNames.${n}`)}
            </button>
          ))}
        </div>
      </div>
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
}: {
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
  const move = (by: number) =>
    setDraft((d) => {
      const pages = [...d.pages];
      const j = index + by;
      if (j < 0 || j >= pages.length) return d;
      [pages[index], pages[j]] = [pages[j], pages[index]];
      return { ...d, pages };
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
      <ul className="flex flex-col gap-1">
        {draft.pages.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setPageId(p.id)}
              aria-current={p.id === page.id}
              className={cx(
                "flex h-[42px] w-full items-center justify-between rounded-[10px] px-2.5 text-start",
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
      </ul>

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
          <Button size="sm" variant="outline" icon="undo" disabled={index <= 0} onClick={() => move(-1)}>
            {t("up")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon="redo"
            disabled={index >= draft.pages.length - 1}
            onClick={() => move(1)}
          >
            {t("down")}
          </Button>
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

      <div className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">{t("add")}</div>
      <div className="grid grid-cols-2 gap-2">
        {(["gallery", "custom", "about", "link"] as PageType[]).map((type) => (
          <Button key={type} size="sm" variant="outline" onClick={() => add(type)}>
            {t(`types.${type}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Block settings (right panel) ---------- */

export function BlockSettings({
  block,
  media,
  categories,
  update,
  openPicker,
}: {
  block: Block;
  media: Record<string, SiteMedia>;
  categories: Record<string, string>;
  update: (patch: Partial<Block>, key?: string) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
}) {
  const t = useTranslations("editor");
  const f = useTranslations("editor.fields");
  const g = useTranslations("editor.gallery");
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
              value={block.tone}
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
    case "contact":
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <Text title={f("button")} value={block.button} onChange={(v) => set({ button: v }, k("b"))} />
          <p className="text-muted text-[12px]">{f("contactNote")}</p>
        </>
      );
      break;
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
