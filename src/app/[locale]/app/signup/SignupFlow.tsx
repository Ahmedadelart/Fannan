"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { GoogleAuthProvider, sendSignInLinkToEmail, signInAnonymously, signInWithPopup } from "firebase/auth";
import { currentUser, EMAIL_KEY, startServerSession, useAuth } from "@/components/auth/AuthProvider";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender } from "@/components/site/SiteRender";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { disciplineById, disciplineLabel, disciplinePlural, searchDisciplines, wantsReel } from "@/config/disciplines";
import { checkUsername, slugify, usernameIdeas, type UsernameProblem } from "@/config/usernames";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { firstName, generateStarter, layoutOrder, reelLayoutName } from "@/lib/site/starter";
import type { LayoutId } from "@/lib/site/types";
import { claimName, completeSignIn, holdName, logStep, prepareClaim, saveStep, setLocale } from "../actions";

export interface SignupInitial {
  step: number;
  name: string;
  discipline: string;
  layout?: LayoutId;
  username: string;
  hasSite: boolean;
  fromHomepage?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type CheckResult =
  | { state: "ok"; name: string }
  | { state: "bad"; name: string; reason: UsernameProblem | "taken"; suggestions: string[] };
type Check = { state: "checking" } | CheckResult;

/* ---------- small pieces matching Onboarding.dc.html ---------- */

const bigInput =
  "h-[60px] w-full rounded-md border-2 border-ink bg-paper px-[18px] text-[20px] text-ink outline-none placeholder:text-muted focus:shadow-[0_0_0_4px_var(--color-lime)]";
const bigButton =
  "inline-flex h-[52px] flex-none items-center justify-center gap-2 whitespace-nowrap rounded-md bg-ink px-6 text-[16px] font-semibold text-white transition-colors hover:bg-ink-soft disabled:opacity-40";
const backButton = "inline-flex h-[52px] items-center px-1.5 text-[15px] font-semibold text-muted hover:text-ink";

function Kicker({ children }: { children: ReactNode }) {
  return <span className="text-muted text-[14px] font-semibold tracking-[0.08em] uppercase">{children}</span>;
}

function Question({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <h1
      className={cx(
        "font-heading font-heading-weight leading-[1.05] tracking-[-0.025em]",
        small ? "text-[34px] md:text-[44px]" : "text-[36px] md:text-[52px]",
      )}
    >
      {children}
    </h1>
  );
}

function Problem({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="text-ink flex items-center gap-2 text-[14px] font-semibold">
      <span aria-hidden className="hl-bar h-[6px] w-3" />
      {children}
    </p>
  );
}

/* ---------- the flow ---------- */

export function SignupFlow({
  initial,
  domain,
  termsUrl,
  policyUrl,
}: {
  initial: SignupInitial;
  domain: string;
  termsUrl: string;
  policyUrl: string;
}) {
  const t = useTranslations("signup");
  const tp = useTranslations("usernameProblems");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const getAuth = useAuth();

  const [step, setStep] = useState(initial.step);
  const [maxStep, setMaxStep] = useState(initial.step);
  const [name, setName] = useState(initial.name);
  const [discipline, setDiscipline] = useState(initial.discipline);
  const [query, setQuery] = useState(() => {
    const d = disciplineById(initial.discipline);
    return d ? disciplineLabel(d, locale) : initial.discipline;
  });
  const [layout, setLayout] = useState<LayoutId>(initial.layout ?? layoutOrder(initial.discipline)[0]);
  const [username, setUsername] = useState(
    () =>
      initial.username ||
      initial.fromHomepage ||
      (initial.step === 5 ? (usernameIdeas(initial.name, disciplineById(initial.discipline)?.en)[0] ?? "") : ""),
  );
  const [held, setHeld] = useState(false);
  const [checked, setChecked] = useState<CheckResult | null>(null);
  // The answer only counts for the name it was given for; anything else is still being checked.
  const check: Check = checked && checked.name === username ? checked : { state: "checking" };
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const googleClaim = useRef<string | null>(null);
  const stepStart = useRef(0);
  const session = useRef<Promise<void> | null>(null);

  const d = disciplineById(discipline);
  const first = firstName(name) || name;
  const what = d ? disciplineLabel(d, locale) : discipline;
  const plural = d ? disciplinePlural(d, locale) : discipline;
  const address = `${username || slugify(name) || "yourname"}.${domain}`;

  /* An anonymous Firebase user plus a server session, created once, as soon as the page opens. */
  function ensureSession(): Promise<void> {
    if (!session.current) {
      session.current = (async () => {
        const auth = getAuth();
        const user = (await currentUser(auth)) ?? (await signInAnonymously(auth)).user;
        const res = await startServerSession(user, locale);
        if (!res.ok) throw new Error("session");
      })().catch((e) => {
        session.current = null;
        throw e;
      });
    }
    return session.current;
  }

  useEffect(() => {
    stepStart.current = Date.now();
    ensureSession()
      .then(async () => {
        if (initial.fromHomepage && !initial.username) {
          const r = await holdName(initial.fromHomepage);
          if (r.ok) setHeld(true);
        }
      })
      .catch(() => setProblem(t("error")));
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Funnel: one "view" per step (anonymous, no personal data).
  useEffect(() => {
    void logStep({ step, action: "view" }).catch(() => {});
  }, [step]);

  function goTo(next: number) {
    const now = Date.now();
    if (next > step) {
      void logStep({
        step,
        action: "complete",
        ms: now - stepStart.current,
        discipline: step === 2 ? discipline : undefined,
        layout: step === 4 ? layout : undefined,
      }).catch(() => {});
    }
    stepStart.current = now;
    setProblem(null);
    if (next === 3) setTicks(0);
    if (next === 5 && !username) {
      const idea = usernameIdeas(name, d?.en)[0] ?? slugify(name);
      if (idea) setUsername(idea);
    }
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
    if (next !== 3) {
      void ensureSession()
        .then(() => saveStep({ step: next, name, discipline, layout }))
        .catch(() => {});
    }
  }

  /* Step 3: a short, deliberate pause while the starter sites are made. */
  useEffect(() => {
    if (step !== 3) return;
    const timers = [700, 1400, 2100].map((ms, i) => setTimeout(() => setTicks(i + 1), ms));
    timers.push(setTimeout(() => goTo(4), 2800));
    void ensureSession()
      .then(() => saveStep({ step: 4, name, discipline, layout }))
      .catch(() => {});
    return () => timers.forEach(clearTimeout);
    // goTo is stable enough for a one-off timer; re-running on every keystroke would restart the pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* Step 5: check the name live. */
  useEffect(() => {
    if (step !== 5) return;
    const local = checkUsername(username);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ name: username, from: name, what: d?.en ?? "" });
        const res = await fetch(`/api/username/check?${qs}`, { signal: ctrl.signal });
        const body = (await res.json()) as { ok: boolean; reason?: UsernameProblem | "taken"; suggestions?: string[] };
        if (body.ok) setChecked({ state: "ok", name: username });
        else
          setChecked({
            state: "bad",
            name: username,
            reason: body.reason ?? local ?? "taken",
            suggestions: body.suggestions ?? [],
          });
      } catch {
        if (!ctrl.signal.aborted && local) setChecked({ state: "bad", name: username, reason: local, suggestions: [] });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [step, username, name, d?.en]);

  /* Step 6: get the Google claim ready ahead of time, so the popup opens straight from the click. */
  useEffect(() => {
    if (step !== 6) return;
    void ensureSession()
      .then(() => prepareClaim())
      .then((token) => (googleClaim.current = token))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function claim() {
    setBusy(true);
    setProblem(null);
    try {
      await ensureSession();
      await saveStep({ step: 5, name, discipline, layout });
      const res = await claimName(username);
      if (!res.ok) {
        setChecked({
          state: "bad",
          name: username,
          reason: res.reason,
          suggestions: check.state === "bad" ? check.suggestions : [],
        });
        return;
      }
      const user = getAuth().currentUser;
      if (user && !user.isAnonymous) {
        router.push("/");
        return;
      }
      goTo(6);
    } catch {
      setProblem(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setProblem(t("emailInvalid"));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await ensureSession();
      const token = await prepareClaim(value);
      const url = new URL("/auth/link", window.location.origin);
      if (token) url.searchParams.set("claim", token);
      await sendSignInLinkToEmail(getAuth(), value, { url: url.toString(), handleCodeInApp: true });
      window.localStorage.setItem(EMAIL_KEY, value);
      setSentTo(value);
      void logStep({ step: 6, action: "complete", method: "email", ms: Date.now() - stepStart.current }).catch(
        () => {},
      );
    } catch {
      setProblem(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setProblem(null);
    const token = googleClaim.current;
    try {
      const cred = await signInWithPopup(getAuth(), new GoogleAuthProvider());
      setBusy(true);
      const res = await startServerSession(cred.user, locale);
      if (!res.ok) throw new Error("session");
      await completeSignIn(token);
      void logStep({ step: 6, action: "complete", method: "google", ms: Date.now() - stepStart.current }).catch(
        () => {},
      );
      router.push("/");
    } catch {
      setProblem(t("googleFailed"));
      setBusy(false);
    }
  }

  async function switchLanguage() {
    await ensureSession()
      .then(() => saveStep({ step, name, discipline, layout }))
      .catch(() => {});
    await setLocale(locale === "ar" ? "en" : "ar");
    window.location.reload();
  }

  /* ---------- live preview ---------- */
  const preview = useMemo(() => {
    const draft = generateStarter({
      name: name.trim() || (locale === "ar" ? "اسمك" : "Your Name"),
      discipline: step >= 2 ? discipline : "",
      layout: step >= 4 ? layout : "grid",
      language: locale,
    });
    if (step < 2) draft.tagline = "";
    return draft;
  }, [name, discipline, layout, step, locale]);

  const chips = searchDisciplines(d && query === disciplineLabel(d, locale) ? "" : query);

  /* ---------- render ---------- */
  return (
    <div className="bg-paper text-ink flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-10">
        <Logo lang={locale} size={24} />
        <nav
          aria-label={t("progress", { step })}
          className="order-last flex w-full items-center justify-center gap-1.5 md:order-none md:w-auto"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={t("goToStep", { step: n })}
              aria-current={n === step ? "step" : undefined}
              disabled={n > maxStep || n === 3 || n === step || (n === 6 && !initial.hasSite && maxStep < 6)}
              onClick={() => goTo(n)}
              className={cx(
                "h-2 rounded-[4px] transition-all",
                n === step ? "w-[26px]" : "w-2",
                n <= step ? "bg-ink" : "bg-line",
              )}
            />
          ))}
        </nav>
        <div className="text-muted flex items-center gap-3 text-[14px]">
          <span className="hidden sm:inline">
            {t("alreadyHave")}{" "}
            <a href="/login" className="text-ink font-semibold underline-offset-2 hover:underline">
              {t("login")}
            </a>
          </span>
          <button
            type="button"
            onClick={switchLanguage}
            lang={locale === "ar" ? "en" : "ar"}
            className="border-line text-ink hover:bg-mist h-8 rounded-[8px] border px-2.5 text-[13px] font-semibold"
          >
            {locale === "ar" ? "English" : "عربي"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row-reverse">
        {/* Live preview: the real renderer at small scale. On phones it's a small card above the question. */}
        <aside
          aria-label={t("previewLabel")}
          className="bg-mist flex flex-col justify-center gap-3.5 px-5 py-5 lg:flex-[1_1_480px] lg:px-14 lg:py-16"
        >
          <span className="text-muted hidden text-[12px] font-semibold tracking-[0.08em] uppercase lg:block">
            {t("previewLabel")}
          </span>
          <div className="border-line bg-paper mx-auto w-full max-w-[560px] overflow-hidden rounded-[16px] border shadow-[0_20px_48px_rgba(20,20,20,0.08)]">
            <div className="border-line text-muted flex h-9 items-center gap-2 border-b px-3.5 text-[12px]">
              <span className="size-[9px] rounded-full bg-[#D8D8D4]" />
              <span className="size-[9px] rounded-full bg-[#D8D8D4]" />
              <span className="size-[9px] rounded-full bg-[#D8D8D4]" />
              <span dir="ltr" className="ms-2 truncate" data-testid="preview-address">
                <b className="text-ink">{address.split(".")[0]}</b>.{domain}
              </span>
            </div>
            <ScaledSite width={1200} height={760} label={t("previewFor", { address })} className="max-lg:max-h-[150px]">
              <SiteRender site={preview} blankArt={step < 3 ? "#F4F4F2" : undefined} />
            </ScaledSite>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col justify-center gap-6 px-5 py-10 md:px-10 lg:flex-[1_1_560px] lg:ps-[120px] xl:max-w-[760px]">
          {step === 1 && (
            <form
              className="flex flex-col gap-[26px]"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return setProblem(t("nameNeeded"));
                goTo(2);
              }}
            >
              <Kicker>{t("step1Kicker")}</Kicker>
              <Question>{t("step1Title")}</Question>
              <input
                className={bigInput}
                aria-label={t("nameLabel")}
                placeholder={t("namePlaceholder")}
                value={name}
                maxLength={80}
                autoComplete="name"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              {problem && <Problem>{problem}</Problem>}
              {held && !problem && (
                <p className="text-lime-ink flex items-center gap-2 text-[14px] font-semibold">
                  <Icon name="check" size={16} />
                  <span dir="ltr">{t("heldName", { address })}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3.5">
                <button type="submit" className={bigButton}>
                  {t("next")}
                </button>
                <span className="text-muted text-[13px]">{t("noCard")}</span>
              </div>
            </form>
          )}

          {step === 2 && (
            <form
              className="flex flex-col gap-[22px]"
              onSubmit={(e) => {
                e.preventDefault();
                if (!discipline.trim()) return setProblem(t("jobNeeded"));
                setLayout(layoutOrder(discipline)[0]);
                goTo(3);
              }}
            >
              <Kicker>{t("stepKicker", { step: 2 })}</Kicker>
              <Question>{t("step2Title", { first })}</Question>
              <input
                className={bigInput}
                aria-label={t("jobLabel")}
                placeholder={t("jobPlaceholder")}
                value={query}
                maxLength={80}
                autoFocus
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  const exact = searchDisciplines(v, 1)[0];
                  const matches = exact && [exact.en, exact.ar].some((l) => l.toLowerCase() === v.trim().toLowerCase());
                  setDiscipline(matches ? exact.id : v.trim());
                }}
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("jobLabel")}>
                {chips.map((c) => {
                  const on = c.id === discipline;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setDiscipline(c.id);
                        setQuery(disciplineLabel(c, locale));
                      }}
                      className={cx(
                        "rounded-pill h-[38px] px-3.5 text-[14px] font-semibold transition-colors",
                        on ? "bg-ink text-white" : "border-line bg-paper hover:bg-mist border",
                      )}
                    >
                      {disciplineLabel(c, locale)}
                    </button>
                  );
                })}
              </div>
              {problem && <Problem>{problem}</Problem>}
              <div className="flex items-center gap-3.5">
                <button type="submit" className={bigButton}>
                  {t("next")}
                </button>
                <button type="button" className={backButton} onClick={() => goTo(1)}>
                  {t("back")}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-[26px]" aria-live="polite">
              <Question>{t("step3Title", { what: locale === "ar" ? what : what.toLowerCase() })}</Question>
              <div className="bg-mist h-3 overflow-hidden rounded-[6px]">
                <div
                  className="bg-lime -ms-1.5 h-3 [transform:skewX(-14deg)] transition-[width] duration-700 ease-out"
                  style={{ width: `${20 + ticks * 27}%` }}
                />
              </div>
              <ul className="flex flex-col gap-2.5 text-[17px]">
                {[t("load1"), wantsReel(d?.kind) ? t("loadReel") : t("loadLayouts", { plural }), t("load3")].map(
                  (line, i) => (
                    <li key={i} className={cx("flex items-center gap-3", ticks <= i && "text-muted")}>
                      <span
                        aria-hidden
                        className={cx("h-[7px] w-3.5 [transform:skewX(-14deg)]", ticks > i ? "bg-ink" : "bg-line")}
                      />
                      {line}
                    </li>
                  ),
                )}
              </ul>
              <div>
                <button type="button" className={bigButton} onClick={() => goTo(4)}>
                  {t("continue")}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-5">
              <Kicker>{t("stepKicker", { step: 4 })}</Kicker>
              <Question small>{t("step4Title", { first })}</Question>
              <p className="text-ink-soft text-[18px]">{t("step4Sub", { plural: plural || what })}</p>
              <div
                className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t("step4Title", { first })}
              >
                {layoutOrder(discipline).map((id) => {
                  const on = id === layout;
                  const key = id === "reel" ? reelLayoutName(discipline) : id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setLayout(id)}
                      className={cx(
                        "bg-paper flex flex-col gap-2 rounded-[14px] border-2 p-2.5 text-start transition-colors",
                        on ? "border-ink" : "border-line hover:border-line-strong",
                      )}
                    >
                      <span className="overflow-hidden rounded-[8px]">
                        <ScaledSite width={1200} height={760}>
                          <SiteRender
                            site={generateStarter({ name: first || name, discipline, layout: id, language: locale })}
                          />
                        </ScaledSite>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{t(`layouts.${key}.name`)}</span>
                        <span
                          className={cx(
                            "rounded-sm px-2 py-[3px] text-[12px] font-semibold",
                            on ? "bg-lime" : "bg-mist",
                          )}
                        >
                          {on ? t("selected") : t("choose")}
                        </span>
                      </span>
                      <span className="text-muted text-[12px]">{t(`layouts.${key}.desc`)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3.5">
                <button type="button" className={bigButton} onClick={() => goTo(5)}>
                  {t("customize")}
                </button>
                <button type="button" className={backButton} onClick={() => goTo(2)}>
                  {t("back")}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <form
              className="flex flex-col gap-[22px]"
              onSubmit={(e) => {
                e.preventDefault();
                if (check.state !== "bad") void claim();
              }}
            >
              <Kicker>{t("stepKicker", { step: 5 })}</Kicker>
              <Question>{t("step5Title")}</Question>
              <div
                dir="ltr"
                className="border-ink flex h-[60px] items-center rounded-md border-2 px-[18px] text-[20px] focus-within:shadow-[0_0_0_4px_var(--color-lime)]"
              >
                <input
                  aria-label={t("usernameLabel")}
                  aria-describedby="username-status"
                  value={username}
                  maxLength={30}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="min-w-0 flex-1 border-0 bg-transparent pe-0.5 text-end outline-none focus-visible:shadow-none"
                />
                <span className="text-muted">.{domain}</span>
              </div>
              <div id="username-status" aria-live="polite" className="min-h-[22px]">
                {check.state === "checking" && <p className="text-muted text-[14px]">{t("checking")}</p>}
                {check.state === "ok" && (
                  <p className="text-lime-ink flex items-center gap-2 text-[14px] font-semibold">
                    <Icon name="check" size={16} />
                    <span dir="ltr">{t("available", { address: `${username}.${domain}` })}</span>
                  </p>
                )}
                {check.state === "bad" && <Problem>{tp(check.reason)}</Problem>}
              </div>
              {check.state === "bad" && check.suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted text-[13px]">{t("suggestions")}</span>
                  {check.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      dir="ltr"
                      onClick={() => setUsername(s)}
                      className="rounded-pill border-line bg-paper hover:bg-mist h-8 border px-3 text-[13px] font-semibold"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {problem && <Problem>{problem}</Problem>}
              <div className="flex items-center gap-3.5">
                <button type="submit" className={bigButton} disabled={busy || check.state !== "ok"}>
                  {busy ? t("saving") : t("claim")}
                </button>
                <button type="button" className={backButton} onClick={() => goTo(4)}>
                  {t("back")}
                </button>
              </div>
            </form>
          )}

          {step === 6 && !sentTo && (
            <div className="flex flex-col gap-5">
              <Kicker>{t("lastStep")}</Kicker>
              <Question>{t("step6Title")}</Question>
              <p className="text-ink-soft text-[18px]">{t("step6Sub", { address: `⁦${username}.${domain}⁩` })}</p>
              <form onSubmit={sendLink} className="flex flex-col gap-5" noValidate>
                <input
                  type="email"
                  dir="ltr"
                  className={cx(bigInput, "text-start rtl:text-end")}
                  aria-label={t("emailLabel")}
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {problem && <Problem>{problem}</Problem>}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" className={bigButton} disabled={busy}>
                    {busy ? t("saving") : t("save")}
                  </button>
                  <button
                    type="button"
                    onClick={google}
                    disabled={busy}
                    className="border-line hover:bg-mist inline-flex h-[52px] items-center gap-2.5 rounded-md border px-5 font-semibold disabled:opacity-40"
                  >
                    <span aria-hidden className="border-ink size-[18px] rounded-full border-2" />
                    {t("google")}
                  </button>
                </div>
              </form>
              <div className="bg-mist flex max-w-[520px] items-start gap-3.5 rounded-[16px] p-[18px]">
                <span aria-hidden className="hl-bar mt-2 h-2 w-4" />
                <p className="text-[15px]">{t("promise")}</p>
              </div>
              <p className="text-muted text-[12px]">
                {t.rich("legal", {
                  terms: (c) => (
                    <a href={termsUrl} className="hover:text-ink underline underline-offset-2">
                      {c}
                    </a>
                  ),
                  policy: (c) => (
                    <a href={policyUrl} className="hover:text-ink underline underline-offset-2">
                      {c}
                    </a>
                  ),
                })}
              </p>
            </div>
          )}

          {step === 6 && sentTo && (
            <div className="flex flex-col gap-5" role="status">
              <span className="bg-lime flex size-16 items-center justify-center rounded-[14px]">
                <Icon name="email" size={40} />
              </span>
              <Question>{t("checkEmailTitle")}</Question>
              <p className="text-ink-soft text-[18px]">{t("checkEmail", { email: `⁦${sentTo}⁩` })}</p>
              <div className="flex flex-wrap items-center gap-3.5">
                <a href="/" className={bigButton}>
                  {t("keepGoing")}
                </a>
                <button type="button" className={backButton} onClick={() => setSentTo(null)}>
                  {t("otherEmail")}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
