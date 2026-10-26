"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { type SiteMedia } from "@/components/site/SiteRender";
import { arabicFonts, headingFonts } from "@/components/site/fonts";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { type LegacyContactFields } from "@/lib/site/contact";
import { normalizeFooter, normalizeHeader } from "@/lib/site/normalize";
import type { FooterSettings, HeaderSettings, SiteDraft } from "@/lib/site/types";
import { StyleTab } from "../_design/StyleTab";
import { Area, Choice, ColorField, Label, Range, Switch, Text, inputCls } from "../_ui/controls";
import { type MediaKind } from "../_ui/media";

/* ---------- the header and footer, clicked on the canvas (round 4) ---------- */

/** Site-wide settings the editor shows: social links and CV (footer), older contact fields. */
export interface EditorSiteSettings {
  social: Array<{ network: string; url: string }>;
  cvMediaId: string | null;
  contact: LegacyContactFields;
}

export function SitePartSettings({
  part,
  draft,
  setDraft,
  media,
  openPicker,
  credit,
  bare = false,
  onOpenSettings,
}: {
  /** Opens Settings, where social links and the CV live. */
  onOpenSettings?: () => void;
  /** Inside Design ▸ Menu / Footer, which already shows the title. */
  bare?: boolean;
  part: "header" | "footer";
  draft: SiteDraft;
  setDraft: (fn: (d: SiteDraft) => SiteDraft, key?: string) => void;
  media: Record<string, SiteMedia>;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
  credit: boolean;
  /** Kept for callers; social links and the CV are shown from here but edited in Settings. */
  siteSettings?: EditorSiteSettings;
  onSiteSettings?: (s: EditorSiteSettings) => void;
}) {
  const t = useTranslations("editor.parts");
  const st = useTranslations("editor.style");
  const header = draft.header ?? normalizeHeader(null);
  const footer = draft.footer ?? normalizeFooter(null);
  const setHeader = (patch: Partial<HeaderSettings>, key?: string) =>
    setDraft((d) => ({ ...d, header: { ...(d.header ?? normalizeHeader(null)), ...patch } }), key);
  const setFooter = (patch: Partial<FooterSettings>, key?: string) =>
    setDraft((d) => ({ ...d, footer: { ...(d.footer ?? normalizeFooter(null)), ...patch } }), key);

  const [tab, setTab] = useState<"layout" | "style" | "items">("layout");
  const tabs = (
    <div role="tablist" className="border-line -mt-1 grid grid-cols-3 border-b">
      {(["layout", "style", "items"] as const).map((x) => (
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
          {t(`tabs.${part}.${x}`)}
        </button>
      ))}
    </div>
  );

  // Round 18: social links and the CV have one home, Settings. Here: show or hide, and a way there.
  const inSettings = (
    <button
      type="button"
      onClick={onOpenSettings}
      className="border-line hover:bg-mist flex h-10 items-center justify-between rounded-[12px] border px-3 text-start text-[13px] font-semibold"
      data-testid="links-in-settings"
    >
      {t("editLinks")}
      <Icon name="chevron-down" size={16} className="text-muted -rotate-90 rtl:rotate-90" />
    </button>
  );

  if (part === "header") {
    const bg = header.background;
    return (
      <div className="flex flex-col gap-5" data-testid="header-settings">
        {!bare && <h3 className="text-[15px] font-semibold">{t("header")}</h3>}
        {tabs}
        {tab === "layout" && (
          <>
            <StyleTab section="nav" draft={draft} media={media} setDraft={setDraft} openPicker={openPicker} />
            <Choice
              title={t("width")}
              value={header.width}
              options={[
                ["full", t("widthFull")],
                ["inset", t("widthInset")],
              ]}
              onChange={(v) => setHeader({ width: v })}
            />
            <Range title={t("linkGap")} value={header.linkGap} min={4} max={64} unit="px" onChange={(v) => setHeader({ linkGap: v }, "h-gap")} />
            <Range
              title={t("height")}
              value={header.space ?? (header.background !== "none" || header.border || header.shadow || header.padding > 0 ? 20 + header.padding : 48)}
              min={0}
              max={96}
              unit="px"
              onChange={(v) => setHeader({ space: v }, "h-pad")}
            />
            <Switch title={t("sticky")} checked={header.sticky} onChange={(v) => setHeader({ sticky: v })} />
          </>
        )}
        {tab === "style" && (
          <>
            <Range title={t("logoSize")} value={header.logoSize} min={20} max={140} unit="px" onChange={(v) => setHeader({ logoSize: v }, "h-logo")} />
            <Range title={t("titleSize")} value={header.titleSize} min={14} max={72} unit="px" onChange={(v) => setHeader({ titleSize: v }, "h-title")} />
            {!draft.theme.logoMediaId && (
              <Label title={t("logoFont")}>
                <select
                  className={inputCls}
                  value={header.logoFont ?? ""}
                  onChange={(e) => setHeader({ logoFont: (e.target.value || null) as HeaderSettings["logoFont"] })}
                  data-testid="logo-font"
                >
                  <option value="">{t("logoFontSite")}</option>
                  {Object.entries(headingFonts).map(([id, f]) => (
                    <option key={id} value={id}>
                      {f.label}
                    </option>
                  ))}
                  {Object.entries(arabicFonts).map(([id, f]) => (
                    <option key={id} value={id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Label>
            )}
            <Switch title={t("upperLinks")} checked={header.upperLinks} onChange={(v) => setHeader({ upperLinks: v })} />
            <Choice
              title={t("background")}
              value={bg === "none" || bg === "surface" ? bg : "colour"}
              options={[
                ["none", t("bgNone")],
                ["surface", t("bgSoft")],
                ["colour", t("bgColour")],
              ]}
              onChange={(v) => setHeader({ background: v === "colour" ? (bg.startsWith("#") ? bg : "#F4F4F2") : v })}
            />
            {bg.startsWith("#") && (
              <>
                <input
                  type="color"
                  aria-label={t("bgColour")}
                  value={bg}
                  onChange={(e) => setHeader({ background: e.target.value.toUpperCase() }, "header-bg")}
                  className="border-line h-9 w-full cursor-pointer rounded-[8px] border bg-white p-1"
                />
                <ColorField
                  title={t("gradientTo")}
                  value={header.gradientTo}
                  themeLabel={t("noGradient")}
                  onChange={(v) => setHeader({ gradientTo: v }, "h-grad")}
                />
              </>
            )}
            <ColorField title={t("textColor")} value={header.textColor} themeLabel={t("theme")} onChange={(v) => setHeader({ textColor: v }, "h-text")} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <Switch title={t("border")} checked={header.border} onChange={(v) => setHeader({ border: v })} />
              <Switch title={t("shadow")} checked={header.shadow} onChange={(v) => setHeader({ shadow: v })} />
            </div>
          </>
        )}
        {tab === "items" && (
          <>
            <Switch title={t("showTagline")} checked={header.tagline} onChange={(v) => setHeader({ tagline: v })} />
            <div className="border-line flex flex-col gap-3 border-t pt-4">
              <Switch title={t("socialInHeader")} checked={header.social} onChange={(v) => setHeader({ social: v })} />
              {header.social && inSettings}
            </div>
            <div className="border-line flex flex-col gap-3 border-t pt-4">
              <span className="text-[13px] font-semibold">{t("hire")}</span>
              <Choice
                title={t("hireShow")}
                value={header.hire.on === null ? "auto" : header.hire.on ? "on" : "off"}
                options={[
                  ["auto", t("hireAuto")],
                  ["on", t("hireOn")],
                  ["off", t("hireOff")],
                ]}
                onChange={(v) => setHeader({ hire: { ...header.hire, on: v === "auto" ? null : v === "on" } })}
              />
              <Text
                title={t("hireLabel")}
                value={header.hire.label}
                placeholder={draft.language === "ar" ? "وظّفني" : "Hire me"}
                onChange={(v) => setHeader({ hire: { ...header.hire, label: v } }, "hire-label")}
              />
              <Text
                title={t("hireLink")}
                value={header.hire.link}
                dir="ltr"
                placeholder="/contact"
                onChange={(v) => setHeader({ hire: { ...header.hire, link: v } }, "hire-link")}
              />
              <Choice
                title={t("hireStyle")}
                value={header.hire.style}
                options={[
                  ["filled", t("filled")],
                  ["outline", t("outline")],
                ]}
                onChange={(v) => setHeader({ hire: { ...header.hire, style: v } })}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="footer-settings">
      {!bare && <h3 className="text-[15px] font-semibold">{t("footer")}</h3>}
      {tabs}
      {tab === "layout" && (
        <>
          <Choice
            title={t("footerLayout")}
            value={footer.layout}
            options={[
              ["stack", t("stack")],
              ["columns", t("columns")],
              ["links", t("linkColumns")],
            ]}
            onChange={(v) =>
              setFooter({
                layout: v,
                // Starting link columns from the site's own pages.
                ...(v === "links" && !footer.groups.length
                  ? {
                      groups: [
                        {
                          title: t("pagesGroup"),
                          links: draft.pages.filter((p) => p.type !== "folder").slice(0, 6).map((p) => ({ label: p.title, link: p.slug ? `/${p.slug}` : "/" })),
                        },
                      ],
                    }
                  : {}),
              })
            }
          />
          {footer.layout === "links" && (
            <div className="flex flex-col gap-3" data-testid="footer-groups-editor">
              {footer.groups.map((g, gi) => {
                const setGroup = (patch: Partial<(typeof footer.groups)[number]>) =>
                  setFooter({ groups: footer.groups.map((x, j) => (j === gi ? { ...x, ...patch } : x)) }, `fg-${gi}`);
                return (
                  <div key={gi} className="border-line flex flex-col gap-2 rounded-[12px] border p-2.5">
                    <Text title={t("groupTitle")} value={g.title} onChange={(v) => setGroup({ title: v })} />
                    {g.links.map((l, li) => (
                      <div key={li} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                        <input
                          aria-label={t("linkLabel")}
                          className={inputCls}
                          value={l.label}
                          onChange={(e) => setGroup({ links: g.links.map((x, j) => (j === li ? { ...x, label: e.target.value } : x)) })}
                        />
                        <input
                          aria-label={t("linkUrl")}
                          className={inputCls}
                          dir="ltr"
                          placeholder="/about"
                          value={l.link}
                          onChange={(e) => setGroup({ links: g.links.map((x, j) => (j === li ? { ...x, link: e.target.value } : x)) })}
                        />
                        <button
                          type="button"
                          aria-label={t("removeLink")}
                          className="text-muted hover:text-ink flex size-9 items-center justify-center"
                          onClick={() => setGroup({ links: g.links.filter((_, j) => j !== li) })}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-1.5">
                      {g.links.length < 8 && (
                        <Button size="sm" variant="outline" icon="add" onClick={() => setGroup({ links: [...g.links, { label: "", link: "" }] })}>
                          {t("addLink")}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon="delete" onClick={() => setFooter({ groups: footer.groups.filter((_, j) => j !== gi) })}>
                        {t("removeGroup")}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {footer.groups.length < 4 && (
                <Button size="sm" variant="outline" icon="add" onClick={() => setFooter({ groups: [...footer.groups, { title: "", links: [] }] })}>
                  {t("addGroup")}
                </Button>
              )}
            </div>
          )}
          {footer.layout === "stack" && (
            <Choice
              title={t("align")}
              value={footer.align}
              options={[
                ["center", t("alignCenter")],
                ["start", t("alignStart")],
              ]}
              onChange={(v) => setFooter({ align: v })}
            />
          )}
          <Range title={t("spacing")} value={footer.padding} min={0} max={120} unit="px" onChange={(v) => setFooter({ padding: v }, "f-pad")} />
          <Area title={t("footerText")} value={footer.text} onChange={(v) => setFooter({ text: v }, "footer-text")} />
        </>
      )}
      {tab === "style" && (
        <>
          <ColorField title={t("background")} value={footer.background} themeLabel={t("theme")} onChange={(v) => setFooter({ background: v }, "f-bg")} />
          {footer.background && (
            <ColorField
              title={t("gradientTo")}
              value={footer.gradientTo}
              themeLabel={t("noGradient")}
              onChange={(v) => setFooter({ gradientTo: v }, "f-grad")}
            />
          )}
          <ColorField title={t("textColor")} value={footer.textColor} themeLabel={t("theme")} onChange={(v) => setFooter({ textColor: v }, "f-text")} />
          <Choice
            title={t("socialStyle")}
            value={footer.socialStyle}
            options={[
              ["text", t("socialText")],
              ["icons", t("socialIcons")],
            ]}
            onChange={(v) => setFooter({ socialStyle: v })}
          />
          <Switch title={t("borderTop")} checked={footer.border} onChange={(v) => setFooter({ border: v })} />
          {credit && <p className="text-muted text-[12px]">{st("footerCredit")}</p>}
        </>
      )}
      {tab === "items" && (
        <>
          <Switch title={t("showTitle")} checked={footer.showTitle} onChange={(v) => setFooter({ showTitle: v })} />
          <Text title={t("email")} value={footer.email} dir="ltr" placeholder="you@email.com" onChange={(v) => setFooter({ email: v }, "f-email")} />
          <Switch title={t("backToTop")} checked={footer.backToTop} onChange={(v) => setFooter({ backToTop: v })} />
          {footer.showTitle && draft.theme.logoMediaId && <Switch title={t("footerLogo")} checked={!!footer.logo} onChange={(v) => setFooter({ logo: v })} />}
          <Switch title={t("footerAccent")} checked={!!footer.accent} onChange={(v) => setFooter({ accent: v })} />
          <Switch title={t("footerBig")} checked={!!footer.big} onChange={(v) => setFooter({ big: v })} />
          <div className="border-line flex flex-col gap-3 border-t pt-4">
            <Switch title={t("showSocial")} checked={footer.social} onChange={(v) => setFooter({ social: v })} />
            <Switch title={t("showCv")} checked={footer.cv} onChange={(v) => setFooter({ cv: v })} />
            {inSettings}
          </div>
        </>
      )}
    </div>
  );
}
