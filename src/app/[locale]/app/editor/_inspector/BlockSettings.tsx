"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { kindOf, SOCIAL_NETWORKS } from "@/lib/site/blocks";
import { CONTACT_WORDS, contactFormOf, type LegacyContactFields } from "@/lib/site/contact";
import { toneBase } from "@/lib/site/samples";
import { DECO_STYLES } from "@/lib/site/deco";
import type { IconName } from "@/components/ui/Icon";
import { defaultSectionStyle } from "@/lib/site/normalize";
import { FREE_COLS, freeBottom } from "@/lib/site/free";
import { LinksSettings } from "../LinksSettings";
import type { Block, BlockOf, ContactForm as ContactFormShape, PageDraft, Theme } from "@/lib/site/types";
import { parseVideoLink } from "@/lib/video";
import { FreeItemSettings } from "./FreeItemSettings";
import { SectionDesign } from "./SectionDesign";
import { GalleryLayoutPicker, ImagesSettings, SectionTabs } from "./gallery";
import { Area, Choice, ColorField, Label, More, Range, Switch, Text, inputCls } from "../_ui/controls";
import { imageSources } from "@/lib/media";
import { MediaField, type MediaKind } from "../_ui/media";

/* ---------- Block settings (right panel) ---------- */

export function BlockSettings({
  block,
  media,
  categories,
  update,
  openPicker,
  freeItem = null,
  onFreeItem,
  contactFallback,
  language,
  projects = [],
  theme,
  isPro = false,
  siteUrl = "",
  shortBase = "",
  pages = [],
  page,
  onDrawItem,
}: {
  /** Round 11: open the doodle studio for a drawing item. */
  onDrawItem?: (itemId: string) => void;
  /** Link pages (round 9): the site's address, the short-link address, and the pages a short link can open. */
  siteUrl?: string;
  shortBase?: string;
  pages?: PageDraft[];
  page?: PageDraft;
  /** The site's colours, for quick background and gradient choices. */
  theme?: Theme;
  /** Pro sites get scroll animations on the live site. */
  isPro?: boolean;
  /** Projects, for project card items. */
  projects?: GalleryProject[];
  /** Site-wide contact settings from before contact sections had their own. */
  contactFallback?: LegacyContactFields;
  /** The site's language: default field names on the contact form follow it. */
  language: Locale;
  freeItem?: string | null;
  onFreeItem?: (id: string | null) => void;
  block: Block;
  media: Record<string, SiteMedia>;
  categories: Record<string, string>;
  update: (patch: Partial<Block>, key?: string) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
}) {
  const t = useTranslations("editor");
  const f = useTranslations("editor.fields");
  const pt = useTranslations("editor.pic");
  const g = useTranslations("editor.gallery");
  const fr = useTranslations("editor.free");
  const c = useTranslations("editor.contactForm");
  const k = (name: string) => `${block.id}-${name}`;
  const set = <T extends Block>(patch: Partial<T>, key?: string) => update(patch as Partial<Block>, key);
  const mediaField = (title: string, id: string | null, kind: MediaKind, apply: (id: string | null) => void) => (
    <MediaField title={title} id={id} kind={kind} media={media} onChange={apply} openPicker={openPicker} />
  );
  const align = (b: { align: "start" | "center" }) => (
    <Choice
      title={f("align")}
      value={b.align}
      options={[
        ["start", f("alignStart")],
        ["center", f("alignCenter")],
      ]}
      onChange={(v) => set({ align: v } as never)}
    />
  );

  const list = <T,>(
    items: T[],
    render: (item: T, change: (patch: Partial<T>) => void) => ReactNode,
    blank: T,
    max = 30,
  ) => (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] font-semibold">{f("items")}</div>
      {items.map((item, i) => (
        <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
          {render(item, (patch) =>
            set({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) } as never, k(`item-${i}`)),
          )}
          <Button
            size="sm"
            variant="ghost"
            icon="delete"
            onClick={() => set({ items: items.filter((_, j) => j !== i) } as never)}
          >
            {f("removeItem")}
          </Button>
        </div>
      ))}
      {items.length < max && (
        <Button size="sm" variant="outline" icon="add" onClick={() => set({ items: [...items, blank] } as never)}>
          {f("addItem")}
        </Button>
      )}
    </div>
  );

  let body: ReactNode = null;
  switch (block.type) {
    case "spread": {
      const sp = projects.find((x) => x.id === block.projectId);
      const ids = sp?.mediaIds ?? [];
      const sx = (name: string) => t(`spreadx.${name}`);
      body = (
        <>
          <Label title={sx("project")}>
            <select
              className={inputCls}
              value={block.projectId ?? ""}
              onChange={(e) => set({ projectId: e.target.value || null, lead: 0, supports: [1, 2, 3] })}
              data-testid="spread-project"
            >
              <option value="">{t("feature.pick")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Label>
          {sp && ids.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold">{sx("pictures")}</span>
              <div className="grid grid-cols-4 gap-1.5" data-testid="spread-pictures">
                {ids.map((id, i) => {
                  const pic = media[id];
                  const src = pic ? imageSources(pic, 400)?.src : null;
                  const isLead = i === block.lead;
                  const sup = block.supports.indexOf(i);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={isLead || sup >= 0}
                      title={isLead ? sx("lead") : sx("picturesHint")}
                      onClick={() => {
                        if (isLead) return;
                        if (sup >= 0) set({ supports: block.supports.filter((x) => x !== i) });
                        else if (block.supports.length < 3) set({ supports: [...block.supports, i] });
                      }}
                      className={cx(
                        "bg-mist relative aspect-square overflow-hidden rounded-[8px] border-2",
                        isLead
                          ? "border-lime"
                          : sup >= 0
                            ? "border-ink"
                            : "border-transparent opacity-70 hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                      {(isLead || sup >= 0) && (
                        <span
                          className={cx(
                            "absolute start-1 top-1 rounded-[4px] px-1 text-[10px] font-bold",
                            isLead ? "bg-lime text-on-lime" : "bg-ink text-white",
                          )}
                        >
                          {isLead ? sx("lead") : sup + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <Label title={sx("leadPick")}>
                <select
                  className={inputCls}
                  value={block.lead}
                  onChange={(e) =>
                    set({
                      lead: Number(e.target.value),
                      supports: block.supports.filter((x) => x !== Number(e.target.value)),
                    })
                  }
                  data-testid="spread-lead"
                >
                  {ids.map((_, i) => (
                    <option key={i} value={i}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
          )}
          <Text
            title={sx("label")}
            value={block.label}
            placeholder={sp?.title}
            onChange={(v) => set({ label: v }, k("label"))}
          />
          <More>
            <Switch title={sx("counter")} checked={block.counter} onChange={(v) => set({ counter: v })} />
            <Switch title={sx("logos")} checked={block.logos} onChange={(v) => set({ logos: v })} />
            <Switch title={sx("words")} checked={block.words} onChange={(v) => set({ words: v })} />
            <Switch title={sx("snap")} checked={block.snap} onChange={(v) => set({ snap: v })} />
          </More>
        </>
      );
      break;
    }
    case "brand": {
      const bx = (name: string) => t(`brandx.${name}`);
      const tiles = block.tiles;
      const setTile = (i: number, patch: Partial<(typeof tiles)[number]>, key?: string) =>
        set(
          { tiles: tiles.map((x, j) => (j === i ? { ...x, ...patch } : x)) },
          key ? k(`tile-${i}-${key}`) : undefined,
        );
      const fontChoice = (
        title: string,
        value: "heading" | "arabic" | "body",
        apply: (v: "heading" | "arabic" | "body") => void,
      ) => (
        <Choice
          title={title}
          value={value}
          options={[
            ["heading", bx("fonts.heading")],
            ["arabic", bx("fonts.arabic")],
            ["body", bx("fonts.body")],
          ]}
          onChange={apply}
        />
      );
      body = (
        <>
          {mediaField(bx("logo"), block.logoId, "image", (id) => set({ logoId: id }))}
          {!block.logoId && (
            <div className="grid grid-cols-2 gap-2.5">
              <Text
                title={bx("markLetters")}
                value={block.mark?.letters ?? ""}
                placeholder="rb"
                onChange={(v) =>
                  set({ mark: v ? { letters: v.slice(0, 4), word: block.mark?.word ?? "" } : null }, k("mark"))
                }
              />
              <Text
                title={bx("markWord")}
                value={block.mark?.word ?? ""}
                placeholder="REDBUBBLE"
                onChange={(v) => set({ mark: { letters: block.mark?.letters ?? "", word: v } }, k("markw"))}
              />
            </div>
          )}
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <div className="grid grid-cols-2 gap-2.5">
            <Text
              title={bx("button")}
              value={block.button.label}
              onChange={(v) => set({ button: { ...block.button, label: v } }, k("btn"))}
            />
            <Text
              title={bx("buttonLink")}
              dir="ltr"
              placeholder="https://"
              value={block.button.link}
              onChange={(v) => set({ button: { ...block.button, link: v } }, k("lnk"))}
            />
          </div>
          <div className="flex flex-col gap-2" data-testid="brand-tiles">
            <span className="text-[12px] font-semibold">{bx("tiles")}</span>
            {tiles.map((tile, i) => (
              <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
                {mediaField(f("image"), tile.mediaId, "image", (id) => setTile(i, { mediaId: id }))}
                <Text title={f("title")} value={tile.title} onChange={(v) => setTile(i, { title: v }, "title")} />
                <Text title={f("text")} value={tile.text} onChange={(v) => setTile(i, { text: v }, "text")} />
                <Label title={bx("tileProject")}>
                  <select
                    className={inputCls}
                    value={tile.projectId ?? ""}
                    onChange={(e) => setTile(i, { projectId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </Label>
                {tile.projectId ? (
                  <Range
                    title={bx("tileSheet")}
                    value={tile.sheet + 1}
                    min={1}
                    max={Math.max(1, projects.find((p) => p.id === tile.projectId)?.mediaIds?.length ?? 1)}
                    onChange={(v) => setTile(i, { sheet: v - 1 }, "sheet")}
                  />
                ) : (
                  <Text
                    title={bx("tileLink")}
                    dir="ltr"
                    placeholder="https://"
                    value={tile.link}
                    onChange={(v) => setTile(i, { link: v }, "link")}
                  />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon="delete"
                  onClick={() => set({ tiles: tiles.filter((_, j) => j !== i) })}
                >
                  {bx("removeTile")}
                </Button>
              </div>
            ))}
            {tiles.length < 12 && (
              <Button
                size="sm"
                variant="outline"
                icon="add"
                onClick={() =>
                  set({
                    tiles: [
                      ...tiles,
                      {
                        mediaId: null,
                        tone: toneBase("#5B3A2E"),
                        title: "",
                        text: "",
                        link: "",
                        projectId: null,
                        sheet: 0,
                      },
                    ],
                  })
                }
              >
                {bx("addTile")}
              </Button>
            )}
          </div>
          <More>
            {fontChoice(bx("headingFont"), block.headingFont, (v) => set({ headingFont: v }))}
            <Choice
              title={bx("buttonStyle")}
              value={block.button.style}
              options={[
                ["filled", t("parts.filled")],
                ["outline", t("parts.outline")],
              ]}
              onChange={(v) => set({ button: { ...block.button, style: v } })}
            />
            <Switch
              title={bx("buttonPill")}
              checked={!!block.button.pill}
              onChange={(v) => set({ button: { ...block.button, pill: v || undefined } })}
            />
            <Range
              title={bx("logoWidth")}
              value={block.logoWidth}
              min={60}
              max={480}
              unit="px"
              onChange={(v) => set({ logoWidth: v }, k("lw"))}
            />
            <Range
              title={bx("columns")}
              value={block.columns}
              min={1}
              max={6}
              onChange={(v) => set({ columns: v }, k("cols"))}
            />
            <Choice
              title={bx("tileRatio")}
              value={block.tileRatio}
              options={(["16/9", "4/3", "1/1", "4/5", "3/4", "15/16"] as const).map((x) => [x, x.replace("/", ":")])}
              onChange={(v) => set({ tileRatio: v })}
            />
            <Range
              title={bx("tileRadius")}
              value={block.tileRadius}
              min={0}
              max={40}
              unit="px"
              onChange={(v) => set({ tileRadius: v }, k("tr"))}
            />
            <Switch title={bx("tileBorder")} checked={block.tileBorder} onChange={(v) => set({ tileBorder: v })} />
            {fontChoice(bx("tileFont"), block.tileFont, (v) => set({ tileFont: v }))}
            <Choice
              title={bx("dir")}
              value={block.dir}
              options={[
                ["auto", bx("dirs.auto")],
                ["ltr", bx("dirs.ltr")],
                ["rtl", bx("dirs.rtl")],
              ]}
              onChange={(v) => set({ dir: v })}
            />
            <div className="border-line flex flex-col gap-3 border-t pt-4">
              <span className="text-[13px] font-semibold">{bx("colors")}</span>
              <Label title={bx("accent")}>
                <input
                  type="color"
                  value={block.colors.accent}
                  onChange={(e) =>
                    set({ colors: { ...block.colors, accent: e.target.value.toUpperCase() } }, k("accent"))
                  }
                  className="border-line h-9 w-full cursor-pointer rounded-[8px] border p-0.5"
                />
              </Label>
              <ColorField
                title={bx("textColor")}
                value={block.colors.text}
                themeLabel={t("design2.auto")}
                onChange={(v) => set({ colors: { ...block.colors, text: v } }, k("ctext"))}
              />
              <ColorField
                title={bx("headingColor")}
                value={block.colors.heading ?? null}
                themeLabel={t("design2.auto")}
                onChange={(v) => set({ colors: { ...block.colors, heading: v } }, k("chead"))}
              />
              <ColorField
                title={bx("tileColor")}
                value={block.colors.tile}
                themeLabel={t("design2.auto")}
                onChange={(v) => set({ colors: { ...block.colors, tile: v } }, k("ctile"))}
              />
              <ColorField
                title={bx("tileTextColor")}
                value={block.colors.tileText}
                themeLabel={t("design2.auto")}
                onChange={(v) => set({ colors: { ...block.colors, tileText: v } }, k("ctt"))}
              />
            </div>
          </More>
        </>
      );
      break;
    }
    case "links":
      body = (
        <LinksSettings
          block={block}
          set={(patch, key) => set(patch, key)}
          mediaField={mediaField}
          isPro={isPro}
          siteUrl={siteUrl}
          shortBase={shortBase}
          pages={pages}
          page={page ?? pages[0]}
        />
      );
      break;
    case "cards": {
      const v = block.variant;
      const cf = (name: string) => t(`cardsForm.${name}`);
      const withIcon = v === "icons";
      const withPicture = [
        "images",
        "tiles",
        "mosaic",
        "testimonials",
        "timeline",
        "films",
        "marquee",
        "awards",
      ].includes(v);
      const withText = [
        "icons",
        "images",
        "stats",
        "faq",
        "testimonials",
        "timeline",
        "films",
        "offers",
        "awards",
        "list",
      ].includes(v);
      const withMeta = ["testimonials", "timeline", "press", "offers", "tiles", "awards", "list"].includes(v);
      const withLink = ["images", "nav", "press", "offers", "tiles", "awards"].includes(v);
      const withButton = ["images", "offers"].includes(v);
      body = (
        <>
          {v !== "nav" && v !== "mosaic" && (
            <>
              <Text title={f("heading")} value={block.heading} onChange={(x) => set({ heading: x }, k("h"))} />
              <Area title={cf("intro")} value={block.intro} onChange={(x) => set({ intro: x }, k("intro"))} />
            </>
          )}
          {["icons", "images", "tiles", "stats", "mosaic", "films", "offers"].includes(v) && (
            <Range
              title={cf("columns")}
              value={block.columns}
              min={1}
              max={6}
              onChange={(x) => set({ columns: x }, k("cols"))}
            />
          )}
          {["images", "tiles", "icons", "stats"].includes(v) && (
            <More>
              {v === "images" && (
                <Switch title={t("cardsx.flat")} checked={!!block.flat} onChange={(x) => set({ flat: x })} />
              )}
              {v === "images" && block.flat && (
                <Choice
                  title={t("cardsx.tileRatio")}
                  value={block.tileRatio ?? "1/1"}
                  options={(["1/1", "4/3", "16/9", "4/5"] as const).map((x) => [x, x.replace("/", ":")])}
                  onChange={(x) => set({ tileRatio: x })}
                />
              )}
              {v === "images" && (
                <Switch
                  title={t("cardsx.bigTitles")}
                  checked={!!block.bigTitles}
                  onChange={(x) => set({ bigTitles: x })}
                />
              )}
              {v === "images" && (
                <Switch
                  title={t("cardsx.accentTitles")}
                  checked={!!block.accentTitles}
                  onChange={(x) => set({ accentTitles: x })}
                />
              )}
              {v === "tiles" && (
                <>
                  <Choice
                    title={t("cardsx.tileRatio")}
                    value={block.tileRatio ?? "4/5"}
                    options={(["4/5", "1/1", "4/3", "16/9"] as const).map((x) => [x, x.replace("/", ":")])}
                    onChange={(x) => set({ tileRatio: x })}
                  />
                  <Switch
                    title={t("cardsx.tileCenter")}
                    checked={block.tileText === "center"}
                    onChange={(x) => set({ tileText: x ? "center" : "corner" })}
                  />
                </>
              )}
              {["icons", "stats"].includes(v) && (
                <Choice
                  title={f("align")}
                  value={block.align}
                  options={[
                    ["start", f("alignStart")],
                    ["center", f("alignCenter")],
                  ]}
                  onChange={(x) => set({ align: x })}
                />
              )}
            </More>
          )}
          {v === "mosaic" && (
            <>
              <Text title={f("button")} value={block.button} onChange={(x) => set({ button: x }, k("btn"))} />
              <Text
                title={cf("link")}
                dir="ltr"
                placeholder="/sketches"
                value={block.link}
                onChange={(x) => set({ link: x }, k("lnk"))}
              />
            </>
          )}
          {v === "press" && mediaField(cf("cover"), block.mediaId, "image", (id) => set({ mediaId: id }))}
          {list(
            block.items,
            (it, change) => (
              <>
                {withIcon && (
                  <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label={t("deco.icon")}>
                    {(DECO_STYLES.icon ?? []).slice(0, 12).map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={it.icon === name}
                        aria-label={name}
                        onClick={() => change({ icon: name })}
                        className={cx(
                          "flex h-8 items-center justify-center rounded-[8px] border",
                          it.icon === name ? "border-primary bg-secondary-container" : "border-line hover:bg-mist",
                        )}
                      >
                        <Icon name={name as IconName} size={16} />
                      </button>
                    ))}
                  </div>
                )}
                {withPicture &&
                  mediaField(
                    v === "testimonials" ? cf("photo") : v === "marquee" ? cf("logo") : f("image"),
                    it.mediaId,
                    "image",
                    (id) => change({ mediaId: id }),
                  )}
                {v !== "mosaic" && (
                  <Text
                    title={
                      v === "stats"
                        ? cf("number")
                        : v === "testimonials"
                          ? cf("name")
                          : v === "faq"
                            ? cf("question")
                            : v === "list"
                              ? f("role")
                              : f("title")
                    }
                    value={it.title}
                    onChange={(x) => change({ title: x })}
                  />
                )}
                {withMeta && (
                  <Text
                    title={
                      v === "testimonials"
                        ? cf("role")
                        : v === "timeline"
                          ? cf("step")
                          : v === "offers"
                            ? cf("badge")
                            : v === "awards"
                              ? cf("tag")
                              : v === "list"
                                ? cf("years")
                                : cf("meta")
                    }
                    value={it.meta}
                    onChange={(x) => change({ meta: x })}
                  />
                )}
                {v === "offers" && <Text title={cf("price")} value={it.price} onChange={(x) => change({ price: x })} />}
                {v === "list" && (
                  <Text title={cf("org")} value={it.subtitle ?? ""} onChange={(x) => change({ subtitle: x })} />
                )}
                {v === "awards" && (
                  <Text title={cf("date")} value={it.date ?? ""} onChange={(x) => change({ date: x })} />
                )}
                {withText && (
                  <Area
                    title={
                      v === "stats"
                        ? cf("label")
                        : v === "faq"
                          ? cf("answer")
                          : v === "testimonials"
                            ? cf("quote")
                            : v === "offers"
                              ? cf("lines")
                              : f("text")
                    }
                    value={it.text}
                    onChange={(x) => change({ text: x })}
                  />
                )}
                {v === "testimonials" && (
                  <Range title={cf("stars")} value={it.stars} min={0} max={5} onChange={(x) => change({ stars: x })} />
                )}
                {v === "films" && (
                  <Text
                    title={cf("video")}
                    dir="ltr"
                    placeholder="https://youtu.be/"
                    value={it.url}
                    onChange={(x) => change({ url: x })}
                  />
                )}
                {withButton && <Text title={f("button")} value={it.button} onChange={(x) => change({ button: x })} />}
                {withLink && (
                  <Text
                    title={cf("link")}
                    dir="ltr"
                    placeholder={v === "nav" ? "#work" : "https://"}
                    value={it.link}
                    onChange={(x) => change({ link: x })}
                  />
                )}
              </>
            ),
            {
              title: "",
              text: "",
              meta: "",
              icon: "sparkle",
              mediaId: null,
              tone: block.tone,
              link: "",
              button: "",
              stars: v === "testimonials" ? 5 : 0,
              price: "",
              url: "",
            },
            24,
          )}
          {v === "nav" && <p className="text-muted text-[12px]">{cf("navHint")}</p>}
        </>
      );
      break;
    }
    case "cover":
      body = (
        <>
          {mediaField(f("image"), block.mediaId, "image", (id) => set({ mediaId: id }))}
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Text title={f("subheading")} value={block.subheading} onChange={(v) => set({ subheading: v }, k("s"))} />
          <div className="grid grid-cols-2 gap-2.5">
            <Text
              title={t("coverx.button")}
              value={block.button ?? ""}
              onChange={(v) => set({ button: v }, k("btn"))}
            />
            <Text
              title={t("coverx.link")}
              dir="ltr"
              placeholder="https://"
              value={block.link ?? ""}
              onChange={(v) => set({ link: v }, k("lnk"))}
            />
          </div>
          <Choice
            title={f("height")}
            value={block.height}
            options={[
              ["large", f("heightLarge")],
              ["full", f("heightFull")],
            ]}
            onChange={(v) => set({ height: v })}
          />
          <More>
            <div className="flex flex-col gap-2" data-testid="cover-slides">
              <span className="text-[12px] font-semibold">{t("coverx.slides")}</span>
              {(block.slides ?? []).map((sl, i) => (
                <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
                  {mediaField(f("image"), sl.mediaId, "image", (id) =>
                    set({ slides: (block.slides ?? []).map((x, j) => (j === i ? { ...x, mediaId: id } : x)) }),
                  )}
                  <Text
                    title={t("coverx.slideCaption")}
                    value={sl.caption}
                    onChange={(v) =>
                      set(
                        { slides: (block.slides ?? []).map((x, j) => (j === i ? { ...x, caption: v } : x)) },
                        k(`sl-${i}`),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="delete"
                    onClick={() => set({ slides: (block.slides ?? []).filter((_, j) => j !== i) })}
                  >
                    {t("coverx.removeSlide")}
                  </Button>
                </div>
              ))}
              {(block.slides?.length ?? 0) < 12 && (
                <Button
                  size="sm"
                  variant="outline"
                  icon="add"
                  onClick={() => set({ slides: [...(block.slides ?? []), { mediaId: null, caption: "" }] })}
                >
                  {t("coverx.addSlide")}
                </Button>
              )}
            </div>
            {!!block.slides?.length && (
              <Range
                title={t("coverx.interval")}
                value={block.interval ?? 6}
                min={2}
                max={30}
                unit="s"
                onChange={(v) => set({ interval: v }, k("iv"))}
              />
            )}
            <Text
              title={t("coverx.caption")}
              value={block.caption ?? ""}
              onChange={(v) => set({ caption: v }, k("cap"))}
            />
            <Text title={t("coverx.note")} value={block.note ?? ""} onChange={(v) => set({ note: v }, k("note"))} />
            <div className="flex flex-col gap-2" data-testid="cover-stats-settings">
              <span className="text-[12px] font-semibold">{t("coverx.stats")}</span>
              {(block.stats ?? []).map((st, i) => (
                <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Text
                      title={t("coverx.statValue")}
                      value={st.value}
                      placeholder="+100K"
                      onChange={(v) =>
                        set(
                          { stats: (block.stats ?? []).map((x, j) => (j === i ? { ...x, value: v } : x)) },
                          k(`sv-${i}`),
                        )
                      }
                    />
                    <Text
                      title={t("coverx.statLabel")}
                      value={st.label}
                      onChange={(v) =>
                        set(
                          { stats: (block.stats ?? []).map((x, j) => (j === i ? { ...x, label: v } : x)) },
                          k(`sl-${i}`),
                        )
                      }
                    />
                  </div>
                  <Text
                    title={t("coverx.statLink")}
                    dir="ltr"
                    placeholder="https://"
                    value={st.link}
                    onChange={(v) =>
                      set({ stats: (block.stats ?? []).map((x, j) => (j === i ? { ...x, link: v } : x)) }, k(`sk-${i}`))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="delete"
                    onClick={() => set({ stats: (block.stats ?? []).filter((_, j) => j !== i) })}
                  >
                    {t("coverx.removeStat")}
                  </Button>
                </div>
              ))}
              {(block.stats?.length ?? 0) < 4 && (
                <Button
                  size="sm"
                  variant="outline"
                  icon="add"
                  onClick={() => set({ stats: [...(block.stats ?? []), { value: "", label: "", link: "" }] })}
                >
                  {t("coverx.addStat")}
                </Button>
              )}
            </div>
            <Text
              title={t("coverx.eyebrow")}
              value={block.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v }, k("eb"))}
            />
            <Switch title={t("coverx.inset")} checked={!!block.inset} onChange={(v) => set({ inset: v })} />
            {!block.inset && (
              <Switch
                title={t("coverx.roundBottom")}
                checked={!!block.roundBottom}
                onChange={(v) => set({ roundBottom: v })}
              />
            )}
            <Choice
              title={t("coverx.size")}
              value={block.size ?? "l"}
              options={(["s", "m", "l", "xl"] as const).map((x) => [x, t(`coverx.sizes.${x}`)])}
              onChange={(v) => set({ size: v })}
            />
            <Label title={f("colour")}>
              <input
                type="color"
                value={toneBase(block.tone)}
                onChange={(e) => set({ tone: e.target.value.toUpperCase() }, k("tone"))}
                className="border-line h-9 w-full rounded-[8px] border p-0.5"
              />
            </Label>
          </More>
        </>
      );
      break;
    case "text":
      body = (
        <>
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          {align(block)}
          <Choice
            title={f("size")}
            value={block.size}
            options={[
              ["body", f("sizeBody")],
              ["large", f("sizeLarge")],
            ]}
            onChange={(v) => set({ size: v })}
          />
        </>
      );
      break;
    case "hero":
      body = (
        <>
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          {align(block)}
        </>
      );
      break;
    case "columns":
      body = list(
        block.items,
        (c, change) => (
          <>
            <Text title={f("heading")} value={c.heading} onChange={(v) => change({ heading: v })} />
            <Area title={f("text")} value={c.text} onChange={(v) => change({ text: v })} />
          </>
        ),
        { heading: "", text: "" },
        4,
      );
      break;
    case "gallery": {
      const b = block as BlockOf<"gallery">;
      body = (
        <>
          <Label title={g("source")}>
            <select className={inputCls} value={b.source} onChange={(e) => set({ source: e.target.value })}>
              <option value="all">{g("all")}</option>
              {Object.entries(categories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
              {(() => {
                const tags = [...new Set(projects.flatMap((p) => p.tags ?? []).map((x) => x.toLowerCase()))].sort();
                return tags.length ? (
                  <optgroup label={t("galleryx.tags")}>
                    {tags.map((x) => (
                      <option key={x} value={`tag:${x}`}>
                        #{x}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })()}
            </select>
          </Label>
          <GalleryLayoutPicker b={b} set={set} isPro={isPro} />
          <Range
            title={g("columns")}
            value={b.columns}
            min={1}
            max={6}
            onChange={(v) => set({ columns: v }, k("cols"))}
          />
          <Range
            title={g("spacing")}
            value={b.gap}
            min={0}
            max={120}
            unit="px"
            onChange={(v) => set({ gap: v }, k("gap"))}
          />
          <Label title={g("shape")}>
            <select
              className={inputCls}
              value={b.ratio}
              onChange={(e) => set({ ratio: e.target.value as BlockOf<"gallery">["ratio"] })}
            >
              {(["16:9", "4:3", "1:1", "4:5", "3:4", "2:3"] as const).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="original">{g("original")}</option>
            </select>
          </Label>
          <Switch title={g("captions")} checked={b.captions} onChange={(v) => set({ captions: v })} />
          <div className="flex flex-col gap-1.5" data-testid="gallery-lines">
            <span className="text-[12px] font-semibold">{t("galleryx.lines")}</span>
            <div className="flex flex-wrap gap-1.5">
              {(["network", "client", "role", "studio", "year"] as const).map((line) => {
                const on = !!b.lines?.includes(line);
                return (
                  <button
                    key={line}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({ lines: on ? (b.lines ?? []).filter((x) => x !== line) : [...(b.lines ?? []), line] })
                    }
                    className={cx(
                      "rounded-pill border px-2.5 py-1 text-[12px] font-semibold",
                      on ? "border-ink bg-mist" : "border-line hover:bg-mist",
                    )}
                  >
                    {t(`galleryx.lineNames.${line}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <Switch title={g("filter")} checked={b.filter} onChange={(v) => set({ filter: v })} />
          <More>
            <Switch title={g("lightbox")} checked={b.lightbox} onChange={(v) => set({ lightbox: v })} />
            <Switch title={t("galleryx.coverLogo")} checked={!!b.coverLogo} onChange={(v) => set({ coverLogo: v })} />
            <Label title={g("hover")}>
              <select
                className={inputCls}
                value={b.hover ?? "none"}
                onChange={(e) => set({ hover: e.target.value as BlockOf<"gallery">["hover"] })}
                data-testid="gallery-hover"
              >
                {(["none", "zoom", "title", "lift", "view"] as const).map((h) => (
                  <option key={h} value={h}>
                    {g(`hovers.${h}`)}
                  </option>
                ))}
              </select>
            </Label>
            <Switch title={g("credits")} checked={b.credits} onChange={(v) => set({ credits: v })} />
            <Switch
              title={t("galleryx.captionLogos")}
              checked={!!b.captionLogos}
              onChange={(v) => set({ captionLogos: v })}
            />
            {b.layout === "rows" && (
              <Range
                title={t("galleryx.rowHeight")}
                value={b.rowHeight ?? 0}
                min={0}
                max={720}
                step={10}
                unit="px"
                onChange={(v) => set({ rowHeight: v || undefined }, k("rh"))}
              />
            )}
            <Switch title={g("hoverPlay")} checked={b.hoverPlay} onChange={(v) => set({ hoverPlay: v })} />
            <Choice
              title={t("galleryx.loopPlay")}
              value={b.loopPlay ?? "hover"}
              options={(["hover", "always"] as const).map((x) => [x, t(`galleryx.loopPlays.${x}`)])}
              onChange={(v) => set({ loopPlay: v })}
            />
            {(b.layout === "grid" || b.layout === "fullscreen") && (
              <Switch
                title={t("galleryx.split")}
                checked={!!b.split}
                onChange={(v) => set({ split: v, wideColumns: b.wideColumns ?? 2 })}
              />
            )}
            {b.split && (b.layout === "grid" || b.layout === "fullscreen") && (
              <Range
                title={t("galleryx.wideColumns")}
                value={b.wideColumns ?? 2}
                min={1}
                max={4}
                onChange={(v) => set({ wideColumns: v }, k("wcols"))}
              />
            )}
            <div className="flex flex-col gap-2.5">
              {!!b.lines?.length && (
                <Switch
                  title={t("galleryx.accentRole")}
                  checked={!!b.accentRole}
                  onChange={(v) => set({ accentRole: v })}
                />
              )}
              {!!b.lines?.length && (
                <Switch
                  title={t("galleryx.captionAccent")}
                  checked={b.captionStyle === "accent"}
                  onChange={(v) => set({ captionStyle: v ? "accent" : "plain" })}
                />
              )}
              {b.captionStyle !== "accent" && (
                <Switch
                  title={t("galleryx.captionHeading")}
                  checked={b.captionStyle === "heading"}
                  onChange={(v) => set({ captionStyle: v ? "heading" : "plain" })}
                />
              )}
              <Choice
                title={t("galleryx.captionSize")}
                value={b.captionSize ?? "m"}
                options={(["s", "m", "l", "xl"] as const).map((x) => [x, t(`galleryx.captionSizes.${x}`)])}
                onChange={(v) => set({ captionSize: v === "m" ? undefined : v })}
              />
            </div>
            {b.layout === "grid" && (
              <Switch title={g("cardSizes")} checked={!!b.cardSizes} onChange={(v) => set({ cardSizes: v })} />
            )}
            {projects.length > 1 && (
              <fieldset className="border-line flex flex-col gap-1.5 border-t pt-3" data-testid="gallery-picks">
                <legend className="mb-1 text-[12px] font-semibold">{g("picks")}</legend>
                <p className="text-muted m-0 text-[12px]">{g("picksHint")}</p>
                {projects
                  .filter((p) => p.visibility !== "hidden")
                  .map((p) => {
                    const on = !!b.picks?.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          className="accent-primary size-4"
                          checked={on}
                          onChange={() =>
                            set({ picks: on ? (b.picks ?? []).filter((x) => x !== p.id) : [...(b.picks ?? []), p.id] })
                          }
                        />
                        {p.title}
                      </label>
                    );
                  })}
              </fieldset>
            )}
            <p className="text-muted text-[12px]">{g("samples")}</p>
          </More>
        </>
      );
      break;
    }
    case "image":
      body = (
        <>
          {mediaField(f("image"), block.mediaId, "image", (id) => set({ mediaId: id, crop: undefined }))}
          <Switch
            title={pt("showCaption")}
            checked={block.showCaption !== false}
            onChange={(v) => set({ showCaption: v })}
          />
          {block.showCaption !== false && (
            <Text
              title={f("caption")}
              value={block.caption}
              placeholder={language === "ar" ? "وصف قصير لصورتك" : "A little description of your image"}
              onChange={(v) => set({ caption: v }, k("c"))}
            />
          )}
          <Switch title={f("fullWidth")} checked={block.fullWidth} onChange={(v) => set({ fullWidth: v })} />
        </>
      );
      break;
    case "images":
      body = <ImagesSettings block={block} set={set} k={k} media={media} openPicker={openPicker} />;
      break;
    case "video":
      body = (
        <>
          <Label title={f("url")} hint={block.url && !parseVideoLink(block.url) ? f("urlBad") : undefined}>
            <input
              className={inputCls}
              dir="ltr"
              placeholder="https://vimeo.com/…"
              value={block.url}
              onChange={(e) => set({ url: e.target.value }, k("u"))}
            />
          </Label>
          <Text title={f("caption")} value={block.caption} onChange={(v) => set({ caption: v }, k("c"))} />
        </>
      );
      break;
    case "loop":
      body = (
        <>
          {mediaField(f("media"), block.mediaId, "loop", (id) => set({ mediaId: id }))}
          <Text title={f("caption")} value={block.caption} onChange={(v) => set({ caption: v }, k("c"))} />
        </>
      );
      break;
    case "before-after":
      body = (
        <>
          {mediaField(f("before"), block.beforeId, "image", (id) => set({ beforeId: id }))}
          {mediaField(f("after"), block.afterId, "image", (id) => set({ afterId: id }))}
          <Text title={f("beforeLabel")} value={block.beforeLabel} onChange={(v) => set({ beforeLabel: v }, k("bl"))} />
          <Text title={f("afterLabel")} value={block.afterLabel} onChange={(v) => set({ afterLabel: v }, k("al"))} />
        </>
      );
      break;
    case "pdf":
      body = (
        <>
          {mediaField(f("pdf"), block.mediaId, "pdf", (id) => set({ mediaId: id }))}
          <Text title={f("label")} value={block.label} onChange={(v) => set({ label: v }, k("l"))} />
        </>
      );
      break;
    case "reel":
      body = (
        <>
          <Text title={f("title")} value={block.title} onChange={(v) => set({ title: v }, k("t"))} />
          <Label title={f("url")} hint={block.url && !parseVideoLink(block.url) ? f("urlBad") : undefined}>
            <input
              className={inputCls}
              dir="ltr"
              placeholder="https://vimeo.com/…"
              value={block.url}
              onChange={(e) => set({ url: e.target.value }, k("u"))}
            />
          </Label>
          {mediaField(f("orLoop"), block.mediaId, "loop", (id) => set({ mediaId: id }))}
        </>
      );
      break;
    case "credits":
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          {list(
            block.items,
            (c, change) => (
              <>
                <div className="grid grid-cols-[72px_1fr] gap-2">
                  <Text title={f("year")} value={c.year} onChange={(v) => change({ year: v })} />
                  <Text title={f("title")} value={c.title} onChange={(v) => change({ title: v })} />
                </div>
                <Text title={f("role")} value={c.role} onChange={(v) => change({ role: v })} />
                <Text title={f("studio")} value={c.studio} onChange={(v) => change({ studio: v })} />
              </>
            ),
            { year: String(new Date().getFullYear()), title: "", role: "", studio: "" },
            60,
          )}
        </>
      );
      break;
    case "logos":
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          {list(
            block.items,
            (l, change) => (
              <>
                <Text title={f("name")} value={l.name} onChange={(v) => change({ name: v })} />
                <MediaField
                  title={f("logo")}
                  id={l.mediaId}
                  kind="image"
                  media={media}
                  onChange={(id) => change({ mediaId: id })}
                  openPicker={openPicker}
                />
                {!l.mediaId && (
                  <Choice
                    title={t("logosx.look")}
                    value={l.look ?? "auto"}
                    options={(["auto", "word", "box", "lower"] as const).map((x) => [x, t(`logosx.looks.${x}`)])}
                    onChange={(v) => change({ look: v === "auto" ? undefined : v })}
                  />
                )}
                <Range
                  title={t("logosx.height")}
                  value={l.height ?? 0}
                  min={0}
                  max={120}
                  unit="px"
                  onChange={(v) => change({ height: v || undefined })}
                />
              </>
            ),
            { name: "", mediaId: null },
            40,
          )}
          <Switch title={t("logosx.moving")} checked={!!block.moving} onChange={(v) => set({ moving: v })} />
          <Choice
            title={t("logosx.size")}
            value={block.size ?? "m"}
            options={(["s", "m", "l", "xl"] as const).map((x) => [x, t(`logosx.sizes.${x}`)])}
            onChange={(v) => set({ size: v })}
          />
          <More>
            {!block.moving && (
              <Switch title={t("logosx.oneRow")} checked={!!block.oneRow} onChange={(v) => set({ oneRow: v })} />
            )}
            {!block.oneRow && (
              <Range
                title={t("logosx.columns")}
                value={block.columns ?? 0}
                min={0}
                max={8}
                onChange={(v) => set({ columns: v }, k("lcols"))}
              />
            )}
            <Choice
              title={t("logosx.tint")}
              value={block.tint ?? "original"}
              options={(["original", "white", "black"] as const).map((x) => [x, t(`logosx.tints.${x}`)])}
              onChange={(v) => set({ tint: v })}
            />
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span>{t("logosx.band")}</span>
              <span className="flex items-center gap-2">
                <Toggle
                  label={t("logosx.band")}
                  hideLabel
                  checked={!!block.band}
                  onChange={(v) => set({ band: v ? "#FF5A1F" : null })}
                />
                {block.band && (
                  <input
                    type="color"
                    aria-label={t("logosx.band")}
                    value={block.band}
                    onChange={(e) => set({ band: e.target.value.toUpperCase() }, k("band"))}
                    className="border-line h-8 w-10 rounded-[8px] border p-0.5"
                  />
                )}
              </span>
            </div>
          </More>
        </>
      );
      break;
    case "header":
      body = (
        <>
          <div className="grid grid-cols-[80px_1fr] gap-2.5">
            <Text title={t("header.number")} value={block.number} onChange={(v) => set({ number: v }, k("n"))} />
            <Text title={t("header.title")} value={block.title} onChange={(v) => set({ title: v }, k("t"))} />
          </div>
          <Text title={t("header.subtitle")} value={block.subtitle} onChange={(v) => set({ subtitle: v }, k("s"))} />
          <Text
            title={t("header.badge")}
            placeholder={t("header.badgeHint")}
            value={block.badge}
            onChange={(v) => set({ badge: v }, k("b"))}
          />
          <Choice
            title={t("header.size")}
            value={block.size}
            options={(["m", "l", "xl"] as const).map((x) => [x, t(`header.sizes.${x}`)])}
            onChange={(v) => set({ size: v })}
          />
          <More>
            {mediaField(t("header.logo"), block.logoId, "image", (id) => set({ logoId: id }))}
            <Switch title={t("header.divider")} checked={block.divider} onChange={(v) => set({ divider: v })} />
            <Switch title={t("header.accent")} checked={!!block.accent} onChange={(v) => set({ accent: v })} />
            <Switch title={t("header.upper")} checked={!!block.upper} onChange={(v) => set({ upper: v })} />
            <Switch title={t("header.narrow")} checked={!!block.narrow} onChange={(v) => set({ narrow: v })} />
            <Switch title={t("header.underline")} checked={!!block.underline} onChange={(v) => set({ underline: v })} />
            {mediaField(t("header.line"), block.lineId ?? null, "image", (id) => set({ lineId: id }))}
            <p className="text-muted m-0 text-[12px]">{t("header.anchorHint")}</p>
          </More>
        </>
      );
      break;
    case "feature":
      body = (
        <>
          <Label title={t("feature.project")}>
            <select
              className={inputCls}
              value={block.projectId ?? ""}
              onChange={(e) => set({ projectId: e.target.value || null })}
              data-testid="feature-project"
            >
              <option value="">{t("feature.pick")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Label>
          <Choice
            title={t("feature.words")}
            value={block.words}
            options={(["short", "all", "none"] as const).map((x) => [x, t(`feature.wordsOpts.${x}`)])}
            onChange={(v) => set({ words: v })}
          />
          <Choice
            title={t("feature.side")}
            value={block.side}
            options={(["start", "end"] as const).map((x) => [x, t(`feature.sides.${x}`)])}
            onChange={(v) => set({ side: v })}
          />
          {mediaField(t("feature.background"), block.bgMediaId, "image", (id) => set({ bgMediaId: id }))}
          <More>
            <Switch title={t("feature.logos")} checked={block.logos} onChange={(v) => set({ logos: v })} />
            <Switch title={t("feature.laurels")} checked={block.laurels} onChange={(v) => set({ laurels: v })} />
            <Switch title={t("feature.tools")} checked={block.tools} onChange={(v) => set({ tools: v })} />
            <Switch title={t("feature.credits")} checked={block.credits} onChange={(v) => set({ credits: v })} />
            <p className="text-muted m-0 text-[12px]">{t("feature.soonHint")}</p>
          </More>
        </>
      );
      break;
    case "about":
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          {mediaField(f("photo"), block.photoId, "image", (id) => set({ photoId: id }))}
          {mediaField(f("cv"), block.cvId, "pdf", (id) => set({ cvId: id }))}
          <More>
            <Choice
              title={t("aboutx.photoStyle")}
              value={block.photoStyle ?? "side"}
              options={[
                ["side", t("aboutx.photoStyles.side")],
                ["float", t("aboutx.photoStyles.float")],
              ]}
              onChange={(v) => set({ photoStyle: v === "float" ? "float" : undefined })}
            />
            <Text
              title={t("aboutx.skillsTitle")}
              value={block.skillsTitle ?? ""}
              onChange={(v) => set({ skillsTitle: v }, k("st"))}
            />
            <Area
              title={t("aboutx.skills")}
              value={(block.skills ?? []).join("\n")}
              onChange={(v) =>
                set(
                  {
                    skills: v
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  },
                  k("skills"),
                )
              }
            />
            <Text
              title={t("aboutx.orgsTitle")}
              value={block.orgsTitle ?? ""}
              onChange={(v) => set({ orgsTitle: v }, k("ot"))}
            />
            <div className="flex flex-col gap-2" data-testid="about-orgs">
              <span className="text-[12px] font-semibold">{t("aboutx.orgs")}</span>
              {(block.orgs ?? []).map((o, i) => (
                <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
                  {mediaField(f("logo"), o.mediaId, "image", (id) =>
                    set({ orgs: (block.orgs ?? []).map((x, j) => (j === i ? { ...x, mediaId: id } : x)) }),
                  )}
                  <Text
                    title={t("aboutx.orgText")}
                    value={o.text}
                    onChange={(v) =>
                      set({ orgs: (block.orgs ?? []).map((x, j) => (j === i ? { ...x, text: v } : x)) }, k(`org-${i}`))
                    }
                  />
                  <Text
                    title={f("link")}
                    dir="ltr"
                    placeholder="https://"
                    value={o.link}
                    onChange={(v) =>
                      set({ orgs: (block.orgs ?? []).map((x, j) => (j === i ? { ...x, link: v } : x)) }, k(`orgl-${i}`))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="delete"
                    onClick={() => set({ orgs: (block.orgs ?? []).filter((_, j) => j !== i) })}
                  >
                    {f("removeItem")}
                  </Button>
                </div>
              ))}
              {(block.orgs?.length ?? 0) < 8 && (
                <Button
                  size="sm"
                  variant="outline"
                  icon="add"
                  onClick={() => set({ orgs: [...(block.orgs ?? []), { mediaId: null, text: "", link: "" }] })}
                >
                  {f("addItem")}
                </Button>
              )}
            </div>
          </More>
        </>
      );
      break;
    case "contact": {
      const form = contactFormOf(block, contactFallback);
      const words = CONTACT_WORDS[language];
      const setForm = (patch: Partial<ContactFormShape>, key?: string) => set({ form: { ...form, ...patch } }, key);
      const setLabel = (name: keyof ContactFormShape["labels"], v: string) =>
        setForm({ labels: { ...form.labels, [name]: v } }, k(`l-${name}`));
      body = (
        <>
          <Text title={f("heading")} value={block.heading} onChange={(v) => set({ heading: v }, k("h"))} />
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <Choice
            title={t("contactx.mode")}
            value={block.mode ?? "form"}
            options={[
              ["form", t("contactx.modes.form")],
              ["links", t("contactx.modes.links")],
            ]}
            onChange={(v) => set({ mode: v === "links" ? "links" : undefined })}
          />
          {block.mode === "links" && (
            <>
              <Text
                title={t("contactx.email")}
                dir="ltr"
                value={block.email ?? ""}
                placeholder="you@email.com"
                onChange={(v) => set({ email: v }, k("em"))}
              />
              <div className="flex flex-col gap-2" data-testid="contact-link-list">
                <span className="text-[12px] font-semibold">{t("contactx.links")}</span>
                {(block.links ?? []).map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-1.5">
                    <Text
                      title={t("contactx.linkLabel")}
                      value={l.label}
                      onChange={(v) =>
                        set(
                          { links: (block.links ?? []).map((x, j) => (j === i ? { ...x, label: v } : x)) },
                          k(`ll-${i}`),
                        )
                      }
                    />
                    <Text
                      title={t("contactx.linkUrl")}
                      dir="ltr"
                      placeholder="https://"
                      value={l.url}
                      onChange={(v) =>
                        set(
                          { links: (block.links ?? []).map((x, j) => (j === i ? { ...x, url: v } : x)) },
                          k(`lu-${i}`),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={f("removeItem")}
                      className="text-muted hover:text-ink flex size-9 items-center justify-center"
                      onClick={() => set({ links: (block.links ?? []).filter((_, j) => j !== i) })}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                {(block.links?.length ?? 0) < 10 && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon="add"
                    onClick={() => set({ links: [...(block.links ?? []), { label: "", url: "" }] })}
                  >
                    {f("addItem")}
                  </Button>
                )}
              </div>
            </>
          )}
          {mediaField(t("contactx.image"), block.mediaId ?? null, "image", (id) => set({ mediaId: id }))}
          <Choice
            title={c("layout")}
            value={form.layout}
            options={[
              ["stacked", c("stacked")],
              ["split", c("split")],
            ]}
            onChange={(v) => setForm({ layout: v })}
          />
          <Switch title={words.projectType} checked={form.projectType} onChange={(v) => setForm({ projectType: v })} />
          <Switch title={words.budget} checked={form.budget} onChange={(v) => setForm({ budget: v })} />
          <Switch title={words.deadline} checked={form.deadline} onChange={(v) => setForm({ deadline: v })} />
          <Text title={f("button")} value={block.button} onChange={(v) => set({ button: v }, k("b"))} />
          <More>
            <Switch title={t("contactx.flat")} checked={!!block.flat} onChange={(v) => set({ flat: v })} />
            <Choice
              title={t("contactx.headingSize")}
              value={block.headingSize ?? "l"}
              options={(["s", "m", "l"] as const).map((x) => [x, t(`coverx.sizes.${x}`)])}
              onChange={(v) => set({ headingSize: v === "l" ? undefined : v })}
            />
            <Switch title={t("contactx.accent")} checked={!!block.accent} onChange={(v) => set({ accent: v })} />
            <div className="border-line flex flex-col gap-3 border-t pt-4">
              <span className="text-[13px] font-semibold">{c("fields")}</span>
              <Text
                title={c("nameLabel")}
                value={form.labels.name}
                placeholder={words.name}
                onChange={(v) => setLabel("name", v)}
              />
              <Text
                title={c("emailLabel")}
                value={form.labels.email}
                placeholder={words.email}
                onChange={(v) => setLabel("email", v)}
              />
              <Text
                title={c("messageLabel")}
                value={form.labels.message}
                placeholder={words.message}
                onChange={(v) => setLabel("message", v)}
              />
              <Text
                title={c("custom")}
                value={form.custom}
                placeholder={c("customPlaceholder")}
                onChange={(v) => setForm({ custom: v }, k("custom"))}
              />
            </div>
            <div className="border-line flex flex-col gap-3 border-t pt-4">
              <Text
                title={c("success")}
                value={form.success}
                placeholder={words.sent}
                onChange={(v) => setForm({ success: v }, k("ok"))}
              />
              <p className="text-muted text-[12px]">{f("contactNote")}</p>
            </div>
          </More>
        </>
      );
      break;
    }
    case "hire":
      body = (
        <>
          <Text title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <p className="text-muted text-[12px]">{f("hireNote")}</p>
        </>
      );
      break;
    case "social":
      body = (
        <div className="flex flex-col gap-2">
          {block.links.map((l, i) => (
            <div key={i} className="border-line flex flex-col gap-2 rounded-md border p-2.5">
              <Label title={f("network")}>
                <select
                  className={inputCls}
                  value={l.network}
                  onChange={(e) =>
                    set({ links: block.links.map((x, j) => (j === i ? { ...x, network: e.target.value } : x)) })
                  }
                >
                  {SOCIAL_NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Label>
              <Text
                title={f("link")}
                dir="ltr"
                placeholder="https://"
                value={l.url}
                onChange={(v) =>
                  set({ links: block.links.map((x, j) => (j === i ? { ...x, url: v } : x)) }, k(`l${i}`))
                }
              />
              <Button
                size="sm"
                variant="ghost"
                icon="delete"
                onClick={() => set({ links: block.links.filter((_, j) => j !== i) })}
              >
                {f("removeItem")}
              </Button>
            </div>
          ))}
          {block.links.length < 12 && (
            <Button
              size="sm"
              variant="outline"
              icon="add"
              onClick={() => set({ links: [...block.links, { network: "website", url: "" }] })}
            >
              {f("addItem")}
            </Button>
          )}
        </div>
      );
      break;
    case "quote":
      body = (
        <>
          <Area title={f("text")} value={block.text} onChange={(v) => set({ text: v }, k("t"))} />
          <Text title={f("author")} value={block.author} onChange={(v) => set({ author: v }, k("a"))} />
        </>
      );
      break;
    case "free": {
      const it = block.items.find((i) => i.id === freeItem) ?? null;
      if (!it) {
        body = (
          <>
            <p className="text-muted text-[12px]">{fr("sectionHint")}</p>
            <Range
              title={fr("height")}
              value={block.rows}
              min={Math.max(2, freeBottom(block.items))}
              max={160}
              onChange={(v) => set<BlockOf<"free">>({ rows: v }, k("rows"))}
            />
            <p className="text-muted text-[12px]">{fr("phoneHint")}</p>
          </>
        );
        break;
      }
      body = (
        <FreeItemSettings
          key={it.id}
          it={it}
          projects={projects}
          language={language}
          mediaField={mediaField}
          onDraw={onDrawItem ? () => onDrawItem(it.id) : undefined}
          onBack={() => onFreeItem?.(null)}
          setItem={(patch, key) =>
            set<BlockOf<"free">>({ items: block.items.map((i) => (i.id === it.id ? { ...i, ...patch } : i)) }, key)
          }
        />
      );
      break;
    }
  }

  const kind = kindOf(block);
  // An item's own settings replace the section's (they have their own Content | Design tabs).
  const itemOpen = block.type === "free" && !!freeItem && block.items.some((i) => i.id === freeItem);
  return (
    // Round 18: the panel's header names the section; here only Content | Style.
    <div className="flex flex-col gap-4" data-kind={kind.key}>
      {itemOpen ? (
        body
      ) : (
        <SectionTabs
          content={body}
          design={
            <SectionDesign
              value={block.style}
              onChange={(style, key) => update({ style } as Partial<Block>, key ? k(key) : undefined)}
              theme={theme}
              isPro={isPro}
              mediaField={mediaField}
              arrangement={<Arrangement block={block} update={update} />}
            />
          }
        />
      )}
    </div>
  );
}

/**
 * Round 13 alignment dots, in Style ▸ Arrangement since round 18 (the width sits under them);
 * free-form sections can also flip their layout (picture left ↔ right).
 */
export function Arrangement({
  block,
  update,
}: {
  block: Block;
  update: (patch: Partial<Block>, key?: string) => void;
}) {
  const t = useTranslations("editor.layout");
  const st = block.style ?? defaultSectionStyle();
  const align = st.align ?? "start";
  const setAlign = (a: "start" | "center" | "end") => {
    const style = { ...st, align: a };
    if (block.type === "free") {
      // Every text item follows (pictures keep their places).
      const items = block.items.map((i) =>
        ["text", "heading", "button", "quote", "badge"].includes(i.kind) ? { ...i, align: a } : i,
      );
      update({ style, items } as Partial<Block>);
    } else update({ style } as Partial<Block>);
  };
  const lines = (a: "start" | "center" | "end") => (
    <svg viewBox="0 0 20 16" className="h-4 w-5" aria-hidden>
      {[3, 8, 13].map((y, i) => {
        const w = i === 1 ? 10 : 16;
        const x = a === "start" ? 2 : a === "center" ? 10 - w / 2 : 18 - w;
        return <rect key={y} x={x} y={y - 1} width={w} height={2} rx={1} fill="currentColor" />;
      })}
    </svg>
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label={t("align")} className="bg-mist flex rounded-[10px] p-0.5">
        {(["start", "center", "end"] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={align === a}
            aria-label={t(`aligns.${a}`)}
            title={t(`aligns.${a}`)}
            onClick={() => setAlign(a)}
            className={cx(
              "flex h-8 w-9 items-center justify-center rounded-[8px]",
              align === a ? "bg-paper shadow-sm" : "text-muted hover:text-ink",
            )}
            data-testid={`align-${a}`}
          >
            {lines(a)}
          </button>
        ))}
      </div>
      {block.type === "free" && (
        <button
          type="button"
          className="border-line hover:bg-mist ms-auto rounded-[8px] border px-2.5 py-1.5 text-[12px] font-semibold"
          onClick={() =>
            update({
              items: block.items.map((i) => ({ ...i, place: { ...i.place, x: FREE_COLS - i.place.x - i.place.w } })),
            } as Partial<Block>)
          }
          data-testid="mirror-layout"
        >
          {t("mirror")}
        </button>
      )}
    </div>
  );
}
