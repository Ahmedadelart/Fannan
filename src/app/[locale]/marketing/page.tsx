import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import { Highlight } from "@/components/ui/Surfaces";
import { plansConfig } from "@/config/plans";
import { priceCopy } from "@/components/marketing/price";
import type { Locale } from "@/i18n/locales";
import { DISPLAY_DOMAIN, surfaceUrls } from "@/lib/server/urls";
import { ClaimBox } from "./ClaimBox";

// fannan.net (Home-EN.dc.html / Home-AR.dc.html).

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: { canonical: locale === "ar" ? "/ar" : "/", languages: { en: "/", ar: "/ar" } },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), type: "website" },
  };
}

const EXAMPLES = [
  { key: "animator", bg: "#1E1E22", bar: "#F4F1EA", c: ["#5B3A2E", "#7A4E3A", "#3A2A22"] },
  { key: "illustrator", bg: "#FFFFFF", bar: "#141414", c: ["#E8A0A0", "#9CC7C1", "#F2D27A"] },
  { key: "character", bg: "#EDE6F5", bar: "#3A2E5B", c: ["#3A2E5B", "#7B6BB0", "#B9AEDC"] },
] as const;

export default async function MarketingHome({ params }: PageProps<"/[locale]/marketing">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const urls = await surfaceUrls();
  const price = await priceCopy(locale);
  const steps = ["upload", "credits", "share"] as const;
  const features = ["credits", "available", "messages", "google", "reels", "nda"] as const;
  const kinds = ["animation", "character", "storyboard", "illustration", "comics", "motion", "concept"] as const;
  const h2 = "font-heading font-heading-weight text-[clamp(34px,4vw,48px)] leading-[1.05] tracking-[-0.02em]";

  return (
    <div className="bg-paper text-ink text-[17px] leading-[1.55]">
      <MarketingHeader locale={locale} />
      <main>
        <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-4 pt-10 pb-20 md:px-6 md:pt-14 md:pb-24">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
            <div className="text-muted text-[13px] font-semibold tracking-[0.08em] uppercase">{t("eyebrow")}</div>
            <h1 className="font-heading font-heading-weight text-[clamp(44px,6vw,78px)] leading-[1.02] tracking-[-0.03em]">
              {t.rich("title", { hl: (c) => <Highlight>{c}</Highlight> })}
            </h1>
            <p className="text-ink-soft max-w-[520px] text-[20px] leading-[1.6]">{t("sub")}</p>
            <div id="claim" className="flex max-w-[540px] scroll-mt-6 flex-col gap-2.5">
              <ClaimBox signupUrl={urls.app("/signup?username=__NAME__")} domain={DISPLAY_DOMAIN} />
              <div className="text-muted text-[14px]">{t("freeForever")}</div>
            </div>
          </div>

          <div aria-hidden className="relative min-w-0 flex-[1_1_440px] pt-6 pb-10">
            <div className="border-line bg-paper overflow-hidden rounded-[16px] border shadow-[0_20px_48px_rgba(20,20,20,0.10)]">
              <div className="border-line bg-mist flex h-10 items-center gap-2.5 border-b px-3.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2.5 rounded-full bg-[#D8D8D4]" />
                ))}
                <span dir="ltr" className="text-muted ms-2.5 flex h-6 flex-1 items-center rounded-sm bg-white px-2.5 text-[12px]">
                  <b className="text-ink font-semibold">yourname</b>.fannan.net
                </span>
              </div>
              <div className="flex flex-col gap-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <div className="font-heading font-heading-weight text-[26px] leading-[1.1]">{t("mock.name")}</div>
                    <div className="text-muted text-[13px]">{t("mock.role")}</div>
                  </div>
                  <span className="bg-mist rounded-pill flex h-[30px] items-center gap-2 px-3 text-[12px] font-semibold">
                    <span className="size-2 rounded-full bg-[#4A6400]" />
                    {t("mock.available")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["#5B3A2E", "#2E4A5B", "#4E5B2E", "#5B2E4F", "#3A3A44", "#5B4C2E"].map((c) => (
                    <div key={c} className="aspect-square rounded-sm" style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-ink absolute start-[-12px] bottom-0 flex w-[300px] max-w-[80%] items-start gap-3 rounded-[14px] px-4 py-3.5 text-white shadow-[0_14px_30px_rgba(20,20,20,0.25)] md:start-[-24px]">
              <span className="bg-lime text-ink font-heading font-heading-weight flex size-[34px] flex-none items-center justify-center rounded-[9px] text-[20px]">
                {locale === "ar" ? "ف" : "f"}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{t("mock.messageTitle")}</span>
                <span className="text-[13px] leading-[1.4] text-[#CFCFCB]">{t("mock.messageText")}</span>
              </span>
            </div>
          </div>
        </section>

        <div className="border-line bg-mist border-y">
          <div className="font-heading font-heading-weight text-ink-soft mx-auto flex max-w-[1200px] flex-wrap justify-center gap-x-8 gap-y-3 px-4 py-[18px] text-[18px] md:px-6">
            {kinds.map((k) => (
              <span key={k}>{t(`kinds.${k}`)}</span>
            ))}
          </div>
        </div>

        <section id="how" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 pt-24 pb-10 md:px-6">
          <h2 className={h2}>{t("howTitle")}</h2>
          <p className="text-ink-soft mt-3 mb-11 max-w-[620px] text-[18px]">{t("howSub")}</p>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5">
            {steps.map((s, i) => (
              <li key={s} className="border-line flex flex-col gap-3 rounded-[16px] border p-7">
                <span className="bg-lime font-heading font-heading-weight flex size-11 items-center justify-center rounded-md text-[22px]">
                  {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(i + 1)}
                </span>
                <h3 className="font-heading font-heading-weight text-[24px] leading-[1.15]">{t(`steps.${s}.title`)}</h3>
                <p className="text-ink-soft">{t(`steps.${s}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
          <h2 className={h2}>{t.rich("featuresTitle", { hl: (c) => <Highlight>{c}</Highlight> })}</h2>
          <p className="text-ink-soft mt-3 mb-11 max-w-[620px] text-[18px]">{t("featuresSub")}</p>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-10 gap-y-7">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3.5">
                <span aria-hidden className="bg-lime mt-[9px] h-2.5 w-[22px] flex-none -skew-x-[14deg]" />
                <div>
                  <h3 className="font-heading font-heading-weight mb-1 text-[21px]">{t(`features.${f}.title`)}</h3>
                  <p className="text-ink-soft">{t(`features.${f}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="examples" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-16 md:px-6">
          <h2 className={h2}>{t("examplesTitle")}</h2>
          <p className="text-ink-soft mt-3 mb-11 max-w-[620px] text-[18px]">{t("examplesSub")}</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
            {EXAMPLES.map((e) => (
              <a key={e.key} href={mHref(locale, "/examples")} className="group flex flex-col gap-3">
                <div
                  aria-hidden
                  className="border-line flex flex-col gap-3.5 rounded-[14px] border p-[18px] transition-transform group-hover:-translate-y-0.5"
                  style={{ background: e.bg }}
                >
                  <div className="h-3 w-2/5 rounded-[6px]" style={{ background: e.bar }} />
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2, 1, 2, 0].map((c, i) => (
                      <div key={i} className="aspect-square rounded-[4px]" style={{ background: e.c[c] }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-heading font-heading-weight text-[20px]">{t(`examples.${e.key}`)}</span>
                  <span dir="ltr" className="text-muted text-[13px]">
                    name.fannan.net
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 pt-16 pb-24 md:px-6">
          <h2 className={`${h2} mb-10`}>{t("pricingTitle")}</h2>
          <div className="grid max-w-[880px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
            <div className="border-line flex flex-col gap-3.5 rounded-[16px] border p-8">
              <h3 className="font-heading font-heading-weight text-[26px]">{t("free.name")}</h3>
              <div className="font-heading font-heading-weight text-[44px] tracking-[-0.02em]">{price.free}</div>
              <ul className="text-ink-soft leading-loose">
                {(["address", "templates", "badge", "form"] as const).map((k) => (
                  <li key={k}>{k === "address" ? <span dir="ltr">yourname.fannan.net</span> : t(`free.${k}`)}</li>
                ))}
              </ul>
              <a href="#claim" className="border-ink mt-auto flex h-[50px] items-center justify-center rounded-md border-2 font-semibold hover:bg-mist">
                {t("free.cta")}
              </a>
            </div>
            <div className="border-ink flex flex-col gap-3.5 rounded-[16px] border-2 p-8">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading font-heading-weight text-[26px]">{t("pro.name")}</h3>
                <span className="bg-lime rounded-sm px-2.5 py-1 text-[12px] font-semibold">{t("pro.tag")}</span>
              </div>
              <div className="font-heading font-heading-weight text-[44px] tracking-[-0.02em]">
                {price.monthly}{" "}
                <span className="font-body text-muted text-[17px] font-medium tracking-normal">{t("pro.perMonth")}</span>
              </div>
              <p className="text-muted -mt-1.5 text-[14px]">
                {t("pro.durations", { p3: price.p3, p6: price.p6 })}
                {price.currency === "USD" && ` ${t("pro.egypt", { n: price.egpFrom })}`}
              </p>
              <ul className="text-ink-soft leading-loose">
                {(["domain", "nda", "unlimited", "space"] as const).map((k) => (
                  <li key={k}>{t(`pro.${k}`)}</li>
                ))}
              </ul>
              <a
                href={mHref(locale, "/pricing")}
                className="bg-ink hover:bg-ink-soft mt-auto flex h-[50px] items-center justify-center rounded-md font-semibold text-white"
              >
                {t("pro.cta")}
              </a>
            </div>
          </div>
          {plansConfig.launchOffer.enabled && <p className="text-ink-soft mt-6 text-[15px] font-semibold">{t("offer")}</p>}
        </section>

        <section className="bg-lime">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 py-24 text-center md:px-6">
            <p className="font-heading font-heading-weight text-[clamp(42px,6vw,76px)] leading-[1.02] tracking-[-0.03em]">
              {t("closing")}
            </p>
            <a href="#claim" className="bg-ink hover:bg-ink-soft flex h-14 items-center rounded-md px-[30px] text-[17px] font-semibold text-white">
              {t("closingCta")}
            </a>
          </div>
        </section>
      </main>
      <MarketingFooter locale={locale} />
    </div>
  );
}
