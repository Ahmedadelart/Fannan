import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Marhey } from "next/font/google";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { dirFor, isLocale, locales } from "@/i18n/locales";
import { ToastProvider } from "@/components/ui/Toast";
import "../globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: "800", variable: "--font-bricolage" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  preload: false,
});
const marhey = Marhey({ subsets: ["arabic"], weight: "700", variable: "--font-marhey", preload: false });

export const metadata: Metadata = {
  title: { default: "Fannan", template: "%s · Fannan" },
  icons: { icon: "/icon.svg" },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${bricolage.variable} ${plex.variable} ${plexArabic.variable} ${marhey.variable}`}
    >
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
