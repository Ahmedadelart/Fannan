import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import type { Locale } from "@/i18n/locales";
import { imageSources } from "@/lib/media";
import { adminDb } from "@/lib/firebase/admin";
import { liveSite } from "@/lib/server/public";
import { DISPLAY_DOMAIN, surfaceUrls } from "@/lib/server/urls";

// Real sites from artists who agreed to be shown. Ahmed picks them on the admin page
// ("Show on Examples"); nothing here is hand-coded.

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/examples">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "examplesPage" });
  return { title: t("title"), description: t("sub"), alternates: { languages: { en: "/examples", ar: "/ar/examples" } } };
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
        <div className="bg-mist flex max-w-[620px] flex-col items-start gap-3 rounded-[16px] p-8">
          <h2 className="font-heading font-heading-weight text-[24px]">{t("emptyTitle")}</h2>
          <p className="text-ink-soft">{t("emptyText")}</p>
          <a href={`${mHref(locale, "/")}#claim`} className="bg-primary text-on-primary rounded-pill font-medium hover:brightness-110 flex h-12 items-center px-6">
            {t("cta")}
          </a>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-6" data-testid="examples">
          {sites.map((s) => {
            const href = urls.site(s.username, "/");
            const base = href.startsWith("http") ? `${href.replace(/\/$/, "")}/m/` : null;
            const img = s.cover && base ? imageSources(s.cover, 800, base) : null;
            return (
              <li key={s.username}>
                <a href={href} className="group flex flex-col gap-3">
                  <div className="border-line bg-mist aspect-[4/3] overflow-hidden rounded-[14px] border">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.src}
                        srcSet={img.srcSet}
                        sizes="(min-width: 768px) 360px, 100vw"
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-heading font-heading-weight text-[20px]">{s.title}</span>
                    {s.tagline && <span className="text-ink-soft text-[14px]">{s.tagline}</span>}
                    <span dir="ltr" className="text-muted text-start text-[13px] rtl:text-end">
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
