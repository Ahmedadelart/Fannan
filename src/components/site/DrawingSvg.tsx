import type { ReactNode } from "react";
import { brushOf, strokePath } from "@/lib/site/drawing";
import type { Drawing, DrawStroke } from "@/lib/site/types";

// A doodle (round 11), drawn the same way in the editor and on the live site. Pure: renders on the
// server. Brush textures and glows are SVG filters; "boiling" lines are three slightly different
// copies shown one after another (CSS only, still for visitors who prefer less motion).

const FRAMES = 3;

function filterDefs(id: string, used: Set<string>): ReactNode {
  const box = { x: "-20%", y: "-20%", width: "140%", height: "140%" };
  return (
    <defs>
      {used.has("pencil") && (
        <filter id={`${id}-pencil`} {...box}>
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2" result="d" />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 1.25"
            result="grain"
          />
          <feComposite in="d" in2="grain" operator="in" />
        </filter>
      )}
      {used.has("crayon") && (
        <filter id={`${id}-crayon`} {...box}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" result="d" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 1.55" result="holes" />
          <feComposite in="d" in2="holes" operator="in" />
        </filter>
      )}
      {used.has("chalk") && (
        <filter id={`${id}-chalk`} {...box}>
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" result="d" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.7" result="dust" />
          <feComposite in="d" in2="dust" operator="in" />
        </filter>
      )}
      {used.has("neon") && (
        <filter id={`${id}-neon`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
      {used.has("watercolor") && (
        <filter id={`${id}-watercolor`} {...box}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.6" />
        </filter>
      )}
      {used.has("glitch") && (
        <filter id={`${id}-glitch`} {...box}>
          <feFlood floodColor="#FF2E88" result="pink" />
          <feComposite in="pink" in2="SourceAlpha" operator="in" result="p" />
          <feOffset in="p" dx="-5" dy="1" result="p2" />
          <feFlood floodColor="#C6F432" result="lime" />
          <feComposite in="lime" in2="SourceAlpha" operator="in" result="l" />
          <feOffset in="l" dx="5" dy="-1" result="l2" />
          <feMerge>
            <feMergeNode in="p2" />
            <feMergeNode in="l2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
    </defs>
  );
}

/** Strokes in groups that share a brush, so each texture filter runs once per group. */
function groups(strokes: DrawStroke[]) {
  const out: Array<{ filter: string; strokes: DrawStroke[] }> = [];
  for (const s of strokes) {
    const f = brushOf(s.brush).filter;
    const last = out[out.length - 1];
    if (last && last.filter === f) last.strokes.push(s);
    else out.push({ filter: f, strokes: [s] });
  }
  return out;
}

export function DrawingSvg({
  drawing,
  id,
  className,
  /** Live drawing in the editor: one extra stroke still being drawn. */
  extra,
  animate = true,
}: {
  drawing: Drawing;
  id: string;
  className?: string;
  extra?: DrawStroke | null;
  animate?: boolean;
}) {
  const strokes = extra ? [...drawing.strokes, extra] : drawing.strokes;
  const used = new Set(strokes.map((s) => brushOf(s.brush).filter));
  const safe = id.replace(/[^\w-]/g, "");
  const boil = drawing.boil.on && drawing.boil.amount > 0;
  const frames = boil ? FRAMES : 1;
  const step = Math.round(260 - drawing.boil.speed * 2);
  const frame = (f: number) =>
    groups(strokes).map((g, gi) => (
      <g
        key={gi}
        filter={g.filter === "none" ? undefined : `url(#${safe}-${g.filter})`}
        style={g.filter === "watercolor" ? { mixBlendMode: "multiply" } : undefined}
      >
        {g.strokes.map((s, i) => (
          <path
            key={i}
            d={strokePath(s, boil ? drawing.boil.amount : 0, f + 1)}
            fill={s.color}
            fillOpacity={s.opacity / 100}
          />
        ))}
      </g>
    ));
  return (
    <svg
      viewBox={`0 0 ${drawing.w} ${drawing.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
      data-testid="drawing"
      style={{ overflow: "visible", ["--dw-step" as string]: `${step}ms` }}
    >
      {filterDefs(safe, used)}
      {Array.from({ length: frames }, (_, f) => (
        <g
          key={f}
          className={boil && animate ? "dw-frame" : undefined}
          style={
            boil && animate
              ? { animationDelay: `calc(var(--dw-step) * ${-f})` }
              : f > 0
                ? { display: "none" }
                : undefined
          }
        >
          {frame(f)}
        </g>
      ))}
    </svg>
  );
}
