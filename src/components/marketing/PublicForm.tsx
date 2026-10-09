"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cx } from "@/lib/cx";

// One form for fannan.net's contact, report and copyright pages. Posts JSON to /api/report with
// a `kind`. The human check (Turnstile) is heavy, so it loads once someone starts using the form.

export type Field =
  | { name: string; type: "text" | "email" | "url"; label: string; required?: boolean; hint?: string; max?: number }
  | { name: string; type: "textarea"; label: string; required?: boolean; hint?: string; max?: number }
  | { name: string; type: "radio" | "select"; label: string; required?: boolean; options: Array<{ value: string; label: string }> }
  | { name: string; type: "checkbox"; label: string; required?: boolean }
  | { name: string; type: "hidden"; value: string };

export interface FormText {
  submit: string;
  sending: string;
  sent: string;
  missing: string;
  slowDown: string;
  error: string;
}

const input =
  "border-line bg-paper text-ink h-11 w-full rounded-md border px-3 text-[15px] focus:border-primary focus-visible:shadow-none";

export function PublicForm({
  kind,
  fields,
  text,
  turnstileKey,
}: {
  kind: "contact" | "report" | "copyright";
  fields: Field[];
  text: FormText;
  turnstileKey: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const token = useRef("");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
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
        callback: (v: string) => (token.current = v),
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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: Record<string, string | boolean> = {};
    for (const f of fields) {
      data[f.name] = f.type === "checkbox" ? form.get(f.name) === "on" : String(form.get(f.name) ?? "").trim();
    }
    data.website = String(form.get("website") ?? "");
    const missing = fields.some(
      (f) =>
        f.type !== "hidden" &&
        f.required &&
        (f.type === "checkbox" ? !data[f.name] : !data[f.name] || (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data[f.name])))),
    );
    if (missing) return setProblem(text.missing);
    setState("sending");
    setProblem(null);
    if (turnstileKey) {
      arm();
      for (let i = 0; i < 40 && !token.current; i++) await new Promise((r) => setTimeout(r, 250));
    }
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, kind, turnstile: token.current }),
    }).catch(() => null);
    if (res?.ok) return setState("sent");
    setState("idle");
    setProblem(res?.status === 429 ? text.slowDown : text.error);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }

  if (state === "sent") {
    return (
      <p role="status" className="bg-mist rounded-lg p-5 text-[17px] font-semibold" data-testid="form-sent">
        {text.sent}
      </p>
    );
  }

  return (
    <form onSubmit={submit} onFocusCapture={arm} onPointerDownCapture={arm} noValidate className="flex max-w-[620px] flex-col gap-4">
      {fields.map((f) => {
        if (f.type === "hidden") return <input key={f.name} type="hidden" name={f.name} value={f.value} />;
        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="flex items-start gap-2.5 text-[14px]">
              <input type="checkbox" name={f.name} className="accent-ink mt-1 size-4 flex-none" />
              <span>{f.label}</span>
            </label>
          );
        }
        if (f.type === "radio") {
          return (
            <fieldset key={f.name} className="flex flex-col gap-2">
              <legend className="mb-2 text-[14px] font-semibold">{f.label}</legend>
              {f.options.map((o, i) => (
                <label key={o.value} className="flex items-center gap-2.5 text-[15px]">
                  <input type="radio" name={f.name} value={o.value} defaultChecked={i === 0} className="accent-ink size-4" />
                  {o.label}
                </label>
              ))}
            </fieldset>
          );
        }
        return (
          <label key={f.name} className="flex flex-col gap-1.5 text-[14px] font-semibold">
            {f.label}
            {f.type === "select" ? (
              <select name={f.name} className={input}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea name={f.name} maxLength={f.max ?? 5000} rows={6} className={cx(input, "h-auto py-2.5")} />
            ) : (
              <input
                name={f.name}
                type={f.type}
                maxLength={"max" in f && f.max ? f.max : 300}
                dir={f.type === "text" ? undefined : "ltr"}
                autoComplete={f.type === "email" ? "email" : f.name === "name" ? "name" : undefined}
                className={input}
              />
            )}
            {"hint" in f && f.hint && <span className="text-muted text-[12px] font-normal">{f.hint}</span>}
          </label>
        );
      })}
      {/* People never see this; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div ref={widget} />
      {problem && (
        <p role="alert" className="flex items-center gap-2 text-[14px] font-semibold">
          <span aria-hidden className="hl-bar h-[6px] w-3" />
          {problem}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="bg-primary text-on-primary rounded-pill font-medium hover:brightness-110 h-12 self-start px-6 disabled:opacity-50"
      >
        {state === "sending" ? text.sending : text.submit}
      </button>
    </form>
  );
}
