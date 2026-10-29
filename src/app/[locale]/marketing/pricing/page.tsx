import type { Metadata } from "next";
import { headers } from "next/headers";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import { Badge, Pill, Tile } from "@/components/marketing/ui";
import { Icon } from "@/components/ui/Icon";
import { currencyForCountry, plansConfig } from "@/config/plans";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { surfaceUrls } from "@/lib/server/urls";

// Prices from config/plans.json in the visitor's currency (EGP in Egypt, USD elsewhere).
// Round 20: tiles like Talabat's "numbers" (cream, ink, sage), the comparison in a paper tile, an accordion.

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return { title: t("title"), description: t("sub"), alternates: { languages: { en: "/pricing", ar: "/ar/pricing" } } };
}

export default async function PricingPage({ params }: PageProps<"/[locale]/marketing/pricing">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const format = await getFormatter();
  const urls = await surfaceUrls();
  const currency = currencyForCountry((await headers()).get("cf-ipcountry"));
  const money = (n: number) =>
    currency === "EGP" ? `${format.number(n)} ${locale === "ar" ? "ج.م" : "EGP"}` : `$${format.number(n)}`;
  const rows = [
    "projects",
    "address",
    "domain",
    "themes",
    "contact",
    "available",
    "stats",
    "passwords",
    "storage",
    "credit",
  ] as const;
  const tones = { 3: "mist", 6: "sage", 12: "ink" } as const;

  return (
    <MarketingPage locale={locale} path="/pricing" title={t("title")} sub={t("sub")}>
      <p className="m-0 mb-6 text-[15px] opacity-70">{currency === "EGP" ? t("inEgp") : t("inUsd")}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-5">
        <Tile tone="paper" className="border-ink/10 flex flex-col gap-3 border-2 p-7">
          <h2 className="mk-title m-0 text-[24px]">{t("free")}</h2>
          <div className="mk-display text-[44px]">{money(0)}</div>
          <p className="m-0 text-[15px] opacity-80">{t("freeBlurb")}</p>
          <Pill tone="outline" size="sm" href={`${mHref(locale, "/")}#claim`} className="mt-auto self-start">
            {t("startFree")}
          </Pill>
        </Tile>
        {plansConfig.plans.pro.durations.map((d) => {
          const tone = tones[d.months as 3 | 6 | 12] ?? "mist";
          return (
            <Tile key={d.months} tone={tone} className="flex flex-col gap-3 p-7">
              <div className="flex items-center justify-between gap-2">
                <h2 className="mk-title m-0 text-[24px]">{t("pro", { months: d.months })}</h2>
                <Badge tone={tone === "ink" ? "lime" : "ink"}>{t(`tags.${d.months}`)}</Badge>
              </div>
              <div>
                <span className="mk-display text-[44px]">{money(d[currency])}</span>
                <div className="text-[15px] opacity-75">
                  {t("perMonth", { price: money(Math.floor(d[currency] / d.months)) })}
                </div>
              </div>
              <p className="m-0 text-[15px] opacity-80">{t("once")}</p>
              <Pill
                tone={tone === "ink" ? "lime" : "ink"}
                size="sm"
                href={urls.app(`/upgrade?months=${d.months}`)}
                className="mt-auto self-start"
              >
                {t("get", { months: d.months })}
              </Pill>
            </Tile>
          );
        })}
      </div>

      <h2 className="mk-title mt-20 mb-6 text-[clamp(28px,3.2vw,36px)]">{t("compareTitle")}</h2>
      <Tile tone="paper" className="border-ink/10 overflow-x-auto border-2">
        <table className="w-full min-w-[520px] text-start text-[16px]">
          <thead>
            <tr className="border-ink/10 border-b-2">
              <th className="px-6 py-4 text-start font-bold">{t("feature")}</th>
              <th className="px-6 py-4 text-start font-bold">{t("free")}</th>
              <th className="px-6 py-4 text-start font-bold">Pro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r} className={cx(i < rows.length - 1 && "border-ink/10 border-b")}>
                <th scope="row" className="px-6 py-4 text-start font-semibold">
                  {t(`rows.${r}.label`)}
                </th>
                <td className="px-6 py-4 opacity-80">{t(`rows.${r}.free`)}</td>
                <td className="px-6 py-4 font-semibold">{t(`rows.${r}.pro`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tile>

      <h2 className="mk-title mt-20 mb-4 text-[clamp(28px,3.2vw,36px)]">{t("faqTitle")}</h2>
      <div className="flex max-w-[800px] flex-col">
        {(["renew", "stack", "ends", "currency", "refund", "pay"] as const).map((q) => (
          <details key={q} className="mk-acc py-5">
            <summary className="flex items-center justify-between gap-4 text-[19px] font-bold">
              {t(`faq.${q}.q`)}
              <Icon name="chevron-down" size={20} className="mk-chev shrink-0 transition-transform" />
            </summary>
            <p className="m-0 mt-3 max-w-[64ch] text-[17px] leading-[1.6] opacity-85">{t(`faq.${q}.a`)}</p>
          </details>
        ))}
      </div>
    </MarketingPage>
  );
}
