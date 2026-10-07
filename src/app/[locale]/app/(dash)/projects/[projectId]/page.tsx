import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { plansConfig } from "@/config/plans";
import type { Locale } from "@/i18n/locales";
import { loadProject, ownerOf, ProjectError } from "@/lib/server/projects";
import { loadDashboard } from "../../load";
import { ProjectEditor } from "./ProjectEditor";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/projects/[projectId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/app/projects/[projectId]">) {
  const { locale, projectId } = (await params) as { locale: Locale; projectId: string };
  setRequestLocale(locale);
  const { session, address, limits } = await loadDashboard();
  let data;
  try {
    data = await loadProject(await ownerOf(session.uid), projectId);
  } catch (e) {
    if (e instanceof ProjectError) notFound();
    throw e;
  }
  return (
    <ProjectEditor
      key={projectId}
      initialProject={data.project}
      initialMedia={data.media}
      address={address}
      canPassword={limits.passwordProtection}
      maxImageMb={Math.round(plansConfig.uploads.maxImageBytes / 1048576)}
      maxFileMb={Math.round(plansConfig.uploads.maxPdfBytes / 1048576)}
      limits={{
        image: plansConfig.uploads.maxImageBytes,
        pdf: plansConfig.uploads.maxPdfBytes,
        loop: plansConfig.uploads.maxLoopBytes,
      }}
    />
  );
}
