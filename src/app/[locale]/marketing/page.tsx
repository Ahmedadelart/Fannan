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
import {
  Badge,
  Band,
  Circled,
  Intro,
  Marker,
  Pill,
  Squiggle,
  Sticker,
  Tile,
  Wave,
  Wrap,
} from "@/components/marketing/ui";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender, type GalleryProject } from "@/components/site/SiteRender";
import { Icon, type IconName } from "@/components/ui/Icon";
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

// fannan.net (round 20): the Talabat-inspired language in Fannan's colours (design/MARKETING.md).
// Every picture on this page is still a real Fannan site, drawn by the same renderer artists' sites use.

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

/** A site in a rounded frame, with its address on a small paper tag (the pictures of this page). */
function Frame({
  address,
  children,
  className,
  radius = "rounded-[28px] md:rounded-[40px]",
}: {
  address?: string;
  children: ReactNode;
  className?: string;
  radius?: string;
}) {
  return (
    <div className={cx("bg-paper relative overflow-hidden", radius, className)}>
      {children}
      {address && (
        <span
          dir="ltr"
          className="rounded-pill bg-paper/95 text-ink absolute start-4 top-4 px-3 py-1.5 text-[12px] font-bold shadow-[0_6px_16px_rgba(26,28,22,0.18)]"
        >
          {address}
        </span>
      )}
    </div>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ink w-[270px] flex-none rounded-[44px] p-2.5 shadow-[0_30px_70px_rgba(20,20,20,0.25)]">
      <div className="overflow-hidden rounded-[36px]">{children}</div>
    </div>
  );
}

const Site = ({
  site,
  projects,
  height = 760,
  pageId,
}: {
  site: SiteDraft;
  projects?: GalleryProject[];
  height?: number;
  pageId?: string;
}) => (
  <ScaledSite width={1200} height={height}>
    <SiteRender
      site={site}
      pageId={pageId}
      projects={projects}
      social={[
        { network: "instagram", url: "#" },
        { network: "behance", url: "#" },
        { network: "youtube", url: "#" },
      ]}
      editing
    />
  </ScaledSite>
);

/** A one-page site made of library sections, in a theme (for the feature pictures). */
function sectionsSite(l: Locale, keys: string[], preset: keyof typeof themes, title: string): SiteDraft {
  return {
    language: l,
    title,
    tagline: "",
    theme: themes[preset],
    pages: [
      {
        id: "p",
        slug: "",
        title: l === "ar" ? "أعمالي" : "Work",
        type: "custom",
        showInNav: true,
        blocks: keys.map((k) => kindByKey(k)!.make(l)) as Block[],
      },
    ],
  };
}

export default async function MarketingHome({ params }: PageProps<"/[locale]/marketing">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const urls = await surfaceUrls();
  const price = await priceCopy(locale);
  const ex = (k: ShowcaseKey) => showcaseSite(k, locale);
  const label = (k: ShowcaseKey) => {
    const d = disciplineById(
      {
        animator: "2d-animator",
        illustrator: "illustrator",
        photographer: "photographer",
        designer: "graphic-designer",
        comics: "comic-artist",
        modeler: "3d-modeler",
      }[k],
    );
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
    pages: [
      {
        id: "l",
        slug: "links",
        title: "Links",
        type: "links",
        showInNav: false,
        blocks: [linksBlock(locale, animator.site.title)],
      },
    ],
  };
  const qr = await QRCode.toString("https://fannan.net/l/nour", {
    type: "svg",
    margin: 1,
    color: { dark: "#1A1C16", light: "#FFFFFF" },
  });

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
        <div
          className="bg-mist flex flex-wrap items-center justify-center gap-8 rounded-[28px] px-6 py-10 md:rounded-[40px]"
          aria-hidden
        >
          <Phone>
            <ScaledSite width={390} height={760}>
              <SiteRender
                site={linkSite}
                pageId="l"
                social={[
                  { network: "instagram", url: "#" },
                  { network: "behance", url: "#" },
                  { network: "youtube", url: "#" },
                ]}
                editing
              />
            </ScaledSite>
          </Phone>
          <div className="flex flex-col items-center gap-3">
            <div className="bg-paper rounded-[24px] p-4 shadow-[0_16px_40px_rgba(20,20,20,0.10)]">
              <div
                className="size-40 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            </div>
            <Badge tone="paper">
              <span dir="ltr">fannan.net/l/nour</span>
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: "sections",
      label: t("v2.tabs.sections"),
      line: t("v2.tabs.sectionsLine"),
      visual: (
        <Frame address={addr("illustrator")} className="mx-auto max-w-[1000px]">
          <Site
            site={sectionsSite(locale, ["d-hero-split", "c-icons", "d-cta-banner"], "paper", illustrator.site.title)}
            height={1350}
          />
        </Frame>
      ),
    },
    {
      key: "projects",
      label: t("v2.tabs.projects"),
      line: t("v2.tabs.projectsLine"),
      visual: (
        <Frame address={addr("illustrator")} className="mx-auto max-w-[1000px]">
          <Site site={workSite} projects={work} height={1250} />
        </Frame>
      ),
    },
    {
      key: "arabic",
      label: t("v2.tabs.arabic"),
      line: t("v2.tabs.arabicLine"),
      visual: (
        <div className="grid gap-6 md:grid-cols-2" aria-hidden>
          {(["en", "ar"] as const).map((l) => (
            <Frame key={l} address="nour.fannan.net">
              <Site
                site={showcaseSite("animator", l).site}
                projects={showcaseSite("animator", l).projects}
                height={900}
              />
            </Frame>
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
  const steps = [
    { key: "upload", icon: "upload" as IconName, picture: <Site site={workSite} projects={work} height={1000} /> },
    {
      key: "credits",
      icon: "credits" as IconName,
      picture: <Site site={illustrator.site} projects={illustrator.projects} height={1000} />,
    },
    {
      key: "share",
      icon: "link" as IconName,
      picture: (
        <div className="bg-mist flex h-full items-end justify-center pt-6">
          <Phone>
            <ScaledSite width={390} height={620}>
              <SiteRender
                site={linkSite}
                pageId="l"
                social={[
                  { network: "instagram", url: "#" },
                  { network: "behance", url: "#" },
                  { network: "youtube", url: "#" },
                ]}
                editing
              />
            </ScaledSite>
          </Phone>
        </div>
      ),
    },
  ] as const;
  const examples: ShowcaseKey[] = ["animator", "illustrator", "photographer", "designer", "comics", "modeler"];

  return (
    <div className="mk bg-surface text-ink overflow-x-clip">
      <MarketingHeader locale={locale} />
      <main>
        {/* Hero: the words and the claim box on the ink band, a real site as a tilted sticker beside them. */}
        <Band tone="ink">
          <Wrap className="grid items-center gap-12 pt-10 pb-16 md:grid-cols-[1.05fr_0.95fr] md:pt-16 md:pb-24">
            <div className="flex flex-col items-start gap-6">
              <Badge tone="paper">{t("v3.kicker")}</Badge>
              <h1 className="mk-display m-0 text-[clamp(44px,6.4vw,84px)]">
                {t.rich("title", { hl: (c) => <Marker>{c}</Marker> })}
              </h1>
              <p className="mk-lead m-0 max-w-[46ch] opacity-85">{t("v2.sub")}</p>
              <div id="claim" className="flex w-full scroll-mt-6 flex-col gap-2.5">
                <ClaimBox signupUrl={urls.app("/signup?username=__NAME__")} domain={DISPLAY_DOMAIN} onDark />
                <span className="text-[14px] opacity-70">{t("freeForever")}</span>
              </div>
            </div>
            <div
              className="relative mx-auto w-full max-w-[560px] px-3 pt-6 md:px-0 md:pt-0"
              aria-hidden
              data-testid="hero-sites"
            >
              <Sticker outline="paper" tilt={-3}>
                <Site site={animator.site} projects={animator.projects} height={900} />
              </Sticker>
              <span className="rounded-pill bg-lime text-on-lime absolute -start-2 top-[8%] inline-flex rotate-[-6deg] items-center gap-2 px-4 py-2.5 text-[14px] font-bold shadow-[0_12px_30px_rgba(0,0,0,0.3)] rtl:rotate-[6deg]">
                <span className="bg-on-lime size-2.5 rounded-full" />
                {t("mock.available")}
              </span>
              <span className="bg-paper text-ink absolute -end-3 bottom-[10%] hidden max-w-[250px] rotate-[3deg] flex-col gap-0.5 rounded-[20px] px-4 py-3 text-start text-[13px] shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:flex rtl:rotate-[-3deg]">
                <b>{t("mock.messageTitle")}</b>
                <span className="opacity-70">{t("mock.messageText")}</span>
              </span>
            </div>
          </Wrap>
        </Band>

        {/* Four facts in a row (Talabat's "Delivering moments"). */}
        <Wrap className="pt-16 md:pt-20">
          <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-10 p-0 md:grid-cols-4">
            {facts.map(([icon, text]) => (
              <li key={text} className="flex flex-col items-start gap-4">
                <span className="bg-lime text-on-lime flex size-12 items-center justify-center rounded-full">
                  <Icon name={icon} size={24} />
                </span>
                <span className="text-[19px] leading-snug font-bold">{text}</span>
              </li>
            ))}
          </ul>
        </Wrap>

        {/* Who it's for: every kind of artist, scrolling by. */}
        <section aria-label={t("v2.forLabel")} className="mt-16 overflow-hidden py-2 md:mt-20">
          <div className="mk-mq flex w-max gap-3">
            {[...marquee, ...marquee].map((d, i) => (
              <span
                key={i}
                className="rounded-pill border-ink/15 bg-paper border-2 px-5 py-2.5 text-[16px] font-bold whitespace-nowrap"
                aria-hidden={i >= marquee.length}
              >
                {disciplineLabel(d, locale)}
              </span>
            ))}
          </div>
        </section>

        {/* The big line with the ribbon behind it. */}
        <Wrap className="pt-20 pb-6 md:pt-28">
          <Squiggle>
            <h2 className="mk-display m-0 max-w-[14ch] text-[clamp(44px,7vw,88px)] uppercase">
              {t.rich("featuresTitle", { hl: (c) => <Marker>{c}</Marker> })}
            </h2>
          </Squiggle>
        </Wrap>

        {/* One link that does the talking: the two-column intro, then two pictures set off each other. */}
        <Wrap className="pt-16 md:pt-24">
          <Intro
            title={t("v3.introTitle")}
            columns={[t("v3.intro1"), t("v3.intro2")]}
            cta={
              <Pill tone="ink" size="sm" href="#how">
                {t("v3.introCta")}
              </Pill>
            }
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2 md:items-start">
            <Frame address={addr("illustrator")} className="aspect-square">
              <Site site={illustrator.site} projects={illustrator.projects} height={1200} />
            </Frame>
            <Frame address={addr("photographer")} className="aspect-[4/3] md:mt-24">
              <Site site={photographer.site} projects={photographer.projects} height={900} />
            </Frame>
          </div>
        </Wrap>

        {/* How work finds you: three steps along a dashed line (Talabat's timeline). */}
        <Band tone="surface" id="how">
          <Wrap className="pt-24 md:pt-32">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <h2 className="mk-title m-0 text-[clamp(28px,3.2vw,36px)]">{t("howTitle")}</h2>
              <p className="m-0 max-w-[48ch] text-[17px] opacity-80">{t("howSub")}</p>
            </div>
            <ol className="m-0 grid list-none gap-x-6 gap-y-12 p-0 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.key} className="flex flex-col">
                  <Frame className="bg-mist aspect-[4/3] [&>div]:h-full" radius="rounded-[28px] md:rounded-[36px]">
                    {s.picture}
                  </Frame>
                  <div className="mk-dash my-7" />
                  <span className="mk-display text-[36px]">0{i + 1}</span>
                  <h3 className="mk-title mt-3 mb-2 flex items-center gap-2.5 text-[22px]">
                    <Icon name={s.icon} size={20} />
                    {t(`steps.${s.key}.title`)}
                  </h3>
                  <p className="m-0 max-w-[40ch] text-[16px] leading-[1.6] opacity-80">{t(`steps.${s.key}.body`)}</p>
                </li>
              ))}
            </ol>
          </Wrap>
        </Band>

        {/* The guided setup, playing by itself, in a paper tile. */}
        <Wrap className="pt-24 md:pt-32">
          <div className="mb-10 flex flex-col gap-3">
            <h2 className="mk-title m-0 text-[clamp(28px,3.2vw,36px)]">{t("v2.demoTitle")}</h2>
            <p className="m-0 max-w-[60ch] text-[17px] opacity-80">{t("v2.demoSub")}</p>
          </div>
          <Tile tone="mist" className="p-4 md:p-8">
            <GuideDemo
              locale={locale}
              steps={[
                t("v2.steps.what"),
                t("v2.steps.name"),
                t("v2.steps.look"),
                t("v2.steps.pages"),
                t("v2.steps.projects"),
                t("v2.steps.build"),
              ]}
              name={animator.site.title}
              what={label("animator")}
              ready={t("v2.ready")}
            />
          </Tile>
        </Wrap>

        {/* Features as pictures, behind a row of pills. */}
        <Wrap className="pt-24 md:pt-32">
          <FeatureTabs tabs={tabs} />
        </Wrap>

        {/* Examples: the ink band with uneven edges, cards with a wavy foot (Talabat's news). */}
        <div className="mt-24 md:mt-32">
          <Band tone="ink" wave="both" id="examples">
            <Wrap className="py-16 md:py-20">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <h2 className="mk-title m-0 text-[clamp(28px,3.2vw,36px)]">{t("examplesTitle")}</h2>
                <p className="m-0 max-w-[48ch] text-[17px] opacity-75">{t("v3.examplesLine")}</p>
              </div>
            </Wrap>
            <div
              role="region"
              aria-label={t("examplesTitle")}
              tabIndex={0}
              className="flex snap-x [scrollbar-width:none] gap-6 overflow-x-auto px-6 pb-4"
              style={{
                paddingInline: "max(24px, calc((100% - 1264px) / 2))",
                scrollPaddingInline: "max(24px, calc((100% - 1264px) / 2))",
              }}
            >
              {examples.map((k) => {
                const e = ex(k);
                return (
                  <figure key={k} className="m-0 flex w-[300px] shrink-0 snap-start flex-col md:w-[340px]">
                    <div className="bg-paper relative overflow-hidden rounded-t-[32px]" aria-hidden>
                      <Site site={e.site} projects={e.projects} height={1000} />
                      <Badge className="absolute start-4 top-4 shadow-[0_8px_20px_rgba(0,0,0,0.25)]">{label(k)}</Badge>
                    </div>
                    <figcaption className="mk-card-foot bg-paper text-ink flex min-h-[132px] flex-col gap-1 rounded-b-[32px] px-6 pt-5 pb-6">
                      <Wave tone="paper" />
                      <span className="mk-title text-[22px]">{e.site.title}</span>
                      <span dir="ltr" className="text-[13px] font-semibold opacity-60 rtl:text-end">
                        {addr(k)}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <Wrap className="pt-6 pb-16 md:pb-20">
              <Pill tone="paper" size="sm" href={mHref(locale, "/examples")}>
                {t("v3.examplesCta")}
              </Pill>
            </Wrap>
          </Band>
        </div>

        {/* Pricing: three tiles, cream, ink and sage (Talabat's numbers). */}
        <Wrap className="pt-24 md:pt-32">
          <div id="pricing" className="scroll-mt-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <h2 className="mk-title m-0 text-[clamp(28px,3.2vw,36px)]">{t("pricingTitle")}</h2>
              <p className="m-0 max-w-[52ch] text-[17px] opacity-80">{t("v3.pricingLine")}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <Tile tone="mist" className="flex flex-col gap-4 p-8">
                <h3 className="mk-title m-0 text-[24px]">{t("free.name")}</h3>
                <div className="mk-display text-[56px]">{price.free}</div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[16px] opacity-85">
                  {(["address", "templates", "badge", "form"] as const).map((k) => (
                    <li key={k} className="flex items-start gap-2.5">
                      <Icon name="check" size={18} className="mt-1 shrink-0" />
                      {k === "address" ? <span dir="ltr">yourname.{DISPLAY_DOMAIN}</span> : t(`free.${k}`)}
                    </li>
                  ))}
                </ul>
                <Pill tone="outline" size="sm" href="#claim" className="mt-auto self-start">
                  {t("free.cta")}
                </Pill>
              </Tile>
              <Tile tone="ink" className="flex flex-col gap-4 p-8">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="mk-title m-0 text-[24px]">{t("pro.name")}</h3>
                  <Badge>{t("pro.tag")}</Badge>
                </div>
                <div className="mk-display text-[56px]">
                  {price.monthly}
                  <span className="ms-2 text-[16px] font-medium tracking-normal opacity-75">{t("pro.perMonth")}</span>
                </div>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[16px] opacity-90">
                  {(["domain", "nda", "unlimited", "space"] as const).map((k) => (
                    <li key={k} className="flex items-start gap-2.5">
                      <Icon name="check" size={18} className="mt-1 shrink-0" />
                      {t(`pro.${k}`)}
                    </li>
                  ))}
                </ul>
                <Pill tone="lime" size="sm" href={mHref(locale, "/pricing")} className="mt-auto self-start">
                  {t("pro.cta")}
                </Pill>
              </Tile>
              <Tile tone="sage" className="flex flex-col gap-4 p-8">
                <h3 className="mk-title m-0 text-[24px]">{t("v3.offerTitle")}</h3>
                <p className="m-0 text-[17px] leading-[1.55]">{t("v3.offerText")}</p>
                <p className="m-0 text-[15px] opacity-80">
                  {t("pro.durations", { p3: price.p3, p6: price.p6 })}
                  {price.currency === "USD" && ` ${t("pro.egypt", { n: price.egpFrom })}`}
                </p>
                {plansConfig.launchOffer.enabled && <p className="m-0 text-[15px] font-bold">{t("offer")}</p>}
                <Pill tone="ink" size="sm" href={mHref(locale, "/pricing")} className="mt-auto self-start">
                  {t("v3.offerCta")}
                </Pill>
              </Tile>
            </div>
          </div>
        </Wrap>

        {/* The closing card: a ring around one word, the lime button (Talabat's "Ready for your next step?"). */}
        <Wrap className="py-24 md:py-32">
          <Tile tone="ink" className="flex flex-col gap-10 px-8 py-12 md:px-16 md:py-20">
            <h2 className="mk-display m-0 max-w-[12ch] text-[clamp(44px,7vw,92px)] uppercase">
              {t.rich("v3.cta", { c: (c) => <Circled stroke="lime">{c}</Circled> })}
            </h2>
            <div className="flex flex-wrap items-center gap-6">
              <Pill tone="lime" href="#claim">
                {t("closingCta")}
              </Pill>
              <span className="text-[16px] opacity-75">{t("v3.ctaLine")}</span>
            </div>
          </Tile>
        </Wrap>
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
      <div className="bg-paper flex flex-col gap-4 rounded-[28px] p-6 md:rounded-[36px]">
        <div className="flex gap-6">
          {[
            ["1,284", t("v2.stats.visitors")],
            ["312", t("v2.stats.clicks")],
            ["9", t("v2.stats.messages")],
          ].map(([n, l]) => (
            <div key={l} className="flex flex-col">
              <span className="mk-display text-[36px]">{n}</span>
              <span className="text-[13px] opacity-70">{l}</span>
            </div>
          ))}
        </div>
        <div className="flex h-40 items-end gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className={cx("flex-1 rounded-t-[6px]", i === bars.length - 2 ? "bg-lime" : "bg-ink")}
              style={{ height: `${(h / 18) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="bg-ink text-paper flex flex-col gap-1 rounded-[28px] p-6">
          <b>{t("mock.messageTitle")}</b>
          <span className="text-[14px] opacity-80">{t("mock.messageText")}</span>
        </div>
        <div className="bg-paper flex flex-col gap-2.5 rounded-[28px] p-6 text-[14px]">
          {[
            [t("v2.stats.l1"), 64],
            [t("v2.stats.l2"), 41],
            [t("v2.stats.l3"), 23],
          ].map(([name, n]) => (
            <div key={String(name)} className="flex flex-col gap-1">
              <span className="flex justify-between">
                <b>{name}</b>
                <span className="opacity-70">{n}</span>
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
