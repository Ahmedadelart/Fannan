import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalDoc, legalTitle } from "@/components/marketing/LegalDoc";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/terms">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: await legalTitle(locale, "terms"), alternates: { languages: { en: "/terms", ar: "/ar/terms" } } };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/marketing/terms">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  return <LegalDoc locale={locale} doc="terms" path="/terms" />;
}
