// Decoration items for free-form sections (round 7): underlines, arrows, marker highlights, doodles,
// dividers, icons, badges and panels. Each is drawn from its settings, so the controls are real
// (wave height, curve, arrow heads, points...). Colours come through currentColor (theme variables work). Drawn in a box of 100 units per grid cell, so lines
// scale with the page. "Wobble" adds a fixed, hand-drawn jitter (0 = clean, the default).
import type { CSSProperties, ReactNode } from "react";
import { iconBodies, type IconName } from "@/components/ui/icons.generated";
import type { FreeItem } from "@/lib/site/types";

type Pt = [number, number];

/** A small, repeatable random sequence from the item's id (the wobble looks the same every time). */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function wobble(pts: Pt[], amount: number, seed: string): Pt[] {
  if (!amount) return pts;
  const r = rng(seed);
  return pts.map(([x, y]) => [x + (r() - 0.5) * amount, y + (r() - 0.5) * amount]);
}

const line = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** Points along a styled line from x0 to x1 at height y (underlines and dividers). */
function strokeLine(style: string, x0: number, x1: number, y: number, amp: number, freq: number): Pt[][] {
  const len = x1 - x0;
  const steps = Math.max(24, Math.round(freq * 24));
  const sample = (f: (t: number) => number) =>
    Array.from({ length: steps + 1 }, (_, i): Pt => [x0 + (len * i) / steps, y + f(i / steps)]);
  switch (style) {
    case "wave":
    case "wavy":
      return [sample((t) => Math.sin(t * Math.PI * 2 * freq) * amp)];
    case "zigzag": {
      const n = Math.max(2, Math.round(freq * 2));
      return [Array.from({ length: n + 1 }, (_, i): Pt => [x0 + (len * i) / n, y + (i % 2 ? -amp : amp)])];
    }
    case "scribble":
      return [
        sample((t) => Math.sin(t * Math.PI * 2 * freq) * amp),
        sample((t) => Math.sin(t * Math.PI * 2 * freq + 1.6) * amp * 0.7 + amp * 0.3),
      ];
    case "double":
      return [
        [
          [x0, y - amp * 0.6],
          [x1, y - amp * 0.6],
        ],
        [
          [x0, y + amp * 0.6],
          [x1, y + amp * 0.6],
        ],
      ];
    case "loop": {
      const n = Math.max(2, Math.round(freq));
      const r = amp;
      const pts: Pt[] = [];
      for (let i = 0; i <= n * 40; i++) {
        const t = (i / 40) * Math.PI * 2;
        pts.push([x0 + ((len - 2 * r) * i) / (n * 40) + r - r * Math.sin(t) * 0.9, y + r * Math.cos(t) * 0.8 - r * 0.2]);
      }
      return [pts];
    }
    default:
      return [
        [
          [x0, y],
          [x1, y],
        ],
      ];
  }
}

function star(cx: number, cy: number, r: number, points: number, sharp: number): Pt[] {
  const inner = r * (0.2 + 0.6 * (1 - sharp / 100));
  return Array.from({ length: points * 2 }, (_, i): Pt => {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 ? inner : r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
}

/** The SVG for a drawn decoration (underline, arrow, highlight, doodle, divider, icon). */
export function DecoSvg({ it, color }: { it: FreeItem; color: string }) {
  const d = it.deco;
  const W = it.place.w * 100;
  const H = it.place.h * 100;
  const sw = d.stroke * 2; // px on a 1200px page → units (one cell = 100 units = 50px)
  const pad = sw + 4;
  const wob = (d.wobble / 100) * Math.min(W, H) * 0.06;
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: sw,
    strokeLinecap: d.round ? ("round" as const) : ("square" as const),
    strokeLinejoin: d.round ? ("round" as const) : ("miter" as const),
    strokeDasharray: d.dashed ? `${sw * 2.4} ${sw * 1.8}` : undefined,
  };
  const flip = `translate(${d.flipX ? W : 0} ${d.flipY ? H : 0}) scale(${d.flipX ? -1 : 1} ${d.flipY ? -1 : 1})`;
  let body: ReactNode = null;

  switch (it.kind) {
    case "underline":
    case "divider": {
      const amp = (d.amp / 100) * (H / 2 - pad);
      const style = it.kind === "divider" && (d.style === "dotted" || d.style === "dashed") ? "straight" : d.style;
      const dash =
        it.kind === "divider" && d.style === "dotted"
          ? { strokeDasharray: `0 ${sw * 2.2}`, strokeLinecap: "round" as const }
          : it.kind === "divider" && d.style === "dashed"
            ? { strokeDasharray: `${sw * 3} ${sw * 2}` }
            : {};
      body = strokeLine(style, pad, W - pad, H / 2, amp, d.freq).map((pts, i) => (
        <path key={i} d={line(wobble(pts, wob, it.id + i))} {...common} {...dash} />
      ));
      break;
    }
    case "arrow": {
      const y = H / 2;
      const x0 = pad + d.headSize;
      const x1 = W - pad - d.headSize;
      const bend = (d.curve / 100) * (H / 2 - pad);
      let pts: Pt[];
      if (d.style === "bent") {
        pts = [
          [x0, y - bend],
          [x0 + (x1 - x0) * 0.5, y - bend],
          [x0 + (x1 - x0) * 0.5, y + bend],
          [x1, y + bend],
        ];
      } else if (d.style === "zigzag") {
        const n = Math.max(2, Math.round(d.freq * 2));
        pts = Array.from({ length: n + 1 }, (_, i): Pt => [x0 + ((x1 - x0) * i) / n, y + (i % 2 ? -1 : 1) * Math.abs(bend || (H / 2 - pad) * 0.4) * (i === 0 || i === n ? 0 : 1)]);
      } else if (d.style === "loop") {
        const r = Math.min(H / 2 - pad, (x1 - x0) / 5);
        pts = Array.from({ length: 121 }, (_, i): Pt => {
          const t = i / 120;
          const a = t * Math.PI * 2;
          const loop = t > 0.3 && t < 0.7 ? Math.sin((t - 0.3) * Math.PI * 2.5) : 0;
          return [x0 + (x1 - x0) * t - loop * r * Math.sin(a * 2), y + bend * Math.sin(t * Math.PI) - loop * r];
        });
      } else {
        const curve = d.style === "straight" ? 0 : bend;
        pts = Array.from({ length: 41 }, (_, i): Pt => {
          const t = i / 40;
          return [x0 + (x1 - x0) * t, y - curve * 4 * t * (1 - t)];
        });
      }
      pts = wobble(pts, wob, it.id);
      const head = (tip: Pt, from: Pt, key: string) => {
        const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
        const s = d.headSize;
        const p1: Pt = [tip[0] - s * Math.cos(a - 0.5), tip[1] - s * Math.sin(a - 0.5)];
        const p2: Pt = [tip[0] - s * Math.cos(a + 0.5), tip[1] - s * Math.sin(a + 0.5)];
        return d.head === "filled" ? (
          <path key={key} d={`${line([p1, tip, p2])} Z`} fill="currentColor" stroke="currentColor" strokeWidth={sw * 0.6} strokeLinejoin="round" />
        ) : (
          <path key={key} d={line([p1, tip, p2])} {...common} strokeDasharray={undefined} />
        );
      };
      const n = pts.length;
      body = (
        <>
          <path d={line(pts)} {...common} />
          {d.head !== "none" && head(pts[n - 1], pts[Math.max(0, n - 4)], "end")}
          {d.head === "both" && head(pts[0], pts[Math.min(n - 1, 3)], "start")}
        </>
      );
      break;
    }
    case "highlight": {
      const slant = (d.curve / 100) * H * 0.5;
      const pts: Pt[] = [
        [slant, H * 0.12],
        [W, H * 0.04],
        [W - slant, H * 0.9],
        [0, H * 0.98],
      ];
      const rough = wobble(
        pts.flatMap((p, i) => {
          const q = pts[(i + 1) % 4];
          return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as Pt];
        }),
        Math.max(wob, (d.wobble / 100) * H * 0.12),
        it.id,
      );
      body = <path d={`${line(rough)} Z`} fill="currentColor" />;
      break;
    }
    case "doodle": {
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) / 2 - pad;
      const fill = d.filled ? "currentColor" : "none";
      const shape = (pts: Pt[], closed = true) => (
        <path d={`${line(wobble(pts, wob, it.id))}${closed ? " Z" : ""}`} {...common} fill={closed ? fill : "none"} />
      );
      switch (d.style) {
        case "sparkle": {
          const k = r * (0.12 + 0.3 * (1 - d.curve / 100));
          body = (
            <path
              d={`M${cx},${cy - r} Q${cx + k},${cy - k} ${cx + r},${cy} Q${cx + k},${cy + k} ${cx},${cy + r} Q${cx - k},${cy + k} ${cx - r},${cy} Q${cx - k},${cy - k} ${cx},${cy - r} Z`}
              {...common}
              fill={fill}
            />
          );
          break;
        }
        case "star":
          body = shape(star(cx, cy, r, Math.max(3, Math.round(d.freq)), d.curve));
          break;
        case "burst":
          body = shape(star(cx, cy, r, Math.max(8, Math.round(d.freq * 2)), 30));
          break;
        case "heart":
          body = (
            <path
              d={`M${cx},${cy + r * 0.85} C${cx - r * 1.4},${cy - r * 0.1} ${cx - r * 0.6},${cy - r * 1.1} ${cx},${cy - r * 0.35} C${cx + r * 0.6},${cy - r * 1.1} ${cx + r * 1.4},${cy - r * 0.1} ${cx},${cy + r * 0.85} Z`}
              {...common}
              fill={fill}
            />
          );
          break;
        case "circle": {
          // A loose circle drawn a little past one turn.
          const pts = Array.from({ length: 73 }, (_, i): Pt => {
            const a = (i / 60) * Math.PI * 2 - 0.4;
            const k = 1 - (i / 72) * 0.08;
            return [cx + Math.cos(a) * (W / 2 - pad) * k, cy + Math.sin(a) * (H / 2 - pad) * k];
          });
          body = shape(pts, false);
          break;
        }
        case "swirl": {
          const turns = Math.max(1, d.freq / 2);
          const pts = Array.from({ length: 120 }, (_, i): Pt => {
            const t = i / 119;
            const a = t * Math.PI * 2 * turns;
            return [cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t];
          });
          body = shape(pts, false);
          break;
        }
        case "emphasis": {
          // Three short strokes, like "look here".
          body = [-0.6, 0, 0.6].map((a, i) => {
            const ang = -Math.PI / 2 + a;
            const p0: Pt = [cx + Math.cos(ang) * r * 0.35, cy + r * 0.6 + Math.sin(ang) * r * 0.35];
            const p1: Pt = [cx + Math.cos(ang) * r * 1.2, cy + r * 0.6 + Math.sin(ang) * r * 1.2];
            return <path key={i} d={line(wobble([p0, p1], wob, it.id + i))} {...common} />;
          });
          break;
        }
        default: {
          // pencil
          const L = Math.max(W, H) * 0.42;
          body = (
            <g transform={`rotate(-35 ${cx} ${cy})`}>
              <path d={line([[cx - L, cy - r * 0.22], [cx + L * 0.6, cy - r * 0.22], [cx + L, cy], [cx + L * 0.6, cy + r * 0.22], [cx - L, cy + r * 0.22]]) + " Z"} {...common} fill={fill} />
              <path d={line([[cx + L * 0.6, cy - r * 0.22], [cx + L * 0.6, cy + r * 0.22]])} {...common} />
            </g>
          );
        }
      }
      break;
    }
    case "icon": {
      const name = (d.style in iconBodies ? d.style : "sparkle") as IconName;
      const s = Math.min(W, H) * (d.backing === "none" ? 1 : 0.62);
      const back =
        d.backing === "none" ? null : d.backing === "circle" ? (
          <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) / 2} fill={it.fill2 ?? "rgba(0,0,0,.08)"} />
        ) : (
          <rect x={(W - Math.min(W, H)) / 2} y={(H - Math.min(W, H)) / 2} width={Math.min(W, H)} height={Math.min(W, H)} rx={Math.min(W, H) * 0.24} fill={it.fill2 ?? "rgba(0,0,0,.08)"} />
        );
      return (
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full overflow-visible" aria-hidden style={{ color }}>
          {back}
          <svg
            x={(W - s) / 2}
            y={(H - s) / 2}
            width={s}
            height={s}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(0.5, d.stroke / 2)}
            strokeLinecap="square"
            strokeLinejoin="miter"
            dangerouslySetInnerHTML={{ __html: iconBodies[name] }}
          />
        </svg>
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full overflow-visible" aria-hidden data-deco={it.kind} style={{ color }}>
      <g transform={flip}>{body}</g>
    </svg>
  );
}

/** Text inside a burst doodle (like "NEW"), centred over it. */
export function DecoLabel({ it, style }: { it: FreeItem; style: CSSProperties }) {
  if (it.kind !== "doodle" || it.deco.style !== "burst" || !it.text) return null;
  return (
    <span className="absolute inset-0 flex items-center justify-center text-center font-bold" style={style}>
      {it.text}
    </span>
  );
}
