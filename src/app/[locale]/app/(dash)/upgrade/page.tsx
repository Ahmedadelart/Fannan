import type { Metadata } from "next";
import { headers } from "next/headers";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { currencyForCountry, plansConfig } from "@/config/plans";
import { Badge } from "@/components/ui/Badge";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { GRACE_DAYS, DAY_MS } from "@/lib/plan";
import { checkoutProvider, priceList, usdToEgp } from "@/lib/server/billing";
import { loadDashboard } from "../load";
import { BuyButton } from "./BuyButton";

// Upgrade (Settings.dc.html "Plan & billing", full page): Free vs Pro for 3, 6 or 12 months,
// prices in EGP in Egypt and USD elsewhere. Prepaid; nothing renews.

export async function generateMetadata({ params }: PageProps<"/[locale]/app/upgrade">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "upgrade" });
  return { title: t("title"), robots: { index: false } };
}

export default async function UpgradePage({ params, searchParams }: PageProps<"/[locale]/app/upgrade">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("upgrade");
  const format = await getFormatter();
  const { pro, session } = await loadDashboard();
  const picked = Number((await searchParams).months) || null;

  const currency = currencyForCountry((await headers()).get("cf-ipcountry"));
  const prices = await priceList(currency);
  const provider = checkoutProvider();
  const rate =
    currency === "USD" && !plansConfig.payments.chargeUsd ? await usdToEgp().catch(() => null) : null;
  const money = (n: number) =>
    currency === "EGP" ? t("egp", { n: format.number(n) }) : `$${format.number(n)}`;
  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: "long" });

  const proFeatures = ["projects", "domain", "storage", "passwords", "stats", "credit"] as const;
  const freeFeatures = ["projects", "address", "themes", "contact", "stats", "credit"] as const;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">{t("title")}</h1>
          <p className="text-muted mt-1">{t("sub")}</p>
        </div>
        <Badge variant="neutral">{currency === "EGP" ? t("currencyEgp") : t("currencyUsd")}</Badge>
      </div>

      {pro.proUntil !== null && pro.plan === "pro" && (
        <div role="status" className={cx("rounded-lg p-4 text-[14px]", pro.inGrace || (pro.daysLeft ?? 99) <= 14 ? "bg-lime" : "bg-paper border-line border")}>
          <span className="font-semibold">
            {pro.inGrace
              ? t("statusGrace", { date: date(pro.proUntil + GRACE_DAYS * DAY_MS) })
              : t("statusPro", { date: date(pro.proUntil) })}
          </span>{" "}
          {t("stacks")}
        </div>
      )}
      {pro.plan === "pro" && pro.proUntil === null && (
        <div role="status" className="border-line bg-paper rounded-lg border p-4 text-[14px] font-semibold">
          {t("statusGift")}
        </div>
      )}

      {provider === "practice" && (
        <div role="note" className="bg-ink rounded-lg p-4 text-[14px] text-white">
          <span className="font-semibold">{t("practiceTitle")}</span> {t("practiceText")}
        </div>
      )}
      {provider === null && (
        <div role="note" className="border-line bg-paper rounded-lg border p-4 text-[14px]">
          {t("soon")}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3.5">
        <section className="border-line bg-paper flex flex-col gap-3 rounded-[14px] border-2 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-heading-weight text-[22px]">{t("free")}</h2>
            {pro.plan === "free" && <Badge variant="neutral">{t("current")}</Badge>}
          </div>
          <div>
            <span className="font-heading font-heading-weight text-[30px]">{money(0)}</span>
            <span className="text-muted"> {t("forever")}</span>
          </div>
          <p className="text-ink-soft text-[13px]">{t("freeBlurb")}</p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {freeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden className="bg-lime mt-2 h-[5px] w-2.5 flex-none -skew-x-[14deg]" />
                {t(`freeFeatures.${f}`)}
              </li>
            ))}
          </ul>
        </section>
        {prices.map((p) => {
          const hot = picked ? p.months === picked : p.months === 12;
          return (
            <section
              key={p.months}
              data-testid={`plan-${p.months}`}
              className={cx("bg-paper flex flex-col gap-3 rounded-[14px] border-2 p-5", hot ? "border-ink" : "border-line")}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading font-heading-weight text-[22px]">{t("pro", { months: p.months })}</h2>
                <span className={cx("rounded-sm px-2 py-0.5 text-[11px] font-semibold", hot ? "bg-lime" : "bg-mist")}>
                  {p.offer ? t("offer") : t(`tags.${p.months}`)}
                </span>
              </div>
              <div>
                <span className="font-heading font-heading-weight text-[30px]">{money(p.amount)}</span>
                <span className="text-muted text-[13px]"> · {t("perMonth", { price: money(p.perMonth) })}</span>
              </div>
              <p className="text-ink-soft text-[13px]">{t("once")}</p>
              {rate && (
                <p className="text-muted text-[12px]">
                  {t("bankEgp", { amount: format.number(Math.round(p.amount * rate)) })}
                </p>
              )}
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {proFeatures.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="bg-lime mt-2 h-[5px] w-2.5 flex-none -skew-x-[14deg]" />
                    {t(`proFeatures.${f}`)}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <BuyButton
                  months={p.months}
                  label={t("get", { months: p.months })}
                  primary={hot}
                  disabled={!provider || session.isAnonymous}
                />
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-muted text-[12px]">{t("note")}</p>
    </>
  );
}
