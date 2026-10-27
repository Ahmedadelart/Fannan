"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { type GalleryProject } from "@/components/site/SiteRender";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { DECO_STYLES } from "@/lib/site/deco";
import type { IconName } from "@/components/ui/Icon";
import type { FreeItem } from "@/lib/site/types";
import { Area, Choice, ColorField, Label, Range, Switch, Text, inputCls } from "../_ui/controls";
import { type MediaKind } from "../_ui/media";

/* ---------- a free-form item's settings: Content | Design ---------- */

export function FreeItemSettings({
  it,
  projects,
  language,
  setItem,
  onBack,
  mediaField,
  onDraw,
}: {
  /** Round 11: opens the doodle studio (drawing items). */
  onDraw?: () => void;
  it: FreeItem;
  projects: GalleryProject[];
  language: Locale;
  setItem: (patch: Partial<FreeItem>, key?: string) => void;
  onBack: () => void;
  mediaField: (title: string, id: string | null, kind: MediaKind, apply: (id: string | null) => void) => ReactNode;
}) {
  const f = useTranslations("editor.fields");
  const fr = useTranslations("editor.free");
  const [tab, setTab] = useState<"content" | "design">("content");
  const ik = (name: string) => `${it.id}-${name}`;
  const typed = ["text", "heading", "button", "quote", "list", "project", "badge"].includes(it.kind);
  const framed = ["image", "shape", "button", "video", "map", "project", "panel"].includes(it.kind);
  const linkable = ["image", "button", "shape", "text", "heading", "badge", "icon", "doodle"].includes(it.kind);
  const cornered = ["image", "button", "shape", "video", "map", "audio", "project", "panel", "badge"].includes(it.kind);
  const dc = it.deco;
  const setDeco = (patch: Partial<FreeItem["deco"]>, key?: string) => setItem({ deco: { ...dc, ...patch } }, key);
  const dk = useTranslations("editor.deco");
  const drawn = ["underline", "arrow", "highlight", "doodle", "divider", "icon"].includes(it.kind);

  const content = (
    <>
      {it.kind === "drawing" && (
        <div className="flex flex-col gap-3" data-testid="drawing-settings">
          {onDraw && (
            <Button size="sm" variant="outline" icon="pen" onClick={onDraw} data-testid="drawing-open">
              {it.drawing?.strokes.length ? fr("drawEdit") : fr("drawStart")}
            </Button>
          )}
          {it.drawing && (
            <>
              <Switch
                title={fr("boil")}
                checked={it.drawing.boil.on}
                onChange={(v) => setItem({ drawing: { ...it.drawing!, boil: { ...it.drawing!.boil, on: v } } })}
              />
              {it.drawing.boil.on && (
                <>
                  <Range
                    title={fr("boilAmount")}
                    value={it.drawing.boil.amount}
                    min={5}
                    max={100}
                    onChange={(v) =>
                      setItem({ drawing: { ...it.drawing!, boil: { ...it.drawing!.boil, amount: v } } }, ik("ba"))
                    }
                  />
                  <Range
                    title={fr("boilSpeed")}
                    value={it.drawing.boil.speed}
                    min={0}
                    max={100}
                    onChange={(v) =>
                      setItem({ drawing: { ...it.drawing!, boil: { ...it.drawing!.boil, speed: v } } }, ik("bs"))
                    }
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
      {(it.kind === "text" || it.kind === "heading" || it.kind === "quote") && (
        <Area title={fr("text")} value={it.text} onChange={(v) => setItem({ text: v }, ik("t"))} />
      )}
      {it.kind === "button" && (
        <Text title={fr("label")} value={it.text} onChange={(v) => setItem({ text: v }, ik("t"))} />
      )}
      {(it.kind === "badge" || (it.kind === "doodle" && dc.style === "burst")) && (
        <Text title={dk("words")} value={it.text} onChange={(v) => setItem({ text: v }, ik("t"))} />
      )}
      {(it.kind === "text" || it.kind === "heading" || it.kind === "quote") && (
        <p className="text-muted -mt-2 text-[12px]">{dk("accentHint")}</p>
      )}
      {it.kind === "icon" && (
        <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
          {dk("icon")}
          <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label={dk("icon")}>
            {(DECO_STYLES.icon ?? []).map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={dc.style === name}
                aria-label={name}
                title={name}
                onClick={() => setDeco({ style: name })}
                className={cx(
                  "flex h-9 items-center justify-center rounded-[8px] border",
                  dc.style === name ? "border-primary bg-secondary-container" : "border-line hover:bg-mist",
                )}
              >
                <Icon name={name as IconName} size={18} />
              </button>
            ))}
          </div>
        </div>
      )}
      {it.kind === "quote" && (
        <Text title={fr("author")} value={it.caption} onChange={(v) => setItem({ caption: v }, ik("cap"))} />
      )}
      {it.kind === "image" && mediaField(f("image"), it.mediaId, "image", (id) => setItem({ mediaId: id }))}
      {it.kind === "image" && (
        <Text title={fr("caption")} value={it.caption} onChange={(v) => setItem({ caption: v }, ik("cap"))} />
      )}
      {it.kind === "image" && (
        <Choice
          title={fr("fit")}
          value={it.fit}
          options={[
            ["cover", fr("fill")],
            ["contain", fr("fitWhole")],
          ]}
          onChange={(v) => setItem({ fit: v })}
        />
      )}
      {it.kind === "video" && (
        <Text
          title={fr("videoLink")}
          dir="ltr"
          placeholder="https://youtu.be/"
          value={it.url}
          onChange={(v) => setItem({ url: v }, ik("url"))}
        />
      )}
      {it.kind === "audio" && (
        <Text
          title={fr("audioLink")}
          dir="ltr"
          placeholder="https://soundcloud.com/…"
          value={it.url}
          onChange={(v) => setItem({ url: v }, ik("url"))}
        />
      )}
      {it.kind === "map" && (
        <Text title={fr("address")} value={it.text} onChange={(v) => setItem({ text: v }, ik("t"))} />
      )}
      {it.kind === "social" && <p className="text-muted text-[12px]">{fr("socialHint")}</p>}
      {it.kind === "project" && (
        <Label title={fr("project")}>
          <select
            className={inputCls}
            value={it.projectId ?? ""}
            onChange={(e) => setItem({ projectId: e.target.value || null })}
          >
            <option value="">{fr("projectFirst")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Label>
      )}
      {it.kind === "list" && (
        <div className="flex flex-col gap-3">
          {it.entries.map((e, n) => (
            <div key={n} className="border-line flex flex-col gap-2 rounded-[12px] border p-2.5">
              <Text
                title={fr("question")}
                value={e.title}
                onChange={(v) =>
                  setItem({ entries: it.entries.map((x, j) => (j === n ? { ...x, title: v } : x)) }, ik(`q${n}`))
                }
              />
              <Area
                title={fr("answer")}
                value={e.body}
                onChange={(v) =>
                  setItem({ entries: it.entries.map((x, j) => (j === n ? { ...x, body: v } : x)) }, ik(`a${n}`))
                }
              />
              <Button
                size="sm"
                variant="ghost"
                icon="delete"
                onClick={() => setItem({ entries: it.entries.filter((_, j) => j !== n) })}
              >
                {fr("removeRow")}
              </Button>
            </div>
          ))}
          {it.entries.length < 20 && (
            <Button
              size="sm"
              variant="outline"
              icon="add"
              onClick={() => setItem({ entries: [...it.entries, { title: "", body: "" }] })}
            >
              {fr("addRow")}
            </Button>
          )}
        </div>
      )}
      {linkable && (
        <Text
          title={fr("link")}
          dir="ltr"
          placeholder={fr("linkPlaceholder")}
          value={it.link}
          onChange={(v) => setItem({ link: v }, ik("link"))}
        />
      )}
      <Switch title={fr("hideOnPhone")} checked={it.hideOnPhone} onChange={(v) => setItem({ hideOnPhone: v })} />
      <Switch title={fr("hideEverywhere")} checked={it.hidden} onChange={(v) => setItem({ hidden: v })} />
    </>
  );

  const styles = DECO_STYLES[it.kind];
  const decoDesign = (
    <>
      {styles && it.kind !== "icon" && (
        <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
          {dk("style")}
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={dk("style")}>
            {styles.map((st) => (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={dc.style === st}
                onClick={() => setDeco({ style: st })}
                className={cx(
                  "h-9 rounded-[8px] px-1 text-[11px] font-semibold",
                  dc.style === st
                    ? "bg-secondary-container text-on-secondary-container"
                    : "border-line hover:bg-mist border",
                )}
              >
                {dk(`styles.${st}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {drawn && (
        <ColorField
          title={fr("color")}
          value={it.fill}
          themeLabel={fr("theme")}
          onChange={(v) => setItem({ fill: v }, ik("fill"))}
        />
      )}
      {(it.kind === "underline" ||
        it.kind === "arrow" ||
        it.kind === "divider" ||
        it.kind === "icon" ||
        (it.kind === "doodle" && !dc.filled)) && (
        <Range
          title={fr("thickness")}
          value={dc.stroke}
          min={1}
          max={40}
          unit="px"
          onChange={(v) => setDeco({ stroke: v }, ik("sw"))}
        />
      )}
      {(it.kind === "underline" ||
        (it.kind === "divider" && (dc.style === "wavy" || dc.style === "zigzag" || dc.style === "double"))) && (
        <Range
          title={dk("amp")}
          value={dc.amp}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setDeco({ amp: v }, ik("amp"))}
        />
      )}
      {(it.kind === "underline" ||
        (it.kind === "divider" && (dc.style === "wavy" || dc.style === "zigzag")) ||
        (it.kind === "arrow" && dc.style === "zigzag") ||
        (it.kind === "doodle" && ["star", "burst", "swirl"].includes(dc.style))) && (
        <Range
          title={it.kind === "doodle" && dc.style !== "swirl" ? dk("points") : dk("freq")}
          value={dc.freq}
          min={1}
          max={24}
          onChange={(v) => setDeco({ freq: v }, ik("freq"))}
        />
      )}
      {(it.kind === "arrow" ||
        it.kind === "highlight" ||
        (it.kind === "doodle" && (dc.style === "star" || dc.style === "sparkle"))) && (
        <Range
          title={it.kind === "arrow" ? dk("curve") : it.kind === "highlight" ? dk("slant") : dk("sharp")}
          value={dc.curve}
          min={it.kind === "arrow" ? -100 : 0}
          max={100}
          onChange={(v) => setDeco({ curve: v }, ik("curve"))}
        />
      )}
      {it.kind === "arrow" && (
        <>
          <Choice
            title={dk("head")}
            value={dc.head}
            options={[
              ["none", dk("heads.none")],
              ["open", dk("heads.open")],
              ["filled", dk("heads.filled")],
              ["both", dk("heads.both")],
            ]}
            onChange={(v) => setDeco({ head: v })}
          />
          {dc.head !== "none" && (
            <Range
              title={dk("headSize")}
              value={dc.headSize}
              min={8}
              max={120}
              onChange={(v) => setDeco({ headSize: v }, ik("hs"))}
            />
          )}
        </>
      )}
      {it.kind === "doodle" && (
        <Switch title={dk("filled")} checked={dc.filled} onChange={(v) => setDeco({ filled: v })} />
      )}
      {(it.kind === "underline" || it.kind === "arrow") && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Switch title={dk("dashed")} checked={dc.dashed} onChange={(v) => setDeco({ dashed: v })} />
          <Switch title={dk("round")} checked={dc.round} onChange={(v) => setDeco({ round: v })} />
          <Switch title={dk("flipX")} checked={dc.flipX} onChange={(v) => setDeco({ flipX: v })} />
          <Switch title={dk("flipY")} checked={dc.flipY} onChange={(v) => setDeco({ flipY: v })} />
        </div>
      )}
      {drawn && it.kind !== "icon" && (
        <Range
          title={dk("wobble")}
          value={dc.wobble}
          min={0}
          max={100}
          onChange={(v) => setDeco({ wobble: v }, ik("wob"))}
        />
      )}
      {it.kind === "icon" && (
        <>
          <Choice
            title={dk("backing")}
            value={dc.backing}
            options={[
              ["none", dk("backings.none")],
              ["circle", dk("backings.circle")],
              ["square", dk("backings.square")],
            ]}
            onChange={(v) => setDeco({ backing: v })}
          />
          {dc.backing !== "none" && (
            <ColorField
              title={dk("backingColor")}
              value={it.fill2}
              themeLabel={fr("theme")}
              onChange={(v) => setItem({ fill2: v }, ik("f2"))}
            />
          )}
        </>
      )}
      {it.kind === "image" && (
        <>
          <Choice
            title={dk("mask")}
            value={dc.mask}
            options={[
              ["none", dk("masks.none")],
              ["rounded", dk("masks.rounded")],
              ["circle", dk("masks.circle")],
              ["arch", dk("masks.arch")],
              ["blob", dk("masks.blob")],
            ]}
            onChange={(v) => setDeco({ mask: v })}
          />
          <Choice
            title={dk("frame")}
            value={dc.frame}
            options={[
              ["none", dk("frames.none")],
              ["sticker", dk("frames.sticker")],
              ["polaroid", dk("frames.polaroid")],
            ]}
            onChange={(v) => setDeco({ frame: v })}
          />
          <Choice
            title={dk("filter")}
            value={dc.filter}
            options={[
              ["none", dk("filters.none")],
              ["grayscale", dk("filters.grayscale")],
              ["duotone", dk("filters.duotone")],
            ]}
            onChange={(v) => setDeco({ filter: v })}
          />
          {dc.filter === "duotone" && (
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              {dk("duotone")}
              <input
                type="color"
                aria-label={dk("dark")}
                value={dc.duo1}
                onChange={(e) => setDeco({ duo1: e.target.value.toUpperCase() }, ik("d1"))}
                className="border-line h-8 w-10 rounded-[8px] border p-0.5"
              />
              <input
                type="color"
                aria-label={dk("light")}
                value={dc.duo2}
                onChange={(e) => setDeco({ duo2: e.target.value.toUpperCase() }, ik("d2"))}
                className="border-line h-8 w-10 rounded-[8px] border p-0.5"
              />
            </div>
          )}
          <Choice
            title={dk("backdrop")}
            value={dc.backdrop}
            options={[
              ["none", dk("backdrops.none")],
              ["circle", dk("backdrops.circle")],
              ["blob", dk("backdrops.blob")],
            ]}
            onChange={(v) => setDeco({ backdrop: v })}
          />
          {dc.backdrop !== "none" && (
            <ColorField
              title={dk("backdropColor")}
              value={it.fill2}
              themeLabel={fr("theme")}
              onChange={(v) => setItem({ fill2: v }, ik("f2"))}
            />
          )}
        </>
      )}
      {it.kind === "button" && (
        <Switch title={dk("arrow")} checked={dc.arrow} onChange={(v) => setDeco({ arrow: v })} />
      )}
      {(it.kind === "button" || it.kind === "shape" || it.kind === "panel" || it.kind === "badge") && (
        <ColorField
          title={dk("gradientTo")}
          value={it.fill2}
          themeLabel={dk("noGradient")}
          onChange={(v) => setItem({ fill2: v }, ik("f2"))}
        />
      )}
      {(it.kind === "text" || it.kind === "heading" || it.kind === "quote") && (
        <Switch title={dk("textShadow")} checked={dc.textShadow} onChange={(v) => setDeco({ textShadow: v })} />
      )}
    </>
  );

  const design = (
    <>
      {decoDesign}
      {(it.kind === "button" || it.kind === "badge") && (
        <Choice
          title={fr("style")}
          value={it.variant}
          options={[
            ["filled", fr("filled")],
            ["outline", fr("outline")],
            ["text", fr("plain")],
          ]}
          onChange={(v) => setItem({ variant: v })}
        />
      )}
      {it.kind === "shape" && (
        <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
          {fr("shape")}
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={fr("shape")}>
            {(["rect", "circle", "pill", "triangle", "arch"] as const).map((sh) => (
              <button
                key={sh}
                type="button"
                role="radio"
                aria-checked={it.shape === sh}
                aria-label={fr(`shapes.${sh}`)}
                title={fr(`shapes.${sh}`)}
                onClick={() => setItem({ shape: sh })}
                className={cx(
                  "flex h-10 items-center justify-center rounded-[10px] border",
                  it.shape === sh ? "border-primary bg-secondary-container" : "border-line hover:bg-mist",
                )}
              >
                <span
                  className="bg-ink block"
                  style={{
                    width: sh === "pill" ? 22 : 16,
                    height: sh === "pill" ? 11 : 16,
                    borderRadius: sh === "circle" ? "50%" : sh === "pill" ? 999 : sh === "arch" ? "999px 999px 0 0" : 2,
                    clipPath: sh === "triangle" ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {(typed || it.kind === "social") && (
        <Range
          title={it.kind === "social" ? fr("iconSize") : fr("size")}
          value={it.size}
          min={8}
          max={it.kind === "social" ? 96 : 200}
          unit="px"
          onChange={(v) => setItem({ size: v }, ik("size"))}
        />
      )}
      {typed && (
        <>
          <Choice
            title={fr("font")}
            value={it.font}
            options={[
              ["heading", fr("fontHeading")],
              ["body", fr("fontBody")],
            ]}
            onChange={(v) => setItem({ font: v })}
          />
          <Range
            title={fr("weight")}
            value={it.weight}
            min={300}
            max={900}
            onChange={(v) => setItem({ weight: Math.round(v / 100) * 100 }, ik("w"))}
          />
          <Range
            title={fr("lineHeight")}
            value={it.lineHeight}
            min={80}
            max={240}
            unit="%"
            onChange={(v) => setItem({ lineHeight: v }, ik("lh"))}
          />
          {language !== "ar" && (
            <Range
              title={fr("tracking")}
              value={it.tracking}
              min={-10}
              max={50}
              onChange={(v) => setItem({ tracking: v }, ik("tr"))}
            />
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Switch title={fr("upper")} checked={it.upper} onChange={(v) => setItem({ upper: v })} />
            <Switch title={fr("italic")} checked={it.italic} onChange={(v) => setItem({ italic: v })} />
          </div>
        </>
      )}
      {(typed || it.kind === "social") && (
        <Choice
          title={f("align")}
          value={it.align}
          options={[
            ["start", f("alignStart")],
            ["center", f("alignCenter")],
            ["end", fr("alignEnd")],
          ]}
          onChange={(v) => setItem({ align: v })}
        />
      )}
      {(typed || it.kind === "social") && (
        <ColorField
          title={fr("textColor")}
          value={it.color}
          themeLabel={fr("theme")}
          onChange={(v) => setItem({ color: v }, ik("color"))}
        />
      )}
      {(it.kind === "button" ||
        it.kind === "shape" ||
        it.kind === "line" ||
        it.kind === "panel" ||
        it.kind === "badge") && (
        <ColorField
          title={fr("color")}
          value={it.fill}
          themeLabel={fr("theme")}
          onChange={(v) => setItem({ fill: v }, ik("fill"))}
        />
      )}
      {it.kind === "line" && (
        <Range
          title={fr("thickness")}
          value={it.size}
          min={8}
          max={160}
          onChange={(v) => setItem({ size: v }, ik("size"))}
        />
      )}
      {cornered && it.shape !== "circle" && (
        <Range
          title={fr("corners")}
          value={Math.min(it.radius, 200)}
          min={0}
          max={200}
          unit="px"
          onChange={(v) => setItem({ radius: v }, ik("radius"))}
        />
      )}
      {framed && (
        <>
          <Range
            title={fr("border")}
            value={it.borderWidth}
            min={0}
            max={24}
            unit="px"
            onChange={(v) => setItem({ borderWidth: v }, ik("bw"))}
          />
          {it.borderWidth > 0 && (
            <ColorField
              title={fr("borderColor")}
              value={it.borderColor}
              themeLabel={fr("theme")}
              onChange={(v) => setItem({ borderColor: v }, ik("bc"))}
            />
          )}
          <Switch title={fr("shadow")} checked={it.shadow} onChange={(v) => setItem({ shadow: v })} />
        </>
      )}
      <Range
        title={fr("rotate")}
        value={it.rotate}
        min={-180}
        max={180}
        unit="°"
        onChange={(v) => setItem({ rotate: v }, ik("rot"))}
      />
      <Range
        title={fr("opacity")}
        value={it.opacity}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => setItem({ opacity: v }, ik("op"))}
      />
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-ink-soft hover:text-ink self-start text-[12px] font-semibold"
      >
        {fr("backToSection")}
      </button>
      <div className="flex items-center gap-2 text-[14px] font-semibold">{fr(`kinds.${it.kind}`)}</div>
      <div role="tablist" className="border-line -mt-1 grid grid-cols-2 border-b">
        {(["content", "design"] as const).map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={cx(
              "h-9 border-b-2 text-[13px]",
              tab === x ? "border-primary text-ink font-semibold" : "text-muted border-transparent font-medium",
            )}
          >
            {fr(`tabs.${x}`)}
          </button>
        ))}
      </div>
      {tab === "content" ? content : design}
    </>
  );
}
