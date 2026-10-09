"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import type { IconName } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { chooseStart } from "../actions";
import { Kicker, Question } from "../ui";

const STEPS: IconName[] = ["about-cv", "text", "palette", "list", "projects", "image", "grid", "publish"];

export function StartChoice({ name }: { name: string }) {
  const t = useTranslations("guide.start");
  const tg = useTranslations("guide");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pick = async (to: string) => {
    setBusy(true);
    await chooseStart().catch(() => {});
    router.push(to);
  };
  const first = name.trim().split(/\s+/)[0] ?? "";
  const steps = ["what", "name", "look", "pages", "projects", "inside", "pages2", "build"] as const;
  return (
    <div className="bg-surface text-ink flex min-h-dvh flex-col">
      <header className="flex items-center px-5 py-4 md:px-8">
        <Logo lang={locale} size={24} />
      </header>
      <main className="mx-auto flex w-full max-w-[980px] flex-1 flex-col justify-center gap-7 px-5 pb-16">
        <Kicker>{t("kicker")}</Kicker>
        <Question>{t("title", { first })}</Question>
        <p className="text-muted m-0 max-w-[620px] text-[17px]">{t("hint")}</p>
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <button
            type="button"
            disabled={busy}
            onClick={() => pick("/guide")}
            className="border-primary bg-paper hover:bg-secondary-container/30 flex flex-col gap-4 rounded-[28px] border-2 p-6 text-start transition-colors"
            data-testid="start-guide"
          >
            <span className="flex items-center gap-2">
              <span className="bg-lime text-on-lime rounded-[8px] px-2 py-0.5 text-[12px] font-semibold">{t("time")}</span>
            </span>
            <span className="font-heading text-[26px] leading-tight font-semibold">{t("guide")}</span>
            <span className="text-muted text-[15px]">{t("guideHint")}</span>
            <ol className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 sm:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s} className="flex items-center gap-2 text-[13px]">
                  <span className="bg-mist flex size-8 flex-none items-center justify-center rounded-full">
                    <Icon name={STEPS[i]} size={16} />
                  </span>
                  {tg(`${s}.short`)}
                </li>
              ))}
            </ol>
            <span className="bg-primary text-on-primary rounded-pill inline-flex h-[48px] items-center justify-center self-start px-6 text-[16px] font-medium">
              {t("guideButton")}
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => pick("/editor")}
            className="border-line bg-paper hover:bg-mist flex flex-col gap-4 rounded-[28px] border p-6 text-start transition-colors"
            data-testid="start-self"
          >
            <span className="bg-mist flex size-12 items-center justify-center rounded-full">
              <Icon name="site-editor" size={24} />
            </span>
            <span className="font-heading text-[24px] leading-tight font-semibold">{t("self")}</span>
            <span className="text-muted text-[15px]">{t("selfHint")}</span>
            <span className="border-outline rounded-pill mt-auto inline-flex h-[48px] items-center justify-center self-start border px-6 text-[16px] font-semibold">
              {t("selfButton")}
            </span>
          </button>
        </div>
        <p className="text-muted m-0 text-[13px]">{t("later")}</p>
      </main>
    </div>
  );
}
