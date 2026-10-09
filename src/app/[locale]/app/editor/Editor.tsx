"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
import { addFreeItem, ITEM_GROUPS } from "@/lib/site/free";
import { FreeEditor, KIND_ICONS } from "@/components/editor/FreeEditor";
import { LanguageButton, LogoutButton } from "../(dash)/DashClient";
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

/** The left rail. Native panels: blocks, design, projects (list). The rest open app pages in a wide panel. */
type Rail = "home" | "blocks" | "projects" | "design" | "messages" | "stats" | "settings" | "upgrade";
const RAILS: Rail[] = ["home", "blocks", "projects", "design", "messages", "stats", "settings", "upgrade"];
function embedPath(rail: Rail, projectId: string | null): string | null {
  if (rail === "projects") return projectId ? `/projects/${projectId}` : null;
  return { home: "/home", messages: "/messages", stats: "/stats", settings: "/settings", upgrade: "/upgrade" }[
    rail as "home"
  ] ?? null;
}
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
}: {
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
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  // Squarespace-style: the section's tools sit just above its top end corner (inside it when
  // there's no room above), and "Add section" just under its bottom start corner.
  const toolsTop = (b: NonNullable<typeof box>) => (b.top >= 48 ? b.top - 46 : b.top + 8);
  const endAnchor = (b: NonNullable<typeof box>) =>
    rtl ? { left: b.left } : { left: b.left + b.width, transform: "translateX(-100%)" };
  const startAnchor = (b: NonNullable<typeof box>) =>
    rtl ? { left: b.left + b.width, transform: "translateX(-100%)" } : { left: b.left };
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
    <div ref={outer} className={cx("bg-mist flex-1 overflow-auto", fluid ? "pt-12 pb-20" : "px-6 py-6")} data-tip="canvas">
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

        {/* Under a selected free-form section: Layers (drawn by the section itself), then Add item. */}
        {box && !reorder && !dragging && onAddElement && (
          <div
            className="absolute z-20 flex items-start gap-1.5"
            style={{ top: box.top + box.height + 10, ...startAnchor(box), marginInlineStart: 44 }}
          >
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
                          <div className="grid grid-cols-2 gap-0.5">
                            {shown.map((k) => (
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
                            ))}
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
              top: Math.max(0, Math.min(toolsTop(box) + 48 + cardShift.y, height - 120)),
              left: Math.max(0, Math.min(popLeft(box) + cardShift.x, width * scale - 288)),
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
              <button
                type="button"
                aria-label={t("close")}
                className="text-muted hover:text-ink hover:bg-mist flex size-7 items-center justify-center rounded-full"
                onClick={onCloseSettings}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="fannan-compact overflow-y-auto p-3">{settings}</div>
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
  account,
}: {
  /** The account menu and the Messages dot. */
  account: { name: string; admin: boolean; pro: boolean; unread: number; deletionPending: boolean };
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
  const [rail, setRail] = useState<Rail>("blocks");
  // A project opened from the Projects panel (shown in the wide panel).
  const [projectId, setProjectId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const router = useRouter();
  const embed = embedPath(rail, projectId);
  // Pages opened in the wide panel can change projects and media: the preview catches up when it closes.
  const wasEmbedded = useRef(false);
  useEffect(() => {
    if (embed) wasEmbedded.current = true;
    else if (wasEmbedded.current) {
      wasEmbedded.current = false;
      router.refresh();
    }
  }, [embed, router]);
  // Media added in a project shows up in the editor once the page data refreshes.
  const [mediaFrom, setMediaFrom] = useState(initialMedia);
  if (mediaFrom !== initialMedia) {
    setMediaFrom(initialMedia);
    setMedia((m) => ({ ...initialMedia, ...m }));
  }
  // /editor?panel=messages (and so on) opens that panel: links in emails and old bookmarks.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const q = new URLSearchParams(window.location.search);
      const panel = q.get("panel") as Rail | null;
      if (panel && RAILS.includes(panel)) {
        setRail(panel);
        setPanelOpen(true);
        if (panel === "projects" && q.get("id")) setProjectId(q.get("id"));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
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
      onEditItem={(id) => {
        setSelected(b.id);
        setFreeItem(id);
        setSettingsOpen(true);
      }}
      extras={{ social: siteSettings.social, projects }}
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
    social: siteSettings.social,
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
    { id: "home", icon: "dashboard", label: t("rail.home"), short: t("rail.home") },
    { id: "blocks", icon: "site-editor", label: t("rail.blocks"), short: t("rail.pages") },
    { id: "projects", icon: "projects", label: t("rail.projects"), short: t("rail.projects") },
    { id: "design", icon: "palette", label: t("rail.design"), short: t("rail.design") },
    { id: "messages", icon: "messages", label: t("rail.messages"), short: t("rail.messages") },
    { id: "stats", icon: "stats", label: t("rail.stats"), short: t("rail.stats") },
    { id: "settings", icon: "settings", label: t("rail.settings"), short: t("rail.settings") },
  ] as const;
  const openRail = (id: Rail) => {
    if (rail === id && panelOpen && !(id === "projects" && projectId)) return setPanelOpen(false);
    setRail(id);
    if (id === "projects") setProjectId(null);
    setPanelOpen(true);
  };
  // Material 3 navigation rail: an icon in a pill (lime when active) with a short label under it.
  const railTool = "group relative flex w-full flex-col items-center gap-1 py-0.5 text-[#C6C8BA] hover:text-[#E3E4D9]";
  const railPill = (on: boolean) =>
    cx(
      "flex h-8 w-14 items-center justify-center rounded-pill transition-colors",
      on ? "bg-lime text-on-lime" : "group-hover:bg-white/8",
    );
  const railLabel = (on: boolean) =>
    cx("max-w-[76px] truncate text-[11px] leading-tight", on ? "font-semibold text-[#E3E4D9]" : "font-medium");
  const partSettings =
    selected === "__header" || selected === "__footer" ? (
      <SitePartSettings
        key={selected}
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
      projects={projects}
    />
  ) : null);

  return (
    <div className="text-ink bg-surface relative flex h-dvh">
      {/* Navigation rail (Material 3, dark like Carbonmade). */}
      <nav
        aria-label={t("rail.label")}
        className="relative z-40 flex w-20 flex-none flex-col items-center gap-2.5 bg-[#12140E] py-3"
      >
        <button
          type="button"
          onClick={() => openRail("home")}
          aria-label={t("rail.home")}
          className="mb-2 flex size-11 items-center justify-center rounded-[14px] bg-white/10"
        >
          <span className="font-heading font-heading-weight text-lime text-[18px] leading-none">{locale === "ar" ? "ف" : "f"}</span>
        </button>
        {railItems.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-label={r.label}
            aria-pressed={rail === r.id && panelOpen}
            data-tip={r.id === "blocks" ? "rail-blocks" : undefined}
            className={railTool}
            onClick={() => openRail(r.id)}
          >
            <span className={railPill(rail === r.id && panelOpen)}>
              <Icon name={r.icon} size={20} />
            </span>
            {r.id === "messages" && account.unread > 0 && (
              <span className="bg-lime absolute end-4 top-0 size-2.5 rounded-full ring-2 ring-[#12140E]" data-testid="unread-dot" />
            )}
            <span aria-hidden className={railLabel(rail === r.id && panelOpen)}>
              {r.short}
            </span>
          </button>
        ))}
        <span className="flex-1" />
        <a href={locale === "ar" ? "https://fannan.net/ar/help" : "https://fannan.net/help"} target="_blank" rel="noreferrer" className={railTool} aria-label={t("rail.help")}>
          <span className={railPill(false)}>
            <Icon name="help" size={20} />
          </span>
          <span aria-hidden className={railLabel(false)}>
            {t("rail.help")}
          </span>
        </a>
        {/* The account: plan, language, admin (admins only), sign out. */}
        <div className="relative">
          <button
            type="button"
            aria-label={t("account.label")}
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
            className="bg-lime text-on-lime mt-1 flex size-9 items-center justify-center rounded-full text-[14px] font-bold"
            data-testid="account-button"
          >
            {(account.name || "?").trim().charAt(0).toUpperCase()}
          </button>
          {accountOpen && (
            <div
              role="menu"
              className="bg-paper text-ink shadow-float border-line absolute bottom-0 start-12 z-50 flex w-[240px] flex-col gap-1 rounded-[14px] border p-2"
            >
              <span className="text-muted truncate px-2.5 pt-1 pb-2 text-[12px]">{account.name}</span>
              <button
                type="button"
                role="menuitem"
                className="hover:bg-mist flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-start text-[14px] font-semibold"
                onClick={() => {
                  setAccountOpen(false);
                  openRail("upgrade");
                }}
              >
                <Icon name="publish" size={18} />
                {account.pro ? t("account.addTime") : t("account.goPro")}
              </button>
              {account.admin && (
                <a
                  role="menuitem"
                  href="/admin"
                  className="hover:bg-mist flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-semibold"
                >
                  <Icon name="password" size={18} />
                  {t("account.admin")}
                </a>
              )}
              <div className="border-line mt-1 flex items-center justify-between gap-2 border-t px-2.5 pt-2.5 pb-1">
                <LanguageButton locale={locale} label={td("language")} />
                <LogoutButton label={td("logout")} />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* The panel next to the rail (dark). On small screens it floats; tapping outside closes it. */}
      {panelOpen && (
        <div
          aria-hidden
          data-testid="panel-backdrop"
          className="bg-ink/30 absolute inset-y-0 start-20 end-0 z-20 lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
      {panelOpen && (
        <aside
          className={cx(
            "border-line flex flex-none flex-col border-e",
            embed
              ? "bg-mist w-[min(780px,60vw)] max-lg:w-[calc(100vw-80px)]"
              : "fannan-dark bg-paper text-ink w-[300px] overflow-y-auto max-lg:w-[min(320px,calc(100vw-80px))]",
            "max-lg:shadow-float max-lg:absolute max-lg:inset-y-0 max-lg:start-20 max-lg:z-30",
          )}
          data-testid="left-panel"
          data-panel={rail}
        >
          {embed && (
            <>
              {/* Home, projects, messages, stats, settings and Pro, opened right here. */}
              <div className="bg-paper border-line flex h-12 flex-none items-center justify-between gap-2 border-b ps-4 pe-2">
                <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
                  {rail === "projects" && projectId && (
                    <button
                      type="button"
                      aria-label={t("projectsPanel.back")}
                      onClick={() => setProjectId(null)}
                      className="hover:bg-mist -ms-2 flex size-8 items-center justify-center rounded-full"
                    >
                      <Icon name="arrow-left" size={18} className="rtl:-scale-x-100" />
                    </button>
                  )}
                  <span className="truncate">{rail === "projects" ? t("rail.projects") : t(`rail.${rail}`)}</span>
                </span>
                <button
                  type="button"
                  aria-label={t("section.close")}
                  onClick={() => setPanelOpen(false)}
                  className="hover:bg-mist flex size-8 items-center justify-center rounded-full"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <iframe
                key={embed}
                src={embed}
                title={t(`rail.${rail}`)}
                className="min-h-0 w-full flex-1 border-0"
                data-testid="panel-frame"
              />
            </>
          )}
          {rail === "blocks" && (
            <>
              <div className="px-3 pt-3">
                <button
                  type="button"
                  aria-expanded={pagesOpen}
                  onClick={() => setPagesOpen(!pagesOpen)}
                  className="bg-surface flex w-full items-center justify-between rounded-[16px] px-4 py-2.5 text-start"
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

          {rail === "projects" && !projectId && (
            <ProjectsPanel
              projects={projects}
              media={media}
              onOpen={(id) => {
                setProjectId(id);
                router.refresh();
              }}
            />
          )}
        </aside>
      )}

      {/* The preview, with a slim bar on top. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {account.deletionPending && (
          <button
            type="button"
            role="alert"
            onClick={() => openRail("settings")}
            className="bg-lime text-on-lime mx-3 mt-2.5 rounded-[12px] px-4 py-2.5 text-start text-[14px] font-semibold md:mx-4"
          >
            {td("deletionPending")}
          </button>
        )}
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
                reorder ? "bg-secondary-container text-on-secondary-container" : "bg-paper text-ink hover:bg-white",
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
                    device === d ? "bg-secondary-container text-on-secondary-container" : "text-muted hover:text-ink",
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
          fluid={device === "desktop"}
          selectedId={selected}
          reorder={reorder}
          actions={sectionActions}
          version={page.blocks}
          settings={blockSettings}
          settingsOpen={settingsOpen}
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
