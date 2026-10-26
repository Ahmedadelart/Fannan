"use client";

import { useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { startSortDrag } from "@/components/editor/sortDrag";
import type { FreeKind } from "@/lib/site/types";
import { freeItem, ITEM_GROUPS } from "@/lib/site/free";
import { DecoSvg } from "@/components/site/deco";
import { KIND_ICONS } from "@/components/editor/FreeEditor";

/* ---------- canvas: the real site at device width, shrunk to fit ---------- */

/** Sections carry data-block-id; the header and footer are "__header" / "__footer". */
const isPart = (id: string | null) => !!id && id.startsWith("__");
const partSelector = (id: string) =>
  isPart(id) ? `[data-site-part="${id.slice(2)}"]` : `[data-block-id="${id}"]`;

/** Round 18: what the hover card does. Every action names its section (the card follows the pointer). */
export interface SectionActions {
  /** Moves a section to `index` among the others (drag, Move up/down, the reorder view). */
  move: (id: string, index: number) => void;
  edit: (id: string) => void;
  /** "Add section" above or below: the library opens and the new section goes in at `index`. */
  addAt: (index: number) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
}

export function Canvas({
  width: deviceWidth,
  fluid,
  children,
  onPick,
  onDropBlock,
  dropLabel,
  selectedId,
  reorder,
  actions,
  version,
  settings,
  settingsOpen,
  onCloseSettings,
  onAddElement,
  itemId,
  onDock,
  order,
  nameOf,
  insertAt = null,
  quiet = false,
  sheet = false,
}: {
  /** Phones (Ahmed, round 18): the actions slide up from the bottom instead of the card. */
  sheet?: boolean;
  /** The page's sections, top to bottom (for Move up / Move down). */
  order: string[];
  /** A section's name for its tag ("Gallery", "Header"). */
  nameOf: (id: string) => string;
  /** Where "Add section" will put the new section: a line shows there. */
  insertAt?: number | null;
  /** No hover card (an item, a doodle or typing has the page's attention). */
  quiet?: boolean;
  /** Round 17: puts the floating card back into the side panel. */
  onDock?: () => void;
  /** The free-form item whose settings are open: the card opens beside it. */
  itemId?: string | null;
  width: number;
  /** Desktop: the site fills the whole width of the canvas (no grey gaps beside it). */
  fluid?: boolean;
  children: React.ReactNode;
  onPick: (blockId: string | null, onFreeItem: boolean) => void;
  onDropBlock: (kindKey: string, index: number) => void;
  dropLabel: string;
  selectedId: string | null;
  reorder: boolean;
  actions: SectionActions;
  /** Changes whenever the page content changes, so the toolbar follows the section. */
  version: unknown;
  settings?: React.ReactNode;
  settingsOpen: boolean;
  onCloseSettings: () => void;
  /** Set when the selected section is free-form: adds an element inside it. */
  onAddElement?: (kind: FreeKind) => void;
}) {
  const t = useTranslations("editor.section");
  const tf = useTranslations("editor.free");
  const [elementMenu, setElementMenu] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const outer = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(600);
  const [width, setWidth] = useState(deviceWidth);
  // The settings card can be dragged out of the way (Squarespace-style); it keeps its place.
  const [cardShift, setCardShift] = useState({ x: 0, y: 0 });
  const [dropAt, setDropAt] = useState<{ index: number; y: number } | null>(null);
  const [mark, setMark] = useState<{ y: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [itemBox, setItemBox] = useState<typeof box>(null);
  // Round 18: the section under the mouse gets the action card (touch screens: the tapped one).
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverBox, setHoverBox] = useState<typeof box>(null);
  const [insertY, setInsertY] = useState<number | null>(null);
  const hoverFrame = useRef(0);
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  // Where the settings card opens (just under the section's top), and the free-form tools under it.
  const toolsTop = (b: NonNullable<typeof box>) => (b.top >= 48 ? b.top - 46 : b.top + 8);
  const startAnchor = (b: NonNullable<typeof box>) =>
    rtl ? { left: b.left + b.width, transform: "translateX(-100%)" } : { left: b.left };
  /** An item's settings open right beside it: after it in reading order, or before it when there's no room. */
  const besideItem = (b: NonNullable<typeof box>) => {
    const w = 288;
    const gap = 16;
    const frameW = width * scale;
    const after = rtl ? b.left - gap - w : b.left + b.width + gap;
    const before = rtl ? b.left + b.width + gap : b.left - gap - w;
    const fits = (x: number) => x >= 0 && x + w <= frameW;
    return fits(after) ? after : fits(before) ? before : after;
  };
  const startInset = (b: NonNullable<typeof box>, gap: number) =>
    rtl ? { left: b.left + b.width - gap, transform: "translateX(-100%)" } : { left: b.left + gap };
  const endInset = (b: NonNullable<typeof box>, gap: number) =>
    rtl ? { left: b.left + gap } : { left: b.left + b.width - gap, transform: "translateX(-100%)" };
  const popLeft = (b: NonNullable<typeof box>) => {
    const w = 288;
    const frameW = width * scale;
    const x = rtl ? b.left : b.left + b.width - w;
    return Math.max(0, Math.min(x, frameW - w));
  };
  // A new selection closes the element menu.
  const [menuFor, setMenuFor] = useState(selectedId);
  if (menuFor !== selectedId) {
    setMenuFor(selectedId);
    setElementMenu(false);
    // The settings card opens in its usual place for each new selection.
    setCardShift({ x: 0, y: 0 });
  }
  const [cardFor, setCardFor] = useState(itemId);
  if (cardFor !== itemId) {
    setCardFor(itemId);
    setCardShift({ x: 0, y: 0 });
  }

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      const room = o.clientWidth - (fluid ? 0 : 48);
      // Desktop fills the canvas (at least 1024px wide, shrunk below that); tablet and phone keep their width.
      const w = fluid ? Math.max(1024, room) : deviceWidth;
      const fit = Math.min(1, room / w);
      // The reorder view shows the whole page small, so long pages fit on screen.
      const s = reorder ? Math.min(fit, 0.34) : fit;
      setWidth(w);
      setScale(s);
      setHeight(i.scrollHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [deviceWidth, fluid, reorder]);

  // Where the selected section is, in the frame's (scaled) coordinates.
  useLayoutEffect(() => {
    const measure = () => {
      const el = selectedId ? inner.current?.querySelector<HTMLElement>(partSelector(selectedId)) : null;
      const f = frame.current?.getBoundingClientRect();
      if (!el || !f) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - f.top, left: r.left - f.left, width: r.width, height: r.height });
      const item = itemId ? el.querySelector<HTMLElement>(`[data-testid="free-item"][data-free-item="${itemId}"]`) : null;
      const ir = item?.getBoundingClientRect();
      setItemBox(ir ? { top: ir.top - f.top, left: ir.left - f.left, width: ir.width, height: ir.height } : null);
    };
    measure();
    const i = inner.current;
    const ro = i ? new ResizeObserver(measure) : null;
    if (i) ro!.observe(i);
    return () => ro?.disconnect();
  }, [selectedId, scale, version, reorder, itemId]);

  // The hovered section's place, and where a new section will go.
  useLayoutEffect(() => {
    const f = frame.current?.getBoundingClientRect();
    const el = hoverId ? inner.current?.querySelector<HTMLElement>(partSelector(hoverId)) : null;
    if (!el || !f) setHoverBox(null);
    else {
      const r = el.getBoundingClientRect();
      setHoverBox({ top: r.top - f.top, left: r.left - f.left, width: r.width, height: r.height });
    }
    if (insertAt === null || !f) return setInsertY(null);
    const blocks = [...(inner.current?.querySelectorAll<HTMLElement>("[data-block-id]") ?? [])];
    const at = blocks[insertAt]?.getBoundingClientRect().top ?? blocks[blocks.length - 1]?.getBoundingClientRect().bottom;
    setInsertY(at === undefined ? 40 : at - f.top);
  }, [hoverId, insertAt, scale, version, reorder]);
  // The line scrolls into view when it appears.
  useLayoutEffect(() => {
    const o = outer.current;
    if (insertY === null || !o) return;
    const top = insertY + (frame.current?.offsetTop ?? 0);
    if (top < o.scrollTop + 80 || top > o.scrollTop + o.clientHeight - 80)
      o.scrollTo({ top: Math.max(0, top - o.clientHeight / 3), behavior: "smooth" });
  }, [insertY]);

  function onHover(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const target = e.target as HTMLElement;
    // On the card or a pill: keep the section they belong to.
    if (target.closest("[data-canvas-tools]")) return;
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = requestAnimationFrame(() => {
      const busy =
        document.querySelector('[data-testid="free-group"]') ||
        (document.activeElement as HTMLElement | null)?.closest?.("[data-inline-text], [contenteditable=true]");
      const el = busy ? null : target.closest<HTMLElement>("[data-block-id], [data-site-part]");
      setHoverId(el ? (el.dataset.blockId ?? `__${el.dataset.sitePart}`) : null);
    });
  }

  const sections = () =>
    [...(inner.current?.querySelectorAll<HTMLElement>("[data-block-id]") ?? [])].map((el) => ({
      id: el.dataset.blockId!,
      el,
    }));

  function drag(e: React.PointerEvent, id: string) {
    setDragging(id);
    startSortDrag(e, {
      dragId: id,
      items: sections,
      scroller: outer.current,
      onMark: (m) => {
        const f = frame.current?.getBoundingClientRect();
        setMark(m && f ? { y: m.y - f.top } : null);
        if (!m) setDragging(null);
      },
      onDrop: (index) => actions.move(id, index),
    });
  }

  function insertionPoint(e: DragEvent) {
    const blocks = [...(inner.current?.querySelectorAll<HTMLElement>("[data-block-id]") ?? [])];
    const rect = inner.current!.getBoundingClientRect();
    let index = blocks.length;
    let y = blocks.length ? blocks[blocks.length - 1].getBoundingClientRect().bottom : rect.top + 40;
    for (let n = 0; n < blocks.length; n++) {
      const r = blocks[n].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        index = n;
        y = r.top;
        break;
      }
    }
    return { index, y: (y - rect.top) / scale };
  }

  const tool = "flex size-9 items-center justify-center rounded-[10px] text-ink hover:bg-mist disabled:opacity-30 disabled:hover:bg-transparent";
  const cardRow = "flex h-9 w-full items-center gap-2 rounded-[10px] px-2.5 text-start text-[13px] font-semibold text-ink hover:bg-mist";
  // The card: the hovered section, else the selected one (until its settings are open).
  const calm = quiet || reorder || !!dragging || elementMenu;
  // Phones follow the tapped section only.
  const shownId = calm ? null : ((sheet ? null : hoverId) ?? (settingsOpen ? null : selectedId));
  const shownBox = !shownId ? null : !sheet && hoverId ? hoverBox : box;
  const shownAt = shownId ? order.indexOf(shownId) : -1;

  return (
    <div ref={outer} className={cx("bg-mist flex-1 overflow-auto overscroll-contain", fluid ? "pt-12 pb-20" : "px-6 py-6")} data-tip="canvas">
      {reorder && (
        <p role="status" className="bg-ink sticky top-0 z-30 mx-auto mb-4 w-fit rounded-pill px-4 py-2 text-[13px] font-semibold text-white">
          {t("reorderHint")}
        </p>
      )}
      <div
        ref={frame}
        className={cx("relative mx-auto", reorder && "fannan-reorder")}
        style={{ width: width * scale, height }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("application/x-fannan-block")) return;
          e.preventDefault();
          setDropAt(insertionPoint(e));
        }}
        onDragLeave={() => setDropAt(null)}
        onDrop={(e) => {
          const key = e.dataTransfer.getData("application/x-fannan-block");
          const at = insertionPoint(e);
          setDropAt(null);
          if (key) onDropBlock(key, at.index);
        }}
        onPointerMove={onHover}
        onPointerLeave={() => {
          cancelAnimationFrame(hoverFrame.current);
          setHoverId(null);
        }}
        onPointerDown={(e) => {
          if (!reorder) return;
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
          if (el) drag(e, el.dataset.blockId!);
        }}
      >
        <div
          ref={inner}
          data-testid="canvas"
          className={cx(
            "absolute start-0 top-0 origin-top-left overflow-hidden bg-white rtl:origin-top-right",
            !fluid && "rounded-[6px] shadow-[0_1px_3px_rgba(20,20,20,.08)]",
          )}
          style={{ width, transform: `scale(${scale})`, minHeight: 600 }}
          onClick={(e: MouseEvent) => {
            if (reorder) return;
            const target = e.target as HTMLElement;
            const el = target.closest<HTMLElement>("[data-block-id]");
            const part = target.closest<HTMLElement>("[data-site-part]")?.dataset.sitePart;
            onPick(
              el?.dataset.blockId ?? (part ? `__${part}` : null),
              !!target.closest("[data-free-item], [role=menu], [role=toolbar]"),
            );
          }}
        >
          {children}
          {dropAt && (
            <div
              className="pointer-events-none absolute inset-x-6 z-10 flex items-center gap-2"
              style={{ top: dropAt.y - 2 }}
            >
              <span className="bg-ink h-1 flex-1 rounded" />
              <span className="bg-lime text-ink rounded-[6px] px-2 py-0.5 text-[12px] font-semibold">{dropLabel}</span>
              <span className="bg-ink h-1 flex-1 rounded" />
            </div>
          )}
        </div>

        {/* While dragging a section: where it will land. */}
        {mark && (
          <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center gap-2" style={{ top: mark.y - 3 }}>
            <span className="bg-ink h-1.5 flex-1 rounded" />
            <span className="bg-lime text-ink rounded-[6px] px-2 py-0.5 text-[12px] font-semibold">{dropLabel}</span>
            <span className="bg-ink h-1.5 flex-1 rounded" />
          </div>
        )}

        {/* Where "Add section" will put the new one. */}
        {insertY !== null && !reorder && (
          <div data-testid="insert-marker" className="pointer-events-none absolute inset-x-0 z-20 flex items-center gap-2" style={{ top: insertY - 3 }}>
            <span className="bg-ink h-1.5 flex-1 rounded" />
            <span className="bg-lime text-on-lime rounded-[8px] px-2.5 py-1 text-[12px] font-semibold">{t("insertHere")}</span>
            <span className="bg-ink h-1.5 flex-1 rounded" />
          </div>
        )}

        {/* Round 18 (Squarespace-style): the section under the pointer shows its name, an action card
            and "Add section" on its top and bottom edges. The header and footer only get Edit. */}
        {shownId && shownBox && (
          <>
            <span
              aria-hidden
              className="border-ink/60 pointer-events-none absolute z-10 border-[1.5px]"
              style={{ top: shownBox.top, left: shownBox.left, width: shownBox.width, height: shownBox.height }}
            />
            {isPart(shownId) ? (
              <span
                data-canvas-tools
                className="bg-ink pointer-events-none absolute z-20 flex h-6 items-center rounded-pill px-2.5 text-[11px] font-semibold text-white"
                style={{ top: shownBox.top + 8, ...startInset(shownBox, 10) }}
              >
                {nameOf(shownId)}
              </span>
            ) : (
              <button
                type="button"
                data-canvas-tools
                aria-label={`${nameOf(shownId)}: ${t("drag")}`}
                title={t("drag")}
                className="bg-ink absolute z-20 flex h-6 cursor-grab touch-none items-center gap-1 rounded-pill ps-1.5 pe-2.5 text-[11px] font-semibold text-white"
                style={{ top: shownBox.top + 10, ...startInset(shownBox, 12) }}
                onPointerDown={(e) => drag(e, shownId)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" && shownAt > 0) {
                    e.preventDefault();
                    actions.move(shownId, shownAt - 1);
                  }
                  if (e.key === "ArrowDown" && shownAt < order.length - 1) {
                    e.preventDefault();
                    actions.move(shownId, shownAt + 1);
                  }
                }}
              >
                <Icon name="drag" size={12} />
                {nameOf(shownId)}
              </button>
            )}
            {!sheet && (
            <div
              role="toolbar"
              aria-label={t("toolbar")}
              data-testid="section-toolbar"
              data-canvas-tools
              data-section={shownId}
              className="border-line shadow-float absolute z-20 flex min-w-[172px] flex-col gap-0.5 rounded-[16px] border bg-white p-1.5"
              style={{ top: shownBox.top + (isPart(shownId) ? Math.max(6, shownBox.height / 2 - 24) : 12), ...endInset(shownBox, 12) }}
            >
              <button type="button" data-testid="section-edit" className={cardRow} onClick={() => actions.edit(shownId)}>
                <Icon name="pen" size={16} />
                {shownId === "__header" ? t("editHeader") : shownId === "__footer" ? t("editFooter") : t("edit")}
              </button>
              {!isPart(shownId) && (
                <>
                  <span className="border-line my-0.5 flex gap-0.5 border-y px-0.5 py-0.5">
                    <button type="button" aria-label={t("duplicate")} title={t("duplicate")} className={tool} onClick={() => actions.duplicate(shownId)}>
                      <Icon name="duplicate" size={18} />
                    </button>
                    <button
                      type="button"
                      data-testid="section-up"
                      aria-label={t("moveUp")}
                      title={t("moveUp")}
                      disabled={shownAt <= 0}
                      className={tool}
                      onClick={() => actions.move(shownId, shownAt - 1)}
                    >
                      <Icon name="arrow-up" size={18} />
                    </button>
                    <button
                      type="button"
                      data-testid="section-down"
                      aria-label={t("moveDown")}
                      title={t("moveDown")}
                      disabled={shownAt < 0 || shownAt >= order.length - 1}
                      className={tool}
                      onClick={() => actions.move(shownId, shownAt + 1)}
                    >
                      <Icon name="arrow-down" size={18} />
                    </button>
                  </span>
                  <button type="button" data-testid="section-remove" className={cardRow} onClick={() => actions.remove(shownId)}>
                    <Icon name="delete" size={16} />
                    {t("remove")}
                  </button>
                </>
              )}
            </div>
            )}
            {sheet && (
              <div
                role="toolbar"
                aria-label={t("toolbar")}
                data-testid="section-toolbar"
                data-canvas-tools
                data-section={shownId}
                className="shadow-float fixed inset-x-0 bottom-16 z-40 flex flex-col gap-2 rounded-t-[28px] bg-white px-3 pt-2 pb-4"
              >
                <span aria-hidden className="bg-line mx-auto mb-1 h-1 w-9 rounded" />
                <span className="flex items-center justify-between ps-2">
                  <span className="text-[15px] font-semibold">{nameOf(shownId)}</span>
                  <button
                    type="button"
                    aria-label={t("close")}
                    className="text-muted hover:bg-mist flex size-9 items-center justify-center rounded-full"
                    onClick={() => onPick(null, false)}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </span>
                <button
                  type="button"
                  data-testid="section-edit"
                  className="bg-mist flex h-12 items-center gap-3 rounded-[14px] px-3 text-[14px] font-semibold"
                  onClick={() => actions.edit(shownId)}
                >
                  <Icon name="pen" size={20} />
                  {shownId === "__header" ? t("editHeader") : shownId === "__footer" ? t("editFooter") : t("edit")}
                </button>
                {!isPart(shownId) && (
                  <span className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ["duplicate", "duplicate", t("duplicate"), false, () => actions.duplicate(shownId)],
                        ["section-up", "arrow-up", t("moveUp"), shownAt <= 0, () => actions.move(shownId, shownAt - 1)],
                        ["section-down", "arrow-down", t("moveDown"), shownAt >= order.length - 1, () => actions.move(shownId, shownAt + 1)],
                        ["section-remove", "delete", t("remove"), false, () => actions.remove(shownId)],
                      ] as const
                    ).map(([id, icon, label, off, run]) => (
                      <button
                        key={id}
                        type="button"
                        data-testid={id === "duplicate" ? undefined : id}
                        disabled={off}
                        className="border-line flex flex-col items-center gap-1 rounded-[14px] border py-2.5 text-[11px] font-semibold disabled:opacity-30"
                        onClick={run}
                      >
                        <Icon name={icon} size={20} />
                        {label}
                      </button>
                    ))}
                  </span>
                )}
                {!isPart(shownId) && (
                  <button
                    type="button"
                    data-testid="add-section-below"
                    className="border-line flex h-11 items-center justify-center gap-1.5 rounded-pill border text-[13px] font-semibold"
                    onClick={() => actions.addAt(shownAt + 1)}
                  >
                    <Icon name="add" size={18} />
                    {t("addBelow")}
                  </button>
                )}
              </div>
            )}
            {!isPart(shownId) &&
              (sheet ? (["above"] as const) : (["above", "below"] as const)).map((where) => (
                <button
                  key={where}
                  type="button"
                  data-canvas-tools
                  data-testid={`add-section-${where}`}
                  aria-label={where === "above" ? t("addAbove") : t("addBelow")}
                  className="bg-ink shadow-float absolute z-20 flex h-[30px] items-center gap-1.5 rounded-pill px-3.5 text-[12px] font-semibold whitespace-nowrap text-white"
                  style={{
                    top: where === "above" ? shownBox.top - 15 : shownBox.top + shownBox.height - 15,
                    left: shownBox.left + shownBox.width / 2,
                    transform: "translateX(-50%)",
                  }}
                  onClick={() => actions.addAt(where === "above" ? shownAt : shownAt + 1)}
                >
                  <Icon name="add" size={16} />
                  {t("addSection")}
                </button>
              ))}
          </>
        )}

        {/* Under a selected free-form section: Layers (drawn by the section itself), then Add item. */}
        {box && !reorder && !dragging && onAddElement && (
          <div
            className="absolute z-20 flex items-start gap-1.5"
            style={{ top: box.top + box.height + 10, ...startAnchor(box) }}
          >
            {/* The free-form section puts its Layers button here. */}
            <span data-layers-slot className="block min-h-9 min-w-9" />
            {onAddElement && (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={elementMenu}
                  className="bg-ink shadow-float flex h-9 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-semibold text-white"
                  onClick={() => setElementMenu(!elementMenu)}
                >
                  <Icon name="add" size={16} />
                  {tf("addBlock")}
                </button>
                {elementMenu && (
                  <div
                    role="menu"
                    aria-label={tf("addBlock")}
                    className="bg-paper text-ink shadow-float border-line absolute start-0 top-11 flex max-h-[420px] w-[300px] flex-col gap-1 overflow-y-auto rounded-[16px] border p-2"
                  >
                    <label className="border-line text-muted mb-1 flex h-9 items-center gap-2 rounded-[10px] border px-2.5">
                      <Icon name="search" size={16} />
                      <input
                        autoFocus
                        className="text-ink min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                        placeholder={tf("searchItems")}
                        aria-label={tf("searchItems")}
                        value={itemQuery}
                        onChange={(e) => setItemQuery(e.target.value)}
                      />
                    </label>
                    {ITEM_GROUPS.map(({ group, kinds }) => {
                      const shown = kinds.filter((k) => tf(`kinds.${k}`).toLowerCase().includes(itemQuery.toLowerCase()));
                      if (!shown.length) return null;
                      return (
                        <div key={group} className="flex flex-col">
                          <span className="text-muted px-2 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase">
                            {tf(`groups.${group}`)}
                          </span>
                          <div className={cx("grid gap-0.5", group === "decorations" ? "grid-cols-4" : "grid-cols-2")}>
                            {shown.map((k) =>
                              group === "decorations" ? (
                                // Decorations show as little pictures of themselves.
                                <button
                                  key={k}
                                  type="button"
                                  role="menuitem"
                                  aria-label={tf(`kinds.${k}`)}
                                  title={tf(`kinds.${k}`)}
                                  className="hover:bg-mist flex flex-col items-center gap-1 rounded-[10px] p-1.5 text-[10px] font-medium"
                                  onClick={() => {
                                    setElementMenu(false);
                                    setItemQuery("");
                                    onAddElement(k);
                                  }}
                                >
                                  <DecoTile kind={k} />
                                  <span className="w-full truncate text-center">{tf(`kinds.${k}`)}</span>
                                </button>
                              ) : (
                                <button
                                  key={k}
                                  type="button"
                                  role="menuitem"
                                  className="hover:bg-mist flex h-10 items-center gap-2 rounded-[10px] px-2.5 text-start text-[13px] font-medium"
                                  onClick={() => {
                                    setElementMenu(false);
                                    setItemQuery("");
                                    onAddElement(k);
                                  }}
                                >
                                  <Icon name={KIND_ICONS[k]} size={18} />
                                  {tf(`kinds.${k}`)}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* The section's settings, right next to it. Drag its top bar to move it out of the way. */}
        {box && settingsOpen && settings && !reorder && (
          <div
            role="dialog"
            aria-label={t("settings")}
            data-testid="block-settings"
            className="bg-paper text-ink shadow-float border-line absolute z-30 flex max-h-[62vh] w-[288px] flex-col overflow-hidden rounded-[16px] border text-[13px]"
            style={{
              top: Math.max(0, Math.min((itemBox ? itemBox.top : toolsTop(box) + 48) + cardShift.y, height - 120)),
              left: Math.max(0, Math.min((itemBox ? besideItem(itemBox) : popLeft(box)) + cardShift.x, width * scale - 288)),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="border-line flex cursor-move touch-none items-center justify-between border-b py-1.5 ps-3 pe-1.5 select-none"
              title={t("moveCard")}
              data-testid="settings-handle"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                const from = { pointerX: e.clientX, pointerY: e.clientY, x: cardShift.x, y: cardShift.y };
                const move = (ev: PointerEvent) =>
                  setCardShift({ x: from.x + ev.clientX - from.pointerX, y: from.y + ev.clientY - from.pointerY });
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
              onDoubleClick={() => setCardShift({ x: 0, y: 0 })}
            >
              <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                <Icon name="drag" size={16} className="text-muted" />
                {t("settings")}
              </span>
              <span className="flex items-center">
                {onDock && (
                  <button
                    type="button"
                    aria-label={t("dock")}
                    title={t("dock")}
                    className="text-muted hover:text-ink hover:bg-mist flex size-7 items-center justify-center rounded-full"
                    onClick={onDock}
                    data-testid="settings-dock"
                  >
                    <Icon name="send-back" size={16} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t("close")}
                  className="text-muted hover:text-ink hover:bg-mist flex size-7 items-center justify-center rounded-full"
                  onClick={onCloseSettings}
                >
                  <Icon name="close" size={16} />
                </button>
              </span>
            </div>
            <div className="fannan-compact overflow-y-auto p-3">{settings}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A small picture of a decoration, for the add-item menu. */
function DecoTile({ kind }: { kind: FreeKind }) {
  const sample = { ...freeItem(kind, "en", { x: 0, y: 0, w: 3, h: 2 }), id: `tile-${kind}` };
  return (
    <span className="text-primary flex h-9 w-14 items-center justify-center">
      {kind === "drawing" ? (
        // The doodle tool: a pen and a scribble.
        <svg viewBox="0 0 56 36" className="h-9 w-14" aria-hidden>
          <path d="M6 26c6-12 12-14 16-6s10 8 14-4 10-10 14-2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : kind === "badge" ? (
        <span className="bg-lime text-on-lime rounded-pill px-2 py-0.5 text-[9px] font-bold">NEW</span>
      ) : kind === "panel" ? (
        <span className="bg-secondary-container block h-7 w-11 rounded-[8px] shadow-sm" />
      ) : kind === "highlight" ? (
        <span className="block h-4 w-11 -skew-x-6 rounded-[2px] bg-[#F5E663]" />
      ) : (
        <span className="block h-full w-full">
          <DecoSvg it={sample} color="currentColor" />
        </span>
      )}
    </span>
  );
}
