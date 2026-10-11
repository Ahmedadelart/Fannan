"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { DrawingSvg } from "@/components/site/DrawingSvg";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Controls";
import { cx } from "@/lib/cx";
import { BRUSHES, MAX_POINTS, MAX_STROKES, brushOf, normalizeDrawing, simplify } from "@/lib/site/drawing";
import type { BrushId, DrawStroke, Drawing } from "@/lib/site/types";

// The doodle studio (round 11): a full-screen drawing board. Vector strokes with pressure for
// pens (Apple Pencil, Wacom, S Pen), speed-based width for mice and fingers, palm rejection while a
// pen is in use, brushes, stabilisation, an eraser, undo/redo and "boiling" lines.

const COLORS = ["#1A1C16", "#FFFFFF", "#E5432F", "#F28C28", "#F5C518", "#C6F432", "#2E9E6A", "#7A4FD6", "#D6457C", "#8B5E3C"];

export function DoodleStudio({
  initial,
  isPro,
  onDone,
  onCancel,
  paper = "#FFFFFF",
  ink = "#1A1C16",
}: {
  /** The site's background and text colours: the board looks like the page the doodle goes on. */
  paper?: string;
  ink?: string;
  initial: Drawing;
  isPro: boolean;
  onDone: (d: Drawing) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("editor.doodle");
  const [drawing, setDrawing] = useState<Drawing>(() => normalizeDrawing(initial));
  const [past, setPast] = useState<DrawStroke[][]>([]);
  const [future, setFuture] = useState<DrawStroke[][]>([]);
  const [brush, setBrush] = useState<BrushId>("pen");
  const [color, setColor] = useState(ink);
  const [size, setSize] = useState(10);
  const [opacity, setOpacity] = useState(100);
  const [smoothing, setSmoothing] = useState(50);
  const [eraser, setEraser] = useState(false);
  const [current, setCurrent] = useState<DrawStroke | null>(null);
  const [full, setFull] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const drawingRef = useRef(drawing);
  const currentRef = useRef<DrawStroke | null>(null);
  const penSeen = useRef(false);
  const activePointer = useRef<number | null>(null);
  const changed = useRef(false);
  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  const totalPoints = drawing.strokes.reduce((n, s) => n + s.points.length / 3, 0);

  const commit = useCallback((strokes: DrawStroke[]) => {
    setPast((p) => [...p.slice(-60), drawingRef.current.strokes]);
    setFuture([]);
    setDrawing((d) => ({ ...d, strokes }));
    changed.current = true;
  }, []);
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [drawingRef.current.strokes, ...f]);
      setDrawing((d) => ({ ...d, strokes: p[p.length - 1] }));
      return p.slice(0, -1);
    });
  }, []);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, drawingRef.current.strokes]);
      setDrawing((d) => ({ ...d, strokes: f[0] }));
      return f.slice(1);
    });
  }, []);

  const cancel = useCallback(() => {
    if (changed.current && !window.confirm(t("discard"))) return;
    onCancel();
  }, [onCancel, t]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // While drawing, the editor's own shortcuts (undo, delete…) must not act on the page.
      e.stopImmediatePropagation();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") cancel();
      else if (e.key.toLowerCase() === "e" && !mod) setEraser((x) => !x);
      else if (e.key === "[") setSize((s) => Math.max(1, s - 2));
      else if (e.key === "]") setSize((s) => Math.min(80, s + 2));
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [undo, redo, cancel]);

  /** A pointer position in drawing units. */
  const at = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!;
    const r = el.getBoundingClientRect();
    const d = drawingRef.current;
    // The board keeps the drawing's shape inside its box (like preserveAspectRatio "meet").
    const scale = Math.min(r.width / d.w, r.height / d.h);
    const ox = (r.width - d.w * scale) / 2;
    const oy = (r.height - d.h * scale) / 2;
    return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale];
  };

  const eraseAt = (x: number, y: number) => {
    const strokes = drawingRef.current.strokes;
    const radius = Math.max(12, size * 1.2);
    const keep = strokes.filter((s) => {
      for (let i = 0; i + 2 < s.points.length; i += 3) {
        if (Math.hypot(s.points[i] - x, s.points[i + 1] - y) < radius + s.size / 2) return false;
      }
      return true;
    });
    if (keep.length !== strokes.length) commit(keep);
  };

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") penSeen.current = true;
    // Palm rejection: once a pen has been used, fingers don't draw.
    if (e.pointerType === "touch" && penSeen.current) return;
    if (activePointer.current !== null || e.button > 0) return;
    e.preventDefault();
    svg.current?.setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    const [x, y] = at(e);
    if (eraser) return eraseAt(x, y);
    if (drawingRef.current.strokes.length >= MAX_STROKES || totalPoints >= MAX_POINTS) return;
    const pen = e.pointerType === "pen";
    const s: DrawStroke = {
      brush,
      color,
      size,
      opacity,
      smoothing,
      pressure: pen,
      points: [x, y, pen ? Math.round(e.pressure * 100) : 50],
    };
    currentRef.current = s;
    setCurrent(s);
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== activePointer.current) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    if (eraser) {
      for (const ev of events.length ? events : [e.nativeEvent]) {
        const [x, y] = at(ev);
        eraseAt(x, y);
      }
      return;
    }
    const s = currentRef.current;
    if (!s) return;
    const pts = [...s.points];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = at(ev);
      pts.push(x, y, s.pressure ? Math.round((ev as PointerEvent).pressure * 100) : 50);
    }
    const next = { ...s, points: pts };
    currentRef.current = next;
    setCurrent(next);
  };
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    const s = currentRef.current;
    currentRef.current = null;
    setCurrent(null);
    if (!s) return;
    // A tap makes a dot: repeat the point so the stroke has a body.
    const pts = s.points.length === 3 ? [...s.points, s.points[0] + 0.5, s.points[1] + 0.5, s.points[2]] : s.points;
    commit([...drawingRef.current.strokes, { ...s, points: simplify(pts) }]);
  };

  const spec = brushOf(brush);
  const usesPro = drawing.strokes.some((s) => brushOf(s.brush).pro);
  const slider = (label: string, value: number, min: number, max: number, set: (v: number) => void, testid?: string) => (
    <label className="flex flex-col gap-1 text-[12px] font-semibold">
      <span className="flex justify-between">
        {label}
        <span className="text-muted tabular-nums">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} className="accent-lime w-full" data-testid={testid} />
    </label>
  );

  return (
    <div className="fannan-dark bg-surface text-ink fixed inset-0 z-[1000] flex flex-col" role="dialog" aria-modal="true" aria-label={t("title")} data-testid="doodle-studio">
      <header className="border-line flex h-14 flex-none items-center gap-2 border-b px-3">
        <button type="button" className="hover:bg-mist rounded-pill h-10 px-4 text-[14px] font-semibold" onClick={cancel}>
          {t("cancel")}
        </button>
        <span className="text-[15px] font-semibold">{t("title")}</span>
        <span className="ms-auto flex items-center gap-1">
          <button type="button" aria-label={t("undo")} title={t("undo")} disabled={!past.length} onClick={undo} className="hover:bg-mist flex size-10 items-center justify-center rounded-full disabled:opacity-30">
            <Icon name="undo" size={20} />
          </button>
          <button type="button" aria-label={t("redo")} title={t("redo")} disabled={!future.length} onClick={redo} className="hover:bg-mist flex size-10 items-center justify-center rounded-full disabled:opacity-30">
            <Icon name="redo" size={20} />
          </button>
          <button type="button" aria-label={t("fullscreen")} title={t("fullscreen")} onClick={() => setFull((f) => !f)} className="hover:bg-mist hidden size-10 items-center justify-center rounded-full md:flex">
            <Icon name="fullscreen-cover" size={20} />
          </button>
        </span>
        <button
          type="button"
          className="bg-lime text-on-lime rounded-pill h-10 px-5 text-[14px] font-semibold"
          onClick={() => onDone(normalizeDrawing(drawing))}
          data-testid="doodle-done"
        >
          {t("done")}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* Tools */}
        {!full && (
          <aside className="border-line flex max-h-[42dvh] flex-none flex-col gap-4 overflow-y-auto border-t p-3 md:max-h-none md:w-[280px] md:border-t-0 md:border-e">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">{t("brushes")}</span>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t("brushes")}>
                {BRUSHES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={!eraser && brush === b.id}
                    onClick={() => {
                      setBrush(b.id);
                      setEraser(false);
                      setOpacity(b.opacity);
                    }}
                    className={cx(
                      "relative flex flex-col items-center gap-1 rounded-[12px] border px-1 py-1.5 text-[10px] font-semibold",
                      !eraser && brush === b.id ? "border-lime bg-mist" : "border-line hover:bg-mist",
                    )}
                    data-testid={`brush-${b.id}`}
                  >
                    <BrushSample id={b.id} />
                    {t(`brush.${b.id}`)}
                    {b.pro && !isPro && <span className="bg-lime text-on-lime absolute -top-1.5 -end-1 rounded-[6px] px-1 text-[8px] font-bold">PRO</span>}
                  </button>
                ))}
              </div>
              {spec.pro && !isPro && <p className="text-muted m-0 text-[11px]">{t("proBrush")}</p>}
            </div>

            <button
              type="button"
              aria-pressed={eraser}
              onClick={() => setEraser((x) => !x)}
              className={cx("rounded-pill flex h-10 items-center justify-center gap-2 border text-[13px] font-semibold", eraser ? "border-lime bg-mist" : "border-line hover:bg-mist")}
              data-testid="doodle-eraser"
            >
              <Icon name="delete" size={16} />
              {t("eraser")}
            </button>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold">{t("color")}</span>
              <div className="flex flex-wrap gap-1.5">
                {[ink, ...COLORS.filter((c) => c !== ink)].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                    className={cx("size-8 rounded-full border-2", color === c ? "border-lime" : "border-line")}
                    style={{ background: c }}
                  />
                ))}
                <input type="color" aria-label={t("pick")} value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-full border-0 bg-transparent" />
              </div>
            </div>

            {slider(t("size"), size, 1, 80, setSize, "doodle-size")}
            {slider(t("opacity"), opacity, 5, 100, setOpacity)}
            {slider(t("smoothing"), smoothing, 0, 100, setSmoothing)}

            <div className="border-line flex flex-col gap-3 rounded-[16px] border p-3" data-testid="doodle-boil">
              <div className="flex items-center justify-between gap-2">
                <span className="flex flex-col">
                  <span className="text-[13px] font-semibold">{t("boil")}</span>
                  <span className="text-muted text-[11px]">{t("boilHint")}</span>
                </span>
                <Toggle label={t("boil")} hideLabel checked={drawing.boil.on} onChange={(v) => setDrawing((d) => ({ ...d, boil: { ...d.boil, on: v } }))} />
              </div>
              {drawing.boil.on && (
                <>
                  {slider(t("boilAmount"), drawing.boil.amount, 5, 100, (v) => setDrawing((d) => ({ ...d, boil: { ...d.boil, amount: v } })))}
                  {slider(t("boilSpeed"), drawing.boil.speed, 0, 100, (v) => setDrawing((d) => ({ ...d, boil: { ...d.boil, speed: v } })))}
                </>
              )}
            </div>

            <button
              type="button"
              className="text-muted hover:text-ink self-start text-[12px] font-semibold"
              disabled={!drawing.strokes.length}
              onClick={() => {
                if (window.confirm(t("clearConfirm"))) commit([]);
              }}
            >
              {t("clear")}
            </button>
            <p className="text-muted m-0 text-[11px]">{t("keys")}</p>
            {usesPro && !isPro && (
              <p className="m-0 flex items-center gap-1.5 text-[11px]">
                <Badge variant="brand">Pro</Badge>
                {t("proLive")}
              </p>
            )}
          </aside>
        )}

        {/* The board */}
        <div className="bg-mist relative flex min-h-0 flex-1 items-center justify-center p-3 md:p-6">
          {/* The board fills the space; the drawing keeps its shape inside it. */}
          <div className="relative h-full w-full">
            <svg
              ref={svg}
              className={cx("absolute inset-0 h-full w-full touch-none", eraser ? "cursor-cell" : "cursor-crosshair")}
              viewBox={`0 0 ${drawing.w} ${drawing.h}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              data-testid="doodle-board"
            >
              <defs>
                <pattern id="doodle-dots" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1.4" fill={ink} fillOpacity="0.18" />
                </pattern>
              </defs>
              <rect width={drawing.w} height={drawing.h} rx="16" fill={paper} />
              <rect width={drawing.w} height={drawing.h} rx="16" fill="url(#doodle-dots)" />
            </svg>
            <DrawingSvg drawing={drawing} extra={current} id="studio" className="pointer-events-none absolute inset-0 h-full w-full" animate={!current} />
          </div>
          <span className="text-muted absolute bottom-2 text-[11px] tabular-nums">
            {t("points", { used: Math.round(totalPoints), max: MAX_POINTS })}
          </span>
        </div>
      </div>
    </div>
  );
}

/** A little scribble in each brush, for its button. */
function BrushSample({ id }: { id: BrushId }) {
  const d = {
    w: 120,
    h: 40,
    strokes: [
      {
        brush: id,
        color: id === "neon" ? "#C6F432" : "#F4F4F0",
        size: 7,
        opacity: brushOf(id).opacity,
        smoothing: 60,
        pressure: true,
        points: [10, 26, 30, 30, 12, 60, 50, 24, 80, 70, 30, 60, 90, 22, 40, 110, 16, 30],
      },
    ],
    boil: { on: false, amount: 0, speed: 0 },
  } satisfies Drawing;
  return <DrawingSvg drawing={d} id={`bs-${id}`} className="h-6 w-full" />;
}
