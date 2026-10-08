"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

const field = "w-full border px-3.5 py-3 text-[16px] outline-none focus:border-[var(--site-text)]";

/** The working contact form on an artist's live site. Styled by the artist's theme. */
export interface ContactFields {
  projectType: boolean;
  budget: boolean;
  deadline: boolean;
  customQuestion: string;
}

export function ContactForm({
  button,
  turnstileKey,
  fields,
}: {
  button: string;
  turnstileKey: string;
  fields?: ContactFields;
}) {
  const t = useTranslations("site.contact");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const token = useRef("");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  // The human check is heavy (hundreds of KB), so it loads only once someone starts using the form.
  const [armed, setArmed] = useState(false);
  const arm = () => {
    if (turnstileKey && !armed) setArmed(true);
  };

  useEffect(() => {
    if (!armed || !turnstileKey || !widget.current) return;
    const render = () => {
      if (!widget.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: turnstileKey,
        callback: (v) => (token.current = v),
        "expired-callback": () => (token.current = ""),
      });
    };
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [armed, turnstileKey]);

  /** Waits briefly for the human check if the visitor was faster than it. */
  async function turnstileToken() {
    if (!turnstileKey) return "";
    arm();
    for (let i = 0; i < 40 && !token.current; i++) await new Promise((r) => setTimeout(r, 250));
    return token.current;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!data.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email ?? "") || !data.message?.trim()) {
      setProblem(t("missing"));
      return;
    }
    setState("sending");
    setProblem(null);
    const turnstile = await turnstileToken();
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, turnstile, page: window.location.pathname }),
    }).catch(() => null);
    if (res?.ok) {
      setState("sent");
      return;
    }
    setState("error");
    setProblem(res?.status === 429 ? t("slowDown") : t("error"));
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }

  if (state === "sent") {
    return (
      <p role="status" className="m-0 text-[18px] font-semibold" data-testid="contact-sent">
        {t("sent")}
      </p>
    );
  }

  const box = {
    borderColor: "var(--site-line)",
    borderRadius: "var(--site-radius)",
    background: "var(--site-bg)",
    color: "var(--site-text)",
  };
  return (
    <form
      onSubmit={submit}
      onFocusCapture={arm}
      onPointerDownCapture={arm}
      className="mt-2 grid w-full max-w-[560px] gap-3"
      noValidate
    >
      <label className="grid gap-1.5 text-[14px] font-semibold">
        {t("name")}
        <input name="name" autoComplete="name" maxLength={120} className={field} style={box} />
      </label>
      <label className="grid gap-1.5 text-[14px] font-semibold">
        {t("email")}
        <input name="email" type="email" dir="ltr" autoComplete="email" maxLength={200} className={field} style={box} />
      </label>
      {fields?.projectType && (
        <label className="grid gap-1.5 text-[14px] font-semibold">
          {t("projectType")}
          <input name="f_projectType" maxLength={200} className={field} style={box} />
        </label>
      )}
      {fields?.budget && (
        <label className="grid gap-1.5 text-[14px] font-semibold">
          {t("budget")}
          <input name="f_budget" maxLength={200} className={field} style={box} />
        </label>
      )}
      {fields?.deadline && (
        <label className="grid gap-1.5 text-[14px] font-semibold">
          {t("deadline")}
          <input name="f_deadline" maxLength={200} className={field} style={box} />
        </label>
      )}
      {fields?.customQuestion && (
        <label className="grid gap-1.5 text-[14px] font-semibold">
          {fields.customQuestion}
          <input name="f_custom" maxLength={500} className={field} style={box} />
        </label>
      )}
      <label className="grid gap-1.5 text-[14px] font-semibold">
        {t("message")}
        <textarea name="message" rows={5} maxLength={5000} className={field} style={box} />
      </label>
      {/* Hidden from people; bots fill it in. */}
      <label aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div ref={widget} />
      {problem && (
        <p role="alert" className="m-0 text-[14px] font-semibold">
          {problem}
        </p>
      )}
      <button
        type="submit"
        className="site-button justify-self-start border-0"
        disabled={state === "sending"}
        style={{ cursor: "pointer", font: "inherit", fontWeight: 600 }}
      >
        {state === "sending" ? t("sending") : button}
      </button>
    </form>
  );
}
