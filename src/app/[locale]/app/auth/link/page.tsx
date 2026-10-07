import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { CompleteLink } from "./CompleteLink";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/auth/link">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "authLink" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AuthLinkPage({ params }: PageProps<"/[locale]/app/auth/link">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  return <CompleteLink />;
}
