"use client";

import { useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { Icon } from "@/components/ui/Icon";
import { kindByKey, LIBRARY, type BlockKind, type LibraryGroup } from "@/lib/site/blocks";
import type { Block, SiteDraft } from "@/lib/site/types";

/* ---------- Blocks tab: a list of real previews, dragged onto the page (Carbonmade-style) ---------- */

/** About how tall a block is on a 1200px page, so its preview isn't cropped or empty. */
export function previewHeight(b: Block): number {
  switch (b.type) {
    case "free":
      return Math.round(b.rows * 47 + 40 + (b.style ? b.style.padTop + b.style.padBottom : 0));
    case "cards":
      return b.variant === "nav"
        ? 160
        : b.variant === "marquee" || b.variant === "stats"
          ? 320
          : b.variant === "timeline"
            ? 1100
            : 640;
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
    case "spread":
      return 760;
    case "brand":
      return 640;
    default:
      return 560;
  }
}

/** The same ids every time for a sample: `<kind>-0`, `<kind>-1`… in the order they appear. */
function stableIds<T>(value: T, key: string, n = { i: 0 }): T {
  if (Array.isArray(value)) return value.map((x) => stableIds(x, key, n)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(value as Record<string, unknown>))
      out[k] = k === "id" && typeof x === "string" ? `${key}-${n.i++}` : stableIds(x, key, n);
    return out as T;
  }
  return value;
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
  // One sample of the block in the artist's own theme, made once. Its ids are fixed per kind, so the
  // server and the browser draw the same preview (random ids made React throw the first render away).
  const [sample] = useState(() => stableIds(kind.make(draft.language), kind.key));
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
  adding = false,
  onCancelAdding,
}: {
  /** The small picker under "Add section" on the canvas: two columns, click to add. */
  compact?: boolean;
  onAdd: (k: BlockKind) => void;
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  projects: GalleryProject[];
  /** "Add section" was pressed on the page: the new section goes where the line shows. */
  adding?: boolean;
  onCancelAdding?: () => void;
}) {
  const t = useTranslations("editor");
  const [q, setQ] = useState("");
  // Round 18: kinds of sections as rows first; one kind opens its sections, one readable picture a row.
  const [open, setOpen] = useState<LibraryGroup | null>(null);
  const match = (k: BlockKind) => !q || t(`blocks.${k.key}`).toLowerCase().includes(q.toLowerCase());
  const kinds = (keys: string[]) => keys.map(kindByKey).filter((k): k is BlockKind => !!k && match(k));
  const blank = kindByKey("free-blank");

  const tile = (k: BlockKind) => (
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
      className="group border-line relative flex w-full min-w-0 cursor-grab flex-col overflow-hidden rounded-[12px] border bg-[#141414] text-start transition-colors hover:border-[#C6C8BA] active:cursor-grabbing"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}
    >
      <BlockPreview kind={k} draft={draft} media={media} projects={projects} />
      <span className="text-ink block truncate px-3 py-2 text-[12px] font-semibold">{t(`blocks.${k.key}`)}</span>
      {k.pro && (
        <span className="bg-lime text-on-lime rounded-pill absolute end-2 top-2 px-1.5 text-[9px] leading-[16px] font-bold tracking-[0.06em]">
          PRO
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 px-3 pt-3 pb-6" data-tip={compact ? undefined : "blocks"}>
      {adding && (
        <div className="bg-lime text-on-lime flex items-center justify-between gap-2 rounded-[12px] py-1.5 ps-3 pe-1.5 text-[12px] font-semibold">
          {t("section.insertHere")}
          <button
            type="button"
            aria-label={t("section.close")}
            onClick={onCancelAdding}
            className="flex size-7 items-center justify-center rounded-full hover:bg-black/10"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {open && !q ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="hover:bg-mist rounded-pill -ms-1 flex h-9 w-fit items-center gap-1.5 ps-1.5 pe-3 text-[13px] font-semibold"
            data-testid="library-back"
          >
            <Icon name="arrow-left" size={18} />
            {t("library.back")}
          </button>
          <h3 className="px-1 text-[15px] font-semibold">{t(`library.${open}`)}</h3>
          <section className="flex flex-col gap-3" aria-label={t(`library.${open}`)}>
            {kinds(LIBRARY.find((g) => g.group === open)?.keys ?? []).map(tile)}
          </section>
        </>
      ) : (
        <>
          <label className="border-line text-muted flex h-10 items-center gap-2 rounded-[12px] border px-3">
            <Icon name="search" size={18} />
            <input
              className="text-ink min-w-0 flex-1 bg-transparent outline-none focus-visible:shadow-none"
              placeholder={t("searchBlocks")}
              aria-label={t("searchBlocks")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {q ? (
            <section className="flex flex-col gap-3" aria-label={t("searchBlocks")}>
              {LIBRARY.flatMap(({ keys }) => kinds(keys)).map(tile)}
            </section>
          ) : (
            <>
              <div className="flex flex-col gap-0.5" role="list" aria-label={t("library.label")}>
                {LIBRARY.filter(({ group }) => group !== "blank").map(({ group, keys }) => {
                  const first = kindByKey(keys[0]);
                  return (
                    <button
                      key={group}
                      type="button"
                      role="listitem"
                      onClick={() => setOpen(group)}
                      data-testid={`library-cat-${group}`}
                      data-library-keys={keys.join(" ")}
                      className="hover:bg-mist flex h-[52px] items-center gap-3 rounded-[12px] px-2 text-start"
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none h-9 w-[52px] flex-none overflow-hidden rounded-[6px] bg-[#141414]"
                      >
                        {first && <BlockPreview kind={first} draft={draft} media={media} projects={projects} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{t(`library.${group}`)}</span>
                      <span className="text-muted text-[12px] tabular-nums">{keys.length}</span>
                      <Icon name="chevron-down" size={16} className="text-muted -rotate-90 rtl:rotate-90" />
                    </button>
                  );
                })}
              </div>
              {blank && (
                <button
                  type="button"
                  onClick={() => onAdd(blank)}
                  data-testid="add-free-blank"
                  data-block-key="free-blank"
                  className="border-line hover:bg-mist rounded-pill flex h-10 items-center justify-center gap-1.5 border text-[13px] font-semibold"
                >
                  <Icon name="add" size={16} />
                  {t("library.blankSection")}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Little drawings of each navigation layout, so the choice is visual. */
