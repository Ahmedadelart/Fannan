"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender } from "@/components/site/SiteRender";
import { arabicFonts, headingFonts, siteFontVars } from "@/components/site/fonts";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { buildFromGuide, newGuidePage } from "@/lib/site/guide";
import type { HeaderSettings, ThemePreset } from "@/lib/site/types";
import { showcaseAnswers } from "./showcase";

// fannan.net: the guided setup playing by itself. Each step changes the real site on the right.

const STEP_ICONS: IconName[] = ["about-cv", "text", "palette", "list", "projects", "publish"];
const FONTS: Array<NonNullable<HeaderSettings["logoFont"]>> = ["bricolage", "fraunces", "syne"];
const PRESETS: ThemePreset[] = ["gallery", "paper", "night"];
const TICK = 160;

export function GuideDemo({
  locale,
  steps,
  name,
  what,
  ready,
}: {
  locale: Locale;
  /** Short labels for the six steps. */
  steps: string[];
  name: string;
  what: string;
  ready: string;
}) {
  const [step, setStep] = useState(0);
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Plays only while on screen, and never for people who prefer less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Shows the finished site straight away.
      const id = requestAnimationFrame(() => setStep(5));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || paused) return;
    const id = setInterval(() => {
      setT((x) => {
        const length = step === 1 ? name.length + 18 : 16;
        if (x + 1 < length) return x + 1;
        setStep((s) => (s + 1) % 6);
        return 0;
      });
    }, TICK);
    return () => clearInterval(id);
  }, [visible, paused, step, name.length]);

  const { site, projects } = useMemo(() => {
    const base = showcaseAnswers("animator", locale);
    const a = structuredClone(base.answers);
    const typed = step === 0 ? "" : step === 1 ? name.slice(0, t) : name;
    a.logo = { ...a.logo, name: typed || " ", font: step === 1 ? FONTS[Math.min(2, Math.floor(Math.max(0, t - name.length) / 6))] : step > 1 ? "syne" : null };
    a.preset = step < 2 ? "gallery" : step === 2 ? PRESETS[Math.min(2, Math.floor(t / 6))] : "night";
    const count = step < 3 ? 1 : step === 3 ? Math.min(4, 1 + Math.floor(t / 4)) : 4;
    a.pages = a.pages.slice(0, Math.min(count, a.pages.length));
    if (count >= 4) a.pages.push({ ...newGuidePage(locale === "ar" ? "روابطي" : "Links", "links"), id: "demo-links", inMenu: true });
    const shown = step < 4 ? 0 : step === 4 ? Math.min(base.projects.length, 1 + Math.floor(t / 4)) : base.projects.length;
    a.projects = a.projects.slice(0, shown);
    const ps = base.projects.slice(0, shown);
    return {
      site: buildFromGuide(a, { language: locale, title: typed, projects: ps }),
      projects: ps.map((p) => ({ ...p, card: { size: a.projects.find((x) => x.id === p.id)!.size, text: "title" as const } })),
    };
  }, [step, t, name, locale]);

  const font = (f: NonNullable<HeaderSettings["logoFont"]>) =>
    f in headingFonts ? headingFonts[f as keyof typeof headingFonts].family : arabicFonts[f as keyof typeof arabicFonts].family;

  return (
    <div
      ref={box}
      className={cx("grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]", siteFontVars)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label={steps.join(", ")}>
        {steps.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                setStep(i);
                setT(i === 1 ? name.length : 15);
              }}
              aria-current={i === step ? "step" : undefined}
              className={cx(
                "flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-start transition-colors",
                i === step ? "bg-paper shadow-[0_8px_24px_rgba(20,20,20,0.08)]" : "hover:bg-paper/60",
              )}
            >
              <span className={cx("flex size-10 flex-none items-center justify-center rounded-full", i === step ? "bg-lime text-on-lime" : i < step ? "bg-secondary-container" : "bg-mist text-muted")}>
                {i < step ? <Icon name="check" size={18} /> : <Icon name={STEP_ICONS[i]} size={18} />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cx("text-[16px] font-semibold", i !== step && "text-ink-soft")}>{label}</span>
                {i === step && (
                  <span className="text-muted truncate text-[13px]" aria-hidden>
                    {i === 0 ? what : i === 1 ? <span style={{ fontFamily: font(site.header?.logoFont ?? "bricolage") }}>{name.slice(0, Math.min(t, name.length))}▍</span> : i === 5 ? `✓ ${ready}` : "…"}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="border-line bg-paper overflow-hidden rounded-[20px] border shadow-[0_30px_60px_rgba(20,20,20,0.12)]" aria-hidden>
        <div className="border-line bg-mist flex h-9 items-center gap-2 border-b px-3.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-[#D8D8D4]" />
          ))}
          <span dir="ltr" className="text-muted ms-2 text-[12px]">
            <b className="text-ink">nour</b>.fannan.net
          </span>
        </div>
        <ScaledSite width={1200} height={820}>
          <SiteRender site={site} projects={projects} social={[{ network: "instagram", url: "#" }, { network: "behance", url: "#" }]} editing />
        </ScaledSite>
      </div>
    </div>
  );
}
