import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Surfaces";
import type { Locale } from "@/i18n/locales";
import { listProjects } from "@/lib/server/projects";
import { loadDashboard, priceLabel } from "../load";
import { NewProjectButton } from "./NewProjectButton";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/projects">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProjectsPage({ params, searchParams }: PageProps<"/[locale]/app/projects">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("projects");
  const { site, limits } = await loadDashboard();
  const projects = await listProjects(site.id);
  const limit = limits.projects;
  const atLimit = limit !== null && projects.length >= limit;
  const sp = await searchParams;
  const labels = {
    live: t("badge.live"),
    password: t("badge.password"),
    draft: t("badge.draft"),
    hidden: t("badge.hidden"),
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">
            {t("title")}
          </h1>
          <p className="text-muted mt-1">{t("sub")}</p>
        </div>
        {!atLimit && <NewProjectButton label={t("new")} title={t("newTitle")} size="lg" />}
      </div>

      {(atLimit || sp.limit) && limit !== null && (
        <div role="status" className="bg-lime flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
          <div className="flex flex-col">
            <span className="font-heading font-heading-weight text-[18px]">
              {t("limitTitle", { count: projects.length, limit })}
            </span>
            <span className="text-[14px]">{t("limitText", { price: await priceLabel(locale) })}</span>
          </div>
          <a href="/upgrade" className={buttonClasses("primary", "md")}>
            {t("upgrade")}
          </a>
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState icon="projects" title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              labels={labels}
              p={{
                id: p.id,
                title: p.title,
                meta: [p.category ? t(`categories.${p.category}`) : "", p.role].filter(Boolean).join(" · "),
                visibility: p.visibility,
                published: p.published,
                cover: p.cover,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
