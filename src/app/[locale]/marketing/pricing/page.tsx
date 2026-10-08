import type { Metadata } from "next";
import { headers } from "next/headers";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import { currencyForCountry, plansConfig } from "@/config/plans";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { surfaceUrls } from "@/lib/server/urls";

// Prices from config/plans.json in the visitor's currency (EGP in Egypt, USD elsewhere).

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
  const rows = ["projects", "address", "domain", "themes", "contact", "available", "stats", "passwords", "storage", "credit"] as const;

  return (
    <MarketingPage locale={locale} path="/pricing" title={t("title")} sub={t("sub")}>
      <p className="text-muted mb-6 text-[14px]">{currency === "EGP" ? t("inEgp") : t("inUsd")}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-4">
        <section className="border-line flex flex-col gap-3 rounded-[16px] border p-6">
          <h2 className="font-heading font-heading-weight text-[24px]">{t("free")}</h2>
          <div className="font-heading font-heading-weight text-[36px]">{money(0)}</div>
          <p className="text-ink-soft text-[14px]">{t("freeBlurb")}</p>
          <a href={`${mHref(locale, "/")}#claim`} className="border-ink mt-auto flex h-12 items-center justify-center rounded-md border-2 font-semibold hover:bg-mist">
            {t("startFree")}
          </a>
        </section>
        {plansConfig.plans.pro.durations.map((d) => (
          <section key={d.months} className={cx("flex flex-col gap-3 rounded-[16px] border-2 p-6", d.months === 12 ? "border-ink" : "border-line")}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading font-heading-weight text-[24px]">{t("pro", { months: d.months })}</h2>
              <span className={cx("rounded-sm px-2 py-0.5 text-[11px] font-semibold", d.months === 12 ? "bg-lime" : "bg-mist")}>
                {t(`tags.${d.months}`)}
              </span>
            </div>
            <div>
              <span className="font-heading font-heading-weight text-[36px]">{money(d[currency])}</span>
              <div className="text-muted text-[14px]">{t("perMonth", { price: money(Math.floor(d[currency] / d.months)) })}</div>
            </div>
            <p className="text-ink-soft text-[14px]">{t("once")}</p>
            <a
              href={urls.app(`/upgrade?months=${d.months}`)}
              className={cx(
                "mt-auto flex h-12 items-center justify-center rounded-md font-semibold",
                d.months === 12 ? "bg-ink hover:bg-ink-soft text-white" : "border-ink border-2 hover:bg-mist",
              )}
            >
              {t("get", { months: d.months })}
            </a>
          </section>
        ))}
      </div>

      <h2 className="font-heading font-heading-weight mt-16 mb-6 text-[32px]">{t("compareTitle")}</h2>
      <div className="border-line overflow-x-auto rounded-[16px] border">
        <table className="w-full min-w-[480px] text-start text-[15px]">
          <thead className="bg-mist">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t("feature")}</th>
              <th className="px-4 py-3 text-start font-semibold">{t("free")}</th>
              <th className="px-4 py-3 text-start font-semibold">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map((r) => (
              <tr key={r}>
                <th scope="row" className="px-4 py-3 text-start font-medium">
                  {t(`rows.${r}.label`)}
                </th>
                <td className="text-ink-soft px-4 py-3">{t(`rows.${r}.free`)}</td>
                <td className="px-4 py-3 font-medium">{t(`rows.${r}.pro`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-heading font-heading-weight mt-16 mb-6 text-[32px]">{t("faqTitle")}</h2>
      <div className="flex max-w-[760px] flex-col gap-3">
        {(["renew", "stack", "ends", "currency", "refund", "pay"] as const).map((q) => (
          <details key={q} className="border-line group rounded-[14px] border p-5">
            <summary className="cursor-pointer text-[17px] font-semibold">{t(`faq.${q}.q`)}</summary>
            <p className="text-ink-soft mt-3">{t(`faq.${q}.a`)}</p>
          </details>
        ))}
      </div>
    </MarketingPage>
  );
}
