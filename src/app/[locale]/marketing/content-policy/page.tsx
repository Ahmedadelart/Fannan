import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalDoc, legalTitle } from "@/components/marketing/LegalDoc";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/content-policy">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: await legalTitle(locale, "policy"), alternates: { languages: { en: "/content-policy", ar: "/ar/content-policy" } } };
}

export default async function PolicyPage({ params }: PageProps<"/[locale]/marketing/content-policy">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  return <LegalDoc locale={locale} doc="policy" path="/content-policy" />;
}
