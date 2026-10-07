import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { checkUsername } from "@/config/usernames";
import type { Locale } from "@/i18n/locales";
import { getUser } from "@/lib/server/data";
import { getSession } from "@/lib/server/session";
import { DISPLAY_DOMAIN, surfaceUrls } from "@/lib/server/urls";
import { SignupFlow, type SignupInitial } from "./SignupFlow";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function SignupPage({ params, searchParams }: PageProps<"/[locale]/app/signup">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;

  const session = await getSession();
  const user = session ? await getUser(session.uid) : null;
  // Saved accounts with a site go straight to their dashboard.
  if (session && !session.isAnonymous && user?.siteId) redirect("/");

  const fromHomepage = typeof sp.username === "string" ? sp.username.toLowerCase() : undefined;
  const initial: SignupInitial = {
    step: Math.min(user?.onboarding?.step ?? 1, user?.siteId ? 6 : 5),
    name: user?.onboarding?.name ?? "",
    discipline: user?.onboarding?.discipline ?? "",
    layout: user?.onboarding?.layout,
    username: user?.onboarding?.username ?? "",
    hasSite: !!user?.siteId,
    fromHomepage: fromHomepage && checkUsername(fromHomepage) === null ? fromHomepage : undefined,
  };
  // Never resume onto the loader step.
  if (initial.step === 3) initial.step = 4;
  const urls = await surfaceUrls();

  return (
    <SignupFlow
      initial={initial}
      domain={DISPLAY_DOMAIN}
      termsUrl={urls.marketing(locale === "ar" ? "/ar/terms" : "/terms")}
      policyUrl={urls.marketing(locale === "ar" ? "/ar/content-policy" : "/content-policy")}
    />
  );
}
