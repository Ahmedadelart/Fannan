"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import {
  ARABIC_CATEGORIES,
  ARABIC_FONTS,
  FONTS,
  LATIN_CATEGORIES,
  LATIN_FONTS,
  PAIRS,
  fontOf,
  fontStack,
  type FontInfo,
} from "@/components/site/fonts";
import type { Theme } from "@/lib/site/types";

// The font picker (round 12): curated pairs first, then every heading, body and Arabic font drawn
// in its own letters. Pointing at a font previews it on the page; clicking keeps it. Arrow keys
// move through the list (previewing as they go), Enter picks. Rows load their font only when they
// scroll into view, so the long list stays light.

type Fonts = Theme["fonts"];
type Tab = "pairs" | "heading" | "body" | "arabic" | "arabicBody";

export function FontPicker({
  fonts,
  siteName,
  onChange,
  onPreview,
}: {
  fonts: Fonts;
  /** The site's name: headings are shown with it. */
  siteName: string;
  onChange: (fonts: Fonts) => void;
  /** A temporary look on the page while pointing at a font (null: back to the saved fonts). */
  onPreview: (fonts: Fonts | null) => void;
}) {
  const t = useTranslations("editor.fonts");
  const [tab, setTab] = useState<Tab>("pairs");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  // Leaving the picker puts the saved fonts back on the page.
  useEffect(() => () => onPreview(null), [onPreview]);

  const field = tab === "pairs" ? null : tab;
  const arabic = tab === "arabic" || tab === "arabicBody";
  const shown = useMemo(() => {
    const all = arabic ? ARABIC_FONTS : LATIN_FONTS;
    const q = query.trim().toLowerCase();
    const current = field ? (fonts[field] ?? fonts.arabic) : null;
    return all
      .filter((f) => (!category || f.category === category) && (!q || f.name.toLowerCase().includes(q) || f.category.includes(q)))
      .sort((a, b) => (a.id === current ? -1 : b.id === current ? 1 : 0));
  }, [arabic, query, category, field, fonts]);

  const withFont = (f: FontInfo): Fonts => {
    if (!field) return fonts;
    const next = { ...fonts, [field]: f.id };
    // A new heading font starts at its own best weight.
    if (field === "heading") delete next.headingWeight;
    return next;
  };
  const sample = () =>
    tab === "heading" ? siteName || "Your Name" : tab === "body" ? t("bodySample") : tab === "arabic" ? "فنان · معرض أعمالي" : "نص قصير عن أعمالي وخبرتي.";

  const onKey = (e: KeyboardEvent) => {
    if (!field || !shown.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, Math.min(shown.length - 1, cursor + (e.key === "ArrowDown" ? 1 : -1)));
      setCursor(next);
      onPreview(withFont(shown[next]));
      list.current?.querySelectorAll<HTMLElement>("[data-font-row]")[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault();
      onChange(withFont(shown[cursor]));
      onPreview(null);
    } else if (e.key === "Escape") onPreview(null);
  };

  const h = fontOf(fonts.heading, "space-grotesk");
  const weights = h.variable ? [300, 400, 500, 600, 700, 800, 900].filter((w) => w >= h.weights[0] && w <= h.weights[h.weights.length - 1]) : [...h.weights];

  return (
    <div className="flex flex-col gap-3" data-testid="font-picker" onKeyDown={onKey}>
      {/* What's chosen now */}
      <div className="border-line bg-paper flex flex-col gap-1 rounded-[14px] border p-3">
        <span className="truncate text-[20px] leading-tight" style={{ fontFamily: fontStack(h), fontWeight: fonts.headingWeight ?? h.headingWeight }}>
          {siteName || "Your Name"}
        </span>
        <span className="text-muted truncate text-[13px]" style={{ fontFamily: fontStack(fontOf(fonts.body, "plex")) }}>
          {fontOf(fonts.heading, "space-grotesk").name} · {fontOf(fonts.body, "plex").name}
        </span>
        <span dir="rtl" className="text-muted truncate text-[13px]" style={{ fontFamily: fontStack(fontOf(fonts.arabic, "plex-arabic")) }}>
          {fontOf(fonts.arabic, "plex-arabic").name} · {fontOf(fonts.arabicBody ?? fonts.arabic, "plex-arabic").name}
        </span>
      </div>

      <div role="tablist" aria-label={t("title")} className="flex flex-wrap gap-1">
        {(["pairs", "heading", "body", "arabic", "arabicBody"] as Tab[]).map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            onClick={() => {
              setTab(x);
              setCategory(null);
              setQuery("");
              setCursor(-1);
              onPreview(null);
            }}
            className={cx("rounded-pill h-8 px-3 text-[12px] font-semibold", tab === x ? "bg-secondary-container text-on-secondary-container" : "border-line hover:bg-mist border")}
            data-testid={`fonts-tab-${x}`}
          >
            {t(`tabs.${x}`)}
          </button>
        ))}
      </div>

      {tab === "pairs" ? (
        <div className="flex flex-col gap-2" onMouseLeave={() => onPreview(null)} data-testid="font-pairs">
          {PAIRS.map((p) => {
            const ph = fontOf(p.heading, "space-grotesk");
            const pb = fontOf(p.body, "plex");
            const on = fonts.heading === p.heading && fonts.body === p.body && fonts.arabic === p.arabic;
            const next: Fonts = { ...fonts, heading: p.heading, body: p.body, arabic: p.arabic, arabicBody: p.arabicBody };
            delete next.headingWeight;
            return (
              <LazyRow key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onMouseEnter={() => onPreview(next)}
                  onFocus={() => onPreview(next)}
                  onClick={() => {
                    onChange(next);
                    onPreview(null);
                  }}
                  className={cx("flex w-full flex-col gap-1 rounded-[14px] border p-3 text-start", on ? "border-lime border-2" : "border-line hover:bg-mist")}
                  data-testid={`pair-${p.id}`}
                >
                  <span className="text-muted text-[10px] font-semibold tracking-[0.08em] uppercase">{t(`pairs.${p.id}`)}</span>
                  <span className="truncate text-[22px] leading-tight" style={{ fontFamily: fontStack(ph), fontWeight: ph.headingWeight }}>
                    {siteName || "Your Name"}
                  </span>
                  <span className="text-muted line-clamp-2 text-[13px]" style={{ fontFamily: fontStack(pb) }}>
                    {t("bodySample")}
                  </span>
                  <span dir="rtl" className="truncate text-[15px]" style={{ fontFamily: fontStack(fontOf(p.arabic, "plex-arabic")), fontWeight: 700 }}>
                    فنان · {FONTS[p.arabic]?.name}
                  </span>
                </button>
              </LazyRow>
            );
          })}
        </div>
      ) : (
        <>
          <label className="border-line flex h-9 items-center gap-2 rounded-[10px] border px-2.5">
            <Icon name="search" size={16} />
            <input
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              placeholder={t("search")}
              aria-label={t("search")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(-1);
              }}
              data-testid="font-search"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {[null, ...(arabic ? ARABIC_CATEGORIES : LATIN_CATEGORIES)].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cx("rounded-[8px] px-2 py-1 text-[11px] font-semibold", category === c ? "bg-ink text-paper" : "bg-mist hover:bg-line")}
              >
                {t(`cats.${c ?? "all"}`)}
              </button>
            ))}
          </div>
          <div
            ref={list}
            role="listbox"
            aria-label={t(`tabs.${tab}`)}
            tabIndex={0}
            className="flex max-h-[420px] flex-col gap-1 overflow-y-auto pe-1"
            onMouseLeave={() => onPreview(null)}
            data-testid="font-list"
          >
            {shown.map((f, i) => {
              const on = (field && (fonts[field] ?? (field === "arabicBody" ? fonts.arabic : undefined))) === f.id;
              return (
                <LazyRow key={f.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-font-row
                    onMouseEnter={() => {
                      setCursor(i);
                      onPreview(withFont(f));
                    }}
                    onClick={() => {
                      onChange(withFont(f));
                      onPreview(null);
                    }}
                    className={cx(
                      "flex w-full items-center gap-2 rounded-[12px] border px-3 py-2 text-start",
                      on ? "border-lime border-2" : i === cursor ? "border-line-strong bg-mist" : "border-transparent hover:bg-mist",
                    )}
                    data-testid={`font-${f.id}`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        dir={arabic ? "rtl" : undefined}
                        className={cx("truncate leading-snug", tab === "heading" || tab === "arabic" ? "text-[22px]" : "text-[15px]")}
                        style={{ fontFamily: fontStack(f), fontWeight: tab === "heading" || tab === "arabic" ? f.headingWeight : 400 }}
                      >
                        {sample()}
                      </span>
                      <span className="text-muted text-[11px]">
                        {f.name} · {t(`cats.${f.category}`)}
                      </span>
                    </span>
                    {on && <Icon name="check" size={16} />}
                  </button>
                </LazyRow>
              );
            })}
            {!shown.length && <p className="text-muted m-0 p-2 text-[13px]">{t("none")}</p>}
          </div>
        </>
      )}

      {/* Fine-tuning the headings */}
      <div className="border-line flex flex-col gap-2.5 border-t pt-3">
        {weights.length > 1 && (
          <label className="flex flex-col gap-1 text-[12px] font-semibold">
            {t("weight")}
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("weight")}>
              {weights.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={(fonts.headingWeight ?? h.headingWeight) === w}
                  onClick={() => onChange({ ...fonts, headingWeight: w })}
                  className={cx("h-8 min-w-10 rounded-[8px] px-2 text-[13px]", (fonts.headingWeight ?? h.headingWeight) === w ? "bg-secondary-container" : "border-line border")}
                  style={{ fontFamily: fontStack(h), fontWeight: w }}
                >
                  Aa
                </button>
              ))}
            </div>
          </label>
        )}
        <div className="flex flex-col gap-1 text-[12px] font-semibold">
          {t("size")}
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t("size")}>
            {(["s", "m", "l"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={(fonts.headingScale ?? "m") === s}
                onClick={() => onChange({ ...fonts, headingScale: s })}
                className={cx("h-8 rounded-[8px] text-[12px] font-semibold", (fonts.headingScale ?? "m") === s ? "bg-secondary-container" : "border-line border")}
              >
                {t(`sizes.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          <span className="flex justify-between">
            {t("tracking")}
            <span className="text-muted font-normal tabular-nums">{((fonts.headingTracking ?? -1) / 100).toFixed(2)}em</span>
          </span>
          <input
            type="range"
            min={-10}
            max={30}
            value={fonts.headingTracking ?? -1}
            onChange={(e) => onChange({ ...fonts, headingTracking: Number(e.target.value) })}
            className="fannan-range"
            data-testid="heading-tracking"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-[13px]">
          {t("upper")}
          <input type="checkbox" className="accent-primary size-4" checked={!!fonts.headingUpper} onChange={(e) => onChange({ ...fonts, headingUpper: e.target.checked })} />
        </label>
      </div>
    </div>
  );
}

/** Renders its row only once it scrolls near view, so the font file downloads only then. */
function LazyRow({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className="min-h-[52px]">
      {seen ? children : null}
    </div>
  );
}
