import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { loadGuide } from "@/lib/server/guide";
import { settingsFrom } from "@/lib/server/settings";
import { defaultGuide } from "@/lib/site/guide";
import { loadDashboard } from "../(dash)/load";
import { GuideFlow } from "./GuideFlow";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/guide">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return { title: t("metaTitle"), robots: { index: false } };
}

// The guided setup (round 8): questions one at a time, then the site is built from the answers.
export default async function GuidePage({ params }: PageProps<"/[locale]/app/guide">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { session, user, site, draft, render, limits, address } = await loadDashboard();
  const { state } = await loadGuide(session.uid);
  const settings = settingsFrom(site as Parameters<typeof settingsFrom>[0]);
  const fresh = defaultGuide({
    name: draft.title,
    discipline: user.onboarding?.discipline ?? "",
    language: draft.language,
    preset: draft.theme.preset,
  });
  // Coming back resumes where people stopped; after a build, running it again starts from the same answers.
  const answers = state?.answers?.pages?.length ? { ...fresh, ...state.answers } : fresh;
  const edited = !!(site as { draftUpdatedAt?: unknown }).draftUpdatedAt;

  return (
    <GuideFlow
      initial={{
        step: state && !state.done ? state.step : 0,
        answers,
        rerun: edited,
        language: draft.language,
        title: draft.title,
        address,
        header: draft.header,
        media: render.media,
        projects: render.projects,
        social: settings.social,
        projectLimit: limits.projects,
      }}
    />
  );
}
