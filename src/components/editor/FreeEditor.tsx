"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { FreeItemContent, freeItemStyle, freeOrder, type SiteMedia } from "@/components/site/SiteRender";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { FREE_COLS, FREE_KINDS, freeBottom } from "@/lib/site/free";
import type { BlockOf, FreeItem, FreeKind, FreePlace } from "@/lib/site/types";
import { InlineText } from "./InlineText";

// A free-form section on the editor canvas (Squarespace-style): click an item to select it, drag it
// anywhere on the grid, resize from 8 handles, turn it from the round handle, layer it, and
// double-click text to type. Places snap to the grid's square cells and are stored from the
// reading start, so Arabic pages mirror naturally.

type Free = BlockOf<"free">;
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface FreeEditorProps {
  b: Free;
  media: Record<string, SiteMedia>;
  /** Is this section the one selected on the canvas? */
  active: boolean;
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  /** One change to the section. `key` merges a run of changes into one undo step. */
  onChange: (fn: (b: Free) => Free, key?: string) => void;
  onAdd: (kind: FreeKind) => void;
  typeHere: string;
}

export const KIND_ICONS: Record<FreeKind, IconName> = {
  text: "text",
  heading: "hero-headline",
  image: "image",
  button: "button",
  shape: "shape",
  line: "line",
  video: "video-4k",
};

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** The browser sends a click when a drag ends; it must not deselect what was just moved. */
function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}

/** No text selection on the page while something is being dragged. */
function noSelect(on: boolean) {
  if (on) document.body.style.setProperty("user-select", "none");
  else document.body.style.removeProperty("user-select");
}

function handleStyle(h: Handle): CSSProperties {
  const s: CSSProperties = { position: "absolute", width: 12, height: 12 };
  if (h.includes("n")) s.top = -7;
  if (h.includes("s")) s.bottom = -7;
  if (!h.includes("n") && !h.includes("s")) s.top = "calc(50% - 6px)";
  if (h.includes("w")) s.insetInlineStart = -7;
  if (h.includes("e")) s.insetInlineEnd = -7;
  if (!h.includes("w") && !h.includes("e")) s.insetInlineStart = "calc(50% - 6px)";
  const ew = h === "e" || h === "w";
  const ns = h === "n" || h === "s";
  s.cursor = ew ? "ew-resize" : ns ? "ns-resize" : h === "ne" || h === "sw" ? "nesw-resize" : "nwse-resize";
  return s;
}

export function FreeEditor({
  b,
  media,
  active,
  selectedItem,
  onSelectItem,
  onChange,
  onAdd,
  typeHere,
}: FreeEditorProps) {
  const t = useTranslations("editor.free");
  const grid = useRef<HTMLDivElement>(null);
  // While a pointer is moving something, its place is kept here and saved once on release.
  const [live, setLive] = useState<{ id: string; place: FreePlace; rotate: number } | null>(null);
  const [liveRows, setLiveRows] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const order = freeOrder(b.items);
  const rows = liveRows ?? Math.max(b.rows, live ? live.place.y + live.place.h : 0);

  const stacked = () => grid.current && getComputedStyle(grid.current).display === "flex";
  const cell = () => (grid.current?.getBoundingClientRect().width ?? FREE_COLS) / FREE_COLS;
  const update = (id: string, patch: Partial<FreeItem>, key?: string) =>
    onChange((s) => {
      const items = s.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
      return { ...s, items, rows: Math.max(s.rows, freeBottom(items)) };
    }, key);

  /** Pointer drags: moving, resizing, turning. */
  function track(
    e: React.PointerEvent,
    it: FreeItem,
    step: (dx: number, dy: number, ev: PointerEvent) => { place?: FreePlace; rotate?: number },
  ) {
    if (e.button !== 0 || stacked()) return;
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const c = cell();
    let last = { place: it.place, rotate: it.rotate };
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - x0) / c) * (rtl ? -1 : 1);
      const dy = (ev.clientY - y0) / c;
      if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return;
      moved = true;
      const r = step(dx, dy, ev);
      last = { place: r.place ?? last.place, rotate: r.rotate ?? last.rotate };
      setLive({ id: it.id, ...last });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      noSelect(false);
      setLive(null);
      if (moved) {
        swallowNextClick();
        update(it.id, { place: last.place, rotate: last.rotate });
      }
    };
    noSelect(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const startMove = (e: React.PointerEvent, it: FreeItem) =>
    track(e, it, (dx, dy) => ({
      place: {
        ...it.place,
        x: Math.min(FREE_COLS - it.place.w, Math.max(0, Math.round(it.place.x + dx))),
        y: Math.max(0, Math.round(it.place.y + dy)),
      },
    }));

  const startResize = (e: React.PointerEvent, it: FreeItem, h: Handle) =>
    track(e, it, (dx, dy) => {
      let { x, y, w, h: hh } = it.place;
      const p = it.place;
      if (h.includes("e")) w = Math.min(FREE_COLS - p.x, Math.max(1, Math.round(p.w + dx)));
      if (h.includes("w")) {
        x = Math.min(p.x + p.w - 1, Math.max(0, Math.round(p.x + dx)));
        w = p.w + (p.x - x);
      }
      if (h.includes("s")) hh = Math.max(1, Math.round(p.h + dy));
      if (h.includes("n")) {
        y = Math.min(p.y + p.h - 1, Math.max(0, Math.round(p.y + dy)));
        hh = p.h + (p.y - y);
      }
      return { place: { x, y, w, h: hh } };
    });

  const startRotate = (e: React.PointerEvent, it: FreeItem) => {
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-free-item]");
    const r = el?.getBoundingClientRect();
    if (!r) return;
    const cx0 = r.left + r.width / 2;
    const cy0 = r.top + r.height / 2;
    track(e, it, (_dx, _dy, ev) => {
      let deg = (Math.atan2(ev.clientY - cy0, ev.clientX - cx0) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      // Snaps to 15° steps; hold Shift for any angle.
      if (!ev.shiftKey) deg = Math.round(deg / 15) * 15;
      return { rotate: Math.round(deg) };
    });
  };

  function startHeight(e: React.PointerEvent) {
    if (e.button !== 0 || stacked()) return;
    e.preventDefault();
    e.stopPropagation();
    const y0 = e.clientY;
    const c = cell();
    const min = Math.max(2, freeBottom(b.items));
    let next = b.rows;
    const move = (ev: PointerEvent) => {
      next = Math.max(min, Math.round(b.rows + (ev.clientY - y0) / c));
      setLiveRows(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLiveRows(null);
      swallowNextClick();
      if (next !== b.rows) onChange((s) => ({ ...s, rows: next }));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Keyboard: arrows nudge one cell, Delete removes, Esc lets go.
  useEffect(() => {
    if (!active || !selectedItem || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      const it = b.items.find((i) => i.id === selectedItem);
      if (!it) return;
      const by = { ArrowLeft: [rtl ? 1 : -1, 0], ArrowRight: [rtl ? -1 : 1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
        e.key
      ] as [number, number] | undefined;
      if (by) {
        e.preventDefault();
        update(
          it.id,
          {
            place: {
              ...it.place,
              x: Math.min(FREE_COLS - it.place.w, Math.max(0, it.place.x + by[0])),
              y: Math.max(0, it.place.y + by[1]),
            },
          },
          `nudge-${it.id}`,
        );
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange((s) => ({ ...s, items: s.items.filter((i) => i.id !== it.id) }));
        onSelectItem(null);
      } else if (e.key === "Escape") onSelectItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const layer = (it: FreeItem, dir: 1 | -1) =>
    onChange((s) => {
      const zs = s.items.map((i) => i.z);
      const z = dir === 1 ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
      // Keep stacking numbers small and positive.
      const items = s.items.map((i) => (i.id === it.id ? { ...i, z } : i));
      const sorted = [...items].sort((a, c) => a.z - c.z);
      const norm = new Map(sorted.map((i, n) => [i.id, n + 1]));
      return { ...s, items: items.map((i) => ({ ...i, z: norm.get(i.id)! })) };
    });

  const duplicate = (it: FreeItem) =>
    onChange((s) => {
      const copy: FreeItem = {
        ...structuredClone(it),
        id: Math.random().toString(36).slice(2, 10),
        place: { ...it.place, x: Math.min(FREE_COLS - it.place.w, it.place.x + 1), y: it.place.y + 1 },
        z: Math.max(...s.items.map((i) => i.z)) + 1,
      };
      return { ...s, items: [...s.items, copy], rows: Math.max(s.rows, copy.place.y + copy.place.h) };
    });

  const tool = "flex size-8 items-center justify-center rounded-[8px] text-white hover:bg-white/15";

  return (
    <div className="site-free-band fannan-free-edit relative" style={{ background: b.background ?? undefined }}>
      <div className="site-free relative">
        <div
          ref={grid}
          className={cx("site-free-grid", (live || liveRows !== null || active) && "fannan-free-grid-lines")}
          style={{ ["--rows" as string]: rows }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              onSelectItem(null);
              setEditing(null);
            }
          }}
          data-testid="free-grid"
        >
          {b.items.map((orig) => {
            const it = live?.id === orig.id ? { ...orig, place: live.place, rotate: live.rotate } : orig;
            const textual = it.kind === "text" || it.kind === "heading" || it.kind === "button";
            return (
              <div
                key={it.id}
                data-free-item={it.id}
                data-testid="free-item"
                data-kind={it.kind}
                className={cx("site-free-item", `site-free-${it.kind}`, "fannan-free-item")}
                data-phone-hidden={it.hideOnPhone || undefined}
                style={{
                  ...freeItemStyle(it, order.get(it.id) ?? 0),
                  opacity: undefined,
                  cursor: editing === it.id ? "text" : "move",
                }}
                onPointerDown={(e) => {
                  if (editing === it.id) return;
                  onSelectItem(it.id);
                  startMove(e, it);
                }}
                onDoubleClick={() => textual && setEditing(it.id)}
              >
                <div className="h-full w-full" style={{ opacity: it.opacity / 100 }}>
                  <FreeItemContent
                    it={it}
                    media={media}
                    base="/api/media/"
                    live={false}
                    text={
                      textual && editing === it.id ? (
                        <InlineText
                          value={it.text}
                          multiline={it.kind !== "button"}
                          placeholder={typeHere}
                          className="block min-h-full"
                          onChange={(v) => update(it.id, { text: v }, `free-text-${it.id}`)}
                        />
                      ) : undefined
                    }
                  />
                </div>
              </div>
            );
          })}

          {(() => {
            const sel = active && selectedItem ? b.items.find((i) => i.id === selectedItem) : null;
            if (!sel) return null;
            const it = live?.id === sel.id ? { ...sel, place: live.place, rotate: live.rotate } : sel;
            const textual = it.kind === "text" || it.kind === "heading" || it.kind === "button";
            // The selection sits above every item, so handles stay reachable where items overlap,
            // while the items keep their real stacking order.
            return (
              <div
                className="site-free-item pointer-events-none"
                data-free-item={it.id}
                data-testid="free-selection"
                style={{ ...freeItemStyle(it, order.get(it.id) ?? 0), zIndex: 990, opacity: undefined }}
              >
                <>
                  <span aria-hidden className="fannan-free-outline" />
                  {HANDLES.map((h) => (
                    <span
                      key={h}
                      data-handle={h}
                      aria-hidden
                      className="fannan-free-handle pointer-events-auto"
                      style={handleStyle(h)}
                      onPointerDown={(e) => startResize(e, it, h)}
                    />
                  ))}
                  <span
                    aria-hidden
                    data-handle="rotate"
                    className="fannan-free-rotate pointer-events-auto"
                    onPointerDown={(e) => startRotate(e, it)}
                  />
                  <div
                    role="toolbar"
                    aria-label={t("item")}
                    data-testid="free-toolbar"
                    className="bg-ink shadow-float pointer-events-auto absolute start-0 -top-[52px] z-[1000] flex items-center gap-0.5 rounded-[10px] p-1"
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ transform: it.rotate ? `rotate(${-it.rotate}deg)` : undefined, transformOrigin: "0 100%" }}
                  >
                    {textual && (
                      <button
                        type="button"
                        className={tool}
                        aria-label={t("editText")}
                        title={t("editText")}
                        onClick={() => setEditing(it.id)}
                      >
                        <span className="text-[13px] font-semibold">Aa</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={tool}
                      aria-label={t("front")}
                      title={t("front")}
                      onClick={() => layer(it, 1)}
                    >
                      <Icon name="bring-front" size={18} />
                    </button>
                    <button
                      type="button"
                      className={tool}
                      aria-label={t("back")}
                      title={t("back")}
                      onClick={() => layer(it, -1)}
                    >
                      <Icon name="send-back" size={18} />
                    </button>
                    <button
                      type="button"
                      className={tool}
                      aria-label={t("duplicate")}
                      title={t("duplicate")}
                      onClick={() => duplicate(it)}
                    >
                      <Icon name="duplicate" size={18} />
                    </button>
                    <button
                      type="button"
                      className={tool}
                      aria-label={t("delete")}
                      title={t("delete")}
                      onClick={() => {
                        onChange((s) => ({ ...s, items: s.items.filter((i) => i.id !== it.id) }));
                        onSelectItem(null);
                      }}
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  </div>
                </>
              </div>
            );
          })()}
        </div>
      </div>

      {active && (
        <>
          {/* Add a block inside this section. */}
          <div
            className="absolute start-2 bottom-2 z-[1001] flex flex-col-reverse"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-expanded={menu}
              className="bg-ink shadow-float flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold text-white"
              onClick={() => setMenu(!menu)}
            >
              <Icon name="add" size={16} />
              {t("addBlock")}
            </button>
            {menu && (
              <div
                role="menu"
                className="bg-paper text-ink shadow-float border-line mb-1.5 grid w-[280px] grid-cols-2 gap-1 rounded-[12px] border p-2"
              >
                {FREE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="menuitem"
                    className="hover:bg-mist flex h-10 items-center gap-2 rounded-[8px] px-2.5 text-start text-[13px] font-semibold"
                    onClick={() => {
                      setMenu(false);
                      onAdd(k);
                    }}
                  >
                    <Icon name={KIND_ICONS[k]} size={18} />
                    {t(`kinds.${k}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Section height. */}
          <button
            type="button"
            aria-label={t("height")}
            title={t("height")}
            className="bg-ink shadow-float rounded-pill absolute start-1/2 bottom-[-14px] z-[1001] flex h-7 w-14 -translate-x-1/2 cursor-ns-resize touch-none items-center justify-center text-white rtl:translate-x-1/2"
            onPointerDown={startHeight}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") onChange((s) => ({ ...s, rows: s.rows + 1 }));
              if (e.key === "ArrowUp")
                onChange((s) => ({ ...s, rows: Math.max(Math.max(2, freeBottom(s.items)), s.rows - 1) }));
            }}
          >
            <Icon name="reorder" size={16} />
          </button>
        </>
      )}
    </div>
  );
}
