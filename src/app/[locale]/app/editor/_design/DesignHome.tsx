"use client";

import { useTranslations } from "next-intl";
import { type SiteMedia } from "@/components/site/SiteRender";
import { fontOf, fontStack } from "@/components/site/fonts";
import { Icon } from "@/components/ui/Icon";
import { imageSources } from "@/lib/media";
import type { SiteDraft } from "@/lib/site/types";
import { NavSketch, type DesignSection } from "./StyleTab";

/* ---------- Round 18: the Design panel as small previews (Squarespace's Site Styles) ---------- */

export function DesignHome({
  draft,
  media,
  onOpen,
  onOpenSettings,
  canPassword,
}: {
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  onOpen: (section: DesignSection) => void;
  /** The site language lives in Settings. */
  onOpenSettings: () => void;
  canPassword: boolean;
}) {
  const t = useTranslations("editor");
  const th = draft.theme;
  const heading = fontStack(fontOf(th.fonts.heading, "inter"));
  const body = fontStack(fontOf(th.fonts.body, "inter"));
  const { background, text, accent } = th.colors;
  const logo = th.logoMediaId ? imageSources(media[th.logoMediaId], 400)?.src : null;
  const label = "text-muted text-[11px] font-semibold tracking-[0.08em] uppercase";
  const card =
    "border-line hover:bg-mist flex min-w-0 flex-col gap-2.5 rounded-[14px] border p-3 text-start transition-colors";
  const open = (section: DesignSection) => ({
    type: "button" as const,
    onClick: () => onOpen(section),
    "aria-label": t(`design.${section}`),
    "data-testid": `design-card-${section}`,
  });

  return (
    <div className="flex flex-col gap-2.5 px-3 pt-3 pb-6">
      <h2 className="px-1 pb-0.5 text-[15px] font-semibold">{t("rail.design")}</h2>
      {/* Theme: the colours, the heading font and a button, as they look on the site. */}
      <button {...open("styles")} className={card}>
        <span className={label}>{t("design.styles")}</span>
        <span className="flex items-center gap-3 rounded-[10px] p-3" style={{ background, color: text }}>
          <span className="text-[28px] leading-none" style={{ fontFamily: heading }}>
            Aa
          </span>
          <span className="flex overflow-hidden rounded-[4px] ring-1 ring-black/10">
            {[background, text, accent].map((c, i) => (
              <span key={i} className="h-7 w-4" style={{ background: c }} />
            ))}
          </span>
          <span
            className="ms-auto px-2.5 py-1.5 text-[10px] font-bold"
            style={{ background: accent, color: background, borderRadius: th.radius, fontFamily: body }}
          >
            {t("design.sampleButton")}
          </span>
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        <button {...open("fonts")} className={card}>
          <span className={label}>{t("design.fonts")}</span>
          <span className="truncate text-[20px] leading-none" style={{ fontFamily: heading }}>
            {fontOf(th.fonts.heading, "inter").name}
          </span>
          <span className="text-ink-soft truncate text-[11px]" style={{ fontFamily: body }}>
            {fontOf(th.fonts.body, "inter").name}
          </span>
        </button>
        <button {...open("logo")} className={card}>
          <span className={label}>{t("design.logo")}</span>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-7 max-w-full object-contain object-left rtl:object-right" />
          ) : (
            <span className="truncate text-[16px] leading-tight" style={{ fontFamily: heading }}>
              {draft.title || "—"}
            </span>
          )}
        </button>
        <button {...open("nav")} className={card}>
          <span className={label}>{t("design.nav")}</span>
          <span className="flex h-8 items-center rounded-[8px] px-2" style={{ background, color: text }}>
            <NavSketch nav={th.nav} />
          </span>
        </button>
        <button {...open("footer")} className={card}>
          <span className={label}>{t("design.footer")}</span>
          <span
            className="flex h-8 items-center justify-between rounded-[8px] px-2"
            style={{ background: text, color: background }}
          >
            <span className="h-1.5 w-7 rounded-[2px] bg-current" />
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 rounded-full bg-current" />
              ))}
            </span>
          </span>
        </button>
      </div>
      <button {...open("lock")} className={`${card} flex-row items-center`}>
        <Icon name="password" size={18} />
        <span className="flex-1 text-[13px] font-semibold">{t("design.lock")}</span>
        {!canPassword && (
          <span className="bg-lime text-on-lime rounded-pill px-2 py-0.5 text-[10px] font-bold">PRO</span>
        )}
      </button>
      <button
        type="button"
        data-testid="site-language"
        onClick={onOpenSettings}
        className="hover:bg-mist flex h-10 items-center justify-between rounded-[12px] px-3 text-[13px]"
      >
        {t("style.language")}
        <span className="text-muted flex items-center gap-1">
          {t(`style.languages.${draft.language}`)}
          <Icon name="chevron-down" size={16} className="-rotate-90 rtl:rotate-90" />
        </span>
      </button>
    </div>
  );
}
