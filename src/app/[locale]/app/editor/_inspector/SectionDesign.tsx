"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { EDGE_PATHS } from "@/components/site/edges";
import { patternCss, PATTERN_IDS } from "@/components/site/patterns";
import { defaultSectionStyle } from "@/lib/site/normalize";
import type { Theme, EdgeShape, SectionStyle } from "@/lib/site/types";
import { Choice, ColorField, Range, Switch, Text } from "../_ui/controls";
import { type MediaKind } from "../_ui/media";

/* ---------- a section's Style tab (round 7, regrouped in round 18): arrangement, background,
   spacing, then More (edges, exact width, card, text colour, link name, motion) ---------- */

export function EdgeTile({ shape }: { shape: EdgeShape }) {
  return (
    <svg viewBox="0 0 1200 100" preserveAspectRatio="none" className="h-5 w-full" aria-hidden>
      {shape === "none" ? (
        <rect x="0" y="50" width="1200" height="50" fill="currentColor" />
      ) : (
        <path d={EDGE_PATHS[shape]} fill="currentColor" />
      )}
    </svg>
  );
}

export function SectionDesign({
  value,
  onChange,
  theme,
  isPro,
  mediaField,
  compact = false,
  arrangement,
}: {
  /** Round 18: the section's alignment (and mirror), shown with the width as "Arrangement". */
  arrangement?: ReactNode;
  /** Background only (the password page): no edges, card, anchor or motion. */
  compact?: boolean;
  value?: SectionStyle;
  onChange: (s: SectionStyle, key?: string) => void;
  theme?: Theme;
  isPro: boolean;
  mediaField: (title: string, id: string | null, kind: MediaKind, apply: (id: string | null) => void) => ReactNode;
}) {
  const d = useTranslations("editor.design2");
  const st = value ?? defaultSectionStyle();
  const bg = st.bg;
  const set = (patch: Partial<SectionStyle>, key?: string) => onChange({ ...st, ...patch }, key);
  const [more, setMore] = useState(false);
  const setBg = (patch: Partial<SectionStyle["bg"]>, key?: string) => set({ bg: { ...bg, ...patch } }, key);
  const accent = theme?.colors.accent ?? "#C6F432";
  const ground = theme?.colors.background ?? "#FFFFFF";
  const ink = theme?.colors.text ?? "#141414";
  // Quick gradients: the theme's own colours first, then a few warm ones (no blue).
  const gradients: Array<[string, string]> = [
    [accent, ground],
    [ground, accent],
    ["#FFF4D6", "#FFFFFF"],
    ["#FF8A3D", "#FFC94A"],
    ["#1F3B2D", "#0F1A14"],
    ["#3A1F4D", "#141414"],
    ["#F4F1E6", "#E4DBC4"],
    [ink, ground],
  ];
  const swatch = "size-8 flex-none rounded-full border border-line";

  return (
    <div className="flex flex-col gap-5" data-testid="section-design">
      {/* Arrangement: one alignment and one width for the whole section. */}
      {!compact && (
        <div className="flex flex-col gap-3" data-testid="quick-layout">
          <span className="text-[13px] font-semibold">{d("arrangement")}</span>
          {arrangement}
          <Choice
            title={d("width")}
            value={st.width}
            options={[
              ["narrow", d("widths.narrow")],
              ["medium", d("widths.medium")],
              ["normal", d("widths.normal")],
              ["full", d("widths.full")],
            ]}
            onChange={(v) => set({ width: v, maxWidth: undefined })}
          />
        </div>
      )}

      {/* Background */}
      <div className={cx("flex flex-col gap-3", !compact && "border-line border-t pt-4")}>
        <span className="text-[13px] font-semibold">{d("background")}</span>
        <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={d("background")}>
          {(["none", "color", "gradient", "image", "pattern"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={bg.kind === kind}
              onClick={() => setBg({ kind })}
              className={cx(
                "h-9 rounded-[10px] text-[11px] font-semibold",
                bg.kind === kind
                  ? "bg-secondary-container text-on-secondary-container"
                  : "border-line hover:bg-mist border",
              )}
            >
              {d(`bg.${kind}`)}
            </button>
          ))}
        </div>
        {(bg.kind === "color" || bg.kind === "pattern") && (
          <div className="flex flex-wrap items-center gap-1.5">
            {[ground, accent, ink, "#FFF4D6", "#F4F1E6", "#1F3B2D", "#141414"].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                className={cx(
                  swatch,
                  bg.color.toUpperCase() === c.toUpperCase() && "ring-primary ring-2 ring-offset-1",
                )}
                style={{ background: c }}
                onClick={() => setBg({ color: c.toUpperCase() })}
              />
            ))}
            <input
              type="color"
              aria-label={d("color")}
              value={bg.color}
              onChange={(e) => setBg({ color: e.target.value.toUpperCase() }, "bg-color")}
              className="border-line h-8 w-10 cursor-pointer rounded-[8px] border bg-white p-0.5"
            />
          </div>
        )}
        {bg.kind === "gradient" && (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {gradients.map(([a, b]) => (
                <button
                  key={a + b}
                  type="button"
                  aria-label={`${a} → ${b}`}
                  className="border-line h-9 rounded-[10px] border"
                  style={{ background: `linear-gradient(${bg.angle}deg, ${a}, ${b})` }}
                  onClick={() => setBg({ color: a.toUpperCase(), color2: b.toUpperCase(), color3: null })}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <input
                type="color"
                aria-label={d("from")}
                value={bg.color}
                onChange={(e) => setBg({ color: e.target.value.toUpperCase() }, "g1")}
                className="border-line h-8 w-10 rounded-[8px] border p-0.5"
              />
              <span className="text-muted">→</span>
              <input
                type="color"
                aria-label={d("to")}
                value={bg.color2}
                onChange={(e) => setBg({ color2: e.target.value.toUpperCase() }, "g2")}
                className="border-line h-8 w-10 rounded-[8px] border p-0.5"
              />
              {bg.color3 ? (
                <>
                  <span className="text-muted">→</span>
                  <input
                    type="color"
                    aria-label={d("third")}
                    value={bg.color3}
                    onChange={(e) => setBg({ color3: e.target.value.toUpperCase() }, "g3")}
                    className="border-line h-8 w-10 rounded-[8px] border p-0.5"
                  />
                  <button
                    type="button"
                    className="text-muted hover:text-ink"
                    aria-label={d("removeThird")}
                    onClick={() => setBg({ color3: null })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-primary font-semibold"
                  onClick={() => setBg({ color3: "#FFFFFF" })}
                >
                  + {d("third")}
                </button>
              )}
            </div>
            {!bg.radial && (
              <Range
                title={d("angle")}
                value={bg.angle}
                min={0}
                max={360}
                unit="°"
                onChange={(v) => setBg({ angle: v }, "angle")}
              />
            )}
            <Switch title={d("radial")} checked={bg.radial} onChange={(v) => setBg({ radial: v })} />
          </>
        )}
        {bg.kind === "image" && (
          <>
            {mediaField(d("picture"), bg.mediaId, "image", (id) => setBg({ mediaId: id }))}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold">{d("overlay")}</span>
              <input
                type="color"
                aria-label={d("overlay")}
                value={bg.overlay}
                onChange={(e) => setBg({ overlay: e.target.value.toUpperCase() }, "ov")}
                className="border-line h-8 w-10 rounded-[8px] border p-0.5"
              />
            </div>
            <Range
              title={d("overlayOpacity")}
              value={bg.overlayOpacity}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => setBg({ overlayOpacity: v }, "ovo")}
            />
            <Range
              title={d("blur")}
              value={bg.blur ?? 0}
              min={0}
              max={40}
              unit="px"
              onChange={(v) => setBg({ blur: v }, "blur")}
            />
          </>
        )}
        {bg.kind === "pattern" && (
          <>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={d("pattern")}>
              {PATTERN_IDS.map((id) => {
                const css = patternCss(id, bg.patternColor, 60);
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={bg.pattern === id}
                    aria-label={d(`patterns.${id}`)}
                    onClick={() => setBg({ pattern: id })}
                    className={cx(
                      "flex h-12 items-end justify-start rounded-[10px] border p-1 text-[10px] font-semibold",
                      bg.pattern === id ? "border-primary border-2" : "border-line",
                    )}
                    style={{
                      background: bg.color,
                      backgroundImage: css?.image,
                      backgroundSize: css?.size,
                      color: readableOnHex(bg.color),
                    }}
                  >
                    {d(`patterns.${id}`)}
                  </button>
                );
              })}
            </div>
            {bg.pattern === "custom" && mediaField(d("tile"), bg.mediaId, "image", (id) => setBg({ mediaId: id }))}
            {bg.pattern !== "custom" && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold">{d("patternColor")}</span>
                <input
                  type="color"
                  aria-label={d("patternColor")}
                  value={bg.patternColor}
                  onChange={(e) => setBg({ patternColor: e.target.value.toUpperCase() }, "pc")}
                  className="border-line h-8 w-10 rounded-[8px] border p-0.5"
                />
              </div>
            )}
            <Range
              title={d("patternOpacity")}
              value={bg.patternOpacity}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => setBg({ patternOpacity: v }, "po")}
            />
            <Range
              title={d("patternScale")}
              value={bg.patternScale}
              min={25}
              max={400}
              unit="%"
              onChange={(v) => setBg({ patternScale: v }, "ps")}
            />
          </>
        )}
      </div>

      {/* Spacing */}
      {!compact && (
        <div className="border-line flex flex-col gap-3 border-t pt-4">
          <span className="text-[13px] font-semibold">{d("spacing")}</span>
          <Range
            title={d("padTop")}
            value={st.padTop}
            min={0}
            max={240}
            unit="px"
            onChange={(v) => set({ padTop: v }, "pt")}
          />
          <Range
            title={d("padBottom")}
            value={st.padBottom}
            min={0}
            max={240}
            unit="px"
            onChange={(v) => set({ padBottom: v }, "pb")}
          />
        </div>
      )}

      {compact ? (
        <ColorField
          title={d("textColor")}
          value={st.text}
          themeLabel={d("auto")}
          onChange={(v) => set({ text: v }, "tx")}
        />
      ) : (
        <>
          {/* Everything else, one click away. */}
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore(!more)}
            className="border-line hover:bg-mist flex h-10 items-center justify-between rounded-[12px] border px-3 text-[13px] font-semibold"
            data-testid="inspector-more"
          >
            {more ? d("fewer") : d("more")}
            <Icon name="chevron-down" size={16} className={cx("transition-transform", more && "rotate-180")} />
          </button>
          {more && (
            <>
              {st.width !== "full" && (
                <div className="flex flex-col gap-3">
                  <Range
                    title={d("exactWidth")}
                    value={st.maxWidth ?? 0}
                    min={0}
                    max={1920}
                    step={10}
                    unit="px"
                    onChange={(v) => set({ maxWidth: v >= 320 ? v : undefined }, "mw")}
                  />
                  <p className="text-muted -mt-2 text-[12px]">{d("exactWidthHint")}</p>
                </div>
              )}
              {/* Edges */}
              {(["edgeTop", "edgeBottom"] as const).map((which) => {
                const e = st[which];
                return (
                  <div key={which} className="border-line flex flex-col gap-2.5 border-t pt-4">
                    <span className="text-[13px] font-semibold">{d(which)}</span>
                    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={d(which)}>
                      {(["none", "wave", "curve", "slant", "torn", "zigzag", "scallop"] as EdgeShape[]).map((shape) => (
                        <button
                          key={shape}
                          type="button"
                          role="radio"
                          aria-checked={e.shape === shape}
                          aria-label={d(`edges.${shape}`)}
                          title={d(`edges.${shape}`)}
                          onClick={() => set({ [which]: { ...e, shape } } as Partial<SectionStyle>)}
                          className={cx(
                            "text-ink-soft flex h-10 flex-col justify-end overflow-hidden rounded-[10px] border px-1 pt-1",
                            e.shape === shape
                              ? "border-primary bg-secondary-container border-2"
                              : "border-line hover:bg-mist",
                            which === "edgeBottom" && "rotate-180",
                          )}
                        >
                          <EdgeTile shape={shape} />
                        </button>
                      ))}
                    </div>
                    {e.shape !== "none" && (
                      <>
                        <Range
                          title={d("edgeHeight")}
                          value={e.height}
                          min={10}
                          max={240}
                          unit="px"
                          onChange={(v) => set({ [which]: { ...e, height: v } } as Partial<SectionStyle>, which)}
                        />
                        <Switch
                          title={d("flip")}
                          checked={e.flip}
                          onChange={(v) => set({ [which]: { ...e, flip: v } } as Partial<SectionStyle>)}
                        />
                      </>
                    )}
                  </div>
                );
              })}

              {/* Inset card */}
              {!compact && (
                <div className="border-line flex flex-col gap-3 border-t pt-4">
                  <Switch
                    title={d("card")}
                    checked={st.card.on}
                    onChange={(v) => set({ card: { ...st.card, on: v } })}
                  />
                  {st.card.on && (
                    <>
                      <ColorField
                        title={d("cardColor")}
                        value={st.card.color}
                        themeLabel={d("theme")}
                        onChange={(v) => set({ card: { ...st.card, color: v } }, "cc")}
                      />
                      <Range
                        title={d("cardRadius")}
                        value={st.card.radius}
                        min={0}
                        max={80}
                        unit="px"
                        onChange={(v) => set({ card: { ...st.card, radius: v } }, "cr")}
                      />
                      <Range
                        title={d("cardPadding")}
                        value={st.card.padding}
                        min={0}
                        max={120}
                        unit="px"
                        onChange={(v) => set({ card: { ...st.card, padding: v } }, "cp")}
                      />
                      <Switch
                        title={d("cardShadow")}
                        checked={st.card.shadow}
                        onChange={(v) => set({ card: { ...st.card, shadow: v } })}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Text colour, anchor, motion */}
              <div className="border-line flex flex-col gap-3 border-t pt-4">
                <ColorField
                  title={d("textColor")}
                  value={st.text}
                  themeLabel={d("auto")}
                  onChange={(v) => set({ text: v }, "tx")}
                />
                {!compact && (
                  <>
                    <Text
                      title={d("anchor")}
                      dir="ltr"
                      placeholder="work"
                      value={st.anchor}
                      onChange={(v) => set({ anchor: v.toLowerCase().replace(/[^a-z0-9-]/g, "") }, "anchor")}
                    />
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-2 text-[12px] font-semibold">
                        {d("animate")} {!isPro && <Badge variant="brand">Pro</Badge>}
                      </span>
                      <Choice
                        title=""
                        value={st.animate}
                        options={[
                          ["none", d("anim.none")],
                          ["fade", d("anim.fade")],
                          ["slide", d("anim.slide")],
                          ["zoom", d("anim.zoom")],
                        ]}
                        onChange={(v) => set({ animate: v })}
                      />
                      {!isPro && st.animate !== "none" && <p className="text-muted text-[12px]">{d("animPro")}</p>}
                    </div>
                  </>
                )}
                {value && !compact && (
                  <Button size="sm" variant="ghost" icon="undo" onClick={() => onChange(defaultSectionStyle())}>
                    {d("reset")}
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Ink or white on a colour (for the pattern tiles' labels). */
export function readableOnHex(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 140 ? "#141414" : "#FFFFFF";
}
