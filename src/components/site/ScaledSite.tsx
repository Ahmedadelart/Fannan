"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

// Shows a full-size site (designed at `width` px) shrunk to fit its box, like a thumbnail
// that is the real page. Content inside is not interactive.

export function ScaledSite({
  children,
  width = 1200,
  height,
  className,
  label,
}: {
  children: ReactNode;
  /** The width the site is laid out at before shrinking. */
  width?: number;
  /** Visible height in site pixels; the rest is cropped. Defaults to a 16:10 window. */
  height?: number;
  className?: string;
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const viewHeight = height ?? Math.round(width * 0.625);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={box}
      // A described preview is one image; an undescribed one is decoration next to its own label.
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("relative w-full overflow-hidden", className)}
      style={{ height: viewHeight * scale }}
    >
      <div
        aria-hidden
        inert
        className="pointer-events-none absolute start-0 top-0 origin-top-left select-none rtl:origin-top-right"
        style={{ width, height: viewHeight, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
