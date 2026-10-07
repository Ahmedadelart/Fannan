"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { useToast } from "@/components/ui/Toast";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { blockKinds, newId, type BlockKind } from "@/lib/site/blocks";
import type { Block, SiteDraft } from "@/lib/site/types";
import { editorTipsSeen, publishSite, savePagePassword, saveSiteDraft } from "./actions";
import { BlockSettings, BlocksTab, MediaPicker, PagesTab, StyleTab, type MediaKind } from "./Panels";

type Device = "desktop" | "tablet" | "phone";
const WIDTHS: Record<Device, number> = { desktop: 1200, tablet: 820, phone: 390 };
const HISTORY = 60;

/* ---------- canvas: the real site at device width, shrunk to fit ---------- */

function Canvas({
  width,
  children,
  onPick,
  onDropBlock,
  dropLabel,
}: {
  width: number;
  children: React.ReactNode;
  onPick: (blockId: string | null) => void;
  onDropBlock: (kindKey: string, index: number) => void;
  dropLabel: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(600);
  const [dropAt, setDropAt] = useState<{ index: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      const s = Math.min(1, (o.clientWidth - 48) / width);
      setScale(s);
      setHeight(i.scrollHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width]);

  function insertionPoint(e: DragEvent) {
    const blocks = [...(inner.current?.querySelectorAll<HTMLElement>("[data-block-id]") ?? [])];
    const box = inner.current!.getBoundingClientRect();
    let index = blocks.length;
    let y = blocks.length ? blocks[blocks.length - 1].getBoundingClientRect().bottom : box.top + 40;
    for (let n = 0; n < blocks.length; n++) {
      const r = blocks[n].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        index = n;
        y = r.top;
        break;
      }
    }
    return { index, y: (y - box.top) / scale };
  }

  return (
    <div ref={outer} className="flex-1 overflow-auto bg-[#ECECE8] px-6 py-6" data-tip="canvas">
      <div
        className="relative mx-auto"
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
      >
        <div
          ref={inner}
          data-testid="canvas"
          className="absolute start-0 top-0 origin-top-left overflow-hidden rounded-[6px] bg-white shadow-[0_1px_3px_rgba(20,20,20,.08)] rtl:origin-top-right"
          style={{ width, transform: `scale(${scale})`, minHeight: 600 }}
          onClick={(e: MouseEvent) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
            onPick(el?.dataset.blockId ?? null);
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
      const el = document.querySelector<HTMLElement>(`[data-tip="${target}"]`);
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
      aria-label={t.rich(String(n) as "1", bold) as string}
    >
      <div className="bg-ink/45 absolute inset-0" />
      {rect && (
        <div
          className="absolute rounded-md shadow-[0_0_0_2px_var(--color-ink),0_0_0_6px_var(--color-lime)]"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: Math.min(rect.height + 8, 360),
          }}
        />
      )}
      <div
        className="bg-paper text-ink shadow-float absolute flex w-[300px] flex-col gap-3 rounded-lg p-4"
        style={
          rect
            ? {
                left: Math.min(
                  Math.max(
                    16,
                    rect.left + (target === "publish" ? rect.width - 300 : target === "canvas" ? 40 : rect.width + 16),
                  ),
                  window.innerWidth - 316,
                ),
                top: target === "publish" ? rect.bottom + 16 : rect.top + 40,
              }
            : { left: 16, top: 80 }
        }
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
}: {
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
  const [media, setMedia] = useState(initialMedia);
  const [pageId, setPageId] = useState(initialDraft.pages[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"blocks" | "style" | "pages">("blocks");
  const [device, setDevice] = useState<Device>("desktop");
  // Phones and small tablets: the side panels slide in over the canvas.
  const [drawer, setDrawer] = useState<"left" | "right" | null>(null);
  const small = () => window.matchMedia("(max-width: 1023px)").matches;
  // On a phone, start with the phone preview.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 640px)").matches) setDevice("phone");
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [dirty, setDirty] = useState(published.dirty);
  const [version, setVersion] = useState(published.version);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);
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

  function addBlock(kind: BlockKind, at?: number) {
    const b = kind.make(draft.language);
    setBlocks((blocks) => {
      const i = at ?? (selected ? blocks.findIndex((x) => x.id === selected) + 1 : blocks.length);
      const next = [...blocks];
      next.splice(i < 0 ? blocks.length : i, 0, b);
      return next;
    });
    setSelected(b.id);
    if (small()) setDrawer("right");
  }

  function moveBlock(by: number) {
    if (!block) return;
    setBlocks((blocks) => {
      const i = blocks.findIndex((x) => x.id === block.id);
      const j = i + by;
      if (j < 0 || j >= blocks.length) return blocks;
      const next = [...blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

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
  return (
    <div className="text-ink flex h-dvh flex-col bg-[#ECECE8]">
      {/* Top bar */}
      <header className="border-line bg-paper flex flex-wrap items-center gap-3.5 border-b px-[18px] py-2.5">
        <a href="/" aria-label={t("back")} className="flex items-center gap-2">
          <Logo lang={locale} size={20} short />
        </a>
        <span className="bg-line h-6 w-px" />
        <label className="text-muted flex items-center gap-2 text-[13px]">
          {t("page")}
          <select
            className="border-line bg-paper text-ink h-9 rounded-[8px] border px-2.5 font-semibold"
            value={page.id}
            onChange={(e) => {
              setPageId(e.target.value);
              setSelected(null);
            }}
          >
            {draft.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-[1_1_200px] items-center justify-center gap-2.5">
          <div className="bg-mist flex gap-0.5 rounded-[10px] p-[3px]" role="radiogroup" aria-label={t("preview")}>
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
                  "flex h-8 w-10 items-center justify-center rounded-[8px]",
                  device === d ? "bg-paper shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-muted",
                )}
              >
                <Icon name={d === "phone" ? "mobile" : d} size={18} />
              </button>
            ))}
          </div>
          <IconButton icon="undo" label={t("undo")} size="sm" disabled={historySize.past === 0} onClick={undo} />
          <IconButton icon="redo" label={t("redo")} size="sm" disabled={historySize.future === 0} onClick={redo} />
        </div>
        <span className="text-muted text-[12px]" role="status" data-testid="editor-status">
          {status}
        </span>
        <Button variant="outline" icon="preview" onClick={() => setPreview(true)}>
          {t("preview")}
        </Button>
        <span data-tip="publish">
          <Button icon="publish" onClick={doPublish} disabled={publishing || (!dirty && version !== null)}>
            {publishing ? t("publishing") : t("publish")}
          </Button>
        </span>
      </header>

      {/* Small screens: open the panels from here */}
      <div className="border-line bg-paper flex items-center gap-1.5 overflow-x-auto border-b px-3 py-2 lg:hidden">
        {(["blocks", "style", "pages"] as const).map((x) => (
          <Button
            key={x}
            size="sm"
            variant={drawer === "left" && tab === x ? "primary" : "outline"}
            onClick={() => {
              setTab(x);
              setDrawer(drawer === "left" && tab === x ? null : "left");
            }}
          >
            {t(`tabs.${x}`)}
          </Button>
        ))}
        {block && (
          <Button
            size="sm"
            variant={drawer === "right" ? "primary" : "lime"}
            onClick={() => setDrawer(drawer === "right" ? null : "right")}
          >
            {t("editBlock")}
          </Button>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {drawer && (
          <div className="bg-ink/30 absolute inset-0 z-20 lg:hidden" onClick={() => setDrawer(null)} aria-hidden />
        )}
        {/* Left panel */}
        <aside
          className={cx(
            "border-line bg-paper flex w-[300px] min-w-[260px] flex-none flex-col overflow-y-auto border-e",
            "max-lg:shadow-float max-lg:absolute max-lg:inset-y-0 max-lg:start-0 max-lg:z-30 max-lg:w-[min(320px,88vw)]",
            drawer !== "left" && "max-lg:hidden",
          )}
          data-testid="left-panel"
        >
          <nav
            aria-label={t("tabs.blocks")}
            className="border-line bg-paper sticky top-0 z-10 grid grid-cols-3 border-b px-3"
            role="tablist"
          >
            {(["blocks", "style", "pages"] as const).map((x) => (
              <button
                key={x}
                type="button"
                role="tab"
                aria-selected={tab === x}
                onClick={() => setTab(x)}
                className={cx(
                  "h-11 border-b-2 text-[14px]",
                  tab === x ? "border-ink text-ink font-semibold" : "text-muted border-transparent font-medium",
                )}
              >
                {t(`tabs.${x}`)}
              </button>
            ))}
          </nav>
          {tab === "blocks" && <BlocksTab onAdd={(k) => addBlock(k)} />}
          {tab === "style" && (
            <StyleTab
              draft={draft}
              media={media}
              setDraft={setDraft}
              openPicker={(kind, done) => setPicker({ kind, done })}
            />
          )}
          {tab === "pages" && (
            <PagesTab
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
          )}
        </aside>

        {/* Canvas */}
        <Canvas
          width={WIDTHS[device]}
          onPick={(id) => {
            setSelected(id);
            if (id && small()) setDrawer("right");
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
            <SiteRender {...renderProps} editing selectedBlockId={selected} />
          )}
        </Canvas>

        {/* Right panel */}
        <aside
          className={cx(
            "border-line bg-paper flex w-[300px] flex-none flex-col gap-4 overflow-y-auto border-s p-4 max-xl:w-[280px]",
            "max-lg:shadow-float max-lg:absolute max-lg:inset-y-0 max-lg:end-0 max-lg:z-30 max-lg:w-[min(340px,92vw)]",
            drawer !== "right" && "max-lg:hidden",
          )}
          data-testid="right-panel"
          aria-label={t("noBlock")}
        >
          {block ? (
            <>
              <BlockSettings
                key={block.id}
                block={block}
                media={media}
                categories={categories}
                openPicker={(kind, done) => setPicker({ kind, done })}
                update={(patch, key) =>
                  setBlocks((blocks) => blocks.map((b) => (b.id === block.id ? ({ ...b, ...patch } as Block) : b)), key)
                }
              />
              <div className="border-line flex flex-wrap gap-1.5 border-t pt-3">
                <Button size="sm" variant="outline" icon="undo" onClick={() => moveBlock(-1)}>
                  {t("blockActions.up")}
                </Button>
                <Button size="sm" variant="outline" icon="redo" onClick={() => moveBlock(1)}>
                  {t("blockActions.down")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon="add"
                  onClick={() => {
                    const copy = { ...structuredClone(block), id: newId() };
                    setBlocks((blocks) => {
                      const i = blocks.findIndex((x) => x.id === block.id);
                      const next = [...blocks];
                      next.splice(i + 1, 0, copy);
                      return next;
                    });
                    setSelected(copy.id);
                  }}
                >
                  {t("blockActions.duplicate")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon="delete"
                  onClick={() => {
                    setBlocks((blocks) => blocks.filter((b) => b.id !== block.id));
                    setSelected(null);
                  }}
                >
                  {t("blockActions.remove")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted">{page.blocks.length ? t("noBlock") : t("emptyPage")}</p>
          )}
        </aside>
      </div>

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
          className="fixed inset-0 z-40 flex flex-col bg-[#ECECE8]"
          role="dialog"
          aria-modal="true"
          aria-label={t("preview")}
        >
          <div className="border-line bg-paper flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <div className="bg-mist flex gap-0.5 rounded-[10px] p-[3px]">
              {(["desktop", "tablet", "phone"] as Device[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={t(d)}
                  aria-pressed={device === d}
                  onClick={() => setDevice(d)}
                  className={cx(
                    "flex h-8 w-10 items-center justify-center rounded-[8px]",
                    device === d ? "bg-paper" : "text-muted",
                  )}
                >
                  <Icon name={d === "phone" ? "mobile" : d} size={18} />
                </button>
              ))}
            </div>
            <Button variant="outline" icon="close" onClick={() => setPreview(false)}>
              {t("closePreview")}
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div
              className="mx-auto overflow-hidden rounded-[6px] bg-white"
              style={{ width: Math.min(WIDTHS[device], 1400), maxWidth: "100%" }}
              data-testid="preview"
            >
              <SiteRender {...renderProps} />
            </div>
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
