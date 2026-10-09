"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithPopup } from "firebase/auth";
import { currentUser, startServerSession, useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { completeSignIn, prepareClaim } from "../actions";
import { AuthShell } from "../AuthShell";
import { EMAIL_KEY } from "@/components/auth/AuthProvider";

const input =
  "h-[52px] w-full rounded-[16px] border border-outline bg-paper px-4 text-[17px] outline-none placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_1px_var(--color-primary)]";
const primary =
  "inline-flex h-[52px] items-center justify-center rounded-pill bg-primary px-7 text-[16px] font-medium text-on-primary hover:brightness-110 disabled:opacity-40";

export function LoginForm() {
  const t = useTranslations("login");
  const ts = useTranslations("signup");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const getAuth = useAuth();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const claim = useRef<string | null>(null);

  // Already signed in on this browser? Restore the server session and go straight in.
  useEffect(() => {
    (async () => {
      const user = await currentUser(getAuth());
      if (user && !user.isAnonymous) {
        const res = await startServerSession(user, locale);
        if (res.ok) return router.replace("/");
      }
      // Someone mid-sign-up who logs in: their draft moves to the account if it has no site yet.
      if (user?.isAnonymous) claim.current = await prepareClaim().catch(() => null);
      setRestoring(false);
    })().catch(() => setRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return setProblem(ts("emailInvalid"));
    setBusy(true);
    setProblem(null);
    try {
      const url = new URL("/auth/link", window.location.origin);
      if (claim.current) url.searchParams.set("claim", claim.current);
      await sendSignInLinkToEmail(getAuth(), value, { url: url.toString(), handleCodeInApp: true });
      window.localStorage.setItem(EMAIL_KEY, value);
      setSentTo(value);
    } catch {
      setProblem(ts("error"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setProblem(null);
    try {
      const cred = await signInWithPopup(getAuth(), new GoogleAuthProvider());
      setBusy(true);
      const res = await startServerSession(cred.user, locale);
      if (!res.ok) throw new Error("session");
      await completeSignIn(claim.current);
      router.replace("/");
    } catch {
      setProblem(ts("googleFailed"));
      setBusy(false);
    }
  }

  if (restoring) {
    return (
      <AuthShell locale={locale}>
        <p className="text-muted" role="status">
          {t("restoring")}
        </p>
      </AuthShell>
    );
  }

  if (sentTo) {
    return (
      <AuthShell locale={locale}>
        <span className="bg-lime flex size-16 items-center justify-center rounded-[14px]">
          <Icon name="email" size={40} />
        </span>
        <h1 className="font-heading font-heading-weight text-[40px] leading-[1.05] tracking-[-0.02em]">
          {t("sentTitle")}
        </h1>
        <p role="status" className="text-ink-soft text-[17px]">
          {t("sent", { email: `⁦${sentTo}⁩` })}
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="text-muted hover:text-ink self-start font-semibold"
        >
          {ts("otherEmail")}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell locale={locale}>
      <h1 className="font-heading font-heading-weight text-[40px] leading-[1.05] tracking-[-0.02em] md:text-[48px]">
        {t("title")}
      </h1>
      <p className="text-ink-soft text-[17px]">{t("sub")}</p>
      <form onSubmit={send} noValidate className="flex flex-col gap-3">
        <input
          type="email"
          dir="ltr"
          className={input}
          aria-label={ts("emailLabel")}
          placeholder={ts("emailPlaceholder")}
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {problem && (
          <p role="alert" className="flex items-center gap-2 text-[14px] font-semibold">
            <span aria-hidden className="hl-bar h-[6px] w-3" />
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={primary} disabled={busy}>
            {t("send")}
          </button>
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="border-line hover:bg-mist inline-flex h-[52px] items-center gap-2.5 rounded-md border px-5 font-semibold disabled:opacity-40"
          >
            <span aria-hidden className="border-ink size-[18px] rounded-full border-2" />
            {ts("google")}
          </button>
        </div>
      </form>
      <p className="text-muted text-[14px]">
        {t("noAccount")}{" "}
        <a href="/signup" className="text-ink font-semibold hover:underline">
          {t("signup")}
        </a>
      </p>
    </AuthShell>
  );
}
