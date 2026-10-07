"use client";

import { useState, type FormEvent } from "react";

/** Password screen on artist sites. The check and the cookie happen on the server (unlock). */
export function PasswordForm({
  username,
  scope,
  unlock,
  labels,
}: {
  username: string;
  scope: string;
  unlock: (data: FormData) => Promise<{ ok: boolean }>;
  labels: { title: string; text: string; label: string; open: string; wrong: string };
}) {
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = {
    border: "1px solid var(--site-line)",
    borderRadius: "var(--site-radius)",
    background: "var(--site-bg)",
    color: "var(--site-text)",
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const r = await unlock(new FormData(e.currentTarget)).catch(() => ({ ok: false }));
    if (r.ok) window.location.reload();
    else {
      setWrong(true);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-[420px] flex-col gap-4 py-16 text-center">
      <h1 className="m-0 text-[32px]" style={{ fontFamily: "var(--site-heading)" }}>
        {labels.title}
      </h1>
      <p className="m-0" style={{ color: "var(--site-muted)" }}>
        {labels.text}
      </p>
      <input type="hidden" name="username" value={username} />
      <input type="hidden" name="scope" value={scope} />
      <label className="grid gap-1.5 text-start text-[14px] font-semibold">
        {labels.label}
        <input
          name="password"
          type="password"
          required
          autoFocus
          className="w-full px-3.5 py-3 text-[16px]"
          style={field}
        />
      </label>
      {wrong && (
        <p role="alert" className="m-0 text-[14px] font-semibold">
          {labels.wrong}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="site-button justify-center border-0"
        style={{ cursor: "pointer", font: "inherit", fontWeight: 600 }}
      >
        {labels.open}
      </button>
    </form>
  );
}
