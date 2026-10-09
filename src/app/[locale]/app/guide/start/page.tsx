import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { loadDashboard } from "../../(dash)/load";
import { StartChoice } from "./StartChoice";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/guide/start">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return { title: t("metaTitle"), robots: { index: false } };
}

// Right after sign-up: be guided through building the site, or start designing straight away.
export default async function GuideStartPage({ params }: PageProps<"/[locale]/app/guide/start">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { draft } = await loadDashboard();
  return <StartChoice name={draft.title} />;
}
