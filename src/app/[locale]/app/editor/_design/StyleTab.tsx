"use client";

import { useTranslations } from "next-intl";
import { type SiteMedia } from "@/components/site/SiteRender";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { defaultSectionStyle } from "@/lib/site/normalize";
import { presetIds, themes } from "@/lib/site/starter";
import { FontPicker } from "@/components/editor/FontPicker";
import type { NavLayout, SiteDraft, Theme } from "@/lib/site/types";
import { SectionDesign } from "../_inspector/SectionDesign";
import { Area, Range, Text } from "../_ui/controls";
import { MediaField, type MediaKind } from "../_ui/media";

export const noPreview = () => {};

export function NavSketch({ nav }: { nav: NavLayout }) {
  const bar = "block h-1 rounded-[2px] bg-current opacity-80";
  const dot = "block h-1 w-3 rounded-[2px] bg-current opacity-40";
  const links = (
    <span className="flex gap-1">
      <span className={dot} />
      <span className={dot} />
      <span className={dot} />
    </span>
  );
  switch (nav) {
    case "top":
      return (
        <span className="flex w-full items-center justify-between">
          <span className={`${bar} w-6`} />
          {links}
        </span>
      );
    case "centered":
      return (
        <span className="flex w-full flex-col items-center gap-1">
          <span className={`${bar} w-8`} />
          {links}
        </span>
      );
    case "split":
      return (
        <span className="flex w-full items-center justify-between">
          <span className={dot} />
          <span className={`${bar} w-6`} />
          <span className={dot} />
        </span>
      );
    case "sidebar":
      return (
        <span className="flex w-full gap-2">
          <span className="flex flex-col gap-1">
            <span className={`${bar} w-5`} />
            <span className={dot} />
            <span className={dot} />
          </span>
          <span className="bg-current/15 block h-6 flex-1 rounded-[2px] opacity-20" />
        </span>
      );
    case "inline":
      return (
        <span className="flex w-full items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className={`${bar} w-5`} />
            {links}
          </span>
          <span className={dot} />
        </span>
      );
    case "minimal":
      return (
        <span className="flex w-full items-center justify-between">
          <span className={`${bar} w-4`} />
          <span className="flex flex-col gap-[3px]">
            <span className="block h-[2px] w-3 bg-current" />
            <span className="block h-[2px] w-3 bg-current" />
          </span>
        </span>
      );
  }
}

export type DesignSection = "logo" | "nav" | "styles" | "fonts" | "footer" | "lock";

export function StyleTab({
  draft,
  media,
  setDraft,
  openPicker,
  section,
  credit,
  onFontPreview,
  onOpenSettings,
}: {
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  setDraft: (fn: (d: SiteDraft) => SiteDraft, key?: string) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
  section: DesignSection;
  /** The site language lives in Settings (round 18): this opens it. */
  onOpenSettings?: () => void;
  credit?: boolean;
  /** Round 12: shows fonts on the page while pointing at them in the picker. */
  onFontPreview?: (fonts: Theme["fonts"] | null) => void;
}) {
  const t = useTranslations("editor.style");
  const th = draft.theme;
  const setTheme = (patch: Partial<Theme>, key?: string) =>
    setDraft((d) => ({ ...d, theme: { ...d.theme, ...patch } }), key);

  if (section === "fonts") {
    return (
      <FontPicker
        fonts={th.fonts}
        siteName={draft.title}
        onChange={(fonts) => setTheme({ fonts })}
        onPreview={onFontPreview ?? noPreview}
      />
    );
  }

  if (section === "logo") {
    return (
      <div className="flex flex-col gap-4">
        <Text title={t("siteTitle")} value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }), "title")} />
        <Text title={t("tagline")} value={draft.tagline} onChange={(v) => setDraft((d) => ({ ...d, tagline: v }), "tagline")} />
        <MediaField
          title={t("logo")}
          id={th.logoMediaId}
          kind="image"
          media={media}
          onChange={(id) => setTheme({ logoMediaId: id })}
          openPicker={openPicker}
        />
        <MediaField
          title={t("favicon")}
          id={th.faviconMediaId}
          kind="image"
          media={media}
          onChange={(id) => setTheme({ faviconMediaId: id })}
          openPicker={openPicker}
        />
      </div>
    );
  }

  if (section === "nav") {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("nav")}>
          {(["top", "inline", "centered", "sidebar", "split", "minimal"] as NavLayout[]).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={th.nav === n}
              aria-label={t(`navNames.${n}`)}
              onClick={() => setTheme({ nav: n })}
              className={cx(
                "bg-paper flex flex-col items-stretch gap-2 rounded-[10px] p-2.5 text-[11px] font-semibold",
                th.nav === n ? "border-lime border-2" : "border-line border",
              )}
            >
              <span className="bg-mist flex h-10 items-center rounded-[6px] px-2">
                <NavSketch nav={n} />
              </span>
              {t(`navNames.${n}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (section === "lock") {
    const lock = draft.lock ?? { title: "", text: "", style: { ...defaultSectionStyle(), bg: { ...defaultSectionStyle().bg, kind: "pattern" as const, pattern: "doodles" as const } } };
    const setLock = (patch: Partial<NonNullable<SiteDraft["lock"]>>, key?: string) =>
      setDraft((d) => ({ ...d, lock: { ...lock, ...(d.lock ?? {}), ...patch } }), key);
    return (
      <div className="flex flex-col gap-4" data-testid="lock-settings">
        <p className="text-muted text-[12px]">{t("lockHint")}</p>
        <Text title={t("lockTitle")} value={lock.title} placeholder={t("lockTitlePlaceholder")} onChange={(v) => setLock({ title: v }, "lock-title")} />
        <Area title={t("lockText")} value={lock.text} onChange={(v) => setLock({ text: v }, "lock-text")} />
        <SectionDesign
          value={lock.style}
          onChange={(style, key) => setLock({ style }, key ? `lock-${key}` : undefined)}
          theme={draft.theme}
          isPro={true}
          mediaField={(title, id, kind, apply) => (
            <MediaField title={title} id={id} kind={kind} media={media} onChange={apply} openPicker={openPicker} />
          )}
          compact
        />
      </div>
    );
  }

  if (section === "footer") {
    return (
      <div className="flex flex-col gap-3 text-[13px]">
        <p className="text-ink-soft">{t("footerAbout")}</p>
        {credit && <p className="text-muted">{t("footerCredit")}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">{t("presets")}</div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("presets")}>
          {presetIds.map((id) => {
            const p = themes[id];
            const on = th.preset === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTheme({ ...p, logoMediaId: th.logoMediaId, faviconMediaId: th.faviconMediaId })}
                className={cx(
                  "bg-paper flex flex-col gap-1.5 rounded-[10px] p-1.5",
                  on ? "border-lime border-2" : "border-line border",
                )}
              >
                <span
                  className="block h-[30px] rounded-[6px] border border-black/10"
                  style={{ background: `linear-gradient(90deg, ${p.colors.background} 0 70%, ${p.colors.accent} 70%)` }}
                />
                <span className="text-[11px] font-semibold">{t(`presetNames.${id}`)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-[12px] font-semibold">{t("colours")}</div>
        <div className="grid grid-cols-3 gap-2">
          {(["background", "text", "accent"] as const).map((c) => (
            <label key={c} className="text-muted flex flex-col gap-1 text-[11px]">
              <input
                type="color"
                value={th.colors[c]}
                onChange={(e) => setTheme({ colors: { ...th.colors, [c]: e.target.value.toUpperCase() } }, `color-${c}`)}
                className="border-line h-9 w-full cursor-pointer rounded-[8px] border p-0.5"
              />
              {t(c)}
            </label>
          ))}
        </div>
      </div>
      <Range title={t("radius")} value={th.radius} min={0} max={24} unit="px" onChange={(v) => setTheme({ radius: v }, "radius")} />
      <button
        type="button"
        data-testid="site-language"
        onClick={onOpenSettings}
        className="hover:bg-mist -mx-2 flex h-9 items-center justify-between rounded-[10px] px-2 text-[13px]"
      >
        {t("language")}
        <span className="text-muted flex items-center gap-1">
          {t(`languages.${draft.language}`)}
          <Icon name="chevron-down" size={16} className="-rotate-90 rtl:rotate-90" />
        </span>
      </button>
    </div>
  );
}
