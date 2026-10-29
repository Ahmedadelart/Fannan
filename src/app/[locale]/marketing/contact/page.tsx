import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MarketingPage } from "@/components/marketing/Chrome";
import { PublicForm } from "@/components/marketing/PublicForm";
import { Tile } from "@/components/marketing/ui";
import type { Locale } from "@/i18n/locales";
import { TURNSTILE_SITE_KEY } from "@/lib/server/turnstile";

export async function generateMetadata({ params }: PageProps<"/[locale]/marketing/contact">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contactPage" });
  return { title: t("title"), alternates: { languages: { en: "/contact", ar: "/ar/contact" } } };
}

export default async function ContactPage({ params }: PageProps<"/[locale]/marketing/contact">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("contactPage");
  const f = await getTranslations("publicForm");
  return (
    <MarketingPage locale={locale} path="/contact" title={t("title")} sub={t("sub")} narrow>
      <Tile tone="paper" className="border-ink/10 border-2 p-6 md:p-10">
        <PublicForm
          kind="contact"
          turnstileKey={TURNSTILE_SITE_KEY}
          text={{
            submit: t("send"),
            sending: f("sending"),
            sent: t("sent"),
            missing: f("missing"),
            slowDown: f("slowDown"),
            error: f("error"),
          }}
          fields={[
            { name: "name", type: "text", label: t("name"), required: true, max: 120 },
            { name: "email", type: "email", label: t("email"), required: true, max: 200 },
            {
              name: "topic",
              type: "select",
              label: t("topic"),
              options: (["general", "account", "billing", "domain", "press"] as const).map((v) => ({
                value: v,
                label: t(`topics.${v}`),
              })),
            },
            { name: "message", type: "textarea", label: t("message"), required: true },
          ]}
        />
      </Tile>
      <p className="m-0 mt-8 text-[15px] opacity-75">
        {t.rich("direct", {
          a: (c) => (
            <a href="mailto:support@fannan.net" dir="ltr" className="font-bold underline underline-offset-4">
              {c}
            </a>
          ),
        })}
      </p>
    </MarketingPage>
  );
}
