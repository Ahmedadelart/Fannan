import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { StagingBar } from "@/components/StagingBar";

export default async function MarketingLayout({ children, params }: LayoutProps<"/[locale]/marketing">) {
  const { locale } = await params;
  // Layouts render alongside the page, so each one sets the language before reading messages.
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider locale={locale}>
      <StagingBar />
      {children}
    </NextIntlClientProvider>
  );
}
