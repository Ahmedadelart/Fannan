import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { LoginForm } from "./LoginForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/app/login">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const deleted = (await searchParams).deleted === "1";
  const t = await getTranslations("login");
  return (
    <>
      {deleted && (
        <p role="status" className="bg-lime mx-auto mt-6 max-w-[440px] rounded-lg p-4 text-[14px] font-medium">
          {t("deleted")}
        </p>
      )}
      <LoginForm />
    </>
  );
}
