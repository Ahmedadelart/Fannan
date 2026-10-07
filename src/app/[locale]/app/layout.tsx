import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { StagingBar } from "@/components/StagingBar";
import { firebaseEnv, firebaseWebConfig } from "@/config/firebase";

// Everything on app.fannan.net: sign-in is available here and only here.
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const env = firebaseEnv();
  return (
    <NextIntlClientProvider locale={locale}>
      <AuthProvider config={firebaseWebConfig(env)} env={env}>
        <StagingBar />
        {children}
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
