"use client";

import { useEffect, useRef, useState } from "react";

// Round 19: a thin page index pinned at the side on wide screens: the spreads, a line, then the named
// sections. The one in the middle of the screen is highlighted; the rail hides over the cover and
// turns dark over light sections.

export interface RailItem {
  id: string;
  label: string;
  /** A line above this item (the sections after the spreads). */
  divider?: boolean;
}

function light(color: string): boolean {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(color);
  if (!m) return false;
  if (m[4] !== undefined && Number(m[4]) === 0) return false;
  return (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255 > 0.6;
}

export function SiteRail({ items, hideOver, label }: { items: RailItem[]; hideOver?: string; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  // Hidden until the cover has scrolled by (shown at once on pages without a cover).
  const [off, setOff] = useState(!!hideOver);
  const [onLight, setOnLight] = useState(false);
  const visible = useRef(new Map<Element, string>());
  useEffect(() => {
    const els = items
      .map((it) => [document.getElementById(it.id), it.id] as const)
      .filter((x): x is readonly [HTMLElement, string] => !!x[0]);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = els.find((x) => x[0] === e.target)?.[1];
          if (!id) continue;
          if (e.isIntersecting) visible.current.set(e.target, id);
          else visible.current.delete(e.target);
        }
        const top = [...visible.current.entries()]
          .sort((a, b) => a[0].getBoundingClientRect().top - b[0].getBoundingClientRect().top)
          .pop();
        if (top) {
          setActive(top[1]);
          const el = top[0] as HTMLElement;
          const bg = getComputedStyle(el).backgroundColor;
          setOnLight(
            light(bg) || (light(getComputedStyle(el.parentElement ?? el).backgroundColor) && !/rgba?\(/.test(bg)),
          );
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    els.forEach(([el]) => io.observe(el));
    const cover = hideOver ? document.getElementById(hideOver) : null;
    const io2 = cover ? new IntersectionObserver(([e]) => setOff(e.isIntersecting), { threshold: 0.2 }) : null;
    if (cover && io2) io2.observe(cover);
    return () => {
      io.disconnect();
      io2?.disconnect();
    };
  }, [items, hideOver]);
  return (
    <nav
      className="site-rail"
      aria-label={label}
      data-off={off || undefined}
      data-light={onLight || undefined}
      data-testid="site-rail"
    >
      <ol>
        {items.map((it) => (
          <li key={it.id} data-divider={it.divider || undefined}>
            <a href={`#${it.id}`} aria-current={active === it.id ? "true" : undefined}>
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
