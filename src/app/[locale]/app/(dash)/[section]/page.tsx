import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";

// Placeholders for dashboard areas built in later phases.
const sections: Record<string, { icon: IconName; nav?: string }> = {
  upgrade: { icon: "publish" },
};

export default async function ComingSoon({ params }: PageProps<"/[locale]/app/[section]">) {
  const { locale, section } = (await params) as { locale: Locale; section: string };
  const s = sections[section];
  if (!s) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  return (
    <div className="border-line bg-paper flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border p-10 text-center">
      <span className="bg-lime flex rounded-[14px] p-3">
        <Icon name={s.icon} size={40} />
      </span>
      <h1 className="font-heading font-heading-weight text-[28px]">
        {s.nav ? t(`nav.${s.nav}`) : t("upgrade")} · {t("comingSoon.title")}
      </h1>
      <p className="text-ink-soft max-w-[360px]">{t("comingSoon.text")}</p>
      <a href="/" className={buttonClasses("outline", "md")}>
        {t("comingSoon.back")}
      </a>
    </div>
  );
}
