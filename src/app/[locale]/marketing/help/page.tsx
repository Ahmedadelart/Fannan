import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import { Tile } from "@/components/marketing/ui";
import { Icon } from "@/components/ui/Icon";
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

// Round 20: groups as accordions with a hairline between the questions (Talabat's highlights list).
export default async function HelpPage({ params }: PageProps<"/[locale]/marketing/help">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("help");
  return (
    <MarketingPage locale={locale} path="/help" title={t("title")} sub={t("sub")} narrow>
      <div className="flex flex-col gap-14">
        {(Object.keys(GROUPS) as Array<keyof typeof GROUPS>).map((g) => (
          <section key={g} aria-labelledby={`help-${g}`} className="flex flex-col">
            <h2 id={`help-${g}`} className="mk-title m-0 mb-2 text-[clamp(26px,3vw,32px)]">
              {t(`groups.${g}`)}
            </h2>
            {GROUPS[g].map((q) => (
              <details key={q} className="mk-acc py-5">
                <summary className="flex items-center justify-between gap-4 text-[19px] font-bold">
                  {t(`q.${q}.q`)}
                  <Icon name="chevron-down" size={20} className="mk-chev shrink-0 transition-transform" />
                </summary>
                <p className="m-0 mt-3 text-[17px] leading-[1.6] whitespace-pre-line opacity-85">{t(`q.${q}.a`)}</p>
              </details>
            ))}
          </section>
        ))}
        <Tile tone="sage" className="p-7 text-[17px]">
          {t.rich("more", {
            a: (c) => (
              <a href={mHref(locale, "/contact")} className="font-bold underline underline-offset-4">
                {c}
              </a>
            ),
          })}
        </Tile>
      </div>
    </MarketingPage>
  );
}
