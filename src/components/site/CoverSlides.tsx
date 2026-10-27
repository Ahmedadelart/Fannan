"use client";

import { useEffect, useState } from "react";

// Round 19: a cover's pictures crossfading one after another, with a caption for each and small
// dot buttons. The first picture is in the page from the start (it is the biggest thing on screen).

export interface Slide {
  src: string;
  srcSet?: string;
  alt: string;
  /** CSS object-position ("50% 30%"). */
  position?: string;
  caption: string;
}

export function CoverSlides({
  slides,
  interval = 6.5,
  dotLabel,
  showCaption = true,
}: {
  slides: Slide[];
  interval?: number;
  /** "Show artwork" for the dots (the number follows). */
  dotLabel: string;
  showCaption?: boolean;
}) {
  const [cur, setCur] = useState(0);
  const [manualAt, setManualAt] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      stop();
      timer = setInterval(() => setCur((c) => (c + 1) % slides.length), Math.max(2, interval) * 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [slides.length, interval, manualAt]);
  return (
    <>
      <div className="site-slides absolute inset-0" aria-hidden>
        {slides.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={s.src}
            srcSet={s.srcSet}
            sizes="100vw"
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
            className={i === cur ? "on" : undefined}
            style={{ objectPosition: s.position }}
          />
        ))}
      </div>
      {showCaption && slides[cur]?.caption && <span className="site-slide-cap">{slides[cur].caption}</span>}
      {slides.length > 1 && (
        <span className="site-slide-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${dotLabel} ${i + 1}`}
              aria-pressed={i === cur}
              className={i === cur ? "on" : undefined}
              onClick={() => {
                setCur(i);
                setManualAt(Date.now());
              }}
            />
          ))}
        </span>
      )}
    </>
  );
}
