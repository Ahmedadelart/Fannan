import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import type { Locale } from "@/i18n/locales";

/** Simple centred page for login and email-link screens. */
export function AuthShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div className="bg-paper flex min-h-dvh flex-col">
      <header className="px-5 py-5 md:px-10">
        <a href="/" aria-label="Fannan">
          <Logo lang={locale} size={24} />
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center gap-5 px-5 pb-20">
        {children}
      </main>
    </div>
  );
}
