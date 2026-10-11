"use client";

// Round 13: the text toolbar (like Carbonmade). Select words in a text on the canvas and it floats
// above them: bold, italic, underline, link, colour, font, and (for free-form text items) size,
// line height and letter spacing for the whole item. Ctrl+B / I / U work natively; Ctrl+K opens the link box.
// The browser does the formatting (execCommand); InlineText cleans the result to the allowlist.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { FONTS, LATIN_FONTS, ARABIC_FONTS } from "@/components/site/fonts";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { safeHref } from "@/lib/site/richtext";

type Panel = null | "link" | "color" | "font";
type ItemType = { size: number; lineHeight: number; tracking: number };

const fieldOf = (n: Node | null): HTMLElement | null =>
  (n instanceof HTMLElement ? n : n?.parentElement)?.closest<HTMLElement>("[data-inline-text][data-rich]") ?? null;

export function TextToolbar({ item, onItem }: { item?: ItemType | null; onItem?: (patch: Partial<ItemType>) => void }) {
  const t = useTranslations("editor.textbar");
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [state, setState] = useState({ b: false, i: false, u: false, a: false });
  const [href, setHref] = useState("");
  const [q, setQ] = useState("");
  const saved = useRef<{ range: Range; field: HTMLElement } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const panelRef = useRef<Panel>(null);
  const [accent, setAccent] = useState("");
  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);

  useEffect(() => {
    const update = () => {
      const sel = document.getSelection();
      if (bar.current?.contains(document.activeElement)) return;
      const field = sel && sel.rangeCount ? fieldOf(sel.anchorNode) : null;
      if (!sel || !field || sel.isCollapsed || fieldOf(sel.focusNode) !== field) {
        if (!panelRef.current) setBox(null);
        return;
      }
      const range = sel.getRangeAt(0);
      saved.current = { range: range.cloneRange(), field };
      setAccent(getComputedStyle(field).getPropertyValue("--site-accent").trim());
      // Under the text (the item's own tools sit above it); above when there's no room below.
      const r = range.getBoundingClientRect();
      const f = field.getBoundingClientRect();
      const below = f.bottom + 10;
      setBox({
        top: below + 170 < window.innerHeight ? below : Math.max(8, f.top - 52),
        left: Math.min(window.innerWidth - 160, Math.max(160, r.left + r.width / 2)),
      });
      setState({
        b: document.queryCommandState("bold"),
        i: document.queryCommandState("italic"),
        u: document.queryCommandState("underline"),
        a: !!(range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest("a"),
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      if (!fieldOf(document.activeElement)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      update();
      if (saved.current) setPanel("link");
    };
    const onScroll = () => {
      if (!panelRef.current) setBox(null);
    };
    document.addEventListener("selectionchange", update);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  /** Put the selection back in the text, then format it. */
  const run = (cmd: string, arg?: string) => {
    const s = saved.current;
    if (!s) return;
    s.field.focus();
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(s.range);
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd, false, arg);
    const now = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (now) saved.current = { range: now.cloneRange(), field: s.field };
    setState((x) => ({ ...x, b: document.queryCommandState("bold"), i: document.queryCommandState("italic"), u: document.queryCommandState("underline") }));
  };
  const close = () => {
    setPanel(null);
    setQ("");
  };

  if (!box || typeof document === "undefined") return null;
  const btn = (on: boolean) =>
    cx("flex h-8 min-w-8 items-center justify-center rounded-[8px] px-1.5 text-[14px]", on ? "bg-lime text-on-lime" : "text-white hover:bg-white/15");
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const fonts = [...LATIN_FONTS, ...ARABIC_FONTS].filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);

  return createPortal(
    <div
      ref={bar}
      className="fixed z-[55] -translate-x-1/2 rtl:translate-x-1/2"
      style={{ top: box.top, left: box.left }}
      data-testid="text-toolbar"
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) keep(e);
      }}
    >
      <div className="bg-ink shadow-float flex items-center gap-0.5 rounded-[12px] p-1 ring-1 ring-white/15" role="toolbar" aria-label={t("label")}>
        <button type="button" className={cx(btn(state.b), "font-bold")} aria-pressed={state.b} title={`${t("bold")} (Ctrl B)`} aria-label={t("bold")} onClick={() => run("bold")} data-testid="tt-bold">
          B
        </button>
        <button type="button" className={cx(btn(state.i), "italic")} aria-pressed={state.i} title={`${t("italic")} (Ctrl I)`} aria-label={t("italic")} onClick={() => run("italic")} data-testid="tt-italic">
          I
        </button>
        <button type="button" className={cx(btn(state.u), "underline")} aria-pressed={state.u} title={`${t("underline")} (Ctrl U)`} aria-label={t("underline")} onClick={() => run("underline")} data-testid="tt-underline">
          U
        </button>
        <span className="mx-0.5 h-5 w-px bg-white/20" />
        <button type="button" className={btn(state.a || panel === "link")} title={`${t("link")} (Ctrl K)`} aria-label={t("link")} onClick={() => setPanel(panel === "link" ? null : "link")} data-testid="tt-link">
          <Icon name="link" size={18} />
        </button>
        <button type="button" className={btn(panel === "color")} title={t("color")} aria-label={t("color")} onClick={() => setPanel(panel === "color" ? null : "color")} data-testid="tt-color">
          <span className="size-4 rounded-full ring-1 ring-white/50" style={{ background: "conic-gradient(#e66,#ec6,#6c6,#6ce,#c6e,#e66)" }} />
        </button>
        <button type="button" className={cx(btn(panel === "font"), "font-semibold")} title={t("font")} aria-label={t("font")} onClick={() => setPanel(panel === "font" ? null : "font")} data-testid="tt-font">
          Aa
        </button>
        <button type="button" className={btn(false)} title={t("clear")} aria-label={t("clear")} onClick={() => (run("removeFormat"), run("unlink"))} data-testid="tt-clear">
          <span className="text-[12px] line-through">T</span>
        </button>
      </div>

      {panel === "link" && (
        <form
          className="bg-paper text-ink shadow-float mt-1.5 flex w-[300px] items-center gap-1.5 rounded-[12px] p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = safeHref(href);
            if (v) run("createLink", v);
            setHref("");
            close();
          }}
        >
          <input
            autoFocus
            dir="ltr"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && close()}
            placeholder="https://"
            aria-label={t("link")}
            className="border-line h-9 min-w-0 flex-1 rounded-[8px] border px-2.5 text-[13px] outline-none"
            data-testid="tt-href"
          />
          <button type="submit" className="bg-primary h-9 rounded-pill px-3 text-[13px] font-semibold text-white" data-testid="tt-href-ok">
            {t("apply")}
          </button>
          {state.a && (
            <button type="button" className="hover:bg-mist h-9 rounded-pill px-2 text-[13px]" onClick={() => (run("unlink"), close())}>
              {t("unlink")}
            </button>
          )}
        </form>
      )}

      {panel === "color" && (
        <div className="bg-paper shadow-float mt-1.5 flex items-center gap-1.5 rounded-[12px] p-2">
          {[accent, "#141414", "#FFFFFF", "#6B6B6B", "#C1502E", "#2F6B4F", "#7A4FD0"].filter(Boolean).map((c) => (
            <button key={c} type="button" aria-label={c} title={c} className="size-7 rounded-full ring-1 ring-black/15" style={{ background: c }} onClick={() => (run("foreColor", c), close())} />
          ))}
          <label className="relative size-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/15" style={{ background: "conic-gradient(#e66,#ec6,#6c6,#6ce,#c6e,#e66)" }} title={t("color")}>
            <input type="color" className="absolute inset-0 opacity-0" aria-label={t("color")} onChange={(e) => run("foreColor", e.target.value)} />
          </label>
        </div>
      )}

      {panel === "font" && (
        <div className="bg-paper text-ink shadow-float mt-1.5 flex w-[260px] flex-col gap-1.5 rounded-[12px] p-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && close()}
            placeholder={t("searchFonts")}
            aria-label={t("searchFonts")}
            className="border-line h-9 rounded-[8px] border px-2.5 text-[13px] outline-none"
            data-testid="tt-font-search"
          />
          <ul className="m-0 flex max-h-[240px] list-none flex-col overflow-auto p-0">
            {fonts.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="hover:bg-mist w-full truncate rounded-[8px] px-2.5 py-1.5 text-start text-[17px]"
                  style={{ fontFamily: FONTS[f.id].family }}
                  onClick={() => (run("fontName", `fn-${f.id}`), close())}
                  data-testid={`tt-font-${f.id}`}
                >
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item && onItem && !panel && (
        <div className="bg-paper text-ink shadow-float mt-1.5 flex w-[300px] flex-col gap-1.5 rounded-[12px] p-2.5 text-[12px]" data-testid="tt-sliders">
          {(
            [
              ["size", t("size"), 8, 240, item.size],
              ["lineHeight", t("lineHeight"), 80, 240, item.lineHeight],
              ["tracking", t("tracking"), -10, 50, item.tracking],
            ] as const
          ).map(([key, label, min, max, v]) => (
            <label key={key} className="grid grid-cols-[90px_1fr_32px] items-center gap-2">
              {label}
              <input type="range" min={min} max={max} value={v} onChange={(e) => onItem({ [key]: Number(e.target.value) })} className="accent-ink" data-testid={`tt-${key}`} />
              <span className="text-muted text-end tabular-nums">{v}</span>
            </label>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
