import { getTranslations, setRequestLocale } from "next-intl/server";
import { StagingBar } from "@/components/StagingBar";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { NavItem, Highlight } from "@/components/ui/Surfaces";
import type { Locale } from "@/i18n/locales";

export default async function AppHome({ params }: PageProps<"/[locale]/app">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("app");
  const tk = await getTranslations("kitchen");
  const tc = await getTranslations("common");
  const other = locale === "ar" ? "en" : "ar";

  return (
    <>
      <StagingBar />
      <div className="bg-mist flex min-h-dvh flex-col md:flex-row">
        <aside className="flex flex-col gap-1 p-4 md:w-[240px]">
          <div className="px-2.5 pb-4">
            <Logo lang={locale} size={24} short />
          </div>
          <NavItem icon="dashboard" label={tk("dashboard")} href="/" active />
          <NavItem icon="projects" label={tk("projects")} href="/" />
          <NavItem icon="stats" label={tk("stats")} href="/" />
          <NavItem icon="messages" label={tk("messages")} href="/" />
          {/* Language switch handled by the proxy; remembered in a cookie on app.fannan.net only. */}
          <a
            href={`/__locale?to=${other}&back=/`}
            lang={other}
            aria-label={t("language")}
            className="text-ink-soft hover:text-ink mt-4 flex h-[42px] items-center gap-3 rounded-[10px] px-2.5 text-[14px] font-semibold"
          >
            <span className="flex p-1">
              <Icon name="language" />
            </span>
            {tc("otherLanguage")}
          </a>
        </aside>
        <main className="bg-paper m-2 flex-1 rounded-lg p-8 md:m-3">
          <h1 className="font-heading font-heading-weight text-[34px] leading-tight">
            <Highlight>{t("title")}</Highlight>
          </h1>
          <p className="text-ink-soft mt-4 max-w-[520px]">{t("placeholder")}</p>
        </main>
      </div>
    </>
  );
}
