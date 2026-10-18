import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardActions } from "@/components/projects/ProjectCardActions";
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
  const all = await listProjects(site.id);
  const sp0 = await searchParams;
  // Tags as filters: one click shows, say, every project tagged "needs-role".
  const tag = typeof sp0.tag === "string" ? sp0.tag.toLowerCase() : "";
  const tags = [...new Set(all.flatMap((p) => p.tags.map((x) => x.toLowerCase())))].sort();
  const projects = tag ? all.filter((p) => p.tags.some((x) => x.toLowerCase() === tag)) : all;
  const limit = limits.projects;
  const atLimit = limit !== null && all.length >= limit;
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
              {t("limitTitle", { count: all.length, limit })}
            </span>
            <span className="text-[14px]">{t("limitText", { price: await priceLabel(locale) })}</span>
            {all.length > limit && (
              <span className="text-[14px]" data-testid="over-limit">
                {t("overLimit", { limit })}
              </span>
            )}
          </div>
          <a href="/upgrade" className={buttonClasses("primary", "md")}>
            {t("upgrade")}
          </a>
        </div>
      )}

      {tags.length > 0 && (
        <nav aria-label={t("tagsLabel")} className="flex flex-wrap gap-1.5" data-testid="project-tags">
          {["", ...tags].map((x) => (
            <a
              key={x || "all"}
              href={x ? `/projects?tag=${encodeURIComponent(x)}` : "/projects"}
              aria-current={x === tag ? "page" : undefined}
              className={x === tag ? "bg-lime text-on-lime rounded-pill px-3 py-1.5 text-[13px] font-semibold" : "bg-mist text-ink-soft hover:text-ink rounded-pill px-3 py-1.5 text-[13px] font-semibold"}
            >
              {x ? `#${x}` : t("allTags", { count: all.length })}
            </a>
          ))}
        </nav>
      )}

      {projects.length === 0 ? (
        <EmptyState icon="projects" title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              labels={labels}
              actions={<ProjectCardActions id={p.id} title={p.title} />}
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
