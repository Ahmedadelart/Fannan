"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/* ---------- first-run tips (3 max, ONBOARDING.md) ---------- */

export function Tips({ onDone }: { onDone: () => void }) {
  const t = useTranslations("editor.tips");
  const [n, setN] = useState(1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const target = ["blocks", "canvas", "publish"][n - 1];
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el =
        document.querySelector<HTMLElement>(`[data-tip="${target}"]`) ??
        (target === "blocks" ? document.querySelector<HTMLElement>('[data-tip="rail-blocks"]') : null);
      setRect(el?.getBoundingClientRect() ?? null);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  const bold = { b: (c: React.ReactNode) => <b>{c}</b> };
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={(t.raw(String(n)) as string).replace(/<\/?b>/g, "")}
    >
      <div className="bg-ink/45 absolute inset-0" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-md shadow-[0_0_0_2px_var(--color-ink),0_0_0_6px_var(--color-lime)]"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: Math.min(rect.height + 8, 360),
          }}
        />
      )}
      <div
        className="bg-paper text-ink shadow-float absolute flex w-[min(300px,calc(100vw-32px))] flex-col gap-3 rounded-lg p-4"
        style={(() => {
          // Keep the card on screen, even on a phone.
          if (typeof document === "undefined") return { left: 16, top: 80 };
          const vw = document.documentElement.clientWidth;
          const vh = document.documentElement.clientHeight;
          const w = Math.min(300, vw - 32);
          if (!rect) return { left: 16, top: 80 };
          const want =
            rect.left + (target === "publish" ? rect.width - w : target === "canvas" ? 40 : rect.width + 16);
          const left = Math.max(16, Math.min(want, vw - w - 16));
          const top = Math.max(16, Math.min(target === "publish" ? rect.bottom + 16 : rect.top + 40, vh - 180));
          return { left, top };
        })()}
      >
        <p className="text-[15px]">{t.rich(String(n) as "1", bold)}</p>
        <div className="flex items-center justify-between">
          <span className="text-muted text-[12px]">{t("count", { n })}</span>
          <Button size="sm" onClick={() => (n < 3 ? setN(n + 1) : onDone())}>
            {n < 3 ? t("next") : t("done")}
          </Button>
        </div>
      </div>
    </div>
  );
}
