import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StagingBar } from "@/components/StagingBar";
import type { Locale } from "@/i18n/locales";

// Placeholder artist site. Artist sites use the artist's theme, not Fannan's brand,
// so this page stays deliberately plain. The real renderer comes in phase 4.

export async function generateMetadata({ params }: PageProps<"/[locale]/site/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: { absolute: username }, robots: { index: false } };
}

export default async function ArtistSite({ params }: PageProps<"/[locale]/site/[username]">) {
  const { locale, username } = (await params) as { locale: Locale; username: string };
  setRequestLocale(locale);
  const t = await getTranslations("site");

  return (
    <>
      <StagingBar />
      <main className="mx-auto flex min-h-[80dvh] max-w-[720px] flex-col justify-center gap-4 px-6">
        <h1 dir="ltr" className="text-[40px] font-semibold tracking-tight">
          {username}
        </h1>
        <p className="text-ink-soft">{t("placeholder", { username })}</p>
      </main>
      <footer className="text-muted py-6 text-center text-[12px]">
        <a href="https://fannan.net" className="hover:text-ink">
          {t("credit")}
        </a>
      </footer>
    </>
  );
}
