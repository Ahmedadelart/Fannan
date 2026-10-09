"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { bringBack } from "../../guide/actions";

/** Home: run the guided setup (again), and bring back the site from before the last build. */
export function GuideCard({ backup }: { backup: { id: string; at: string } | null }) {
  const t = useTranslations("guide.home");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  return (
    <section className="border-line bg-paper flex flex-col gap-3.5 rounded-lg border p-5" data-testid="guide-card">
      <div className="flex items-center gap-2.5">
        <span className="bg-lime text-on-lime flex size-9 items-center justify-center rounded-full">
          <Icon name="sparkle" size={18} />
        </span>
        <span className="font-semibold">{t("title")}</span>
      </div>
      <p className="text-muted m-0 text-[14px]">{t("text")}</p>
      {/* The home panel opens inside the editor: the guide takes the whole window. */}
      <a href="/guide" target="_top" className={cx(buttonClasses("outline", "md"), "self-start")} data-testid="guide-run">
        {t("run")}
      </a>
      {backup && (
        <div className="border-line flex flex-col gap-2 border-t pt-3">
          <span className="text-muted text-[13px]">{t("backup", { date: backup.at })}</span>
          <button
            type="button"
            disabled={busy}
            className={cx(buttonClasses("ghost", "sm"), "self-start")}
            onClick={async () => {
              if (!window.confirm(t("restoreConfirm"))) return;
              setBusy(true);
              const r = await bringBack(backup.id).catch(() => null);
              if (!r?.ok) {
                setBusy(false);
                return setProblem(true);
              }
              (window.top ?? window).location.href = "/editor";
            }}
            data-testid="guide-restore"
          >
            <Icon name="undo" size={16} />
            {t("restore")}
          </button>
          {problem && <span className="text-[13px] font-semibold">{t("restoreFailed")}</span>}
        </div>
      )}
    </section>
  );
}
