"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

// Round 19: lays out a project spread at true proportions. The lead picture spans the full height on
// the left; up to three supporting sheets stack on the right at the same total height; the words sit
// beside the art. Solved from the pictures' aspect ratios and the box's width, so nothing is cropped.
// Under 900px the pieces stack and the CSS takes over.

export function SpreadFrame({
  lead,
  sups,
  gap = 14,
  children,
}: {
  /** The lead picture's width ÷ height. */
  lead: number;
  /** The supporting sheets' width ÷ height, top to bottom. */
  sups: number[];
  gap?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const solve = () => {
      const W = el.clientWidth;
      if (W <= 900) {
        el.style.removeProperty("--lead-w");
        el.style.removeProperty("--sup-w");
        el.removeAttribute("data-side");
        return;
      }
      const a0 = lead || 1.5;
      const S = sups.reduce((s, a) => s + 1 / (a || 1.5), 0);
      const gs = gap * Math.max(0, sups.length - 1);
      // Height at which lead + sheets fill the whole width.
      const natural = sups.length ? (W - gap + gs / S) / (a0 + 1 / S) : W / a0;
      const capSide = Math.min(840, window.innerHeight - 200, natural);
      const perH = a0 + (sups.length ? 1 / S : 0);
      const extra = sups.length ? gap - gs / S : 0;
      // The words keep a column of 360–460px; the art takes the rest, up to the full height.
      const textW = Math.max(360, Math.min(460, W * 0.3));
      const H = Math.max(260, Math.min(capSide, (W - 48 - textW - extra) / perH));
      const leadW = H * a0;
      const supW = sups.length ? (H - gs) / S : 0;
      el.style.setProperty("--lead-w", `${leadW}px`);
      el.style.setProperty("--sup-w", `${supW}px`);
      el.setAttribute("data-side", "");
    };
    solve();
    const ro = new ResizeObserver(solve);
    ro.observe(el);
    window.addEventListener("resize", solve);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", solve);
    };
  }, [lead, sups, gap]);
  return (
    <div ref={ref} className="site-spread-wrap" style={{ ["--gap" as string]: `${gap}px` }}>
      {children}
    </div>
  );
}
