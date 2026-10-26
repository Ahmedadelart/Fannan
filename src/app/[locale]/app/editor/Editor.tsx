"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlays";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { blockKinds, imagesBlock, kindOf, networkName, newId, type BlockKind } from "@/lib/site/blocks";
import { sampleTone } from "@/lib/site/samples";
import { setPath } from "@/lib/site/fields";
import { hasOwnPage } from "@/lib/site/pages";
import { normalizeFooter } from "@/lib/site/normalize";
import { moveTo } from "@/components/editor/sortDrag";
import { getClip, mod, setClip, typing } from "@/components/editor/clipboard";
import type { Block, BlockOf, Crop, DrawStroke, SiteDraft } from "@/lib/site/types";
import { addFreeItem } from "@/lib/site/free";
import { DoodlePanel, defaultTools, finishSession, startSession, type DoodleSession, type DoodleTools } from "@/components/editor/doodle";
import { FreeEditor } from "@/components/editor/FreeEditor";
import { PicTools, type PicTarget } from "@/components/editor/PicTools";
import { TextToolbar } from "@/components/editor/TextToolbar";
import { watchLoops } from "@/components/site/loops";
import { LanguageButton, LogoutButton } from "../(dash)/DashClient";
import { SiteEnhancer } from "@/components/site/live/SiteEnhancer";
import { editorTipsSeen, publishSite, savePagePassword, saveSiteDraft } from "./actions";
import { StyleTab, type DesignSection } from "./_design/StyleTab";
import { BlockSettings } from "./_inspector/BlockSettings";
import { SitePartSettings, type EditorSiteSettings } from "./_inspector/SitePartSettings";
import { BlocksTab } from "./_library/BlocksTab";
import { PagesTab } from "./_pages/PagesTab";
import { ProjectsPanel } from "./_projects/ProjectsPanel";
import { MediaPicker, type MediaKind } from "./_ui/media";
import { Canvas, type SectionActions } from "./_canvas/Canvas";
import { PreviewContact } from "./_canvas/PreviewContact";
import { Tips } from "./_shell/Tips";

type Device = "desktop" | "tablet" | "phone";

/** The left rail. Native panels: blocks, design, projects (list). The rest open app pages in a wide panel. */
type Rail = "home" | "blocks" | "projects" | "design" | "doodle" | "messages" | "stats" | "settings" | "upgrade";
const RAILS: Rail[] = ["home", "blocks", "projects", "design", "doodle", "messages", "stats", "settings", "upgrade"];
function embedPath(rail: Rail, projectId: string | null): string | null {
  if (rail === "projects") return projectId ? `/projects/${projectId}` : null;
  return { home: "/home", messages: "/messages", stats: "/stats", settings: "/settings", upgrade: "/upgrade" }[
    rail as "home"
  ] ?? null;
}
const WIDTHS: Record<Device, number> = { desktop: 1200, tablet: 820, phone: 390 };
const HISTORY = 60;

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
  account: { name: string; admin: boolean; pro: boolean; unread: number; deletionPending: boolean; siteUrl: string; shortBase: string; helpUrl: string };
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
      // Just built by the guided setup (round 8).
      if (q.get("ready")) {
        toast(t("guideReady"), "check");
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [panelTab, setPanelTab] = useState<"blocks" | "page">("blocks");
  const [pagesOpen, setPagesOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState<DesignSection | null>("styles");
  const [panelOpen, setPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Round 17 (Carbonmade-style): a section's settings open in the side panel, so they never cover
  // the section being changed. The artist can pop them out as a card they move (and that choice stays).
  const [cardFloat, setCardFloat] = useState(false);
  const [wide, setWide] = useState(true);
  // Phones: a tapped section's actions slide up from the bottom (round 18).
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const p = window.matchMedia("(max-width: 640px)");
    const on = () => {
      setWide(q.matches);
      setPhone(p.matches);
    };
    const frame = requestAnimationFrame(() => {
      on();
      try {
        setCardFloat(localStorage.getItem("fannan.cardFloat") === "1");
      } catch {
        /* storage blocked: docked */
      }
    });
    q.addEventListener("change", on);
    p.addEventListener("change", on);
    return () => {
      cancelAnimationFrame(frame);
      q.removeEventListener("change", on);
      p.removeEventListener("change", on);
    };
  }, []);
  const floatCard = (v: boolean) => {
    setCardFloat(v);
    try {
      localStorage.setItem("fannan.cardFloat", v ? "1" : "0");
    } catch {
      /* fine */
    }
  };
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
  // Undo and redo stay off while previewing: the preview shows the site as visitors see it.
  const previewing = useRef(false);
  useEffect(() => {
    previewing.current = preview;
  }, [preview]);
  // The page shown in the preview (its links switch it without changing the page being edited).
  const [previewPage, setPreviewPage] = useState(initialDraft.pages[0].id);
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
      if (typing(e) || !mod(e) || previewing.current) return;
      const k = e.key.toLowerCase();
      // Undo: Ctrl+Z. Redo: Ctrl+Shift+Z or Ctrl+Y.
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
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

  // Round 18: Settings (open in the wide panel) says what it changed. The editor follows without making
  // it an undo step, and the autosave never writes the language back (Settings owns it).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const m = e.data as { fannan?: string; panel?: string; language?: string; social?: EditorSiteSettings["social"]; cvMediaId?: string | null };
      if (m?.fannan === "changed") {
        if (m.language === "en" || m.language === "ar") {
          const language: Locale = m.language;
          const fix = (d: SiteDraft): SiteDraft => ({ ...d, language });
          past.current = past.current.map(fix);
          future.current = future.current.map(fix);
          latest.current = fix(latest.current);
          setDraftState(latest.current);
          setDirty(true);
        }
        if (m.social || "cvMediaId" in m)
          setSiteSettings((cur) => ({
            ...cur,
            ...(m.social ? { social: m.social } : {}),
            ...("cvMediaId" in m ? { cvMediaId: m.cvMediaId ?? null } : {}),
          }));
      } else if (m?.fannan === "open" && RAILS.includes(m.panel as Rail)) {
        setSettingsOpen(false);
        setFreeItem(null);
        setRail(m.panel as Rail);
        setPanelOpen(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* ---------- keyboard shortcuts for sections, saving and help ---------- */

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const sectionKeys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const on = (e: KeyboardEvent) => sectionKeys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  /* ---------- blocks ---------- */

  const setBlocks = (fn: (blocks: Block[]) => Block[], key?: string) =>
    setDraft(
      (d) => ({ ...d, pages: d.pages.map((p) => (p.id === page.id ? { ...p, blocks: fn(p.blocks) } : p)) }),
      key,
    );

  // A Free artist picking a Pro showpiece block: explain first, let them try it.
  const [upsell, setUpsell] = useState<{ kind: BlockKind; at?: number } | null>(null);

  // Round 18: "Add section" above or below a section: the library opens and a line shows the spot.
  const [insertAt, setInsertAt] = useState<number | null>(null);

  function addBlock(kind: BlockKind, at?: number, confirmed = false) {
    const spot = at ?? insertAt ?? undefined;
    if (kind.pro && !isPro && !confirmed) return setUpsell({ kind, at: spot });
    const b = kind.make(draft.language);
    setBlocks((blocks) => {
      const i = spot ?? (selected ? blocks.findIndex((x) => x.id === selected) + 1 : blocks.length);
      const next = [...blocks];
      next.splice(i < 0 ? blocks.length : i, 0, b);
      return next;
    });
    setInsertAt(null);
    // Ahmed (round 18): a new section opens straight into Edit section.
    setSelected(b.id);
    setFreeItem(null);
    setSettingsOpen(true);
    if (small()) setPanelOpen(false);
  }

  function duplicateBlock(id = block?.id) {
    const original = page.blocks.find((b) => b.id === id);
    if (!original) return;
    const copy = { ...structuredClone(original), id: newId() };
    if (copy.type === "free") copy.items = copy.items.map((i) => ({ ...i, id: newId() }));
    setBlocks((blocks) => {
      const i = blocks.findIndex((x) => x.id === original.id);
      const next = [...blocks];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setSelected(copy.id);
  }

  /** Removes a section; the message that follows has an Undo button (Ctrl+Z works too). */
  function removeBlock(id = block?.id, quiet = false) {
    const at = page.blocks.findIndex((b) => b.id === id);
    if (at < 0) return;
    const gone = page.blocks[at];
    const pageOf = page.id;
    setBlocks((blocks) => blocks.filter((b) => b.id !== gone.id));
    if (selected === gone.id) {
      setSelected(null);
      setSettingsOpen(false);
      setFreeItem(null);
    }
    if (quiet) return;
    toast(t("section.removed"), "delete", {
      label: t("section.undo"),
      run: () =>
        setDraft((d) => ({
          ...d,
          pages: d.pages.map((p) =>
            p.id !== pageOf || p.blocks.some((b) => b.id === gone.id)
              ? p
              : { ...p, blocks: [...p.blocks.slice(0, at), gone, ...p.blocks.slice(at)] },
          ),
        })),
    });
  }

  sectionKeys.current = (e: KeyboardEvent) => {
    // Escape inside the side panel's settings closes them, even from a text box (round 17).
    if (e.key === "Escape" && settingsOpen && (e.target as HTMLElement | null)?.closest?.('[data-testid="left-panel"]')) {
      setSettingsOpen(false);
      setFreeItem(null);
      return;
    }
    // Nothing on the page changes from the keyboard while the preview is open.
    if (typing(e) || preview) return;
    const k = e.key.toLowerCase();
    if (mod(e) && k === "s") {
      // Ctrl+S: save now (the editor also saves by itself).
      e.preventDefault();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void persist().then(() => toast(t("saved"), "check"));
      return;
    }
    if (e.key === "?" && !mod(e)) {
      setShortcutsOpen(true);
      return;
    }
    // Items inside a free-form section have their own shortcuts (FreeEditor).
    if (freeItem || document.querySelector('[data-testid="free-group"]')) return;
    if (e.key === "Escape" && selected) {
      setSelected(null);
      setSettingsOpen(false);
      return;
    }
    const clip = getClip();
    if (mod(e) && k === "v" && clip?.kind === "section") {
      e.preventDefault();
      const copy = { ...structuredClone(clip.block), id: newId() } as Block;
      if (copy.type === "free") copy.items = copy.items.map((i) => ({ ...i, id: newId() }));
      setBlocks((blocks) => {
        const i = selected ? blocks.findIndex((x) => x.id === selected) + 1 : blocks.length;
        const next = [...blocks];
        next.splice(i <= 0 ? blocks.length : i, 0, copy);
        return next;
      });
      setSelected(copy.id);
      toast(t("pasted"), "check");
      return;
    }
    if (!block || reorder) return;
    if (mod(e) && (k === "c" || k === "x")) {
      e.preventDefault();
      setClip({ kind: "section", block });
      if (k === "x") removeBlock(block.id, true);
      toast(k === "x" ? t("cut") : t("copied"), "duplicate");
    } else if (mod(e) && k === "d") {
      e.preventDefault();
      duplicateBlock();
    } else if ((e.key === "Delete" || e.key === "Backspace") && !mod(e)) {
      e.preventDefault();
      removeBlock();
    }
  };

  const sectionActions: SectionActions = {
    move: (id, index) => setBlocks((blocks) => moveTo(blocks, id, index)),
    edit: (id) => {
      setSelected(id);
      setFreeItem(null);
      setInsertAt(null);
      setSettingsOpen(true);
    },
    addAt: (index) => {
      setInsertAt(index);
      setSettingsOpen(false);
      setFreeItem(null);
      setRail("blocks");
      setPanelTab("blocks");
      setPanelOpen(true);
    },
    duplicate: (id) => duplicateBlock(id),
    remove: (id) => removeBlock(id),
  };
  // The line only shows while the library is open to fill it.
  const insertShown = insertAt !== null && panelOpen && rail === "blocks" && panelTab === "blocks" && !settingsOpen ? insertAt : null;
  const sectionName = (id: string) => {
    if (id === "__header") return t("parts.header");
    if (id === "__footer") return t("parts.footer");
    const b = page.blocks.find((x) => x.id === id);
    return b ? t(`blocks.${kindOf(b).key}`) : "";
  };

  /** Round 12: fonts shown on the page while pointing at them in the font picker. */
  const [fontPreview, setFontPreview] = useState<SiteDraft["theme"]["fonts"] | null>(null);

  /** Round 11: drawing right on a free-form section (tools in the Doodle panel, board over the section). */
  const [doodleSession, setDoodleSession] = useState<DoodleSession | null>(null);
  const [doodleTools, setDoodleTools] = useState<DoodleTools>(() => defaultTools(initialDraft.theme.colors.text));
  const [doodleLive, setDoodleLive] = useState<DrawStroke | null>(null);
  const rtl = draft.language === "ar";
  const setSession = useCallback((fn: (s: DoodleSession) => DoodleSession) => setDoodleSession((s) => (s ? fn(s) : s)), []);
  const beginDoodle = (blockId: string, itemId: string | null) => {
    const b = page.blocks.find((x) => x.id === blockId);
    if (!b || b.type !== "free") return;
    setDoodleSession(startSession(b, itemId, rtl));
    setSelected(blockId);
    setFreeItem(null);
    setSettingsOpen(false);
    setRail("doodle");
    setPanelOpen(true);
  };
  const finishDoodle = () => {
    const s = doodleSession;
    if (!s) return;
    changeFree(s.blockId, (b) => finishSession(b, s, rtl, draft.language));
    setDoodleSession(null);
  };
  const cancelDoodle = () => {
    if (doodleSession?.past.length && !window.confirm(t("doodle.discard"))) return;
    setDoodleSession(null);
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
        // Picking something else closes the settings card; it opens again from the pencil.
        if (id !== freeItem || selected !== b.id) setSettingsOpen(false);
        setSelected(b.id);
        setFreeItem(id);
      }}
      onChange={(fn, key) => changeFree(b.id, fn, key)}
      onDrawItem={(id) => beginDoodle(b.id, id)}
      doodle={
        doodleSession && doodleSession.blockId === b.id
          ? { session: doodleSession, setSession, tools: doodleTools, live: doodleLive, setLive: setDoodleLive, onDone: finishDoodle, onCancel: cancelDoodle }
          : null
      }
      onEditItem={(id) => {
        // The pencil opens the item's settings, and closes them again.
        const open = settingsOpen && selected === b.id && freeItem === id;
        setSelected(b.id);
        setFreeItem(id);
        setSettingsOpen(!open);
      }}
      settingsFor={settingsOpen && selected === b.id ? freeItem : null}
      extras={{ social: siteSettings.social, projects }}
      typeHere={t("typeHere")}
    />
  );

  /* ---------- round 13: pictures dropped, replaced or cropped right on the canvas ---------- */

  const canvasWrap = useRef<HTMLDivElement>(null);
  // Loops (GIFs) on the canvas play when they're in view, like on the live site.
  useEffect(() => watchLoops(document), []);
  const splitTarget = (target: PicTarget) => {
    const [blockId, path] = target.split("|");
    return { blockId, path };
  };
  const cropPath = (path: string) => path.replace(/mediaId$/, "crop");
  function placeMedia(target: PicTarget, ids: string[]) {
    const { blockId, path } = splitTarget(target);
    setBlocks((blocks) =>
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        if (path === "+" && b.type === "images") {
          // Fill the sample tiles first, then add the rest.
          const items = [...b.items];
          const rest = [...ids];
          for (let i = 0; i < items.length && rest.length; i++) if (!items[i].mediaId) items[i] = { ...items[i], mediaId: rest.shift()!, crop: undefined };
          return { ...b, items: [...items, ...rest.map((id, n) => ({ id: newId(), mediaId: id, tone: sampleTone(items.length + n), caption: "" }))].slice(0, 60) };
        }
        if (path.startsWith("#") && b.type === "free") {
          return { ...b, items: b.items.map((i) => (i.id === path.slice(1) ? { ...i, mediaId: ids[0], crop: undefined } : i)) };
        }
        const next = setPath(b, path, ids[0]);
        return path.endsWith("mediaId") ? setPath(next, cropPath(path), undefined) : next;
      }),
    );
  }
  function picInfo(target: PicTarget): { mediaId: string | null; crop?: Crop } | null {
    const { blockId, path } = splitTarget(target);
    const b = page.blocks.find((x) => x.id === blockId);
    if (!b) return null;
    if (path.startsWith("#") && b.type === "free") {
      const it = b.items.find((i) => i.id === path.slice(1));
      return it ? { mediaId: it.mediaId, crop: it.crop } : null;
    }
    const get = (p: string) => p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], b);
    const id = get(path);
    return { mediaId: typeof id === "string" ? id : null, crop: get(cropPath(path)) as Crop | undefined };
  }
  function setCrop(target: PicTarget, crop: Crop | undefined) {
    const { blockId, path } = splitTarget(target);
    setBlocks((blocks) =>
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        if (path.startsWith("#") && b.type === "free") return { ...b, items: b.items.map((i) => (i.id === path.slice(1) ? { ...i, crop } : i)) };
        return setPath(b, cropPath(path), crop);
      }),
    );
  }
  /** Files dropped where no picture is: a new picture (or Images) section after the one under the pointer. */
  function looseMedia(ids: string[], near: string | null) {
    const b: Block =
      ids.length === 1
        ? { id: newId(), type: "image", mediaId: ids[0], tone: sampleTone(0), caption: "", fullWidth: false }
        : (() => {
            const g = imagesBlock("grid") as BlockOf<"images">;
            return { ...g, items: ids.map((id, n) => ({ id: newId(), mediaId: id, tone: sampleTone(n), caption: "" })) };
          })();
    setBlocks((blocks) => {
      const i = near ? blocks.findIndex((x) => x.id === near) + 1 : blocks.length;
      const next = [...blocks];
      next.splice(i <= 0 ? blocks.length : i, 0, b);
      return next;
    });
    setSelected(b.id);
    toast(t("pic.newSection"), "image");
  }

  /** Text typed on the canvas. Typing in one field counts as one step to undo. */
  const onText = (blockId: string, path: string, value: string) =>
    setBlocks((blocks) => blocks.map((b) => (b.id === blockId ? setPath(b, path, value) : b)), `text-${blockId}-${path}`);
  const onSiteText = (field: "title" | "tagline" | "footer", value: string) =>
    setDraft(
      (d) => (field === "footer" ? { ...d, footer: { ...normalizeFooter(d.footer), text: value } } : { ...d, [field]: value }),
      `site-${field}`,
    );

  /** Links in the preview: pages switch in place, projects open on the live site, the rest as usual. */
  function previewClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (/^(https?:|mailto:|tel:)/i.test(href)) {
      a.target = "_blank";
      a.rel = "noopener";
      return;
    }
    if (!href.startsWith("/")) return;
    e.preventDefault();
    const [path, hash] = href.split("#");
    const slug = path.replace(/^\/+/, "");
    const target = draft.pages.find((p) => p.slug === slug && hasOwnPage(p));
    if (target) {
      setPreviewPage(target.id);
      requestAnimationFrame(() => {
        const box = (e.currentTarget as HTMLElement | null)?.closest('[role="dialog"]');
        const anchor = hash ? document.getElementById(hash) : null;
        if (anchor) anchor.scrollIntoView({ behavior: "smooth" });
        else box?.scrollTo({ top: 0 });
      });
      return;
    }
    if (projects.some((p) => p.slug === slug)) {
      if (version !== null) window.open(`${account.siteUrl}/${slug}`, "_blank", "noopener");
      else toast(t("previewProject"), "projects");
    }
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
    // While pointing at a font in the picker, the page shows it (nothing is saved until a click).
    site: fontPreview ? { ...draft, theme: { ...draft.theme, fonts: fontPreview } } : draft,
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
  // Round 18: Pages, Design, Projects | Messages, Stats. Doodle left the rail (Add item → Doodle);
  // Settings and Help sit at the bottom; the "f" opens the dashboard.
  const railItems = [
    { id: "blocks", icon: "site-editor", label: t("rail.blocks") },
    { id: "design", icon: "palette", label: t("rail.design") },
    { id: "projects", icon: "projects", label: t("rail.projects") },
    { id: "messages", icon: "messages", label: t("rail.messages") },
    { id: "stats", icon: "stats", label: t("rail.stats") },
  ] as const;
  const openRail = (id: Rail) => {
    // Settings shown in the panel give way to whatever the rail opens.
    if (docked) {
      setSettingsOpen(false);
      setFreeItem(null);
      setRail(id);
      setPanelOpen(true);
      return;
    }
    if (rail === id && panelOpen && !(id === "projects" && projectId)) return embedPath(id, projectId) ? wideBack() : setPanelOpen(false);
    setRail(id);
    if (id === "projects") setProjectId(null);
    setPanelOpen(true);
  };
  const railOn = (id: Rail) => rail === id && panelOpen;
  const railTool = "group relative flex flex-none flex-col items-center gap-0.5 text-[#C6C8BA] hover:text-[#E3E4D9]";
  const railPill = (on: boolean) =>
    cx(
      "flex size-10 items-center justify-center rounded-full transition-colors max-sm:h-8 max-sm:w-14 max-sm:rounded-pill",
      on ? "bg-lime text-on-lime" : "group-hover:bg-white/8",
    );
  /** The name beside a rail icon, on hover or keyboard focus (desktop). */
  const railTip = (label: string) => (
    <span
      aria-hidden
      className="shadow-float pointer-events-none absolute start-[52px] top-1/2 z-50 -translate-y-1/2 rounded-[8px] bg-[#1A1C16] px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:hidden"
    >
      {label}
    </span>
  );
  const barTool =
    "flex size-9 flex-none items-center justify-center rounded-full text-ink hover:bg-paper disabled:opacity-40 disabled:hover:bg-transparent";
  const upToDate = !dirty && version !== null;
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
      theme={draft.theme}
      isPro={isPro}
      siteUrl={account.siteUrl}
      shortBase={account.shortBase}
      pages={draft.pages}
      page={page}
      onDrawItem={(itemId) => beginDoodle(block.id, itemId)}
    />
  ) : null);
  const docked = settingsOpen && !!blockSettings && !reorder && !doodleSession && wide && !cardFloat;
  const closeSettings = () => {
    setSettingsOpen(false);
    setFreeItem(null);
  };
  const wideOn = panelOpen && !docked && !!embed;
  const [frames, setFrames] = useState<string[]>([]);
  if (wideOn && embed && frames[frames.length - 1] !== embed) setFrames([...frames.filter((f) => f !== embed), embed].slice(wide ? -4 : -2));
  /** Back from a wide panel: a project goes back to the list, anything else back to the site. */
  function wideBack() {
    if (rail === "projects" && projectId) return setProjectId(null);
    setRail("blocks");
    if (!wide) setPanelOpen(false);
  }

  return (
    // Pinned to the window (round 17 fix): nothing on the page can scroll the editor away.
    <div className="text-ink bg-surface fixed inset-0 flex overscroll-none">
      {/* Round 18: a slim icon rail (Carbonmade). Names show on hover; on phones it is a bottom bar. */}
      <nav
        aria-label={t("rail.label")}
        className="relative z-40 flex w-14 flex-none flex-col items-center gap-1.5 bg-[#12140E] py-2.5 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-16 max-sm:w-full max-sm:flex-row max-sm:justify-around max-sm:py-0"
      >
        <button
          type="button"
          onClick={() => openRail("home")}
          aria-label={t("rail.home")}
          className="group relative mb-2.5 flex size-9 flex-none items-center justify-center rounded-[12px] bg-white/10 max-sm:hidden"
        >
          <span className="font-heading font-heading-weight text-lime text-[18px] leading-none">{locale === "ar" ? "ف" : "f"}</span>
          {railTip(t("rail.home"))}
        </button>
        {railItems.map((r, i) => (
          <Fragment key={r.id}>
            {i === 3 && <span aria-hidden className="my-1.5 h-px w-6 flex-none bg-[#3A3D33] max-sm:hidden" />}
            <button
              type="button"
              aria-label={r.label}
              aria-pressed={railOn(r.id)}
              data-tip={r.id === "blocks" ? "rail-blocks" : undefined}
              className={cx(railTool, r.id === "stats" && "max-sm:hidden")}
              onClick={() => openRail(r.id)}
            >
              <span className={railPill(railOn(r.id))}>
                <Icon name={r.icon} size={20} />
              </span>
              {r.id === "messages" && account.unread > 0 && (
                <span
                  className="bg-lime absolute end-2 top-1.5 size-2 rounded-full ring-2 ring-[#12140E] max-sm:end-3 max-sm:top-1"
                  data-testid="unread-dot"
                />
              )}
              <span aria-hidden className="hidden text-[10px] font-semibold max-sm:block">
                {r.label}
              </span>
              {railTip(r.label)}
            </button>
          </Fragment>
        ))}
        <span className="flex-1 max-sm:hidden" />
        <a href={account.helpUrl} target="_blank" rel="noreferrer" className={cx(railTool, "max-sm:hidden")} aria-label={t("rail.help")}>
          <span className={railPill(false)}>
            <Icon name="help" size={20} />
          </span>
          {railTip(t("rail.help"))}
        </a>
        <button
          type="button"
          aria-label={t("rail.settings")}
          aria-pressed={railOn("settings")}
          className={cx(railTool, "max-sm:hidden")}
          onClick={() => openRail("settings")}
        >
          <span className={railPill(railOn("settings"))}>
            <Icon name="settings" size={20} />
          </span>
          {railTip(t("rail.settings"))}
        </button>
        {/* The account: plan, language, admin (admins only), sign out. On phones also the rest of the rail. */}
        <div className="relative max-sm:flex max-sm:flex-col max-sm:items-center">
          <button
            type="button"
            aria-label={t("account.label")}
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
            className="group relative mt-1 flex flex-col items-center gap-0.5 max-sm:mt-0"
            data-testid="account-button"
          >
            <span className="bg-lime text-on-lime flex size-8 items-center justify-center rounded-full text-[14px] font-bold">
              {(account.name || "?").trim().charAt(0).toUpperCase()}
            </span>
            <span aria-hidden className="hidden text-[10px] font-semibold text-[#C6C8BA] max-sm:block">
              {t("account.more")}
            </span>
            {railTip(t("account.label"))}
          </button>
          {accountOpen && (
            <div
              role="menu"
              className="bg-paper text-ink shadow-float border-line absolute bottom-0 start-12 z-50 flex w-[240px] flex-col gap-1 rounded-[14px] border p-2 max-sm:start-auto max-sm:end-0 max-sm:bottom-full max-sm:mb-2"
            >
              <span className="text-muted truncate px-2.5 pt-1 pb-2 text-[12px]">{account.name}</span>
              {/* Phones: what the bottom bar has no room for. */}
              {(
                [
                  ["home", "dashboard", t("rail.home")],
                  ["stats", "stats", t("rail.stats")],
                  ["settings", "settings", t("rail.settings")],
                ] as const
              ).map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className="hover:bg-mist flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-start text-[14px] font-semibold sm:hidden"
                  onClick={() => {
                    setAccountOpen(false);
                    openRail(id);
                  }}
                >
                  <Icon name={icon} size={18} />
                  {label}
                </button>
              ))}
              <a
                role="menuitem"
                href={account.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-mist flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-semibold sm:hidden"
              >
                <Icon name="help" size={18} />
                {t("rail.help")}
              </a>
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
              <button
                type="button"
                role="menuitem"
                className="hover:bg-mist flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-start text-[14px] font-semibold"
                onClick={() => {
                  setAccountOpen(false);
                  setShortcutsOpen(true);
                }}
              >
                <Icon name="help" size={18} />
                {t("shortcuts.title")}
              </button>
              <a
                role="menuitem"
                href="/guide"
                className="hover:bg-mist flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] font-semibold"
                data-testid="account-guide"
              >
                <Icon name="sparkle" size={18} />
                {t("account.guide")}
              </a>
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
      {panelOpen && !wideOn && (
        <div
          aria-hidden
          data-testid="panel-backdrop"
          className="bg-ink/30 absolute inset-y-0 start-14 end-0 z-20 max-sm:hidden lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
      {((panelOpen && !embed) || docked) && (
        <aside
          className={cx(
            // "relative": hidden screen-reader labels inside stay within the panel's own scrolling.
            "border-line fannan-dark bg-paper text-ink relative flex w-[300px] flex-none flex-col overflow-y-auto overscroll-contain border-e",
            "max-lg:shadow-float max-lg:absolute max-lg:inset-y-0 max-lg:start-14 max-lg:z-30 max-lg:w-[min(320px,calc(100vw-56px))]",
            "max-sm:start-0 max-sm:top-14 max-sm:bottom-16 max-sm:w-full",
          )}
          data-testid="left-panel"
          data-panel={docked ? "settings" : rail}
        >
          {docked && (
            // The selected section's (or item's) settings, in the panel: back to the sections, pop out, close.
            <div role="region" aria-label={t("section.settings")} data-testid="block-settings" className="flex min-h-0 flex-1 flex-col">
              <div className="border-line flex h-12 flex-none items-center justify-between gap-1 border-b ps-2 pe-2">
                <button
                  type="button"
                  onClick={closeSettings}
                  className="hover:bg-mist flex h-9 items-center gap-1.5 rounded-pill ps-2 pe-3 text-[13px] font-semibold"
                  data-testid="settings-back"
                >
                  <Icon name="arrow-left" size={18} />
                  {panelOpen && rail === "blocks" ? t("panelTabs.blocks") : t("section.done")}
                </button>
                <button
                  type="button"
                  aria-label={t("section.float")}
                  title={t("section.float")}
                  onClick={() => floatCard(true)}
                  className="text-muted hover:text-ink hover:bg-mist flex size-9 items-center justify-center rounded-full"
                  data-testid="settings-float"
                >
                  <Icon name="bring-front" size={18} />
                </button>
              </div>
              <div className="fannan-compact relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{blockSettings}</div>
            </div>
          )}
          {!docked && rail === "blocks" && (
            <>
              <div className="px-3 pt-3">
                <button
                  type="button"
                  aria-expanded={pagesOpen}
                  onClick={() => setPagesOpen(!pagesOpen)}
                  className="bg-surface flex h-11 w-full items-center justify-between rounded-[14px] px-4 text-start"
                  data-testid="page-switcher"
                >
                  <span className="truncate text-[15px] font-semibold" title={t("currentlyEditing")}>
                    {page.title}
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
                    projects={projects}
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
                        projects={projects}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {!docked && rail === "doodle" && (
            <DoodlePanel
              session={doodleSession}
              tools={doodleTools}
              setTools={setDoodleTools}
              setSession={setSession}
              isPro={isPro}
              ink={draft.theme.colors.text}
              canDraw={block?.type === "free"}
              onStart={() => block && beginDoodle(block.id, null)}
              onAddSection={() => {
                const kind = blockKinds.find((k) => k.key === "free-blank");
                if (kind) addBlock(kind);
              }}
              onDone={finishDoodle}
              onCancel={cancelDoodle}
            />
          )}

          {!docked && rail === "design" && (
            <div className="flex flex-col">
              <h2 className="text-muted px-4 pt-4 pb-2 text-[11px] font-semibold tracking-[0.1em] uppercase">{t("rail.design")}</h2>
              {(["logo", "nav", "styles", "fonts", "footer", "lock"] as DesignSection[]).map((sec) => (
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
                          onFontPreview={setFontPreview}
                          credit={credit}
                          draft={draft}
                          media={media}
                          setDraft={setDraft}
                          openPicker={(kind, done) => setPicker({ kind, done })}
                          onOpenSettings={() => openRail("settings")}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!docked && rail === "projects" && !projectId && (
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

      {/* Round 18: Home, Projects, Messages, Stats, Settings and Pro open wide over the editor, the site
          dimmed behind (Carbonmade). Up to 4 stay loaded, so each keeps its place when opened again. */}
      <div
        className={cx("absolute inset-y-0 start-14 end-0 z-30 flex max-sm:start-0 max-sm:bottom-16", !wideOn && "hidden")}
        data-testid="wide-panel"
      >
        <div className="bg-mist shadow-float flex w-[min(760px,100%)] flex-none flex-col">
          <div className="bg-surface border-line flex h-14 flex-none items-center border-b px-2">
            <button
              type="button"
              onClick={wideBack}
              className="hover:bg-mist flex h-9 items-center gap-1.5 rounded-pill ps-2 pe-3 text-[13px] font-semibold"
              data-testid="wide-back"
            >
              <Icon name="arrow-left" size={18} />
              {rail === "projects" && projectId ? t("rail.projects") : t("wideBack")}
            </button>
          </div>
          {frames.map((path) => (
            <iframe
              key={path}
              src={path}
              title={t(`rail.${rail}`)}
              hidden={path !== embed}
              className="min-h-0 w-full flex-1 border-0"
              data-testid={path === embed ? "panel-frame" : undefined}
            />
          ))}
        </div>
        <button type="button" tabIndex={-1} aria-label={t("wideBack")} onClick={wideBack} className="bg-ink/55 min-w-0 flex-1 max-sm:hidden" />
      </div>

      {/* The preview, with a slim bar on top. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden max-sm:pb-16">
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
        {/* Round 18 top bar: undo and redo · the page and its status in the middle · reorder, screen
            size, preview and Publish. */}
        <header className="bg-surface border-line grid h-14 flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-2 md:px-3">
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t("undo")} title={t("undo")} disabled={historySize.past === 0} onClick={undo} className={barTool}>
              <Icon name="undo" size={18} />
            </button>
            <button type="button" aria-label={t("redo")} title={t("redo")} disabled={historySize.future === 0} onClick={redo} className={barTool}>
              <Icon name="redo" size={18} />
            </button>
          </div>
          <div className="flex min-w-0 flex-col items-center leading-tight">
            <span className="max-w-[220px] truncate text-[13px] font-semibold max-sm:max-w-[110px]" data-testid="top-page">
              {page.title}
            </span>
            <span className="text-muted max-w-[220px] truncate text-[12px] max-sm:hidden" role="status" data-testid="editor-status">
              {status}
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1">
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
                barTool,
                "w-auto min-w-9 gap-1.5 text-[13px] font-semibold",
                reorder && "bg-secondary-container text-on-secondary-container hover:bg-secondary-container px-3",
              )}
            >
              <Icon name="reorder" size={18} />
              {reorder && <span>{t("reorderDone")}</span>}
            </button>
            <div className="bg-paper flex gap-0.5 rounded-pill p-[3px] max-sm:hidden" role="radiogroup" aria-label={t("device")}>
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
                    "flex size-[30px] items-center justify-center rounded-full",
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
              onClick={() => {
                setPreviewPage(page.id);
                setPreview(true);
              }}
              className={barTool}
            >
              <Icon name="preview" size={18} />
            </button>
            <span data-tip="publish">
              {/* Greyed with a tick once the live site has everything. */}
              <button
                type="button"
                onClick={doPublish}
                disabled={publishing || upToDate}
                className={cx(
                  "flex h-9 items-center gap-2 rounded-pill px-3 text-[13px] font-semibold sm:px-4",
                  upToDate ? "bg-[#E8E9DF] text-muted" : "bg-lime text-on-lime hover:brightness-95 disabled:opacity-60",
                )}
              >
                <Icon name={upToDate ? "check" : "publish"} size={16} />
                <span className="max-sm:sr-only">{publishing ? t("publishing") : t("publish")}</span>
              </button>
            </span>
          </div>
        </header>

        <PicTools
          root={canvasWrap}
          media={media}
          disabled={reorder || !!doodleSession || page.type === "link" || page.type === "folder" || page.type === "project"}
          onUploaded={(m) => setMedia((all) => ({ ...all, [m.id]: m }))}
          onPlace={placeMedia}
          onLoose={looseMedia}
          cropOf={picInfo}
          onCrop={setCrop}
        />
        <TextToolbar
          item={(() => {
            const fb = page.blocks.find((x) => x.id === selected && x.type === "free") as BlockOf<"free"> | undefined;
            const it = fb?.items.find((i) => i.id === freeItem);
            return it && ["text", "heading", "quote"].includes(it.kind) ? { size: it.size, lineHeight: it.lineHeight, tracking: it.tracking } : null;
          })()}
          onItem={(patch) => {
            if (!selected || !freeItem) return;
            changeFree(selected, (b) => ({ ...b, items: b.items.map((i) => (i.id === freeItem ? { ...i, ...patch } : i)) }), `textbar-${freeItem}`);
          }}
        />
        <div ref={canvasWrap} className="contents">
        <Canvas
          width={WIDTHS[device]}
          fluid={device === "desktop"}
          selectedId={selected}
          reorder={reorder}
          actions={sectionActions}
          order={page.blocks.map((b) => b.id)}
          nameOf={sectionName}
          insertAt={insertShown}
          quiet={!!freeItem || !!doodleSession}
          sheet={phone}
          version={page.blocks}
          settings={docked ? null : blockSettings}
          settingsOpen={settingsOpen}
          onDock={wide ? () => floatCard(false) : undefined}
          itemId={block?.type === "free" && settingsOpen ? freeItem : null}
          onAddElement={
            block?.type === "free"
              ? (kind) => {
                  // "Draw" opens the board over this section; the drawing becomes an item when done.
                  if (kind === "drawing") return beginDoodle(block.id, null);
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
            // A new selection closes the settings card; it opens from the toolbar when needed.
            if (id !== selected) setSettingsOpen(false);
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
          ) : page.type === "folder" ? (
            <div className="text-muted flex h-[400px] items-center justify-center p-10 text-center" data-testid="folder-note">
              {t("pages.folderCanvas")}
            </div>
          ) : page.type === "project" ? (
            <div className="text-muted flex h-[400px] items-center justify-center p-10 text-center" data-testid="project-note">
              {t("pages.projectCanvas", { project: projects.find((x) => x.id === page.projectId)?.title ?? "…" })}
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
      </div>

      {shortcutsOpen && (
        <Modal open onClose={() => setShortcutsOpen(false)} title={t("shortcuts.title")} closeLabel={t("closePreview")}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 text-[14px]" data-testid="shortcuts">
            {(
              [
                ["undo", "Ctrl Z"],
                ["redo", "Ctrl Shift Z · Ctrl Y"],
                ["copy", "Ctrl C"],
                ["cut", "Ctrl X"],
                ["paste", "Ctrl V"],
                ["duplicate", "Ctrl D"],
                ["delete", "Delete"],
                ["selectAll", "Ctrl A"],
                ["pick", "Shift + click"],
                ["nudge", "← ↑ → ↓"],
                ["nudgeFar", "Shift + ← ↑ → ↓"],
                ["letGo", "Esc"],
                ["save", "Ctrl S"],
                ["help", "?"],
              ] as const
            ).map(([key, keys]) => (
              <div key={key} className="contents">
                <dt className="text-ink-soft">{t(`shortcuts.${key}`)}</dt>
                <dd className="m-0 text-end">
                  <kbd dir="ltr" className="bg-mist border-line rounded-[6px] border px-2 py-0.5 font-mono text-[12px]">
                    {keys}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted mt-4 text-[12px]">{t("shortcuts.mac")}</p>
        </Modal>
      )}

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
            onClickCapture={previewClick}
          >
            {/* Clickable like the live site: pages switch here, projects open on the published site. */}
            <SiteRender
              {...renderProps}
              pageId={previewPage}
              live
              contactHref={`/${draft.pages.find((p) => p.blocks.some((b) => b.type === "contact"))?.slug ?? ""}#contact`}
              renderContact={(b) => <PreviewContact block={b} language={draft.language} fallback={siteSettings.contact} />}
            />
            <SiteEnhancer key={previewPage} protectImages={false} closeLabel={t("closePreview")} />
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
