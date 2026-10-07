import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { LoginForm } from "./LoginForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function LoginPage({ params }: PageProps<"/[locale]/app/login">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  return <LoginForm />;
}
