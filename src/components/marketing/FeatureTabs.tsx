"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

// fannan.net: features as big pictures with a row of tabs (like Squarespace), turning by themselves.

export function FeatureTabs({ tabs }: { tabs: Array<{ key: string; label: string; line: string; visual: ReactNode }> }) {
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || paused) return;
    const id = setTimeout(() => setAt((x) => (x + 1) % tabs.length), 6000);
    return () => clearTimeout(id);
  }, [visible, paused, at, tabs.length]);

  return (
    <div
      ref={box}
      className="flex flex-col gap-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div role="tablist" aria-label="Features" className="flex flex-wrap justify-center gap-2" data-testid="feature-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`ft-${tab.key}`}
            aria-selected={i === at}
            aria-controls={`fp-${tab.key}`}
            onClick={() => setAt(i)}
            className={cx(
              "rounded-pill relative h-11 overflow-hidden px-5 text-[15px] font-semibold transition-colors",
              i === at ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-mist border-line border",
            )}
          >
            {tab.label}
            {i === at && visible && !paused && <span aria-hidden className="ft-progress bg-lime absolute inset-x-0 bottom-0 h-[3px] origin-left" />}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`fp-${tab.key}`}
          aria-labelledby={`ft-${tab.key}`}
          hidden={i !== at}
          className="flex flex-col items-center gap-5"
        >
          <p className="text-ink-soft m-0 max-w-[620px] text-center text-[18px]">{tab.line}</p>
          <div className="w-full">{tab.visual}</div>
        </div>
      ))}
    </div>
  );
}
