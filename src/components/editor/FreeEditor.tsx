"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  FreeItemContent,
  freeItemStyle,
  freeOrder,
  type FreeExtras,
  type SiteMedia,
} from "@/components/site/SiteRender";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { FREE_COLS, freeBottom } from "@/lib/site/free";
import type { BlockOf, FreeItem, FreeKind, FreePlace } from "@/lib/site/types";
import { getClip, mod, setClip, typing } from "./clipboard";
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
  typeHere: string;
  /** The pencil in the item's toolbar: opens (or closes) its full settings. */
  onEditItem: (id: string) => void;
  /** The item whose settings card is open, if any (the pencil shows pressed). */
  settingsFor?: string | null;
  /** Social links and projects, for social link and project items. */
  extras?: FreeExtras;
}

export const KIND_ICONS: Record<FreeKind, IconName> = {
  text: "text",
  heading: "hero-headline",
  image: "image",
  button: "button",
  shape: "shape",
  line: "line",
  video: "video-4k",
  social: "social-links",
  quote: "quote",
  list: "list",
  map: "map",
  audio: "audio",
  project: "projects",
};

/** Items whose words are typed in place (double-click). */
const TYPED: FreeKind[] = ["text", "heading", "button", "quote"];
/** Items that can link somewhere. */
const LINKABLE: FreeKind[] = ["image", "button", "shape", "text", "heading"];

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
  typeHere,
  onEditItem,
  settingsFor = null,
  extras,
}: FreeEditorProps) {
  const t = useTranslations("editor.free");
  // Squarespace-style layers list: drag to restack, hover to hide.
  const [layersOpen, setLayersOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  // Several items picked at once (drag a box on an empty spot, or Shift-click), moved and removed together.
  const [group, setGroup] = useState<string[]>([]);
  const [groupLive, setGroupLive] = useState<{ dx: number; dy: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const grouped = active && group.length > 1;
  const [groupFor, setGroupFor] = useState(active);
  if (groupFor !== active) {
    setGroupFor(active);
    if (!active) setGroup([]);
  }
  const grid = useRef<HTMLDivElement>(null);
  // While a pointer is moving something, its place is kept here and saved once on release.
  const [live, setLive] = useState<{ id: string; place: FreePlace; rotate: number } | null>(null);
  const [liveRows, setLiveRows] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
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

  /** Windows-style box selection: drag on an empty spot; every item the box touches is picked. */
  function startMarquee(e: React.PointerEvent) {
    const g = grid.current;
    if (e.button !== 0 || !g || stacked()) {
      onSelectItem(null);
      setGroup([]);
      return;
    }
    e.preventDefault();
    const r0 = g.getBoundingClientRect();
    const k = r0.width / g.offsetWidth; // the canvas is drawn scaled
    const x0 = e.clientX;
    const y0 = e.clientY;
    let rect = { left: x0, top: y0, right: x0, bottom: y0 };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return;
      moved = true;
      rect = {
        left: Math.min(x0, ev.clientX),
        top: Math.min(y0, ev.clientY),
        right: Math.max(x0, ev.clientX),
        bottom: Math.max(y0, ev.clientY),
      };
      setMarquee({
        x: (rect.left - r0.left) / k,
        y: (rect.top - r0.top) / k,
        w: (rect.right - rect.left) / k,
        h: (rect.bottom - rect.top) / k,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      noSelect(false);
      setMarquee(null);
      if (!moved) {
        onSelectItem(null);
        setGroup([]);
        return;
      }
      swallowNextClick();
      const hit = [...g.querySelectorAll<HTMLElement>('[data-testid="free-item"]:not([data-hidden])')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top;
        })
        .map((el) => el.dataset.freeItem!);
      if (hit.length === 1) {
        setGroup([]);
        onSelectItem(hit[0]);
      } else {
        setGroup(hit);
        onSelectItem(null);
      }
    };
    noSelect(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Drags every picked item together, keeping them all on the grid. */
  function startGroupMove(e: React.PointerEvent) {
    if (e.button !== 0 || stacked()) return;
    e.preventDefault();
    e.stopPropagation();
    const picked = b.items.filter((i) => group.includes(i.id));
    const minX = Math.min(...picked.map((i) => i.place.x));
    const maxX = Math.max(...picked.map((i) => i.place.x + i.place.w));
    const minY = Math.min(...picked.map((i) => i.place.y));
    const x0 = e.clientX;
    const y0 = e.clientY;
    const c = cell();
    let last = { dx: 0, dy: 0 };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return;
      moved = true;
      const dx = Math.round(((ev.clientX - x0) / c) * (rtl ? -1 : 1));
      const dy = Math.round((ev.clientY - y0) / c);
      last = { dx: Math.max(-minX, Math.min(FREE_COLS - maxX, dx)), dy: Math.max(-minY, dy) };
      setGroupLive(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      noSelect(false);
      setGroupLive(null);
      if (!moved) return;
      swallowNextClick();
      shiftGroup(last.dx, last.dy);
    };
    noSelect(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const shiftGroup = (dx: number, dy: number, key?: string) =>
    onChange((s) => {
      const items = s.items.map((i) =>
        group.includes(i.id) ? { ...i, place: { ...i.place, x: i.place.x + dx, y: Math.max(0, i.place.y + dy) } } : i,
      );
      return { ...s, items, rows: Math.max(s.rows, freeBottom(items)) };
    }, key);

  /** Shift-click adds an item to the picked ones, or takes it out. */
  function togglePick(id: string) {
    const base = group.length ? group : selectedItem ? [selectedItem] : [];
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (next.length > 1) {
      setGroup(next);
      onSelectItem(null);
    } else {
      setGroup([]);
      onSelectItem(next[0] ?? null);
    }
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

  // Keyboard for picked items: arrows move them all (Shift: four steps), Delete removes them, Esc lets go.
  useEffect(() => {
    if (!grouped) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      const by = { ArrowLeft: [rtl ? 1 : -1, 0], ArrowRight: [rtl ? -1 : 1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
        e.key
      ] as [number, number] | undefined;
      const picked = b.items.filter((i) => group.includes(i.id));
      if (by && !mod(e)) {
        e.preventDefault();
        if (e.shiftKey) by.forEach((v, n) => (by[n] = v * 4));
        const minX = Math.min(...picked.map((i) => i.place.x));
        const maxX = Math.max(...picked.map((i) => i.place.x + i.place.w));
        const minY = Math.min(...picked.map((i) => i.place.y));
        const dx = Math.max(-minX, Math.min(FREE_COLS - maxX, by[0]));
        const dy = Math.max(-minY, by[1]);
        if (dx || dy) shiftGroup(dx, dy, "nudge-group");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onChange((s) => ({ ...s, items: s.items.filter((i) => !group.includes(i.id)) }));
        setGroup([]);
      } else if (e.key === "Escape") setGroup([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
      if (by && !mod(e)) {
        e.preventDefault();
        if (e.shiftKey) by.forEach((v, n) => (by[n] = v * 4));
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
      } else if ((e.key === "Delete" || e.key === "Backspace") && !mod(e)) {
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

  // Copy, cut, paste, duplicate and select all, for the items of this section.
  useEffect(() => {
    if (!active || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || !mod(e)) return;
      const k = e.key.toLowerCase();
      const picked = grouped
        ? b.items.filter((i) => group.includes(i.id))
        : b.items.filter((i) => i.id === selectedItem);
      if (k === "a") {
        e.preventDefault();
        const all = b.items.filter((i) => !i.hidden).map((i) => i.id);
        if (all.length > 1) {
          setGroup(all);
          onSelectItem(null);
        } else onSelectItem(all[0] ?? null);
      } else if ((k === "c" || k === "x") && picked.length) {
        e.preventDefault();
        setClip({ kind: "items", items: picked });
        if (k === "x") {
          const ids = new Set(picked.map((i) => i.id));
          onChange((s) => ({ ...s, items: s.items.filter((i) => !ids.has(i.id)) }));
          setGroup([]);
          onSelectItem(null);
        }
      } else if (k === "v" && getClip()?.kind === "items") {
        e.preventDefault();
        const clip = getClip() as { kind: "items"; items: FreeItem[] };
        const taken = new Set(b.items.map((i) => `${i.place.x},${i.place.y}`));
        // Pasted on top of where they were copied from, they shift one cell so they show.
        const shift = clip.items.some((i) => taken.has(`${i.place.x},${i.place.y}`)) ? 1 : 0;
        let z = Math.max(0, ...b.items.map((i) => i.z));
        const pasted = clip.items.map((i) => ({
          ...structuredClone(i),
          id: Math.random().toString(36).slice(2, 10),
          z: ++z,
          place: { ...i.place, x: Math.min(FREE_COLS - i.place.w, i.place.x + shift), y: i.place.y + shift },
        }));
        onChange((s) => {
          const items = [...s.items, ...pasted];
          return { ...s, items, rows: Math.max(s.rows, freeBottom(items)) };
        });
        if (pasted.length > 1) {
          setGroup(pasted.map((i) => i.id));
          onSelectItem(null);
        } else onSelectItem(pasted[0]?.id ?? null);
      } else if (k === "d" && picked.length) {
        e.preventDefault();
        picked.forEach((i) => duplicate(i));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tool = "flex size-8 items-center justify-center rounded-full text-[#45483D] hover:bg-[#1A1C16]/8";

  /** Layers, front to back. Dragging a row restacks; the eye hides an item. */
  const layers = [...b.items].sort((a, c) => c.z - a.z);
  const restack = (ids: string[]) =>
    onChange((s) => {
      const z = new Map(ids.map((id, n) => [id, ids.length - n]));
      return { ...s, items: s.items.map((i) => ({ ...i, z: z.get(i.id) ?? i.z })) };
    });
  function dragLayer(e: React.PointerEvent, id: string) {
    const list = (e.currentTarget as HTMLElement).closest("[data-layers]");
    if (!list) return;
    e.preventDefault();
    const rows = () => [...list.querySelectorAll<HTMLElement>("[data-layer]")];
    let target = layers.findIndex((l) => l.id === id);
    let moved = false;
    const move = (ev: PointerEvent) => {
      moved = true;
      const r = rows();
      let n = r.findIndex((el) => ev.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
      if (n < 0) n = r.length - 1;
      target = n;
      r.forEach((el, i) => (el.style.boxShadow = i === n ? "inset 0 2px 0 #4C6700" : ""));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      rows().forEach((el) => (el.style.boxShadow = ""));
      if (!moved) return onSelectItem(id);
      const ids = layers.map((l) => l.id).filter((x) => x !== id);
      ids.splice(target, 0, id);
      restack(ids);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  const layerName = (it: FreeItem) =>
    (TYPED.includes(it.kind) || it.kind === "map" ? it.text.split("\n")[0].slice(0, 28) : "") || t(`kinds.${it.kind}`);

  return (
    <div className="site-free-band fannan-free-edit relative" style={{ background: b.background ?? undefined }}>
      <div className="site-free relative">
        <div
          ref={grid}
          className={cx("site-free-grid", (live || liveRows !== null || active) && "fannan-free-grid-lines")}
          style={{ ["--rows" as string]: rows }}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setEditing(null);
            startMarquee(e);
          }}
          data-testid="free-grid"
        >
          {b.items.map((orig) => {
            const shifted =
              groupLive && group.includes(orig.id)
                ? { ...orig, place: { ...orig.place, x: orig.place.x + groupLive.dx, y: orig.place.y + groupLive.dy } }
                : orig;
            const it = live?.id === orig.id ? { ...orig, place: live.place, rotate: live.rotate } : shifted;
            const textual = TYPED.includes(it.kind);
            return (
              <div
                key={it.id}
                data-free-item={it.id}
                data-testid="free-item"
                data-kind={it.kind}
                className={cx("site-free-item", `site-free-${it.kind}`, "fannan-free-item")}
                data-phone-hidden={it.hideOnPhone || undefined}
                data-hidden={it.hidden || undefined}
                style={{
                  ...freeItemStyle(it, order.get(it.id) ?? 0),
                  opacity: it.hidden ? 0.22 : undefined,
                  pointerEvents: it.hidden ? "none" : undefined,
                  cursor: editing === it.id ? "text" : "move",
                }}
                onPointerDown={(e) => {
                  if (editing === it.id) return;
                  if (e.shiftKey) {
                    e.preventDefault();
                    return togglePick(it.id);
                  }
                  if (grouped && group.includes(it.id)) return startGroupMove(e);
                  setGroup([]);
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
                    extras={extras}
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

          {grouped &&
            (() => {
              const picked = b.items.filter((i) => group.includes(i.id));
              if (picked.length < 2) return null;
              const d = groupLive ?? { dx: 0, dy: 0 };
              const x = Math.min(...picked.map((i) => i.place.x)) + d.dx;
              const y = Math.min(...picked.map((i) => i.place.y)) + d.dy;
              const w = Math.max(...picked.map((i) => i.place.x + i.place.w)) + d.dx - x;
              const h = Math.max(...picked.map((i) => i.place.y + i.place.h)) + d.dy - y;
              return (
                <>
                  {picked.map((i) => (
                    <div
                      key={i.id}
                      className="site-free-item pointer-events-none"
                      style={{ ...freeItemStyle({ ...i, place: { ...i.place, x: i.place.x + d.dx, y: i.place.y + d.dy } }, 0), zIndex: 989, opacity: undefined }}
                    >
                      <span aria-hidden className="fannan-free-outline" />
                    </div>
                  ))}
                  <div
                    className="site-free-item pointer-events-none"
                    data-testid="free-group"
                    style={{ ...freeItemStyle({ ...picked[0], place: { x, y, w, h }, rotate: 0 }, 0), zIndex: 990, opacity: undefined }}
                  >
                    <span aria-hidden className="absolute -inset-1.5 rounded-[4px] border-2 border-dashed border-[#4C6700]" />
                    <div
                      role="toolbar"
                      aria-label={t("picked", { count: picked.length })}
                      data-testid="group-toolbar"
                      className="border-line shadow-float pointer-events-auto absolute start-0 -top-[52px] z-[1000] flex items-center gap-0.5 rounded-pill border bg-white p-1"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <span className="px-2.5 text-[12px] font-semibold text-[#1A1C16]">{t("picked", { count: picked.length })}</span>
                      <span className="bg-line mx-0.5 h-5 w-px" />
                      <button type="button" className={tool} aria-label={t("front")} title={t("front")} onClick={() => picked.forEach((i) => layer(i, 1))}>
                        <Icon name="bring-front" size={18} />
                      </button>
                      <button type="button" className={tool} aria-label={t("back")} title={t("back")} onClick={() => picked.forEach((i) => layer(i, -1))}>
                        <Icon name="send-back" size={18} />
                      </button>
                      <button type="button" className={tool} aria-label={t("duplicate")} title={t("duplicate")} onClick={() => picked.forEach((i) => duplicate(i))}>
                        <Icon name="duplicate" size={18} />
                      </button>
                      <button
                        type="button"
                        className={tool}
                        aria-label={t("delete")}
                        title={t("delete")}
                        onClick={() => {
                          onChange((s) => ({ ...s, items: s.items.filter((i) => !group.includes(i.id)) }));
                          setGroup([]);
                        }}
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

          {marquee && (
            <div
              aria-hidden
              data-testid="free-marquee"
              className="pointer-events-none absolute z-[995] rounded-[2px] border border-[#4C6700] bg-[#C6F432]/20"
              style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
            />
          )}

          {(() => {
            const sel = active && selectedItem && !grouped ? b.items.find((i) => i.id === selectedItem) : null;
            if (!sel) return null;
            const it = live?.id === sel.id ? { ...sel, place: live.place, rotate: live.rotate } : sel;
            const textual = TYPED.includes(it.kind);
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
                    className="border-line shadow-float rounded-pill pointer-events-auto absolute start-0 -top-[52px] z-[1000] flex items-center gap-0.5 border bg-white p-1"
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ transform: it.rotate ? `rotate(${-it.rotate}deg)` : undefined, transformOrigin: "0 100%" }}
                  >
                    <button
                      type="button"
                      className={tool}
                      aria-label={t("edit")}
                      title={t("edit")}
                      aria-pressed={settingsFor === it.id}
                      data-testid="item-edit"
                      onClick={() => onEditItem(it.id)}
                    >
                      <Icon name="site-editor" size={18} />
                    </button>
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
                    {LINKABLE.includes(it.kind) && (
                      <button
                        type="button"
                        className={cx(tool, (linkFor === it.id || it.link) && "text-primary")}
                        aria-label={t("link")}
                        title={t("link")}
                        aria-expanded={linkFor === it.id}
                        onClick={() => setLinkFor(linkFor === it.id ? null : it.id)}
                      >
                        <Icon name="link" size={18} />
                      </button>
                    )}
                    <span className="bg-line mx-0.5 h-5 w-px" />
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
                    {linkFor === it.id && (
                      <form
                        className="border-line shadow-float absolute start-0 top-[46px] flex w-[260px] gap-1.5 rounded-[14px] border bg-white p-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setLinkFor(null);
                        }}
                      >
                        <input
                          autoFocus
                          dir="ltr"
                          aria-label={t("link")}
                          placeholder={t("linkPlaceholder")}
                          defaultValue={it.link}
                          className="border-line focus:border-primary h-9 min-w-0 flex-1 rounded-[10px] border px-2.5 text-[13px] text-[#1A1C16] outline-none"
                          onChange={(e) => update(it.id, { link: e.target.value }, `free-link-${it.id}`)}
                          onKeyDown={(e) => e.key === "Escape" && setLinkFor(null)}
                        />
                      </form>
                    )}
                  </div>
                </>
              </div>
            );
          })()}
        </div>
        {active && (
          // Under the section's bottom start corner, beside "Add item" (the canvas leaves room for it).
          <div
            className="absolute start-0 top-[calc(100%+10px)] z-[1001]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={t("layers")}
              title={t("layers")}
              aria-expanded={layersOpen}
              data-testid="layers-button"
              onClick={() => setLayersOpen(!layersOpen)}
              className="border-line shadow-float flex size-9 items-center justify-center rounded-full border bg-white text-[#1A1C16] hover:bg-[#F0F1E7]"
            >
              <Icon name="layers" size={20} />
            </button>
            {layersOpen && (
              <div
                role="list"
                aria-label={t("layers")}
                data-layers
                data-testid="layers-panel"
                ref={(el) => el?.scrollIntoView({ block: "nearest" })}
                className="border-line shadow-float absolute start-0 bottom-[calc(100%+8px)] flex max-h-[320px] w-[230px] flex-col gap-0.5 overflow-y-auto rounded-[16px] border bg-white p-2 text-[#1A1C16]"
              >
                <span className="px-2 pt-1 pb-2 text-[12px] font-semibold">{t("layers")}</span>
                {layers.map((it) => (
                  <div
                    key={it.id}
                    role="listitem"
                    data-layer={it.id}
                    className={cx(
                      "group flex h-9 cursor-grab touch-none items-center gap-2 rounded-[10px] px-2 text-[13px] select-none hover:bg-[#F0F1E7]",
                      selectedItem === it.id && "bg-[#DEE6C8]",
                      it.hidden && "text-[#76786C]",
                    )}
                    onPointerDown={(e) => !(e.target as HTMLElement).closest("button") && dragLayer(e, it.id)}
                  >
                    <Icon name={KIND_ICONS[it.kind]} size={16} />
                    <span className="min-w-0 flex-1 truncate">{layerName(it)}</span>
                    <button
                      type="button"
                      aria-label={it.hidden ? t("show") : t("hide")}
                      title={it.hidden ? t("show") : t("hide")}
                      aria-pressed={it.hidden}
                      className={cx(
                        "flex size-7 items-center justify-center rounded-full hover:bg-white",
                        it.hidden ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
                      )}
                      onClick={() => update(it.id, { hidden: !it.hidden })}
                    >
                      <Icon name={it.hidden ? "hidden" : "preview"} size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {active && (
        <>
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
