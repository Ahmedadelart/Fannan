"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { Button, buttonClasses, IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlays";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { blockKinds, networkName, newId, type BlockKind } from "@/lib/site/blocks";
import { setPath } from "@/lib/site/fields";
import { normalizeFooter } from "@/lib/site/normalize";
import { moveTo, startSortDrag } from "@/components/editor/sortDrag";
import type { Block, BlockOf, FreeKind, SiteDraft } from "@/lib/site/types";
import { addFreeItem, FREE_KINDS } from "@/lib/site/free";
import { FreeEditor, KIND_ICONS } from "@/components/editor/FreeEditor";
import { editorTipsSeen, publishSite, savePagePassword, saveSiteDraft } from "./actions";
import {
  BlockSettings,
  BlocksTab,
  MediaPicker,
  PagesTab,
  ProjectsPanel,
  SitePartSettings,
  StyleTab,
  type DesignSection,
  type EditorSiteSettings,
  type MediaKind,
} from "./Panels";

type Device = "desktop" | "tablet" | "phone";
const WIDTHS: Record<Device, number> = { desktop: 1200, tablet: 820, phone: 390 };
const HISTORY = 60;

/* ---------- canvas: the real site at device width, shrunk to fit ---------- */

/** Sections carry data-block-id; the header and footer are "__header" / "__footer". */
const isPart = (id: string | null) => !!id && id.startsWith("__");
const partSelector = (id: string) =>
  isPart(id) ? `[data-site-part="${id.slice(2)}"]` : `[data-block-id="${id}"]`;

export interface SectionActions {
  /** Moves a section to `index` among the others (drag on the canvas or in the reorder view). */
  move: (id: string, index: number) => void;
  settings: () => void;
  add: () => void;
  duplicate: () => void;
  remove: () => void;
}

function Canvas({
  width,
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
}: {
  width: number;
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
  const outer = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(600);
  const [dropAt, setDropAt] = useState<{ index: number; y: number } | null>(null);
  const [mark, setMark] = useState<{ y: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  // Squarespace-style: the section's tools sit just above its top end corner (inside it when
  // there's no room above), and "Add section" just under its bottom start corner.
  const toolsTop = (b: NonNullable<typeof box>) => (b.top >= 48 ? b.top - 46 : b.top + 8);
  const endAnchor = (b: NonNullable<typeof box>) =>
    rtl ? { left: b.left } : { left: b.left + b.width, transform: "translateX(-100%)" };
  const startAnchor = (b: NonNullable<typeof box>) =>
    rtl ? { left: b.left + b.width, transform: "translateX(-100%)" } : { left: b.left };
  const popLeft = (b: NonNullable<typeof box>) => {
    const w = 320;
    const frameW = width * scale;
    const x = rtl ? b.left : b.left + b.width - w;
    return Math.max(0, Math.min(x, frameW - w));
  };
  // A new selection closes the element menu.
  const [menuFor, setMenuFor] = useState(selectedId);
  if (menuFor !== selectedId) {
    setMenuFor(selectedId);
    setElementMenu(false);
  }

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      const fit = Math.min(1, (o.clientWidth - 48) / width);
      // The reorder view shows the whole page small, so long pages fit on screen.
      const s = reorder ? Math.min(fit, 0.34) : fit;
      setScale(s);
      setHeight(i.scrollHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width, reorder]);

  // Where the selected section is, in the frame's (scaled) coordinates.
  useLayoutEffect(() => {
    const measure = () => {
      const el = selectedId ? inner.current?.querySelector<HTMLElement>(partSelector(selectedId)) : null;
      const f = frame.current?.getBoundingClientRect();
      if (!el || !f) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - f.top, left: r.left - f.left, width: r.width, height: r.height });
    };
    measure();
    const i = inner.current;
    const ro = i ? new ResizeObserver(measure) : null;
    if (i) ro!.observe(i);
    return () => ro?.disconnect();
  }, [selectedId, scale, version, reorder]);

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

  const tool = "flex size-8 items-center justify-center rounded-full text-ink hover:bg-mist";

  return (
    <div ref={outer} className="flex-1 overflow-auto bg-[#ECECE8] px-6 py-6" data-tip="canvas">
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
        onPointerDown={(e) => {
          if (!reorder) return;
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
          if (el) drag(e, el.dataset.blockId!);
        }}
      >
        <div
          ref={inner}
          data-testid="canvas"
          className="absolute start-0 top-0 origin-top-left overflow-hidden rounded-[6px] bg-white shadow-[0_1px_3px_rgba(20,20,20,.08)] rtl:origin-top-right"
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

        {/* The selected section's tools: drag, settings, duplicate, delete. */}
        {box && !reorder && !dragging && (
          <div
            role="toolbar"
            aria-label={t("toolbar")}
            data-testid="section-toolbar"
            className="border-line shadow-float absolute z-20 flex items-center gap-0.5 rounded-pill border bg-white p-1"
            style={{ top: toolsTop(box), ...endAnchor(box) }}
          >
            {!isPart(selectedId) && (
            <button
              type="button"
              aria-label={t("drag")}
              title={t("drag")}
              className={cx(tool, "cursor-grab touch-none")}
              onPointerDown={(e) => drag(e, selectedId!)}
              onKeyDown={(e) => {
                const list = sections().map((x) => x.id);
                const i = list.indexOf(selectedId!);
                if (e.key === "ArrowUp" && i > 0) {
                  e.preventDefault();
                  actions.move(selectedId!, i - 1);
                }
                if (e.key === "ArrowDown" && i < list.length - 1) {
                  e.preventDefault();
                  actions.move(selectedId!, i + 1);
                }
              }}
            >
              <Icon name="reorder" size={18} />
            </button>
            )}
            <button
              type="button"
              aria-label={t("settings")}
              title={t("settings")}
              aria-expanded={settingsOpen}
              className={cx(tool, settingsOpen && "bg-lime text-on-lime hover:bg-lime")}
              onClick={actions.settings}
            >
              <Icon name="settings" size={18} />
            </button>
            {!isPart(selectedId) && (
              <>
                <button type="button" aria-label={t("duplicate")} title={t("duplicate")} className={tool} onClick={actions.duplicate}>
                  <Icon name="duplicate" size={18} />
                </button>
                <button type="button" aria-label={t("remove")} title={t("remove")} className={tool} onClick={actions.remove}>
                  <Icon name="delete" size={18} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Under the selected section: add an element inside it (free-form) or a new section below. */}
        {box && !reorder && !dragging && selectedId !== "__footer" && (
          <div className="absolute z-20 flex items-start gap-1.5" style={{ top: box.top + box.height + 10, ...startAnchor(box) }}>
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
                    className="bg-paper text-ink shadow-float border-line absolute start-0 top-11 grid w-[280px] grid-cols-2 gap-1 rounded-[12px] border p-2"
                  >
                    {FREE_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="menuitem"
                        className="hover:bg-mist flex h-10 items-center gap-2 rounded-[8px] px-2.5 text-start text-[13px] font-semibold"
                        onClick={() => {
                          setElementMenu(false);
                          onAddElement(k);
                        }}
                      >
                        <Icon name={KIND_ICONS[k]} size={18} />
                        {tf(`kinds.${k}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="bg-paper text-ink shadow-float border-line flex h-9 items-center gap-1.5 rounded-pill border px-3.5 text-[13px] font-semibold hover:bg-white"
              onClick={actions.add}
            >
              <Icon name="add" size={16} />
              {t("addSection")}
            </button>
          </div>
        )}

        {/* The section's settings, right next to it (replaces the old side panel). */}
        {box && settingsOpen && settings && !reorder && (
          <div
            role="dialog"
            aria-label={t("settings")}
            data-testid="block-settings"
            className="bg-paper text-ink shadow-float border-line absolute z-30 flex max-h-[70vh] w-[320px] flex-col overflow-hidden rounded-[14px] border"
            // Near the bottom of the page the card moves up so it stays within the page.
            style={{ top: Math.max(0, Math.min(toolsTop(box) + 48, height - 440)), left: popLeft(box) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-line flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-[13px] font-semibold">{t("settings")}</span>
              <button type="button" aria-label={t("close")} className="text-muted hover:text-ink" onClick={onCloseSettings}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">{settings}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- first-run tips (3 max, ONBOARDING.md) ---------- */

function Tips({ onDone }: { onDone: () => void }) {
  const t = useTranslations("editor.tips");
  const [n, setN] = useState(1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const target = ["blocks", "canvas", "publish"][n - 1];
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el =
        document.querySelector<HTMLElement>(`[data-tip="${target}"]`) ??
        (target === "blocks" ? document.querySelector<HTMLElement>('[data-tip="rail-blocks"]') : null);
      setRect(el?.getBoundingClientRect() ?? null);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  const bold = { b: (c: React.ReactNode) => <b>{c}</b> };
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={(t.raw(String(n)) as string).replace(/<\/?b>/g, "")}
    >
      <div className="bg-ink/45 absolute inset-0" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-md shadow-[0_0_0_2px_var(--color-ink),0_0_0_6px_var(--color-lime)]"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: Math.min(rect.height + 8, 360),
          }}
        />
      )}
      <div
        className="bg-paper text-ink shadow-float absolute flex w-[min(300px,calc(100vw-32px))] flex-col gap-3 rounded-lg p-4"
        style={(() => {
          // Keep the card on screen, even on a phone.
          if (typeof document === "undefined") return { left: 16, top: 80 };
          const vw = document.documentElement.clientWidth;
          const vh = document.documentElement.clientHeight;
          const w = Math.min(300, vw - 32);
          if (!rect) return { left: 16, top: 80 };
          const want =
            rect.left + (target === "publish" ? rect.width - w : target === "canvas" ? 40 : rect.width + 16);
          const left = Math.max(16, Math.min(want, vw - w - 16));
          const top = Math.max(16, Math.min(target === "publish" ? rect.bottom + 16 : rect.top + 40, vh - 180));
          return { left, top };
        })()}
      >
        <p className="text-[15px]">{t.rich(String(n) as "1", bold)}</p>
        <div className="flex items-center justify-between">
          <span className="text-muted text-[12px]">{t("count", { n })}</span>
          <Button size="sm" onClick={() => (n < 3 ? setN(n + 1) : onDone())}>
            {n < 3 ? t("next") : t("done")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- the editor ---------- */

export function Editor({
  initialDraft,
  media: initialMedia,
  projects,
  categories,
  available,
  published,
  canPassword,
  showTips,
  credit,
  isPro,
  initialSettings,
}: {
  /** Social links, CV and older contact settings, edited from the footer and contact sections. */
  initialSettings: EditorSiteSettings;
  /** Pro sites can publish the showpiece blocks. */
  isPro: boolean;
  initialDraft: SiteDraft;
  media: Record<string, SiteMedia>;
  projects: GalleryProject[];
  categories: Record<string, string>;
  available: boolean;
  published: { version: number | null; dirty: boolean };
  canPassword: boolean;
  showTips: boolean;
  credit: boolean;
}) {
  const t = useTranslations("editor");
  const td = useTranslations("dashboard");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const [draft, setDraftState] = useState(initialDraft);
  const [siteSettings, setSiteSettings] = useState(initialSettings);
  const [media, setMedia] = useState(initialMedia);
  const [pageId, setPageId] = useState(initialDraft.pages[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  // Inside a free-form section: the selected item.
  const [freeItem, setFreeItem] = useState<string | null>(null);
  // Carbonmade-style shell: an icon rail picks the panel; the blocks panel has Blocks | Page settings.
  const [rail, setRail] = useState<"blocks" | "design" | "projects" | "stats">("blocks");
  const [panelTab, setPanelTab] = useState<"blocks" | "page">("blocks");
  const [pagesOpen, setPagesOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState<DesignSection | null>("styles");
  const [panelOpen, setPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const small = () => window.matchMedia("(max-width: 1023px)").matches;
  // On a phone, start with the phone preview.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 640px)").matches) setDevice("phone");
      // Small screens: the panel opens from the rail instead of covering the page.
      if (window.matchMedia("(max-width: 1023px)").matches) setPanelOpen(false);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [dirty, setDirty] = useState(published.dirty);
  const [version, setVersion] = useState(published.version);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);
  // Zoomed-out view where whole sections are dragged into a new order.
  const [reorder, setReorder] = useState(false);
  const [tips, setTips] = useState(showTips);
  const [picker, setPicker] = useState<{ kind: MediaKind; done: (id: string) => void } | null>(null);
  const past = useRef<SiteDraft[]>([]);
  const future = useRef<SiteDraft[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<unknown> | null>(null);
  const latest = useRef(draft);
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });

  const page = draft.pages.find((p) => p.id === pageId) ?? draft.pages[0];
  const block = page.blocks.find((b) => b.id === selected) ?? null;

  /* ---------- saving ---------- */

  const persist = useCallback(async () => {
    setSave("saving");
    const run = saveSiteDraft(latest.current).catch(() => ({ ok: false as const, error: "network" }));
    saving.current = run;
    const r = await run;
    if (saving.current === run) saving.current = null;
    if (!r.ok) {
      setSave("error");
      saveTimer.current = setTimeout(() => schedule(), 3000);
    } else setSave("saved");
    // schedule only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function schedule() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSave("saving");
    saveTimer.current = setTimeout(() => void persist(), 800);
  }

  /** Every change goes through here: history, autosave, "unpublished changes". */
  const setDraft = useCallback((fn: (d: SiteDraft) => SiteDraft, key?: string) => {
    setDraftState((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      const now = Date.now();
      // Typing in one field counts as one step to undo.
      const coalesce = key && lastKey.current?.key === key && now - lastKey.current.at < 1200;
      if (!coalesce) {
        past.current = [...past.current.slice(-HISTORY + 1), prev];
        future.current = [];
      }
      lastKey.current = key ? { key, at: now } : null;
      latest.current = next;
      return next;
    });
    setDirty(true);
    setHistorySize({ past: past.current.length + 1, future: 0 });
    schedule();
    // schedule only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(latest.current);
    latest.current = prev;
    lastKey.current = null;
    setDraftState(prev);
    setHistorySize({ past: past.current.length, future: future.current.length });
    setDirty(true);
    schedule();
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(latest.current);
    latest.current = next;
    lastKey.current = null;
    setDraftState(next);
    setHistorySize({ past: past.current.length, future: future.current.length });
    setDirty(true);
    schedule();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      if (typing || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (saveTimer.current || saving.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", warn);
    };
    // undo/redo read refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- blocks ---------- */

  const setBlocks = (fn: (blocks: Block[]) => Block[], key?: string) =>
    setDraft(
      (d) => ({ ...d, pages: d.pages.map((p) => (p.id === page.id ? { ...p, blocks: fn(p.blocks) } : p)) }),
      key,
    );

  // A Free artist picking a Pro showpiece block: explain first, let them try it.
  const [upsell, setUpsell] = useState<{ kind: BlockKind; at?: number } | null>(null);

  function addBlock(kind: BlockKind, at?: number, confirmed = false) {
    if (kind.pro && !isPro && !confirmed) return setUpsell({ kind, at });
    const b = kind.make(draft.language);
    setBlocks((blocks) => {
      const i = at ?? (selected ? blocks.findIndex((x) => x.id === selected) + 1 : blocks.length);
      const next = [...blocks];
      next.splice(i < 0 ? blocks.length : i, 0, b);
      return next;
    });
    setSelected(b.id);
    if (small()) setPanelOpen(false);
  }

  function duplicateBlock() {
    if (!block) return;
    const copy = { ...structuredClone(block), id: newId() };
    setBlocks((blocks) => {
      const i = blocks.findIndex((x) => x.id === block.id);
      const next = [...blocks];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setSelected(copy.id);
  }

  function removeBlock() {
    if (!block) return;
    setBlocks((blocks) => blocks.filter((b) => b.id !== block.id));
    setSelected(null);
  }

  const sectionActions = {
    move: (id: string, index: number) => setBlocks((blocks) => moveTo(blocks, id, index)),
    settings: () => setSettingsOpen((o) => !o),
    add: () => {
      setRail("blocks");
      setPanelTab("blocks");
      setPanelOpen(true);
    },
    duplicate: duplicateBlock,
    remove: removeBlock,
  };

  /** Free-form sections are drawn with handles by FreeEditor. */
  const changeFree = (id: string, fn: (b: BlockOf<"free">) => BlockOf<"free">, key?: string) =>
    setBlocks((blocks) => blocks.map((x) => (x.id === id && x.type === "free" ? fn(x) : x)), key);
  const renderFree = (b: BlockOf<"free">) => (
    <FreeEditor
      b={b}
      media={media}
      active={selected === b.id}
      selectedItem={selected === b.id ? freeItem : null}
      onSelectItem={(id) => {
        setSelected(b.id);
        setFreeItem(id);
      }}
      onChange={(fn, key) => changeFree(b.id, fn, key)}
      typeHere={t("typeHere")}
    />
  );

  /** Text typed on the canvas. Typing in one field counts as one step to undo. */
  const onText = (blockId: string, path: string, value: string) =>
    setBlocks((blocks) => blocks.map((b) => (b.id === blockId ? setPath(b, path, value) : b)), `text-${blockId}-${path}`);
  const onSiteText = (field: "title" | "tagline" | "footer", value: string) =>
    setDraft(
      (d) => (field === "footer" ? { ...d, footer: { ...normalizeFooter(d.footer), text: value } } : { ...d, [field]: value }),
      `site-${field}`,
    );

  async function doPublish() {
    setPublishing(true);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      await persist();
    } else if (saving.current) await saving.current;
    const r = await publishSite().catch(() => ({ ok: false as const, error: "network" }));
    setPublishing(false);
    if (!r.ok) return toast(t("publishFailed"), "publish");
    setVersion(r.version);
    setDirty(false);
    toast(t("published"), "check");
  }

  async function pagePassword(id: string, pw: string) {
    const r = await savePagePassword(id, pw);
    if (!r.ok) {
      toast(t("pages.proOnly"), "password");
      return false;
    }
    setDraftState((d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, hasPassword: !!pw } : p)) }));
    setDirty(true);
    toast(t("saved"), "password");
    return true;
  }

  const renderProps = {
    site: draft,
    pageId: page.id,
    media,
    projects,
    available: { on: available, label: td("available.title"), hire: td("hireMe") },
    categoryLabel: (id: string) => categories[id] ?? id,
    credit: credit ? (draft.language === "ar" ? "صُنع بواسطة فنان" : "Made with Fannan") : null,
    contactFallback: siteSettings.contact,
    footerLinks: [
      ...siteSettings.social.map((l) => ({ href: l.url, label: networkName(l.network, l.url), kind: "social" as const })),
      ...(siteSettings.cvMediaId && media[siteSettings.cvMediaId]
        ? [{ href: "#cv", label: draft.language === "ar" ? "السيرة الذاتية (PDF)" : "Résumé (PDF)", kind: "cv" as const }]
        : []),
    ],
  };

  const status =
    save === "saving"
      ? t("saving")
      : save === "error"
        ? t("saveFailed")
        : dirty
          ? version === null
            ? t("neverPublished")
            : t("unpublished")
          : t("upToDate");

  /* ---------- render ---------- */
  const railItems = [
    { id: "blocks", icon: "site-editor", label: t("rail.blocks") },
    { id: "projects", icon: "projects", label: t("rail.projects") },
    { id: "design", icon: "palette", label: t("rail.design") },
    { id: "stats", icon: "stats", label: t("rail.stats") },
  ] as const;
  const railTool =
    "group relative flex size-10 items-center justify-center rounded-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white";
  const railTip =
    "bg-lime text-ink pointer-events-none absolute start-[48px] z-50 hidden whitespace-nowrap rounded-pill px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] uppercase group-hover:block";
  const partSettings =
    selected === "__header" || selected === "__footer" ? (
      <SitePartSettings
        part={selected === "__header" ? "header" : "footer"}
        draft={draft}
        setDraft={setDraft}
        media={media}
        openPicker={(kind, done) => setPicker({ kind, done })}
        credit={credit}
        siteSettings={siteSettings}
        onSiteSettings={setSiteSettings}
      />
    ) : null;
  const blockSettings = partSettings ?? (block ? (
    <BlockSettings
      key={block.id}
      block={block}
      freeItem={freeItem}
      onFreeItem={setFreeItem}
      media={media}
      categories={categories}
      openPicker={(kind, done) => setPicker({ kind, done })}
      update={(patch, key) =>
        setBlocks((blocks) => blocks.map((b) => (b.id === block.id ? ({ ...b, ...patch } as Block) : b)), key)
      }
      contactFallback={siteSettings.contact}
      language={draft.language}
    />
  ) : null);

  return (
    <div className="text-ink relative flex h-dvh bg-[#E9E9E5]">
      {/* Icon rail (dark, like Carbonmade). */}
      <nav
        aria-label={t("rail.label")}
        className="relative z-40 flex w-14 flex-none flex-col items-center gap-1.5 bg-[#141414] py-3"
      >
        <a href="/" aria-label={t("back")} title={t("back")} className="mb-3 flex size-10 items-center justify-center rounded-full bg-white/10">
          <span className="font-heading font-heading-weight text-lime text-[18px] leading-none">{locale === "ar" ? "ف" : "f"}</span>
        </a>
        {railItems.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-label={r.label}
            aria-pressed={rail === r.id && panelOpen}
            data-tip={r.id === "blocks" ? "rail-blocks" : undefined}
            className={cx(railTool, rail === r.id && panelOpen && "bg-white/10 text-white")}
            onClick={() => {
              if (rail === r.id) setPanelOpen(!panelOpen);
              else {
                setRail(r.id);
                setPanelOpen(true);
              }
            }}
          >
            <Icon name={r.icon} size={20} />
            <span className={railTip}>{r.label}</span>
          </button>
        ))}
        <span className="flex-1" />
        <a href={locale === "ar" ? "https://fannan.net/ar/help" : "https://fannan.net/help"} target="_blank" rel="noreferrer" className={railTool} aria-label={t("rail.help")}>
          <Icon name="help" size={20} />
          <span className={railTip}>{t("rail.help")}</span>
        </a>
        <a href="/settings" className={railTool} aria-label={t("rail.settings")}>
          <Icon name="settings" size={20} />
          <span className={railTip}>{t("rail.settings")}</span>
        </a>
      </nav>

      {/* The panel next to the rail (dark). On small screens it floats; tapping outside closes it. */}
      {panelOpen && (
        <div
          aria-hidden
          data-testid="panel-backdrop"
          className="bg-ink/30 absolute inset-y-0 start-14 end-0 z-20 lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
      {panelOpen && (
        <aside
          className={cx(
            "fannan-dark bg-paper text-ink border-line flex w-[300px] flex-none flex-col overflow-y-auto border-e",
            "max-lg:shadow-float max-lg:absolute max-lg:inset-y-0 max-lg:start-14 max-lg:z-30 max-lg:w-[min(320px,calc(100vw-56px))]",
          )}
          data-testid="left-panel"
        >
          {rail === "blocks" && (
            <>
              <div className="px-3 pt-3">
                <button
                  type="button"
                  aria-expanded={pagesOpen}
                  onClick={() => setPagesOpen(!pagesOpen)}
                  className="flex w-full items-center justify-between rounded-[12px] bg-[#141414] px-3.5 py-2.5 text-start"
                  data-testid="page-switcher"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-muted text-[10px] font-semibold tracking-[0.1em] uppercase">{t("currentlyEditing")}</span>
                    <span className="truncate text-[15px] font-semibold">{page.title}</span>
                  </span>
                  <Icon name="chevron-down" size={18} className={cx("transition-transform", pagesOpen && "rotate-180")} />
                </button>
              </div>
              {pagesOpen ? (
                <div className="px-0.5">
                  <PagesTab
                    part="list"
                    draft={draft}
                    pageId={page.id}
                    setPageId={(id) => {
                      setPageId(id);
                      setSelected(null);
                      setPagesOpen(false);
                    }}
                    setDraft={setDraft}
                    canPassword={canPassword}
                    onPassword={pagePassword}
                  />
                </div>
              ) : (
                <>
                  <nav className="border-line mx-3 mt-3 grid grid-cols-2 border-b" role="tablist" aria-label={t("tabs.blocks")}>
                    {(["blocks", "page"] as const).map((x) => (
                      <button
                        key={x}
                        type="button"
                        role="tab"
                        aria-selected={panelTab === x}
                        onClick={() => setPanelTab(x)}
                        className={cx(
                          "h-10 border-b-2 text-[13px]",
                          panelTab === x ? "border-lime text-ink font-semibold" : "text-muted border-transparent font-medium",
                        )}
                      >
                        {t(`panelTabs.${x}`)}
                      </button>
                    ))}
                  </nav>
                  {panelTab === "blocks" ? (
                    <BlocksTab onAdd={(k) => addBlock(k)} draft={draft} media={media} projects={projects} />
                  ) : (
                    <div className="px-0.5">
                      <PagesTab
                        part="settings"
                        draft={draft}
                        pageId={page.id}
                        setPageId={(id) => {
                          setPageId(id);
                          setSelected(null);
                        }}
                        setDraft={setDraft}
                        canPassword={canPassword}
                        onPassword={pagePassword}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {rail === "design" && (
            <div className="flex flex-col">
              <h2 className="text-muted px-4 pt-4 pb-2 text-[11px] font-semibold tracking-[0.1em] uppercase">{t("rail.design")}</h2>
              {(["logo", "nav", "styles", "footer"] as DesignSection[]).map((sec) => (
                <div key={sec} className="border-line border-b">
                  <button
                    type="button"
                    aria-expanded={designOpen === sec}
                    onClick={() => setDesignOpen(designOpen === sec ? null : sec)}
                    className="flex h-12 w-full items-center justify-between px-4 text-[15px] font-semibold"
                  >
                    {t(`design.${sec}`)}
                    <Icon name="chevron-down" size={18} className={cx("transition-transform", designOpen === sec && "rotate-180")} />
                  </button>
                  {designOpen === sec && (
                    <div className="px-4 pb-5">
                      {sec === "footer" ? (
                        <SitePartSettings
                          part="footer"
                          draft={draft}
                          setDraft={setDraft}
                          media={media}
                          openPicker={(kind, done) => setPicker({ kind, done })}
                          credit={credit}
                          siteSettings={siteSettings}
                          onSiteSettings={setSiteSettings}
                        />
                      ) : (
                        <StyleTab
                          section={sec}
                          credit={credit}
                          draft={draft}
                          media={media}
                          setDraft={setDraft}
                          openPicker={(kind, done) => setPicker({ kind, done })}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {rail === "projects" && <ProjectsPanel projects={projects} media={media} />}

          {rail === "stats" && (
            <div className="flex flex-col gap-3 p-4">
              <h2 className="text-muted text-[11px] font-semibold tracking-[0.1em] uppercase">{t("rail.stats")}</h2>
              <p className="text-ink-soft text-[13px]">{t("statsText")}</p>
              <a href="/stats" className="bg-lime text-on-lime flex h-10 items-center justify-center rounded-[10px] text-[13px] font-semibold">
                {t("openStats")}
              </a>
            </div>
          )}
        </aside>
      )}

      {/* The preview, with a slim bar on top. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Three columns, so the status sits centred over the site, not the whole window. */}
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 md:grid-cols-[1fr_minmax(0,420px)_1fr] md:px-4">
          <span
            className="bg-paper text-muted col-span-2 flex h-8 min-w-0 items-center justify-center gap-2 truncate rounded-pill px-3 text-[12px] md:col-span-1 md:col-start-2 md:row-start-1"
            role="status"
            data-testid="editor-status"
          >
            {status}
          </span>
          <div className="flex items-center gap-1.5 md:col-start-1 md:row-start-1">
            <IconButton icon="undo" label={t("undo")} size="sm" disabled={historySize.past === 0} onClick={undo} />
            <IconButton icon="redo" label={t("redo")} size="sm" disabled={historySize.future === 0} onClick={redo} />
            <button
              type="button"
              aria-pressed={reorder}
              aria-label={reorder ? t("reorderDone") : t("reorder")}
              title={reorder ? t("reorderDone") : t("reorder")}
              onClick={() => {
                setReorder(!reorder);
                setSelected(null);
                setSettingsOpen(false);
              }}
              className={cx(
                "flex h-9 items-center gap-1.5 rounded-pill px-3 text-[13px] font-semibold",
                reorder ? "bg-ink text-white" : "bg-paper text-ink hover:bg-white",
              )}
            >
              <Icon name="reorder" size={16} />
              <span className={reorder ? undefined : "max-lg:sr-only"}>{reorder ? t("reorderDone") : t("reorder")}</span>
            </button>
          </div>
          <div className="flex items-center justify-end gap-1.5 md:col-start-3 md:row-start-1">
            <div className="bg-paper flex gap-0.5 rounded-pill p-[3px]" role="radiogroup" aria-label={t("device")}>
              {(["desktop", "tablet", "phone"] as Device[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={device === d}
                  aria-label={t(d)}
                  title={t(d)}
                  onClick={() => setDevice(d)}
                  className={cx(
                    "flex size-8 items-center justify-center rounded-full",
                    d === "tablet" && "max-sm:hidden",
                    device === d ? "bg-ink text-white" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon name={d === "phone" ? "mobile" : d} size={16} />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label={t("preview")}
              title={t("preview")}
              data-testid="preview-button"
              onClick={() => setPreview(true)}
              className="bg-paper text-ink flex size-9 items-center justify-center rounded-full hover:bg-white"
            >
              <Icon name="preview" size={18} />
            </button>
            <span data-tip="publish">
              <button
                type="button"
                onClick={doPublish}
                disabled={publishing || (!dirty && version !== null)}
                className="bg-lime text-on-lime flex h-9 items-center gap-2 rounded-pill px-3 text-[13px] font-semibold tracking-[0.04em] uppercase hover:brightness-95 disabled:opacity-50 sm:px-4"
              >
                <Icon name="publish" size={16} className="rtl:-scale-x-100" />
                <span className="max-sm:sr-only">{publishing ? t("publishing") : t("publish")}</span>
              </button>
            </span>
          </div>
        </header>

        <Canvas
          width={WIDTHS[device]}
          selectedId={selected}
          reorder={reorder}
          actions={sectionActions}
          version={page.blocks}
          settings={blockSettings}
          settingsOpen={settingsOpen || !!freeItem}
          onAddElement={
            block?.type === "free"
              ? (kind) => {
                  const r = addFreeItem(block, kind, draft.language);
                  changeFree(block.id, () => r.block);
                  setFreeItem(r.item.id);
                }
              : undefined
          }
          onCloseSettings={() => {
            setSettingsOpen(false);
            setFreeItem(null);
          }}
          onPick={(id, onFreeItem) => {
            if (id !== selected) setSettingsOpen(!!id && id.startsWith("__"));
            setSelected(id);
            if (!onFreeItem) setFreeItem(null);
          }}
          dropLabel={t("dropHere")}
          onDropBlock={(key, index) => {
            const kind = blockKinds.find((k) => k.key === key);
            if (kind) addBlock(kind, index);
          }}
        >
          {page.type === "link" ? (
            <div className="text-muted flex h-[400px] items-center justify-center p-10 text-center" dir="ltr">
              ↗ {page.url || "https://"}
            </div>
          ) : (
            <SiteRender
              {...renderProps}
              editing
              selectedBlockId={selected}
              onText={reorder ? undefined : onText}
              renderFree={reorder ? undefined : renderFree}
              onSiteText={reorder ? undefined : onSiteText}
              typeHere={t("typeHere")}
            />
          )}
        </Canvas>
      </div>

      {upsell && (
        <Modal
          open
          onClose={() => setUpsell(null)}
          title={t("proBlock.title")}
          closeLabel={t("closePreview")}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  addBlock(upsell.kind, upsell.at, true);
                  setUpsell(null);
                }}
              >
                {t("proBlock.try")}
              </Button>
              <a href="/upgrade" className={buttonClasses("lime", "md")}>
                {t("proBlock.upgrade")}
              </a>
            </div>
          }
        >
          <p className="text-ink-soft text-[14px]">{t("proBlock.text", { block: t(`blocks.${upsell.kind.key}`) })}</p>
        </Modal>
      )}

      {picker && (
        <MediaPicker
          open
          kind={picker.kind}
          media={media}
          onClose={() => setPicker(null)}
          onUploaded={(m) => setMedia((all) => ({ ...all, [m.id]: m }))}
          onPick={(id) => {
            picker.done(id);
            setPicker(null);
          }}
        />
      )}

      {preview && (
        <div
          className={cx("fixed inset-0 z-[60] overflow-auto", device === "desktop" ? "bg-white" : "bg-[#ECECE8]")}
          role="dialog"
          aria-modal="true"
          aria-label={t("preview")}
          onKeyDown={(e) => e.key === "Escape" && setPreview(false)}
        >
          <div
            className={cx("min-h-full", device !== "desktop" && "mx-auto my-6 overflow-hidden rounded-[10px] shadow-[0_2px_24px_rgba(20,20,20,.12)]")}
            style={device === "desktop" ? undefined : { width: WIDTHS[device], maxWidth: "100%" }}
            data-testid="preview"
          >
            <SiteRender {...renderProps} />
          </div>
          <div className="bg-ink shadow-float fixed bottom-5 start-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-pill p-1.5 ring-1 ring-white/20 rtl:translate-x-1/2">
            {(["desktop", "tablet", "phone"] as Device[]).map((d) => (
              <button
                key={d}
                type="button"
                aria-label={t(d)}
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={cx(
                  "flex size-9 items-center justify-center rounded-full",
                  device === d ? "bg-lime text-on-lime" : "text-white/70 hover:text-white",
                )}
              >
                <Icon name={d === "phone" ? "mobile" : d} size={18} />
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-white/20" />
            <button
              type="button"
              autoFocus
              onClick={() => setPreview(false)}
              className="flex h-9 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-semibold text-white hover:bg-white/10"
            >
              <Icon name="close" size={16} />
              {t("closePreview")}
            </button>
          </div>
        </div>
      )}

      {tips && (
        <Tips
          onDone={() => {
            setTips(false);
            void editorTipsSeen();
          }}
        />
      )}
    </div>
  );
}
