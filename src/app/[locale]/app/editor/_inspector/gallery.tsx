"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { type SiteMedia } from "@/components/site/SiteRender";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { imageSources } from "@/lib/media";
import { newId } from "@/lib/site/blocks";
import { sampleTone, toneFill } from "@/lib/site/samples";
import type { BlockOf } from "@/lib/site/types";
import { Choice, Range, Switch, Text, inputCls } from "../_ui/controls";
import { type MediaKind } from "../_ui/media";

/* ---------- round 13: project grid layouts as pictures ---------- */

export const GALLERY_LOOKS = [
  { id: "square", layout: "grid", ratio: "1:1" },
  { id: "rectangle", layout: "grid", ratio: "2:3" },
  { id: "alternate", layout: "alternate" },
  { id: "masonry", layout: "masonry", ratio: "original" },
  { id: "featured", layout: "featured", ratio: "4:3", pro: true },
  { id: "rows", layout: "rows" },
  { id: "slider", layout: "slider" },
  { id: "fullscreen", layout: "fullscreen" },
] as const;

export function GalleryLayoutPicker({
  b,
  set,
  isPro,
}: {
  b: BlockOf<"gallery">;
  set: (patch: Partial<BlockOf<"gallery">>) => void;
  isPro?: boolean;
}) {
  const g = useTranslations("editor.gallery");
  const current =
    GALLERY_LOOKS.find((l) => l.layout === b.layout && (!("ratio" in l) || l.layout !== "grid" || l.ratio === b.ratio))
      ?.id ?? (b.layout === "grid" ? null : b.layout);
  const R = (x: number, y: number, w: number, h: number, k: number) => (
    <rect key={k} x={x} y={y} width={w} height={h} rx={1.5} fill="currentColor" />
  );
  const glyph: Record<(typeof GALLERY_LOOKS)[number]["id"], React.ReactNode> = {
    square: [
      R(1, 2, 8, 8, 1),
      R(11, 2, 8, 8, 2),
      R(21, 2, 8, 8, 3),
      R(1, 12, 8, 6, 4),
      R(11, 12, 8, 6, 5),
      R(21, 12, 8, 6, 6),
    ],
    rectangle: [
      R(2, 1, 7, 11, 1),
      R(11.5, 1, 7, 11, 2),
      R(21, 1, 7, 11, 3),
      R(2, 14, 7, 5, 4),
      R(11.5, 14, 7, 5, 5),
      R(21, 14, 7, 5, 6),
    ],
    alternate: [
      R(1, 1, 8, 11, 1),
      R(11, 1, 8, 6, 2),
      R(21, 1, 8, 11, 3),
      R(1, 14, 8, 5, 4),
      R(11, 9, 8, 10, 5),
      R(21, 14, 8, 5, 6),
    ],
    masonry: [
      R(1, 1, 8, 7, 1),
      R(11, 1, 8, 10, 2),
      R(21, 1, 8, 5, 3),
      R(1, 10, 8, 9, 4),
      R(11, 13, 8, 6, 5),
      R(21, 8, 8, 11, 6),
    ],
    featured: [R(1, 1, 18, 18, 1), R(21, 1, 8, 8, 2), R(21, 11, 8, 8, 3)],
    rows: [R(1, 1, 12, 8, 1), R(15, 1, 6, 8, 2), R(23, 1, 6, 8, 3), R(1, 11, 7, 8, 4), R(10, 11, 19, 8, 5)],
    slider: [R(4, 3, 10, 14, 1), R(16, 3, 10, 14, 2), R(0, 3, 2, 14, 3), R(28, 3, 2, 14, 4)],
    fullscreen: [R(0, 0, 15, 10, 1), R(15, 0, 15, 10, 2), R(0, 10, 15, 10, 3), R(15, 10, 15, 10, 4)],
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold">{g("layout")}</span>
      <div role="radiogroup" aria-label={g("layout")} className="grid grid-cols-4 gap-1.5">
        {GALLERY_LOOKS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={current === l.id}
            onClick={() => set({ layout: l.layout, ...("ratio" in l ? { ratio: l.ratio } : {}) })}
            className={cx(
              "relative flex flex-col items-center gap-1 rounded-[10px] border p-1.5 text-[11px] font-semibold",
              current === l.id ? "border-ink bg-mist" : "border-line hover:bg-mist",
            )}
            data-testid={`gallery-look-${l.id}`}
          >
            <svg viewBox="0 0 30 20" className="h-5 w-8" aria-hidden>
              {glyph[l.id]}
            </svg>
            {g(`looks.${l.id}`)}
            {"pro" in l && !isPro && (
              <span className="bg-lime text-on-lime absolute end-1 -top-1.5 rounded-[6px] px-1 text-[9px] leading-[14px]">
                PRO
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- round 13: the Images section's settings ---------- */

export function ImagesSettings({
  block,
  set,
  k,
  media,
  openPicker,
}: {
  block: BlockOf<"images">;
  set: (patch: Partial<BlockOf<"images">>, key?: string) => void;
  k: (s: string) => string;
  media: Record<string, SiteMedia>;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
}) {
  const t = useTranslations("editor.images");
  const items = block.items;
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    set({ items: next });
  };
  const thumb = (id: string | null, tone: string) => {
    const m = id ? media[id] : null;
    const src = m ? imageSources(m, 400, "/api/media/")?.src : null;
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-12 flex-none rounded-[8px] object-cover" />
    ) : (
      <span className="size-12 flex-none rounded-[8px]" style={{ background: toneFill(tone) }} />
    );
  };
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold">{t("layout")}</span>
        <div role="radiogroup" aria-label={t("layout")} className="grid grid-cols-4 gap-1.5">
          {(["grid", "masonry", "rows", "slideshow"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={block.layout === l}
              onClick={() =>
                set({
                  layout: l,
                  ...(l === "masonry" || l === "rows"
                    ? { ratio: "original" as const }
                    : block.ratio === "original"
                      ? { ratio: "4:3" as const }
                      : {}),
                })
              }
              className={cx(
                "flex flex-col items-center gap-1 rounded-[10px] border p-1.5 text-[11px] font-semibold",
                block.layout === l ? "border-ink bg-mist" : "border-line hover:bg-mist",
              )}
              data-testid={`images-layout-${l}`}
            >
              <LayoutGlyph layout={l} />
              {t(`layouts.${l}`)}
            </button>
          ))}
        </div>
      </div>
      {block.layout !== "slideshow" && (
        <Range title={t("columns")} value={block.columns} min={1} max={6} onChange={(v) => set({ columns: v })} />
      )}
      <Range
        title={t("gap")}
        value={block.gap}
        min={0}
        max={64}
        unit="px"
        onChange={(v) => set({ gap: v }, k("gap"))}
      />
      {block.layout !== "rows" && (
        <Choice
          title={t("ratio")}
          value={block.ratio}
          options={[
            ["original", "↕"],
            ["1:1", "1:1"],
            ["4:3", "4:3"],
            ["4:5", "4:5"],
            ["3:4", "3:4"],
            ["2:3", "2:3"],
            ["16:9", "16:9"],
          ]}
          onChange={(v) => set({ ratio: v })}
        />
      )}
      <Switch title={t("captions")} checked={block.captions} onChange={(v) => set({ captions: v })} />
      <Switch
        title={t("smallHeading")}
        checked={block.headingSize === "s"}
        onChange={(v) => set({ headingSize: v ? "s" : undefined })}
      />
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span>{t("frame")}</span>
        <span className="flex items-center gap-2">
          <Toggle
            label={t("frame")}
            hideLabel
            checked={!!block.frame}
            onChange={(v) => set({ frame: v ? "#E0261B" : null })}
          />
          {block.frame && (
            <input
              type="color"
              aria-label={t("frame")}
              value={block.frame}
              onChange={(e) => set({ frame: e.target.value.toUpperCase() }, k("frame"))}
              className="border-line h-8 w-10 rounded-[8px] border p-0.5"
            />
          )}
        </span>
      </div>
      <Text title={t("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
      <div className="border-line flex flex-col gap-2 border-t pt-3" data-testid="images-manage">
        <span className="text-[13px] font-semibold">
          {t("manage")}{" "}
          <span className="text-muted font-normal">· {t("count", { n: items.filter((i) => i.mediaId).length })}</span>
        </span>
        <p className="text-muted text-[12px]">{t("drop")}</p>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((it, i) => (
            <li
              key={it.id}
              className="border-line flex items-center gap-2 rounded-[10px] border p-1.5"
              data-testid="images-row"
            >
              <button
                type="button"
                className="flex-none"
                aria-label={t("add")}
                onClick={() =>
                  openPicker("image", (id) =>
                    set({ items: items.map((x, j) => (j === i ? { ...x, mediaId: id, crop: undefined } : x)) }),
                  )
                }
              >
                {thumb(it.mediaId, it.tone)}
              </button>
              <input
                className={cx(inputCls, "h-8 min-w-0 flex-1 text-[12px]")}
                placeholder={t("caption")}
                aria-label={t("caption")}
                value={it.caption}
                onChange={(e) =>
                  set({ items: items.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) }, k(`cap-${i}`))
                }
              />
              <span className="flex flex-none flex-col">
                <button
                  type="button"
                  className="text-muted hover:text-ink px-1 text-[11px]"
                  aria-label={t("up")}
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="text-muted hover:text-ink px-1 text-[11px]"
                  aria-label={t("down")}
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                >
                  ▼
                </button>
              </span>
              <button
                type="button"
                className="text-muted hover:text-ink flex size-8 flex-none items-center justify-center rounded-full"
                aria-label={t("remove")}
                title={t("remove")}
                onClick={() => set({ items: items.filter((_, j) => j !== i) })}
              >
                <Icon name="delete" size={16} />
              </button>
            </li>
          ))}
        </ul>
        {items.length < 60 && (
          <Button
            size="sm"
            variant="outline"
            icon="add"
            onClick={() =>
              openPicker("image", (id) =>
                set({ items: [...items, { id: newId(), mediaId: id, tone: sampleTone(items.length), caption: "" }] }),
              )
            }
          >
            {t("add")}
          </Button>
        )}
      </div>
    </>
  );
}

export function LayoutGlyph({ layout }: { layout: "grid" | "masonry" | "rows" | "slideshow" }) {
  const R = (x: number, y: number, w: number, h: number) => (
    <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={1.5} fill="currentColor" />
  );
  const shapes = {
    grid: [R(1, 1, 8, 8), R(11, 1, 8, 8), R(21, 1, 8, 8), R(1, 11, 8, 8), R(11, 11, 8, 8), R(21, 11, 8, 8)],
    masonry: [R(1, 1, 8, 11), R(11, 1, 8, 7), R(21, 1, 8, 9), R(1, 14, 8, 5), R(11, 10, 8, 9), R(21, 12, 8, 7)],
    rows: [R(1, 1, 12, 8), R(15, 1, 6, 8), R(23, 1, 6, 8), R(1, 11, 7, 8), R(10, 11, 19, 8)],
    slideshow: [R(4, 2, 22, 16), R(0, 5, 2, 10), R(28, 5, 2, 10)],
  };
  return (
    <svg viewBox="0 0 30 20" className="h-5 w-8" aria-hidden>
      {shapes[layout]}
    </svg>
  );
}

export function SectionTabs({ content, design }: { content: ReactNode; design: ReactNode }) {
  const fr = useTranslations("editor.free");
  const [tab, setTab] = useState<"content" | "design">("content");
  return (
    <>
      <div role="tablist" className="border-line -mt-1 grid grid-cols-2 border-b">
        {(["content", "design"] as const).map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={cx(
              "h-9 border-b-2 text-[13px]",
              tab === x ? "border-primary text-ink font-semibold" : "text-muted border-transparent font-medium",
            )}
          >
            {fr(`tabs.${x}`)}
          </button>
        ))}
      </div>
      {tab === "content" ? content : design}
    </>
  );
}
