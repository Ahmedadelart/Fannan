import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { DAY_MS, GRACE_DAYS, type ProStatus } from "@/lib/plan";
import { Logo } from "@/components/ui/Logo";
import type { Locale } from "@/i18n/locales";
import { isAdminEmail } from "@/config/admins";
import { countUnread } from "@/lib/server/settings";
import { DashNav, LanguageButton, LogoutButton } from "./DashClient";
import { EMBED_SCRIPT, EmbedBridge } from "./EmbedBridge";
import { loadDashboard } from "./load";

// Dashboard shell matching design/screens/product/Dashboard.dc.html: white sidebar, flat mist main area.
/** Reminders in the dashboard at 14, 3 and 0 days, during the grace period, and after the move to Free. */
async function ProBanner({ pro }: { pro: ProStatus }) {
  if (pro.proUntil === null) return null;
  const t = await getTranslations("dashboard.proBanner");
  const format = await getFormatter();
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "long" });
  const graceEnd = pro.proUntil + GRACE_DAYS * DAY_MS;
  let text: string | null = null;
  if (pro.inGrace) text = t("grace", { date: date(graceEnd) });
  else if (pro.plan === "pro" && pro.daysLeft !== null && pro.daysLeft <= 14) text = t("ending", { date: date(pro.proUntil) });
  else if (pro.plan === "free" && (pro.daysLeft ?? -999) > -(GRACE_DAYS + 30)) text = t("free");
  if (!text) return null;
  return (
    <div role="status" className="bg-lime flex flex-wrap items-center justify-between gap-3 rounded-lg p-4" data-testid="pro-banner">
      <span className="text-[14px] font-semibold">{text}</span>
      <a href="/upgrade" className={buttonClasses("primary", "md")}>
        {t("action")}
      </a>
    </div>
  );
}

export default async function DashLayout({ children, params }: LayoutProps<"/[locale]/app">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { user, site, projects, limits, pro, session } = await loadDashboard();
  const admin = !session.isAnonymous && isAdminEmail(session.email);
  const format = await getFormatter();
  const unread = await countUnread(site.id).catch(() => 0);
  const t = await getTranslations("dashboard");
  const tp = await getTranslations("projects");
  // Storage is never advertised as a number: only a calm percentage here, louder from 80%.
  const storagePct = Math.min(100, Math.round(((site.storageUsed ?? 0) / limits.storageBytes) * 100));
  const limit = limits.projects;

  return (
    <div className="bg-mist text-ink flex min-h-dvh flex-col md:flex-row">
      {/* Inside the editor's panel this page drops its sidebar (see EmbedBridge). */}
      <script dangerouslySetInnerHTML={{ __html: EMBED_SCRIPT }} />
      <EmbedBridge />
      <aside className="dash-chrome border-line bg-paper flex flex-col gap-4 px-3.5 py-4 md:sticky md:top-0 md:h-dvh md:w-[236px] md:flex-none md:gap-6 md:border-e md:py-[22px]">
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
            { href: "/home", icon: "dashboard", label: t("nav.dashboard") },
            { href: "/editor", icon: "site-editor", label: t("nav.editor") },
            { href: "/projects", icon: "projects", label: t("nav.projects") },
            {
              href: "/messages",
              icon: "messages",
              label: t("nav.messages"),
              count: unread,
              countLabel: t("unread", { count: unread }),
            },
            { href: "/stats", icon: "stats", label: t("nav.stats") },
            { href: "/settings", icon: "settings", label: t("nav.settings") },
            ...(admin ? [{ href: "/admin", icon: "password" as const, label: t("nav.admin") }] : []),
          ]}
        />
        <div className="bg-mist hidden flex-col gap-2.5 rounded-md p-3.5 md:mt-auto md:flex">
          <div className="flex justify-between text-[12px]">
            <span className="font-semibold">{pro.plan === "pro" ? t("proPlan") : t("freePlan")}</span>
            {pro.plan === "pro" && pro.proUntil !== null && (
              <span className="text-muted">{t("proUntil", { date: format.dateTime(new Date(pro.proUntil), { dateStyle: "medium" }) })}</span>
            )}
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
            {pro.plan === "pro" ? t("addTime") : t("upgrade")}
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
      <main className="dash-main flex min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-12 md:px-9 md:pt-[30px]">
        <ProBanner pro={pro} />
        {user.deletion && (
          <a href="/settings#account" role="alert" className="bg-lime rounded-lg p-4 text-[14px] font-semibold">
            {t("deletionPending")}
          </a>
        )}
        {children}
      </main>
    </div>
  );
}
