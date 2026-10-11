"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { DrawingSvg } from "@/components/site/DrawingSvg";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Controls";
import { cx } from "@/lib/cx";
import { BRUSHES, MAX_POINTS, MAX_STROKES, brushOf, normalizeDrawing, simplify } from "@/lib/site/drawing";
import { FREE_COLS, freeBottom, freeItem } from "@/lib/site/free";
import type { BlockOf, BrushId, DrawStroke, Drawing, FreeItem } from "@/lib/site/types";
import type { Locale } from "@/i18n/locales";

// Doodles drawn right on the section (round 11, second version). The tools live in the editor's
// side panel (rail → Doodle); the board lies over the selected free-form section, so people see what
// they draw over. "Done" turns the strokes into one drawing item that fits around them.

/** Width of a free-form section in drawing units; one grid square is WIDTH / 24. */
const WIDTH = 1000;
const CELL = WIDTH / FREE_COLS;

export interface DoodleTools {
  brush: BrushId;
  color: string;
  size: number;
  opacity: number;
  smoothing: number;
  eraser: boolean;
}

export interface DoodleSession {
  blockId: string;
  /** Redrawing an existing drawing item (it is hidden while the board is open). */
  itemId: string | null;
  strokes: DrawStroke[];
  past: DrawStroke[][];
  future: DrawStroke[][];
  boil: Drawing["boil"];
}

export const defaultTools = (ink: string): DoodleTools => ({ brush: "pen", color: ink, size: 10, opacity: 100, smoothing: 50, eraser: false });

/** Starts drawing on a section; an existing drawing item's strokes are moved onto the section's board. */
export function startSession(b: BlockOf<"free">, itemId: string | null, rtl: boolean): DoodleSession {
  const it = itemId ? b.items.find((i) => i.id === itemId) : undefined;
  const base: DoodleSession = { blockId: b.id, itemId: it ? it.id : null, strokes: [], past: [], future: [], boil: { on: false, amount: 40, speed: 50 } };
  if (!it?.drawing) return base;
  const d = it.drawing;
  const bx = (rtl ? FREE_COLS - it.place.x - it.place.w : it.place.x) * CELL;
  const by = it.place.y * CELL;
  const bw = it.place.w * CELL;
  const bh = it.place.h * CELL;
  const s = Math.min(bw / d.w, bh / d.h);
  const ox = bx + (bw - d.w * s) / 2;
  const oy = by + (bh - d.h * s) / 2;
  return {
    ...base,
    boil: d.boil,
    strokes: d.strokes.map((st) => ({
      ...st,
      size: st.size * s,
      points: st.points.map((n, i) => (i % 3 === 0 ? n * s + ox : i % 3 === 1 ? n * s + oy : n)),
    })),
  };
}

/** Ends a session: the strokes become one drawing item placed around them (or the old item is updated). */
export function finishSession(b: BlockOf<"free">, s: DoodleSession, rtl: boolean, language: Locale): BlockOf<"free"> {
  const others = b.items.filter((i) => i.id !== s.itemId);
  if (!s.strokes.length) return { ...b, items: others };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const st of s.strokes) {
    const pad = st.size * brushOf(st.brush).scale;
    for (let i = 0; i + 2 < st.points.length; i += 3) {
      minX = Math.min(minX, st.points[i] - pad);
      maxX = Math.max(maxX, st.points[i] + pad);
      minY = Math.min(minY, st.points[i + 1] - pad);
      maxY = Math.max(maxY, st.points[i + 1] + pad);
    }
  }
  const cx0 = Math.max(0, Math.floor(minX / CELL));
  const cx1 = Math.min(FREE_COLS, Math.max(cx0 + 1, Math.ceil(maxX / CELL)));
  const cy0 = Math.max(0, Math.floor(minY / CELL));
  const cy1 = Math.max(cy0 + 1, Math.ceil(maxY / CELL));
  const w = cx1 - cx0;
  const h = cy1 - cy0;
  const drawing: Drawing = normalizeDrawing({
    w: Math.round(w * CELL),
    h: Math.round(h * CELL),
    boil: s.boil,
    strokes: s.strokes.map((st) => ({
      ...st,
      points: st.points.map((n, i) => (i % 3 === 0 ? n - cx0 * CELL : i % 3 === 1 ? n - cy0 * CELL : n)),
    })),
  });
  const old = s.itemId ? b.items.find((i) => i.id === s.itemId) : undefined;
  const place = { x: rtl ? FREE_COLS - cx1 : cx0, y: cy0, w, h };
  const top = others.reduce((m, i) => Math.max(m, i.z), 0);
  const item: FreeItem = old
    ? { ...old, place, rotate: 0, drawing }
    : { ...freeItem("drawing", language, place), z: top + 1, drawing };
  const items = [...others, item];
  return { ...b, items, rows: Math.max(b.rows, freeBottom(items)) };
}

const COLORS = ["#1A1C16", "#FFFFFF", "#E5432F", "#F28C28", "#F5C518", "#C6F432", "#2E9E6A", "#7A4FD6", "#D6457C", "#8B5E3C"];

/** The side panel: brushes, colours, sizes, boiling lines, undo, done. */
export function DoodlePanel({
  session,
  tools,
  setTools,
  setSession,
  isPro,
  ink,
  canDraw,
  onStart,
  onAddSection,
  onDone,
  onCancel,
}: {
  session: DoodleSession | null;
  tools: DoodleTools;
  setTools: (fn: (t: DoodleTools) => DoodleTools) => void;
  setSession: (fn: (s: DoodleSession) => DoodleSession) => void;
  isPro: boolean;
  ink: string;
  /** The selected section is free-form, so it can be drawn on. */
  canDraw: boolean;
  onStart: () => void;
  onAddSection: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("editor.doodle");
  const set = (patch: Partial<DoodleTools>) => setTools((x) => ({ ...x, ...patch }));
  const points = session ? session.strokes.reduce((n, s) => n + s.points.length / 3, 0) : 0;
  const slider = (label: string, value: number, min: number, max: number, onChange: (v: number) => void, testid?: string) => (
    <label className="flex flex-col gap-1 text-[12px] font-semibold">
      <span className="flex justify-between">
        {label}
        <span className="text-muted tabular-nums">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-lime w-full" data-testid={testid} />
    </label>
  );

  if (!session) {
    return (
      <div className="flex flex-col gap-3 px-4 pt-4 pb-6" data-testid="doodle-panel">
        <h2 className="text-muted m-0 text-[11px] font-semibold tracking-[0.1em] uppercase">{t("title")}</h2>
        <p className="text-muted m-0 text-[13px]">{canDraw ? t("startHint") : t("pickHint")}</p>
        {canDraw ? (
          <button type="button" className="bg-lime text-on-lime rounded-pill flex h-11 items-center justify-center gap-2 text-[14px] font-semibold" onClick={onStart} data-testid="doodle-start">
            <Icon name="pen" size={18} />
            {t("start")}
          </button>
        ) : (
          <button type="button" className="border-line hover:bg-mist rounded-pill flex h-11 items-center justify-center gap-2 border text-[14px] font-semibold" onClick={onAddSection} data-testid="doodle-add-section">
            <Icon name="add" size={18} />
            {t("addSection")}
          </button>
        )}
      </div>
    );
  }

  const usesPro = session.strokes.some((s) => brushOf(s.brush).pro);
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6" data-testid="doodle-panel">
      <div className="flex items-center gap-1">
        <h2 className="text-muted m-0 flex-1 text-[11px] font-semibold tracking-[0.1em] uppercase">{t("title")}</h2>
        <button type="button" aria-label={t("undo")} title={t("undo")} disabled={!session.past.length} onClick={() => setSession(undo)} className="hover:bg-mist flex size-9 items-center justify-center rounded-full disabled:opacity-30">
          <Icon name="undo" size={18} />
        </button>
        <button type="button" aria-label={t("redo")} title={t("redo")} disabled={!session.future.length} onClick={() => setSession(redo)} className="hover:bg-mist flex size-9 items-center justify-center rounded-full disabled:opacity-30">
          <Icon name="redo" size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold">{t("brushes")}</span>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t("brushes")}>
          {BRUSHES.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={!tools.eraser && tools.brush === b.id}
              onClick={() => set({ brush: b.id, eraser: false, opacity: b.opacity })}
              className={cx(
                "relative flex flex-col items-center gap-1 rounded-[12px] border px-1 py-1.5 text-[10px] font-semibold",
                !tools.eraser && tools.brush === b.id ? "border-lime bg-mist" : "border-line hover:bg-mist",
              )}
              data-testid={`brush-${b.id}`}
            >
              <BrushSample id={b.id} />
              {t(`brush.${b.id}`)}
              {b.pro && !isPro && <span className="bg-lime text-on-lime absolute -top-1.5 -end-1 rounded-[6px] px-1 text-[8px] font-bold">PRO</span>}
            </button>
          ))}
        </div>
        {brushOf(tools.brush).pro && !isPro && <p className="text-muted m-0 text-[11px]">{t("proBrush")}</p>}
      </div>
      <button
        type="button"
        aria-pressed={tools.eraser}
        onClick={() => set({ eraser: !tools.eraser })}
        className={cx("rounded-pill flex h-10 items-center justify-center gap-2 border text-[13px] font-semibold", tools.eraser ? "border-lime bg-mist" : "border-line hover:bg-mist")}
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
              aria-pressed={tools.color === c}
              onClick={() => set({ color: c })}
              className={cx("size-7 rounded-full border-2", tools.color === c ? "border-lime" : "border-line")}
              style={{ background: c }}
            />
          ))}
          <input type="color" aria-label={t("pick")} value={tools.color} onChange={(e) => set({ color: e.target.value.toUpperCase() })} className="size-7 cursor-pointer rounded-full border-0 bg-transparent" />
        </div>
      </div>
      {slider(t("size"), tools.size, 1, 80, (v) => set({ size: v }), "doodle-size")}
      {slider(t("opacity"), tools.opacity, 5, 100, (v) => set({ opacity: v }))}
      {slider(t("smoothing"), tools.smoothing, 0, 100, (v) => set({ smoothing: v }))}
      <div className="border-line flex flex-col gap-3 rounded-[16px] border p-3" data-testid="doodle-boil">
        <div className="flex items-center justify-between gap-2">
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold">{t("boil")}</span>
            <span className="text-muted text-[11px]">{t("boilHint")}</span>
          </span>
          <Toggle label={t("boil")} hideLabel checked={session.boil.on} onChange={(v) => setSession((s) => ({ ...s, boil: { ...s.boil, on: v } }))} />
        </div>
        {session.boil.on && (
          <>
            {slider(t("boilAmount"), session.boil.amount, 5, 100, (v) => setSession((s) => ({ ...s, boil: { ...s.boil, amount: v } })))}
            {slider(t("boilSpeed"), session.boil.speed, 0, 100, (v) => setSession((s) => ({ ...s, boil: { ...s.boil, speed: v } })))}
          </>
        )}
      </div>
      <button
        type="button"
        className="text-muted hover:text-ink self-start text-[12px] font-semibold disabled:opacity-40"
        disabled={!session.strokes.length}
        onClick={() => {
          if (window.confirm(t("clearConfirm"))) setSession((s) => commit(s, []));
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
      <span className="text-muted text-[11px] tabular-nums">{t("points", { used: Math.round(points), max: MAX_POINTS })}</span>
      <div className="flex gap-2">
        <button type="button" className="border-line hover:bg-mist rounded-pill h-10 flex-1 border text-[14px] font-semibold" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button type="button" className="bg-lime text-on-lime rounded-pill h-10 flex-1 text-[14px] font-semibold" onClick={onDone} data-testid="doodle-done">
          {t("done")}
        </button>
      </div>
    </div>
  );
}

export const commit = (s: DoodleSession, strokes: DrawStroke[]): DoodleSession => ({ ...s, strokes, past: [...s.past.slice(-60), s.strokes], future: [] });
export const undo = (s: DoodleSession): DoodleSession =>
  s.past.length ? { ...s, strokes: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.strokes, ...s.future] } : s;
export const redo = (s: DoodleSession): DoodleSession => (s.future.length ? { ...s, strokes: s.future[0], future: s.future.slice(1), past: [...s.past, s.strokes] } : s);

/**
 * The board over a free-form section's grid: draws with pens (pressure), mice and fingers (speed),
 * ignores the palm once a pen is used, and shows a small bar to finish.
 */
export function DrawBoard({
  session,
  setSession,
  tools,
  rows,
  live,
  setLive,
  onDone,
  onCancel,
}: {
  session: DoodleSession;
  setSession: (fn: (s: DoodleSession) => DoodleSession) => void;
  tools: DoodleTools;
  /** The section's height in grid squares (the board's height). */
  rows: number;
  /** The stroke being drawn right now. */
  live: DrawStroke | null;
  setLive: (s: DrawStroke | null) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("editor.doodle");
  const svg = useRef<SVGSVGElement>(null);
  const current = useRef<DrawStroke | null>(null);
  const pointer = useRef<number | null>(null);
  const penSeen = useRef(false);
  const toolsRef = useRef(tools);
  useEffect(() => {
    toolsRef.current = tools;
  }, [tools]);
  const height = Math.max(rows, 4) * CELL;

  // Keyboard: undo, redo, eraser, size; the editor's own shortcuts wait while drawing.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable=true]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") setSession(e.shiftKey ? redo : undo);
      else if (mod && k === "y") setSession(redo);
      else if (e.key === "Escape") onCancel();
      else if (e.key === "Enter") onDone();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [setSession, onCancel, onDone]);

  const at = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * WIDTH, ((e.clientY - r.top) / r.height) * height];
  };

  const eraseAt = (x: number, y: number) =>
    setSession((s) => {
      const radius = Math.max(12, toolsRef.current.size * 1.2);
      const keep = s.strokes.filter((st) => {
        for (let i = 0; i + 2 < st.points.length; i += 3) if (Math.hypot(st.points[i] - x, st.points[i + 1] - y) < radius + st.size / 2) return false;
        return true;
      });
      return keep.length === s.strokes.length ? s : commit(s, keep);
    });

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") penSeen.current = true;
    if (e.pointerType === "touch" && penSeen.current) return;
    if (pointer.current !== null || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    svg.current?.setPointerCapture(e.pointerId);
    pointer.current = e.pointerId;
    const [x, y] = at(e);
    const tl = toolsRef.current;
    if (tl.eraser) return eraseAt(x, y);
    const total = session.strokes.reduce((n, s) => n + s.points.length / 3, 0);
    if (session.strokes.length >= MAX_STROKES || total >= MAX_POINTS) return;
    const pen = e.pointerType === "pen";
    current.current = { brush: tl.brush, color: tl.color, size: tl.size, opacity: tl.opacity, smoothing: tl.smoothing, pressure: pen, points: [x, y, pen ? Math.round(e.pressure * 100) : 50] };
    setLive(current.current);
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointer.current) return;
    const evs = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    const list = evs.length ? evs : [e.nativeEvent];
    if (toolsRef.current.eraser) {
      for (const ev of list) {
        const [x, y] = at(ev);
        eraseAt(x, y);
      }
      return;
    }
    const s = current.current;
    if (!s) return;
    const pts = [...s.points];
    for (const ev of list) {
      const [x, y] = at(ev);
      pts.push(x, y, s.pressure ? Math.round(ev.pressure * 100) : 50);
    }
    current.current = { ...s, points: pts };
    setLive(current.current);
  };
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    const s = current.current;
    current.current = null;
    setLive(null);
    if (!s) return;
    const pts = s.points.length === 3 ? [...s.points, s.points[0] + 0.5, s.points[1] + 0.5, s.points[2]] : s.points;
    setSession((x) => commit(x, [...x.strokes, { ...s, points: simplify(pts) }]));
  };

  const drawing: Drawing = { w: WIDTH, h: height, strokes: session.strokes, boil: session.boil };
  return (
    // Covers the section's grid exactly (24 squares wide, `rows` squares tall).
    <div className="absolute inset-0 z-[990]" data-testid="draw-board-wrap">
      <span className="bg-ink text-paper rounded-pill pointer-events-auto absolute -top-12 start-1/2 z-10 flex -translate-x-1/2 items-center gap-1 p-1 shadow-[0_8px_24px_rgba(0,0,0,.25)] rtl:translate-x-1/2">
        <span className="px-3 text-[12px] font-semibold">{t("drawingHere")}</span>
        <button type="button" aria-label={t("undo")} disabled={!session.past.length} onClick={() => setSession(undo)} className="flex size-8 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30">
          <Icon name="undo" size={16} />
        </button>
        <button type="button" className="rounded-pill h-8 px-3 text-[13px] font-semibold hover:bg-white/10" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button type="button" className="bg-lime text-on-lime rounded-pill h-8 px-4 text-[13px] font-semibold" onClick={onDone} data-testid="board-done">
          {t("done")}
        </button>
      </span>
      <svg
        ref={svg}
        className={cx("absolute inset-0 h-full w-full touch-none", tools.eraser ? "cursor-cell" : "cursor-crosshair")}
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ outline: "2px dashed #C6F432", outlineOffset: 2, background: "rgba(198,244,50,0.04)" }}
        data-testid="doodle-board"
      />
      <DrawingSvg drawing={drawing} extra={live} id={`board-${session.blockId}`} className="pointer-events-none absolute inset-0 h-full w-full" animate={!live} />
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
