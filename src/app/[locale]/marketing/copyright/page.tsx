import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { PublicForm } from "@/components/marketing/PublicForm";
import type { Locale } from "@/i18n/locales";
import { TURNSTILE_SITE_KEY } from "@/lib/server/turnstile";

// Copyright takedown notices (docs/CONTENT-POLICY.md): the work is hidden after a valid notice
// and the artist can answer with a counter-notice.

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/copyright">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "copyrightPage" });
  return { title: t("title"), alternates: { languages: { en: "/copyright", ar: "/ar/copyright" } } };
}

export default async function CopyrightPage({ params }: PageProps<"/[locale]/marketing/copyright">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("copyrightPage");
  const f = await getTranslations("publicForm");
  return (
    <MarketingPage locale={locale} path="/copyright" title={t("title")} sub={t("sub")} narrow>
      <div className="text-ink-soft mb-8 flex flex-col gap-3">
        {(t.raw("how") as string[]).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <PublicForm
        kind="copyright"
        turnstileKey={TURNSTILE_SITE_KEY}
        text={{ submit: t("send"), sending: f("sending"), sent: t("sent"), missing: f("missing"), slowDown: f("slowDown"), error: f("error") }}
        fields={[
          { name: "name", type: "text", label: t("name"), required: true, max: 120 },
          { name: "email", type: "email", label: t("email"), required: true },
          { name: "url", type: "url", label: t("url"), required: true, hint: t("urlHint") },
          { name: "original", type: "textarea", label: t("original"), required: true, max: 1000 },
          { name: "details", type: "textarea", label: t("details") },
          { name: "goodFaith", type: "checkbox", label: t("goodFaith"), required: true },
          { name: "accurate", type: "checkbox", label: t("accurate"), required: true },
          { name: "signature", type: "text", label: t("signature"), required: true, max: 120 },
        ]}
      />
    </MarketingPage>
  );
}
