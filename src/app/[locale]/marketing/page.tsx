import type { Metadata } from "next";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/Chrome";
import { FeatureTabs } from "@/components/marketing/FeatureTabs";
import { GuideDemo } from "@/components/marketing/GuideDemo";
import { mHref } from "@/components/marketing/links";
import { priceCopy } from "@/components/marketing/price";
import { showcaseAddress, showcaseSite, type ShowcaseKey } from "@/components/marketing/showcase";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender, type GalleryProject } from "@/components/site/SiteRender";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Highlight } from "@/components/ui/Surfaces";
import { plansConfig } from "@/config/plans";
import { disciplineById, disciplineLabel, disciplines } from "@/config/disciplines";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { DISPLAY_DOMAIN, surfaceUrls } from "@/lib/server/urls";
import { kindByKey } from "@/lib/site/blocks";
import { linksBlock } from "@/lib/site/links";
import { themes } from "@/lib/site/starter";
import type { Block, SiteDraft } from "@/lib/site/types";
import { ClaimBox } from "./ClaimBox";

// fannan.net (round 10): less talk, more show. Every picture on this page is a real Fannan site,
// drawn by the same renderer artists' sites use.

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

/* ---------- frames ---------- */

function Browser({ address, children, className }: { address: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("border-line bg-paper overflow-hidden rounded-[18px] border shadow-[0_30px_70px_rgba(20,20,20,0.16)]", className)}>
      <div className="border-line bg-mist flex h-9 items-center gap-2 border-b px-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 rounded-full bg-[#D8D8D4]" />
        ))}
        <span dir="ltr" className="text-muted ms-2 truncate text-[12px]">
          <b className="text-ink">{address.split(".")[0]}</b>.{address.split(".").slice(1).join(".")}
        </span>
      </div>
      {children}
    </div>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ink w-[290px] flex-none rounded-[44px] p-2.5 shadow-[0_30px_70px_rgba(20,20,20,0.25)]">
      <div className="overflow-hidden rounded-[36px]">{children}</div>
    </div>
  );
}

const Site = ({ site, projects, height = 760, pageId }: { site: SiteDraft; projects?: GalleryProject[]; height?: number; pageId?: string }) => (
  <ScaledSite width={1200} height={height}>
    <SiteRender site={site} pageId={pageId} projects={projects} social={[{ network: "instagram", url: "#" }, { network: "behance", url: "#" }, { network: "youtube", url: "#" }]} editing />
  </ScaledSite>
);

/** A one-page site made of library sections, in a theme (for the feature pictures). */
function sectionsSite(l: Locale, keys: string[], preset: keyof typeof themes, title: string): SiteDraft {
  return {
    language: l,
    title,
    tagline: "",
    theme: themes[preset],
    pages: [{ id: "p", slug: "", title: l === "ar" ? "أعمالي" : "Work", type: "custom", showInNav: true, blocks: keys.map((k) => kindByKey(k)!.make(l)) as Block[] }],
  };
}

export default async function MarketingHome({ params }: PageProps<"/[locale]/marketing">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const urls = await surfaceUrls();
  const price = await priceCopy(locale);
  const h2 = "font-heading font-heading-weight text-[clamp(32px,4.2vw,52px)] leading-[1.05] tracking-[-0.02em]";
  const ex = (k: ShowcaseKey) => showcaseSite(k, locale);
  const label = (k: ShowcaseKey) => {
    const d = disciplineById({ animator: "2d-animator", illustrator: "illustrator", photographer: "photographer", designer: "graphic-designer", comics: "comic-artist", modeler: "3d-modeler" }[k]);
    return d ? disciplineLabel(d, locale) : k;
  };
  const addr = showcaseAddress;
  const [animator, illustrator, photographer] = [ex("animator"), ex("illustrator"), ex("photographer")];

  // The link page and its QR code.
  const linkSite: SiteDraft = {
    language: locale,
    title: animator.site.title,
    tagline: "",
    theme: themes.gallery,
    pages: [{ id: "l", slug: "links", title: "Links", type: "links", showInNav: false, blocks: [linksBlock(locale, animator.site.title)] }],
  };
  const qr = await QRCode.toString("https://fannan.net/l/nour", { type: "svg", margin: 1, color: { dark: "#1A1C16", light: "#FFFFFF" } });

  // Project cards in their own sizes.
  const work: GalleryProject[] = [
    ["Sandstorm", "عاصفة رملية", "l"],
    ["Moonlight", "ضوء القمر", "m"],
    ["Tiny Giants", "عمالقة صغار", "m"],
    ["The Lantern", "الفانوس", "wide"],
    ["Falcon", "الصقر", "m"],
  ].map(([en, ar, size], i) => ({
    id: `w${i}`,
    slug: `w${i}`,
    title: locale === "ar" ? ar : en,
    category: "",
    client: "",
    role: "",
    visibility: "public",
    coverId: null,
    mature: false,
    card: { size: size as "m", text: "title" },
  }));
  const workSite = sectionsSite(locale, ["d-title", "grid"], "paper", illustrator.site.title);
  const grid = workSite.pages[0].blocks[1];
  if (grid.type === "gallery") {
    grid.cardSizes = true;
    grid.layout = "grid";
  }

  const marquee = disciplines.filter((d) => d.kind !== "other").slice(0, 28);
  const tabs = [
    {
      key: "links",
      label: t("v2.tabs.links"),
      line: t("v2.tabs.linksLine"),
      visual: (
        <div className="bg-mist flex flex-wrap items-center justify-center gap-8 rounded-[32px] px-6 py-10" aria-hidden>
          <Phone>
            <ScaledSite width={390} height={760}>
              <SiteRender site={linkSite} pageId="l" social={[{ network: "instagram", url: "#" }, { network: "behance", url: "#" }, { network: "youtube", url: "#" }]} editing />
            </ScaledSite>
          </Phone>
          <div className="flex flex-col items-center gap-3">
            <div className="bg-paper rounded-[24px] p-4 shadow-[0_16px_40px_rgba(20,20,20,0.10)]">
              <div className="size-40 [&_svg]:block [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
            <span className="bg-paper rounded-pill px-4 py-2 text-[15px] font-semibold" dir="ltr">
              fannan.net/l/nour
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "sections",
      label: t("v2.tabs.sections"),
      line: t("v2.tabs.sectionsLine"),
      visual: (
        <Browser address={addr("illustrator")} className="mx-auto max-w-[1000px]">
          <Site site={sectionsSite(locale, ["d-hero-split", "c-icons", "d-cta-banner"], "paper", illustrator.site.title)} height={1350} />
        </Browser>
      ),
    },
    {
      key: "projects",
      label: t("v2.tabs.projects"),
      line: t("v2.tabs.projectsLine"),
      visual: (
        <Browser address={addr("illustrator")} className="mx-auto max-w-[1000px]">
          <Site site={workSite} projects={work} height={1250} />
        </Browser>
      ),
    },
    {
      key: "arabic",
      label: t("v2.tabs.arabic"),
      line: t("v2.tabs.arabicLine"),
      visual: (
        <div className="grid gap-6 md:grid-cols-2" aria-hidden>
          {(["en", "ar"] as const).map((l) => (
            <Browser key={l} address="nour.fannan.net">
              <Site site={showcaseSite("animator", l).site} projects={showcaseSite("animator", l).projects} height={900} />
            </Browser>
          ))}
        </div>
      ),
    },
    {
      key: "stats",
      label: t("v2.tabs.stats"),
      line: t("v2.tabs.statsLine"),
      visual: <StatsPicture locale={locale} />,
    },
  ];

  const facts: Array<[IconName, string]> = [
    ["publish", t("v2.facts.free")],
    ["language", t("v2.facts.arabic")],
    ["site-editor", t("v2.facts.nocode")],
    ["link", t("v2.facts.links")],
  ];

  return (
    <div className="bg-surface text-ink overflow-x-clip text-[17px] leading-[1.55]">
      <MarketingHeader locale={locale} />
      <main>
        {/* Hero: a short line, the claim box, and real sites fanned out. */}
        <section className="mx-auto flex max-w-[1240px] flex-col items-center gap-6 px-4 pt-12 text-center md:px-6 md:pt-16">
          <h1 className="font-heading font-heading-weight max-w-[900px] text-[clamp(44px,7vw,92px)] leading-[0.98] tracking-[-0.035em]">
            {t.rich("title", { hl: (c) => <Highlight>{c}</Highlight> })}
          </h1>
          <p className="text-ink-soft m-0 max-w-[560px] text-[19px]">{t("v2.sub")}</p>
          <div id="claim" className="flex w-full max-w-[540px] scroll-mt-6 flex-col items-center gap-2.5">
            <ClaimBox signupUrl={urls.app("/signup?username=__NAME__")} domain={DISPLAY_DOMAIN} />
            <div className="text-muted text-[14px]">{t("freeForever")}</div>
          </div>
        </section>

        <section aria-hidden className="relative mx-auto mt-10 h-[clamp(300px,52vw,640px)] max-w-[1400px] [perspective:1800px]" data-testid="hero-sites">
          <div className="absolute start-[2%] top-[12%] hidden w-[38%] [transform:rotateY(18deg)_rotateZ(-2deg)] opacity-90 md:block rtl:[transform:rotateY(-18deg)_rotateZ(2deg)]">
            <Browser address={addr("illustrator")}>
              <Site site={illustrator.site} projects={illustrator.projects} />
            </Browser>
          </div>
          <div className="absolute end-[2%] top-[12%] hidden w-[38%] [transform:rotateY(-18deg)_rotateZ(2deg)] opacity-90 md:block rtl:[transform:rotateY(18deg)_rotateZ(-2deg)]">
            <Browser address={addr("photographer")}>
              <Site site={photographer.site} projects={photographer.projects} />
            </Browser>
          </div>
          <div className="absolute start-1/2 top-0 z-10 w-[min(92%,640px)] -translate-x-1/2 rtl:translate-x-1/2">
            <Browser address={addr("animator")}>
              <Site site={animator.site} projects={animator.projects} />
            </Browser>
            {/* Little moments: the badge, a message, the QR code. */}
            <span className="bg-paper rounded-pill absolute -start-6 top-[22%] hidden items-center gap-2 px-4 py-2.5 text-[14px] font-semibold shadow-[0_12px_30px_rgba(20,20,20,0.16)] sm:flex">
              <span className="size-2.5 rounded-full bg-[#4A6400]" />
              {t("mock.available")}
            </span>
            <span className="bg-ink text-paper absolute -end-10 bottom-[18%] hidden max-w-[260px] flex-col gap-0.5 rounded-[18px] px-4 py-3 text-start text-[13px] shadow-[0_16px_40px_rgba(20,20,20,0.25)] sm:flex">
              <b>{t("mock.messageTitle")}</b>
              <span className="opacity-80">{t("mock.messageText")}</span>
            </span>
          </div>
        </section>

        {/* Who it's for: every kind of artist, scrolling by. */}
        <section aria-label={t("v2.forLabel")} className="border-line overflow-hidden border-y py-5">
          <div className="mq flex w-max gap-3">
            {[...marquee, ...marquee].map((d, i) => (
              <span key={i} className="border-line bg-paper rounded-pill whitespace-nowrap border px-4 py-2 text-[15px] font-semibold" aria-hidden={i >= marquee.length}>
                {disciplineLabel(d, locale)}
              </span>
            ))}
          </div>
        </section>

        {/* The guided setup, playing by itself. */}
        <section id="how" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 py-24 md:px-6">
          <h2 className={cx(h2, "mb-3 text-center")}>{t("v2.demoTitle")}</h2>
          <p className="text-ink-soft mx-auto mb-12 max-w-[560px] text-center text-[18px]">{t("v2.demoSub")}</p>
          <GuideDemo
            locale={locale}
            steps={[t("v2.steps.what"), t("v2.steps.name"), t("v2.steps.look"), t("v2.steps.pages"), t("v2.steps.projects"), t("v2.steps.build")]}
            name={animator.site.title}
            what={label("animator")}
            ready={t("v2.ready")}
          />
        </section>

        {/* Features as pictures. */}
        <section className="bg-mist">
          <div className="mx-auto max-w-[1240px] px-4 py-24 md:px-6">
            <h2 className={cx(h2, "mb-10 text-center")}>{t.rich("featuresTitle", { hl: (c) => <Highlight>{c}</Highlight> })}</h2>
            <FeatureTabs tabs={tabs} />
          </div>
        </section>

        {/* Real-looking examples, one per kind of artist. */}
        <section id="examples" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 py-24 md:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className={h2}>{t("examplesTitle")}</h2>
            <a href={mHref(locale, "/examples")} className="border-outline text-primary hover:bg-primary/8 rounded-pill flex h-11 items-center border px-5 font-medium">
              {t("v2.moreExamples")}
            </a>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6">
            {(["animator", "illustrator", "photographer", "designer", "comics", "modeler"] as ShowcaseKey[]).map((k) => {
              const e = ex(k);
              return (
                <figure key={k} className="m-0 flex flex-col gap-3">
                  <Browser address={addr(k)} className="shadow-[0_14px_36px_rgba(20,20,20,0.10)]">
                    <div aria-hidden>
                      <Site site={e.site} projects={e.projects} height={720} />
                    </div>
                  </Browser>
                  <figcaption className="flex items-center justify-between gap-2 px-1">
                    <span className="font-semibold">{e.site.title}</span>
                    <span className="text-muted text-[14px]">{label(k)}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>

        {/* Four facts, no paragraphs. */}
        <section className="mx-auto max-w-[1240px] px-4 pb-20 md:px-6">
          <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-4">
            {facts.map(([icon, text]) => (
              <li key={text} className="bg-paper border-line flex flex-col items-start gap-3 rounded-[24px] border p-5">
                <span className="bg-lime text-on-lime flex size-11 items-center justify-center rounded-full">
                  <Icon name={icon} size={20} />
                </span>
                <span className="text-[17px] font-semibold leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="mx-auto max-w-[1240px] scroll-mt-6 px-4 pt-4 pb-24 md:px-6">
          <h2 className={`${h2} mb-10`}>{t("pricingTitle")}</h2>
          <div className="grid max-w-[880px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
            <div className="border-line bg-paper flex flex-col gap-3.5 rounded-[28px] border p-8">
              <h3 className="font-heading font-heading-weight text-[26px]">{t("free.name")}</h3>
              <div className="font-heading font-heading-weight text-[44px] tracking-[-0.02em]">{price.free}</div>
              <ul className="text-ink-soft leading-loose">
                {(["address", "templates", "badge", "form"] as const).map((k) => (
                  <li key={k}>{k === "address" ? <span dir="ltr">yourname.fannan.net</span> : t(`free.${k}`)}</li>
                ))}
              </ul>
              <a href="#claim" className="border-outline text-primary hover:bg-primary/8 mt-auto flex h-[50px] items-center justify-center rounded-pill border font-medium">
                {t("free.cta")}
              </a>
            </div>
            <div className="border-ink bg-paper flex flex-col gap-3.5 rounded-[28px] border-2 p-8">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading font-heading-weight text-[26px]">{t("pro.name")}</h3>
                <span className="bg-lime rounded-sm px-2.5 py-1 text-[12px] font-semibold">{t("pro.tag")}</span>
              </div>
              <div className="font-heading font-heading-weight text-[44px] tracking-[-0.02em]">
                {price.monthly} <span className="font-body text-muted text-[17px] font-medium tracking-normal">{t("pro.perMonth")}</span>
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
              <a href={mHref(locale, "/pricing")} className="bg-primary text-on-primary rounded-pill font-medium hover:brightness-110 mt-auto flex h-[50px] items-center justify-center">
                {t("pro.cta")}
              </a>
            </div>
          </div>
          {plansConfig.launchOffer.enabled && <p className="text-ink-soft mt-6 text-[15px] font-semibold">{t("offer")}</p>}
        </section>

        <section className="bg-lime">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 py-24 text-center md:px-6">
            <p className="font-heading font-heading-weight text-on-lime text-[clamp(42px,6vw,76px)] leading-[1.02] tracking-[-0.03em]">{t("closing")}</p>
            <a href="#claim" className="bg-primary text-on-primary rounded-pill font-medium hover:brightness-110 flex h-14 items-center px-[30px] text-[17px]">
              {t("closingCta")}
            </a>
          </div>
        </section>
      </main>
      <MarketingFooter locale={locale} />
    </div>
  );
}

/** A picture of the Stats page and inbox (drawn, not a screenshot). */
async function StatsPicture({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });
  const bars = [3, 5, 4, 7, 6, 9, 8, 12, 10, 14, 11, 16, 18, 15];
  return (
    <div className="mx-auto grid max-w-[1000px] gap-5 md:grid-cols-[3fr_2fr]" aria-hidden>
      <div className="bg-paper border-line flex flex-col gap-4 rounded-[28px] border p-6">
        <div className="flex gap-6">
          {[
            ["1,284", t("v2.stats.visitors")],
            ["312", t("v2.stats.clicks")],
            ["9", t("v2.stats.messages")],
          ].map(([n, l]) => (
            <div key={l} className="flex flex-col">
              <span className="font-heading font-heading-weight text-[32px]">{n}</span>
              <span className="text-muted text-[13px]">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex h-40 items-end gap-1.5">
          {bars.map((h, i) => (
            <span key={i} className={cx("flex-1 rounded-t-[6px]", i === bars.length - 2 ? "bg-lime" : "bg-ink")} style={{ height: `${(h / 18) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="bg-ink text-paper flex flex-col gap-1 rounded-[24px] p-5">
          <b>{t("mock.messageTitle")}</b>
          <span className="text-[14px] opacity-80">{t("mock.messageText")}</span>
        </div>
        <div className="bg-paper border-line flex flex-col gap-2.5 rounded-[24px] border p-5 text-[14px]">
          {[
            [t("v2.stats.l1"), 64],
            [t("v2.stats.l2"), 41],
            [t("v2.stats.l3"), 23],
          ].map(([name, n]) => (
            <div key={String(name)} className="flex flex-col gap-1">
              <span className="flex justify-between">
                <b>{name}</b>
                <span className="text-muted">{n}</span>
              </span>
              <span className="bg-mist h-1.5 rounded">
                <span className="bg-ink block h-1.5 rounded" style={{ width: `${n}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
