"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { startServerSession, useAuth } from "@/components/auth/AuthProvider";
import type { Locale } from "@/i18n/locales";
import { completeSignIn } from "../../actions";
import { AuthShell } from "../../AuthShell";
import { EMAIL_KEY } from "@/components/auth/AuthProvider";

// The magic link lands here, on this device or another one.
export function CompleteLink() {
  const t = useTranslations("authLink");
  const ts = useTranslations("signup");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const getAuth = useAuth();
  const [state, setState] = useState<"working" | "ask" | "expired">("working");
  const [email, setEmail] = useState("");

  async function finish(address: string) {
    setState("working");
    const auth = getAuth();
    const href = window.location.href;
    try {
      const cred = await signInWithEmailLink(auth, address, href);
      const res = await startServerSession(cred.user, locale);
      if (!res.ok) throw new Error("session");
      const claim = new URL(href).searchParams.get("claim");
      await completeSignIn(claim);
      window.localStorage.removeItem(EMAIL_KEY);
      router.replace("/");
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "auth/invalid-email") setState("ask");
      else setState("expired");
    }
  }

  useEffect(() => {
    const auth = getAuth();
    void auth.authStateReady().then(() => {
      if (!isSignInWithEmailLink(auth, window.location.href)) return setState("expired");
      const saved = window.localStorage.getItem(EMAIL_KEY);
      if (saved) void finish(saved);
      else setState("ask");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (email.trim()) void finish(email.trim());
  }

  return (
    <AuthShell locale={locale}>
      {state === "working" && (
        <p role="status" className="text-muted text-[17px]">
          {t("working")}
        </p>
      )}
      {state === "ask" && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h1 className="font-heading font-heading-weight text-[36px] leading-[1.05] tracking-[-0.02em]">
            {t("askTitle")}
          </h1>
          <p className="text-ink-soft">{t("askSub")}</p>
          <input
            type="email"
            dir="ltr"
            aria-label={ts("emailLabel")}
            placeholder={ts("emailPlaceholder")}
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-ink h-[52px] rounded-md border-2 px-4 text-[17px] outline-none focus:shadow-[0_0_0_4px_var(--color-lime)]"
          />
          <button type="submit" className="bg-ink h-[52px] self-start rounded-md px-6 font-semibold text-white">
            {t("confirm")}
          </button>
        </form>
      )}
      {state === "expired" && (
        <>
          <h1 className="font-heading font-heading-weight text-[32px] leading-[1.1]">{t("expired")}</h1>
          <a
            href="/login"
            className="bg-ink inline-flex h-[52px] items-center self-start rounded-md px-6 font-semibold text-white"
          >
            {t("getNew")}
          </a>
        </>
      )}
    </AuthShell>
  );
}
