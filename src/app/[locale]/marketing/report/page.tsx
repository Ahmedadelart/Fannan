import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { mHref } from "@/components/marketing/links";
import { PublicForm } from "@/components/marketing/PublicForm";
import { REPORT_REASONS } from "@/config/reports";
import type { Locale } from "@/i18n/locales";
import { TURNSTILE_SITE_KEY } from "@/lib/server/turnstile";

// "Report this site" (linked from every artist site's footer, with the site and page filled in).

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/report">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reportPage" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/[locale]/marketing/report">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("reportPage");
  const f = await getTranslations("publicForm");
  const sp = await searchParams;
  const site = typeof sp.site === "string" ? sp.site.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) : "";
  const url = typeof sp.url === "string" ? sp.url.slice(0, 500) : "";
  return (
    <MarketingPage locale={locale} path="/report" title={t("title")} sub={site ? t("subSite", { site }) : t("sub")} narrow>
      <PublicForm
        kind="report"
        turnstileKey={TURNSTILE_SITE_KEY}
        text={{ submit: t("send"), sending: f("sending"), sent: t("sent"), missing: f("missing"), slowDown: f("slowDown"), error: f("error") }}
        fields={[
          ...(site
            ? [{ name: "site", type: "hidden" as const, value: site }, { name: "url", type: "hidden" as const, value: url }]
            : [{ name: "url", type: "url" as const, label: t("url"), required: true, hint: t("urlHint") }]),
          { name: "reason", type: "radio", label: t("reason"), required: true, options: REPORT_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) })) },
          { name: "details", type: "textarea", label: t("details") },
          { name: "email", type: "email", label: t("email"), hint: t("emailHint") },
        ]}
      />
      <p className="text-muted mt-8 text-[14px]">
        {t.rich("copyright", { a: (c) => <a href={mHref(locale, "/copyright")} className="font-semibold underline">{c}</a> })}
      </p>
    </MarketingPage>
  );
}
