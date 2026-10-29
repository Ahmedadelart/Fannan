import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import { Badge, Pill, Tile, Wave } from "@/components/marketing/ui";
import type { Locale } from "@/i18n/locales";
import { imageSources } from "@/lib/media";
import { adminDb } from "@/lib/firebase/admin";
import { liveSite } from "@/lib/server/public";
import { DISPLAY_DOMAIN, surfaceUrls } from "@/lib/server/urls";

// Real sites from artists who agreed to be shown. Ahmed picks them on the admin page
// ("Show on Examples"); nothing here is hand-coded. Round 20: cards with a wavy paper foot.

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/examples">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "examplesPage" });
  return {
    title: t("title"),
    description: t("sub"),
    alternates: { languages: { en: "/examples", ar: "/ar/examples" } },
  };
}

async function featured() {
  const snap = await adminDb().collection("sites").where("featured", "==", true).limit(48).get();
  const sites = await Promise.all(
    snap.docs.map(async (d) => {
      const username = d.data().username as string;
      const site = await liveSite(username);
      if (!site) return null;
      const cover = site.projects.find((p) => p.visibility === "public" && p.coverId && site.media[p.coverId]);
      return { username, title: site.title, tagline: site.tagline, cover: cover ? site.media[cover.coverId!] : null };
    }),
  );
  return sites.filter(Boolean) as Array<NonNullable<(typeof sites)[number]>>;
}

export default async function ExamplesPage({ params }: PageProps<"/[locale]/marketing/examples">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("examplesPage");
  const urls = await surfaceUrls();
  const sites = await featured();

  return (
    <MarketingPage locale={locale} path="/examples" title={t("title")} sub={t("sub")}>
      {sites.length === 0 ? (
        <Tile tone="mist" className="flex max-w-[640px] flex-col items-start gap-4 p-8 md:p-10">
          <h2 className="mk-title m-0 text-[26px]">{t("emptyTitle")}</h2>
          <p className="m-0 text-[17px] opacity-85">{t("emptyText")}</p>
          <Pill tone="ink" size="sm" href={`${mHref(locale, "/")}#claim`}>
            {t("cta")}
          </Pill>
        </Tile>
      ) : (
        <ul
          className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-6 p-0"
          data-testid="examples"
        >
          {sites.map((s) => {
            const href = urls.site(s.username, "/");
            const base = href.startsWith("http") ? `${href.replace(/\/$/, "")}/m/` : null;
            const img = s.cover && base ? imageSources(s.cover, 800, base) : null;
            return (
              <li key={s.username}>
                <a href={href} className="group flex flex-col">
                  <div className="bg-mist relative aspect-square overflow-hidden rounded-t-[32px]">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.src}
                        srcSet={img.srcSet}
                        sizes="(min-width: 768px) 360px, 100vw"
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                    {s.tagline && <Badge className="absolute start-4 top-4 max-w-[80%] truncate">{s.tagline}</Badge>}
                  </div>
                  <div className="mk-card-foot bg-paper flex min-h-[120px] flex-col gap-1 rounded-b-[32px] px-6 pt-5 pb-6">
                    <Wave tone="paper" />
                    <span className="mk-title text-[22px] group-hover:underline group-hover:underline-offset-4">
                      {s.title}
                    </span>
                    <span dir="ltr" className="text-[13px] font-semibold opacity-60 rtl:text-end">
                      {s.username}.{DISPLAY_DOMAIN}
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </MarketingPage>
  );
}
