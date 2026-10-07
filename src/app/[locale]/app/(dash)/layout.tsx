import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import type { Locale } from "@/i18n/locales";
import { DashNav, LanguageButton, LogoutButton } from "./DashClient";
import { loadDashboard } from "./load";

// Dashboard shell matching design/screens/product/Dashboard.dc.html: white sidebar, flat mist main area.
export default async function DashLayout({ children, params }: LayoutProps<"/[locale]/app">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { user, site, projects, limits } = await loadDashboard();
  const t = await getTranslations("dashboard");
  const tp = await getTranslations("projects");
  // Storage is never advertised as a number: only a calm percentage here, louder from 80%.
  const storagePct = Math.min(100, Math.round(((site.storageUsed ?? 0) / limits.storageBytes) * 100));
  const limit = limits.projects;

  return (
    <div className="bg-mist text-ink flex min-h-dvh flex-col md:flex-row">
      <aside className="border-line bg-paper flex flex-col gap-4 px-3.5 py-4 md:sticky md:top-0 md:h-dvh md:w-[236px] md:flex-none md:gap-6 md:border-e md:py-[22px]">
        <div className="flex items-center justify-between px-2">
          <a href="/" aria-label="Fannan">
            <Logo lang={locale} size={24} />
          </a>
          <div className="flex items-center gap-3 md:hidden">
            <LogoutButton label={t("logout")} />
            <LanguageButton locale={locale} label={t("language")} />
          </div>
        </div>
        <DashNav
          label={t("navLabel")}
          items={[
            { href: "/", icon: "dashboard", label: t("nav.dashboard") },
            { href: "/editor", icon: "site-editor", label: t("nav.editor") },
            { href: "/projects", icon: "projects", label: t("nav.projects") },
            { href: "/stats", icon: "stats", label: t("nav.stats") },
            { href: "/settings", icon: "settings", label: t("nav.settings") },
          ]}
        />
        <div className="bg-mist hidden flex-col gap-2.5 rounded-md p-3.5 md:mt-auto md:flex">
          <div className="flex justify-between text-[12px]">
            <span className="font-semibold">{t("freePlan")}</span>
            {limit !== null && <span className="text-muted">{t("projectsUsed", { count: projects, limit })}</span>}
          </div>
          {limit !== null && (
            <div
              className="bg-line h-1.5 rounded-[3px]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={projects}
              aria-label={t("projectsUsed", { count: projects, limit })}
            >
              <div
                className="bg-ink h-1.5 rounded-[3px]"
                style={{ width: `${Math.min(100, (projects / limit) * 100)}%` }}
              />
            </div>
          )}
          <div className="border-line flex flex-col gap-1.5 border-t pt-2.5" data-testid="storage-meter">
            <div className="bg-line h-1.5 rounded-[3px]" aria-hidden>
              <div
                className={storagePct >= 80 ? "bg-ink h-1.5 rounded-[3px]" : "bg-ink-soft h-1.5 rounded-[3px]"}
                style={{ width: `${storagePct}%` }}
              />
            </div>
            <span className={storagePct >= 80 ? "text-ink text-[12px] font-semibold" : "text-muted text-[12px]"}>
              {storagePct >= 80 ? tp("storageHigh", { percent: storagePct }) : tp("storage", { percent: storagePct })}
            </span>
          </div>
          <a
            href="/upgrade"
            className="bg-lime flex h-9 items-center justify-center rounded-[8px] text-[13px] font-semibold hover:brightness-95"
          >
            {t("upgrade")}
          </a>
        </div>
        <div className="text-muted hidden items-center justify-between gap-2 px-2 md:flex">
          <span className="truncate" data-testid="dash-user">
            {user.displayName}
          </span>
          <LanguageButton locale={locale} label={t("language")} />
        </div>
        <div className="hidden px-2 md:block">
          <LogoutButton label={t("logout")} />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-12 md:px-9 md:pt-[30px]">{children}</main>
    </div>
  );
}
