import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/help">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "help" });
  return { title: t("title"), description: t("sub"), alternates: { languages: { en: "/help", ar: "/ar/help" } } };
}

const GROUPS = {
  start: ["what", "free", "time", "arabic"],
  site: ["upload", "video", "publish", "password", "domain", "seo"],
  hired: ["available", "messages", "stats"],
  account: ["username", "export", "delete", "pay"],
} as const;

export default async function HelpPage({ params }: PageProps<"/[locale]/marketing/help">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("help");
  return (
    <MarketingPage locale={locale} path="/help" title={t("title")} sub={t("sub")} narrow>
      <div className="flex flex-col gap-12">
        {(Object.keys(GROUPS) as Array<keyof typeof GROUPS>).map((g) => (
          <section key={g} aria-labelledby={`help-${g}`} className="flex flex-col gap-3">
            <h2 id={`help-${g}`} className="font-heading font-heading-weight text-[28px]">
              {t(`groups.${g}`)}
            </h2>
            {GROUPS[g].map((q) => (
              <details key={q} className="border-line rounded-[14px] border p-5">
                <summary className="cursor-pointer text-[17px] font-semibold">{t(`q.${q}.q`)}</summary>
                <p className="text-ink-soft mt-3 whitespace-pre-line">{t(`q.${q}.a`)}</p>
              </details>
            ))}
          </section>
        ))}
        <p className="bg-mist rounded-[14px] p-5 text-[16px]">
          {t.rich("more", { a: (c) => <a href={mHref(locale, "/contact")} className="font-semibold underline">{c}</a> })}
        </p>
      </div>
    </MarketingPage>
  );
}
