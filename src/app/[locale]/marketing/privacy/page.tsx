import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalDoc, legalTitle } from "@/components/marketing/LegalDoc";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/privacy">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: await legalTitle(locale, "privacy"), alternates: { languages: { en: "/privacy", ar: "/ar/privacy" } } };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/marketing/privacy">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  return <LegalDoc locale={locale} doc="privacy" path="/privacy" />;
}
