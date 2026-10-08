import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender } from "@/components/site/SiteRender";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/Surfaces";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { listProjects } from "@/lib/server/projects";
import { listMessages } from "@/lib/server/settings";
import { statsReport } from "@/lib/server/stats";
import { AvailabilityCard, HideChecklistButton, ShareButton, TurnOnButton } from "./DashClient";
import { loadDashboard } from "./load";
import { NewProjectButton } from "./projects/NewProjectButton";

export async function generateMetadata({ params }: PageProps<"/[locale]/app">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("metaTitle"), robots: { index: false } };
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("border-line bg-paper flex flex-col gap-3.5 rounded-lg border p-5", className)}>
      {children}
    </section>
  );
}

function SectionTitle({ icon, children }: { icon?: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode }) {
  return (
    <h2 className="font-heading font-heading-weight flex items-center gap-2.5 text-[20px] leading-tight">
      {icon && <Icon name={icon} size={20} />}
      {children}
    </h2>
  );
}

export default async function Dashboard({ params }: PageProps<"/[locale]/app">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const { session, user, site, draft, render, address, siteUrl, checklist } = await loadDashboard();
  const tp = await getTranslations("projects");
  const [allProjects, latest, report] = await Promise.all([
    listProjects(site.id),
    listMessages(site.id, 3).catch(() => []),
    statsReport(site.id, 30, site.publishDays ?? []).catch(() => null),
  ]);
  const projects = allProjects.slice(0, 6);
  const format = await getFormatter();
  const badgeLabels = {
    live: tp("badge.live"),
    password: tp("badge.password"),
    draft: tp("badge.draft"),
    hidden: tp("badge.hidden"),
  };

  const items = Object.entries(checklist) as Array<[keyof typeof checklist, boolean]>;
  const done = items.filter(([, v]) => v).length;

  return (
    <>
      {session.isAnonymous && (
        <div role="status" className="bg-lime flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
          <div className="flex flex-col">
            <span className="font-heading font-heading-weight text-[18px]">{t("saveBanner.title")}</span>
            <span className="text-[14px]">{t("saveBanner.text", { address: `⁦${address}⁩` })}</span>
          </div>
          <a href="/signup" className={buttonClasses("primary", "md")}>
            {t("saveBanner.action")}
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">
            {t("title")}
          </h1>
          <p className="text-muted mt-1">{t("sub")}</p>
        </div>
        <div className="flex gap-2">
          <a href={siteUrl} className={buttonClasses("outline", "lg")}>
            <Icon name="preview" size={18} />
            {t("viewSite")}
          </a>
          <a href="/editor" className={buttonClasses("primary", "lg")}>
            <Icon name="site-editor" size={18} />
            {t("editSite")}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t("yourLink")}</span>
            {site.publishedVersion !== null ? (
              <Badge variant="live">{t("published")}</Badge>
            ) : (
              <Badge variant="draft">{t("notPublished")}</Badge>
            )}
          </div>
          <div className="border-line overflow-hidden rounded-[10px] border">
            <ScaledSite width={1200} height={600}>
              <SiteRender
                site={draft}
                editing
                media={render.media}
                projects={render.projects}
                available={{ on: site.available.on, label: t("available.title"), hire: t("hireMe") }}
              />
            </ScaledSite>
          </div>
          <div dir="ltr" className="text-start text-[16px] font-semibold rtl:text-end" data-testid="site-address">
            {address}
          </div>
          <div className="flex gap-2">
            <ShareButton url={siteUrl} label={t("share")} copied={t("copied")} />
          </div>
        </Card>

        <AvailabilityCard key={`${site.available.on}`} on={site.available.on} types={site.available.types} />

        {!user.checklistDismissed ? (
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{t("checklist.title")}</div>
                <div className="text-muted text-[12px]">{t("checklist.progress", { done, total: items.length })}</div>
              </div>
              <HideChecklistButton label={t("checklist.hide")} />
            </div>
            <ul className="flex flex-col gap-2">
              {items.map(([key, ok]) => (
                <li key={key} className={cx("flex items-center gap-2.5 text-[14px]", ok && "text-muted line-through")}>
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-5 flex-none items-center justify-center rounded-sm",
                      ok ? "bg-ink text-lime" : "border-line-strong border-[1.5px]",
                    )}
                  >
                    {ok && <Icon name="check" size={12} />}
                  </span>
                  <span>
                    <span className="sr-only">{ok ? "✓ " : ""}</span>
                    {t(`checklist.items.${key}`)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t("stats.title")}</span>
            </div>
            {report && report.totals.views > 0 ? (
              <a href="/stats" className="flex flex-1 flex-col gap-1 py-2">
                <span className="font-heading font-heading-weight text-[40px] leading-none">
                  {format.number(report.totals.visitors)}
                </span>
                <span className="text-muted text-[13px]">
                  {t("stats.visitors", { count: report.totals.visitors })} ·{" "}
                  {t("stats.views", { count: report.totals.views })}
                </span>
              </a>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 py-4 text-center">
                <span className="font-heading font-heading-weight text-[18px]">{t("stats.emptyTitle")}</span>
                <span className="text-muted text-[13px]">{t("stats.emptyText")}</span>
              </div>
            )}
          </Card>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon="messages">{t("messages.title")}</SectionTitle>
          {latest.length > 0 ? (
            <a href="/messages" className={buttonClasses("outline", "sm")}>
              {t("messages.all")}
            </a>
          ) : (
            <span className="text-muted text-[13px]">{t("messages.sub")}</span>
          )}
        </div>
        {latest.length > 0 ? (
          <ul className="divide-line divide-y" data-testid="latest-messages">
            {latest.map((m) => (
              <li key={m.id}>
                <a href="/messages" className="hover:bg-mist/60 -mx-2 flex items-start gap-3 rounded-[10px] px-2 py-2.5">
                  <span aria-hidden className={cx("mt-2 size-2 flex-none rounded-full", m.read ? "" : "bg-ink")} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex justify-between gap-3">
                      <span className={cx("truncate", m.read ? "font-medium" : "font-semibold")}>{m.name}</span>
                      <span className="text-muted flex-none text-[12px]">
                        {format.dateTime(new Date(m.createdAt), { dateStyle: "medium" })}
                      </span>
                    </span>
                    <span className="text-ink-soft line-clamp-1 text-[13px]">{m.body}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
        <div className="flex flex-col items-center gap-2.5 py-6 text-center">
          <span className="bg-lime flex rounded-[14px] p-3">
            <Icon name="messages" size={40} />
          </span>
          <span className="font-heading font-heading-weight text-[20px]">{t("messages.emptyTitle")}</span>
          {!site.available.on && (
            <>
              <span className="text-ink-soft max-w-[300px] text-[13px]">{t("messages.emptyText")}</span>
              <TurnOnButton label={t("messages.emptyAction")} types={site.available.types} />
            </>
          )}
        </div>
        )}
      </Card>

      <section className="flex flex-col gap-3.5" aria-labelledby="projects-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="projects-title" className="font-heading font-heading-weight text-[20px]">
            {t("projects.title")}
          </h2>
          <NewProjectButton label={t("projects.new")} title={tp("newTitle")} />
        </div>
        {projects.length === 0 ? (
          <EmptyState icon="projects" title={t("projects.emptyTitle")} text={t("projects.emptyText")} />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                labels={badgeLabels}
                p={{
                  id: p.id,
                  title: p.title,
                  meta: [p.category ? tp(`categories.${p.category}`) : "", p.role].filter(Boolean).join(" · "),
                  visibility: p.visibility,
                  published: p.published,
                  cover: p.cover,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
