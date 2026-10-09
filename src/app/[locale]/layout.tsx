import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { dirFor, isLocale, locales } from "@/i18n/locales";
import { ToastProvider } from "@/components/ui/Toast";
import "../globals.css";

// Fonts ship with the app (src/fonts, SIL Open Font License): Google Fonts sometimes serves files
// the build can't read, which broke deploys.
const bricolage = localFont({
  src: "../../fonts/bricolage-grotesque-latin-800-normal.woff2",
  weight: "800",
  variable: "--font-bricolage",
  // No Arial stand-in: it has Arabic letters and would win over the Arabic font in the stack.
  adjustFontFallback: false,
});
const plex = localFont({
  src: [
    { path: "../../fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../../fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "../../fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-plex",
  adjustFontFallback: false,
});
// Google Sans Flex (OFL): the UI and headline font of the Material 3 look (round 4, stage C).
const googleSans = localFont({
  src: "../../fonts/google-sans-flex-latin-wght-normal.woff2",
  weight: "1 1000",
  variable: "--font-google",
  adjustFontFallback: false,
});
const plexArabic = localFont({
  src: [
    { path: "../../fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "../../fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500" },
    { path: "../../fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600" },
    { path: "../../fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-plex-arabic",
  preload: false,
});
const marhey = localFont({
  src: "../../fonts/marhey-arabic-700-normal.woff2",
  weight: "700",
  variable: "--font-marhey",
  preload: false,
});

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
      className={`${bricolage.variable} ${plex.variable} ${googleSans.variable} ${plexArabic.variable} ${marhey.variable}`}
    >
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
