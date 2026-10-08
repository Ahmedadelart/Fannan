"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { checkUsername, type UsernameProblem } from "@/config/usernames";

// "yourname.fannan.net [Claim it]": checks the name, then hands it to sign-up step 1,
// which holds it for 30 minutes.
export function ClaimBox({ signupUrl, domain }: { signupUrl: string; domain: string }) {
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
    <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-2.5">
      <label htmlFor="claim-name" className="text-[14px] font-semibold">
        {t("claimLabel")}
      </label>
      <div className="flex flex-wrap gap-2.5">
        <div
          dir="ltr"
          className="border-ink bg-paper flex h-14 min-w-0 flex-[1_1_260px] items-center rounded-md border-2 px-4 text-[17px] focus-within:shadow-[0_0_0_4px_var(--color-lime)]"
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
            className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-end outline-none focus-visible:shadow-none"
          />
          <span className="text-muted font-medium">.{domain}</span>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-lime text-ink border-ink h-14 rounded-md border-2 px-[26px] text-[17px] font-semibold hover:brightness-95 disabled:opacity-50"
        >
          {busy ? t("claimChecking") : t("claimButton")}
        </button>
      </div>
      {problem && (
        <p role="alert" className="flex items-center gap-2 text-[14px] font-semibold">
          <span aria-hidden className="hl-bar h-[6px] w-3" />
          {tp(problem)}
        </p>
      )}
    </form>
  );
}
