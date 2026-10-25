"use client";

import { useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { kindByKey, LIBRARY, type BlockKind, type LibraryGroup } from "@/lib/site/blocks";
import type { Block, SiteDraft } from "@/lib/site/types";

/* ---------- Blocks tab: a list of real previews, dragged onto the page (Carbonmade-style) ---------- */

/** About how tall a block is on a 1200px page, so its preview isn't cropped or empty. */
export function previewHeight(b: Block): number {
  switch (b.type) {
    case "free":
      return Math.round(b.rows * 47 + 40 + (b.style ? b.style.padTop + b.style.padBottom : 0));
    case "cards":
      return b.variant === "nav" ? 160 : b.variant === "marquee" || b.variant === "stats" ? 320 : b.variant === "timeline" ? 1100 : 640;
    case "gallery":
      return b.layout === "slider" ? 520 : 720;
    case "credits":
    case "contact":
      return 560;
    case "hire":
    case "social":
    case "quote":
      return 300;
    case "header":
      return 160;
    default:
      return 560;
  }
}

export function BlockPreview({
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
  compact = false,
}: {
  /** The small picker under "Add section" on the canvas: two columns, click to add. */
  compact?: boolean;
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
      "h-7 flex-none rounded-pill px-2.5 text-[12px] font-semibold transition-colors",
      on ? "bg-lime text-on-lime" : "bg-mist text-ink-soft hover:text-ink",
    );
  return (
    <div className="flex flex-col gap-4 px-3 pt-3 pb-6" data-tip={compact ? undefined : "blocks"}>
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
      {/* Categories (round 17: wrapped, so none runs off the edge). One tap shows just that kind of section. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("library.label")}>
        <button type="button" aria-pressed={only === "all"} className={chip(only === "all")} onClick={() => setOnly("all")}>
          {t("library.all")}
        </button>
        {LIBRARY.map(({ group }) => (
          <button key={group} type="button" aria-pressed={only === group} className={chip(only === group)} onClick={() => setOnly(group)}>
            {t(`library.${group}`)}
          </button>
        ))}
      </div>
      {LIBRARY.filter(({ group }) => only === "all" || only === group).map(({ group, keys }) => {
        const items = keys.map(kindByKey).filter((k): k is BlockKind => !!k && match(k));
        if (!items.length) return null;
        return (
          // Round 17: two small thumbnails a row (like Carbonmade), the name in one short line under each.
          <section key={group} className="grid grid-cols-2 gap-2" aria-label={t(`library.${group}`)}>
            <h3 className={cx("bg-paper text-muted col-span-2 -mx-3 px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase", !compact && "sticky top-0 z-10")}>
              {t(`library.${group}`)}
            </h3>
            {items.map((k) => (
              <button
                key={k.key}
                type="button"
                draggable={!compact}
                data-block-key={k.key}
                data-testid={compact ? `pick-${k.key}` : `add-${k.key}`}
                aria-label={`${t(`blocks.${k.key}`)}${k.pro ? " (Pro)" : ""}`}
                onDragStart={(e: DragEvent) => {
                  e.dataTransfer.setData("application/x-fannan-block", k.key);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAdd(k)}
                // In the picker on the canvas, pressing doesn't scroll the button away before the click lands.
                onMouseDown={compact ? (e) => e.preventDefault() : undefined}
                title={compact ? undefined : t("dragHint")}
                className="group border-line hover:border-lime relative flex w-full min-w-0 cursor-grab flex-col overflow-hidden rounded-[10px] border bg-[#141414] text-start transition-colors active:cursor-grabbing"
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 110px" }}
              >
                <BlockPreview kind={k} draft={draft} media={media} projects={projects} />
                <span className="text-ink block truncate px-2 py-1.5 text-[11px] font-semibold">{t(`blocks.${k.key}`)}</span>
                {k.pro && (
                  <span className="bg-lime text-on-lime absolute end-1.5 top-1.5 rounded-pill px-1.5 text-[9px] leading-[16px] font-bold tracking-[0.06em]">
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
