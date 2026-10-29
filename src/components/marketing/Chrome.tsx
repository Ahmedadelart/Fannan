import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { surfaceUrls } from "@/lib/server/urls";
import { mHref } from "./links";
import { Band, Pill, Wrap } from "./ui";

// Header and footer for fannan.net (round 20, design/MARKETING.md): the header sits on the ink band
// with the logo on a paper sticker, a few links, log in, the other language as a pill and the lime
// "Claim your name". The footer is the mist block with the questions, the links and the small print.

export async function MarketingHeader({ locale, path = "/" }: { locale: Locale; path?: string }) {
  const t = await getTranslations("mnav");
  const urls = await surfaceUrls();
  const other = locale === "ar" ? "en" : "ar";
  const otherHref = other === "ar" ? mHref("ar", path) : path;
  const link = "text-paper/80 hover:text-paper whitespace-nowrap transition-colors";
  return (
    <header className="bg-ink text-paper">
      <Wrap className="flex h-[76px] items-center justify-between gap-4 md:h-[88px]">
        <a
          href={mHref(locale, "/")}
          aria-label={t("home")}
          className="bg-paper inline-flex shrink-0 -rotate-2 items-center rounded-[14px] px-3 py-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.28)] rtl:rotate-2"
        >
          <Logo lang={locale} size={locale === "ar" ? 26 : 24} />
        </a>
        <nav aria-label={t("main")} className="hidden items-center gap-7 text-[16px] font-medium md:flex">
          <a href={`${mHref(locale, "/")}#how`} className={link}>
            {t("how")}
          </a>
          <a href={mHref(locale, "/examples")} className={link}>
            {t("examples")}
          </a>
          <a href={mHref(locale, "/pricing")} className={link}>
            {t("pricing")}
          </a>
          <a href={mHref(locale, "/help")} className={link}>
            {t("help")}
          </a>
        </nav>
        <div className="flex items-center gap-2.5">
          <a href={urls.app("/login")} className={cx(link, "px-1 text-[14px] font-semibold sm:text-[15px]")}>
            {t("login")}
          </a>
          <a
            href={otherHref}
            lang={other}
            hrefLang={other}
            aria-label={other === "ar" ? "العربية" : "English"}
            className={cx(
              "rounded-pill bg-paper text-ink hover:bg-mist inline-flex h-10 items-center gap-2 px-3 text-[14px] font-bold sm:px-3.5",
              other === "ar" && "font-arabic",
            )}
          >
            <Icon name="language" size={16} />
            <span className="hidden sm:inline">{other === "ar" ? "عربي" : "English"}</span>
          </a>
          {/* Phones get the claim box in the hero itself. */}
          <span className="hidden sm:inline-flex">
            <Pill tone="lime" size="sm" href={`${mHref(locale, "/")}#claim`}>
              {t("claim")}
            </Pill>
          </span>
        </div>
      </Wrap>
    </header>
  );
}

export async function MarketingFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations("mnav");
  const other = locale === "ar" ? "en" : "ar";
  const fannan: Array<[string, string]> = [
    ["/#how", t("how")],
    ["/examples", t("examples")],
    ["/pricing", t("pricing")],
    ["/help", t("help")],
    ["/contact", t("contact")],
  ];
  const more: Array<[string, string]> = [
    ["/terms", t("terms")],
    ["/privacy", t("privacy")],
    ["/content-policy", t("policy")],
    ["/copyright", t("copyright")],
  ];
  const col = "m-0 flex list-none flex-col gap-3 p-0 text-[16px]";
  const a = "underline-offset-4 hover:underline";
  const href = (p: string) => (p.startsWith("/#") ? `${mHref(locale, "/")}${p.slice(1)}` : mHref(locale, p));
  return (
    <footer className="bg-mist text-ink">
      <Wrap className="py-16 md:py-20">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Logo lang={locale} size={locale === "ar" ? 32 : 30} />
          <a
            href={other === "ar" ? mHref("ar", "/") : "/"}
            lang={other}
            hrefLang={other}
            className={cx(
              "rounded-pill border-ink/20 bg-paper hover:border-ink inline-flex h-11 items-center gap-2 border-2 px-4 text-[14px] font-bold",
              other === "ar" && "font-arabic",
            )}
          >
            <Icon name="language" size={16} />
            {other === "ar" ? "عربي" : "English"}
          </a>
        </div>

        <div className="mt-14 grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-9">
            <div className="flex flex-col gap-1.5">
              <h3 className="mk-title m-0 text-[22px]">{t("askTitle")}</h3>
              <p className="m-0 max-w-[38ch] text-[15px] leading-[1.5] opacity-80">{t("askText")}</p>
              <a
                href="mailto:support@fannan.net"
                dir="ltr"
                className="mt-2 inline-flex w-fit items-center gap-2 text-[16px] font-bold"
              >
                <Icon name="arrow-left" size={16} className="rotate-180 rtl:rotate-0" />
                support@fannan.net
              </a>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="mk-title m-0 text-[22px]">{t("pressTitle")}</h3>
              <p className="m-0 max-w-[38ch] text-[15px] leading-[1.5] opacity-80">{t("pressText")}</p>
              <a
                href={mHref(locale, "/contact")}
                className="mt-2 inline-flex w-fit items-center gap-2 text-[16px] font-bold"
              >
                <Icon name="arrow-left" size={16} className="rotate-180 rtl:rotate-0" />
                {t("contactUs")}
              </a>
            </div>
          </div>
          <nav aria-label={t("colFannan")} className="flex flex-col gap-4">
            <h3 className="mk-title m-0 text-[20px]">{t("colFannan")}</h3>
            <ul className={col}>
              {fannan.map(([p, label]) => (
                <li key={p}>
                  <a href={href(p)} className={a}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={t("colMore")} className="flex flex-col gap-4">
            <h3 className="mk-title m-0 text-[20px]">{t("colMore")}</h3>
            <ul className={col}>
              {more.map(([p, label]) => (
                <li key={p}>
                  <a href={href(p)} className={a}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-ink/20 mt-14 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[13px] opacity-80">
          <span>{t("operator", { year: 2026 })}</span>
          <span>{t("tagline")}</span>
        </div>
      </Wrap>
    </footer>
  );
}

/** The frame of the inner pages: the ink hero with the title, then the content, then the footer. */
export async function MarketingPage({
  locale,
  path,
  title,
  sub,
  aside,
  cta,
  children,
  narrow,
}: {
  locale: Locale;
  path: string;
  title: ReactNode;
  sub?: ReactNode;
  /** Something for the end side of the hero (a sticker, a card). */
  aside?: ReactNode;
  cta?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="mk bg-surface text-ink flex min-h-dvh flex-col">
      <MarketingHeader locale={locale} path={path} />
      <Band tone="ink">
        <Wrap className={cx("grid items-center gap-10 py-14 md:py-20", !!aside && "md:grid-cols-[1.1fr_0.9fr]")}>
          <div className="flex flex-col gap-5">
            <h1 className="mk-display m-0 text-[clamp(40px,5.5vw,64px)]">{title}</h1>
            {sub && <p className="mk-lead m-0 max-w-[46ch] opacity-85">{sub}</p>}
            {cta && <div className="mt-2">{cta}</div>}
          </div>
          {aside}
        </Wrap>
      </Band>
      <main
        className={cx("mx-auto w-full flex-1 px-6 py-14 md:px-8 md:py-20", narrow ? "max-w-[860px]" : "max-w-[1328px]")}
      >
        {children}
      </main>
      <MarketingFooter locale={locale} />
    </div>
  );
}
