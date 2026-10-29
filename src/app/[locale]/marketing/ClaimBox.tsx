"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { checkUsername, type UsernameProblem } from "@/config/usernames";
import { cx } from "@/lib/cx";

// "yourname.fannan.net [Claim it]": checks the name, then hands it to sign-up step 1,
// which holds it for 30 minutes. Round 20: drawn for the ink hero (paper field, lime pill).
export function ClaimBox({ signupUrl, domain, onDark }: { signupUrl: string; domain: string; onDark?: boolean }) {
  const t = useTranslations("marketing");
  const tp = useTranslations("usernameProblems");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<UsernameProblem | "taken" | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local = checkUsername(name);
    if (local) return setProblem(local);
    setBusy(true);
    try {
      const res = await fetch(`/api/username/check?name=${encodeURIComponent(name)}`);
      const body = (await res.json()) as { ok: boolean; reason?: UsernameProblem | "taken" };
      if (!body.ok) return setProblem(body.reason ?? "taken");
      window.location.href = signupUrl.replace("__NAME__", name);
    } catch {
      window.location.href = signupUrl.replace("__NAME__", name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-[600px] flex-col gap-2.5">
      <label htmlFor="claim-name" className={cx("text-[15px] font-semibold", onDark && "text-paper/90")}>
        {t("claimLabel")}
      </label>
      <div className="flex flex-wrap gap-2.5">
        <div
          dir="ltr"
          className={cx(
            "rounded-pill bg-paper text-ink flex h-14 min-w-0 flex-[1_1_260px] items-center px-5 text-[17px]",
            onDark
              ? "focus-within:border-lime border-2 border-transparent"
              : "border-ink/15 focus-within:border-ink border-2",
          )}
        >
          <input
            id="claim-name"
            value={name}
            onChange={(e) => {
              setProblem(null);
              setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            placeholder="yourname"
            maxLength={30}
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={problem ? true : undefined}
            className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-end font-semibold outline-none focus-visible:shadow-none"
          />
          <span className="text-muted font-medium">.{domain}</span>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mk-pill rounded-pill bg-lime text-on-lime inline-flex h-14 items-center justify-center px-7 text-[18px] font-bold whitespace-nowrap transition-[transform,filter] hover:-translate-y-px hover:brightness-95 disabled:opacity-50"
        >
          {busy ? t("claimChecking") : t("claimButton")}
        </button>
      </div>
      {problem && (
        <p role="alert" className={cx("m-0 flex items-center gap-2 text-[14px] font-semibold", onDark && "text-paper")}>
          <span aria-hidden className="bg-lime inline-block size-2.5 rounded-full" />
          {tp(problem)}
        </p>
      )}
    </form>
  );
}
