import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { surfaceUrls } from "@/lib/server/urls";
import { mHref } from "./links";

// Header and footer for fannan.net (Home-EN/AR.dc.html): logo, a few links, log in, the other
// language, and "Claim your name". Every marketing page uses the same frame.

export async function MarketingHeader({ locale, path = "/" }: { locale: Locale; path?: string }) {
  const t = await getTranslations("mnav");
  const urls = await surfaceUrls();
  const other = locale === "ar" ? "en" : "ar";
  const otherHref = other === "ar" ? mHref("ar", path) : path;
  const link = "hover:text-ink text-ink-soft whitespace-nowrap";
  return (
    <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-6">
      <a href={mHref(locale, "/")} aria-label={t("home")}>
        <Logo lang={locale} size={28} />
      </a>
      <nav aria-label={t("main")} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] font-medium">
        <a href={`${mHref(locale, "/")}#how`} className={cx(link, "hidden md:inline")}>
          {t("how")}
        </a>
        <a href={mHref(locale, "/examples")} className={cx(link, "hidden md:inline")}>
          {t("examples")}
        </a>
        <a href={mHref(locale, "/pricing")} className={cx(link, "hidden sm:inline")}>
          {t("pricing")}
        </a>
        <a href={urls.app("/login")} className={link}>
          {t("login")}
        </a>
        <a href={otherHref} lang={other} className={cx(link, other === "ar" && "font-arabic")}>
          {other === "ar" ? "عربي" : "English"}
        </a>
        <a
          href={`${mHref(locale, "/")}#claim`}
          className="bg-ink hover:bg-ink-soft flex h-11 items-center rounded-md px-[18px] font-semibold whitespace-nowrap text-white"
        >
          {t("claim")}
        </a>
      </nav>
    </header>
  );
}

export async function MarketingFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations("mnav");
  const links: Array<[string, string]> = [
    ["/pricing", t("pricing")],
    ["/examples", t("examples")],
    ["/help", t("help")],
    ["/contact", t("contact")],
    ["/terms", t("terms")],
    ["/privacy", t("privacy")],
    ["/content-policy", t("policy")],
    ["/copyright", t("copyright")],
  ];
  return (
    <footer className="border-line border-t">
      <div className="text-muted mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 pt-8 pb-11 text-[14px] md:px-6">
        <span className="flex flex-wrap items-baseline gap-2.5">
          <Logo lang={locale} size={20} />
          {t("tagline")}
        </span>
        <nav aria-label={t("footer")} className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map(([href, label]) => (
            <a key={href} href={mHref(locale, href)} className="hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <span className="w-full text-[12px]">{t("operator", { year: 2026 })}</span>
      </div>
    </footer>
  );
}

/** A simple page frame for the inner pages (pricing, help, legal…). */
export async function MarketingPage({
  locale,
  path,
  title,
  sub,
  children,
  narrow,
}: {
  locale: Locale;
  path: string;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="bg-paper text-ink flex min-h-dvh flex-col">
      <MarketingHeader locale={locale} path={path} />
      <main className={cx("mx-auto w-full flex-1 px-4 pt-10 pb-20 md:px-6", narrow ? "max-w-[760px]" : "max-w-[1200px]")}>
        <h1 className="font-heading font-heading-weight text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-[-0.02em]">{title}</h1>
        {sub && <p className="text-ink-soft mt-3 max-w-[620px] text-[18px]">{sub}</p>}
        <div className="mt-10">{children}</div>
      </main>
      <MarketingFooter locale={locale} />
    </div>
  );
}
