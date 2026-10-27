"use client";

import { useEffect, useState } from "react";

// Round 19: the project reader's small behaviours: a progress line at the bottom, arrow keys and
// Space to step between sheets, Escape to leave.

export function ReaderControls({ backHref }: { backHref: string }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    document.documentElement.classList.add("site-reader-page");
    const onScroll = () => {
      const m = document.documentElement.scrollHeight - window.innerHeight;
      setPct(m > 0 ? (window.scrollY / m) * 100 : 0);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = (dir: number) => {
      const figs = [...document.querySelectorAll<HTMLElement>("[data-sheet]")];
      if (!figs.length) return;
      const mid = window.scrollY + window.innerHeight / 2;
      let cur = figs.findIndex((f) => f.offsetTop + f.offsetHeight / 2 > mid - 4);
      if (cur < 0) cur = figs.length - 1;
      const next = Math.max(0, Math.min(figs.length - 1, cur + dir));
      figs[next].scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") window.location.assign(backHref);
      else if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("site-reader-page");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [backHref]);
  return (
    <div className="site-reader-progress" aria-hidden>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
