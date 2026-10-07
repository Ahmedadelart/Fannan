import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import type { Locale } from "@/i18n/locales";

export default async function MarketingHome({ params }: PageProps<"/[locale]/marketing">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("marketing");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <Logo lang={locale} size={28} />
        <a
          href={locale === "ar" ? "/" : "/ar"}
          className={buttonClasses("ghost", "sm")}
          lang={locale === "ar" ? "en" : "ar"}
        >
          {tc("otherLanguage")}
        </a>
      </header>
      <section className="flex flex-col gap-4 py-10">
        <h1 className="font-heading font-heading-weight md:text-display-xl text-[44px] leading-[1.1] tracking-[-0.02em]">
          {t("title")}
        </h1>
        <p className="text-body text-ink-soft max-w-[560px]">{t("subtitle")}</p>
        <p className="text-muted text-[13px]">{t("placeholder")}</p>
        <div>
          <a href={locale === "ar" ? "/ar/kitchen-sink" : "/kitchen-sink"} className={buttonClasses("primary", "lg")}>
            {t("kitchenSinkLink")}
          </a>
        </div>
      </section>
    </main>
  );
}
