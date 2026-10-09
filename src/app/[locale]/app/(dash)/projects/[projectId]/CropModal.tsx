"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlays";
import { cx } from "@/lib/cx";

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

const RATIOS: Array<{ id: string; value: number | null }> = [
  { id: "free", value: null },
  { id: "16:9", value: 16 / 9 },
  { id: "4:3", value: 4 / 3 },
  { id: "1:1", value: 1 },
  { id: "3:4", value: 3 / 4 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Crop on top of the current picture. Coordinates are 0..1 of the shown image; the caller turns
 * them into coordinates of the original. Only straight edges here: crop handles are the one place
 * the interface is fully sharp (Shapes.dc.html §3).
 */
export function CropModal({
  open,
  src,
  width,
  height,
  onClose,
  onSave,
  onReset,
  busy,
}: {
  open: boolean;
  src: string;
  width: number;
  height: number;
  onClose: () => void;
  onSave: (crop: Crop) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [crop, setCrop] = useState<Crop>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [ratio, setRatio] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: string; startX: number; startY: number; start: Crop } | null>(null);
  const imageRatio = width / Math.max(1, height);

  function applyRatio(r: number | null, from: Crop = crop) {
    setRatio(r);
    if (!r) return;
    // r is width/height in pixels; in 0..1 units that's w/h = r / imageRatio.
    const unit = r / imageRatio;
    let w = from.w;
    let h = w / unit;
    if (h > 1) {
      h = 1;
      w = h * unit;
    }
    const x = clamp(from.x + (from.w - w) / 2, 0, 1 - w);
    const y = clamp(from.y + (from.h - h) / 2, 0, 1 - h);
    setCrop({ x, y, w, h });
  }

  function begin(e: ReactPointerEvent) {
    e.preventDefault();
    const mode = (e.target as HTMLElement).dataset.mode ?? "move";
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current;
    const el = box.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    const s = d.start;
    const min = 0.05;
    if (d.mode === "move") {
      setCrop({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }
    let { x, y, w, h } = s;
    if (d.mode.includes("e")) w = clamp(s.w + dx, min, 1 - s.x);
    if (d.mode.includes("s")) h = clamp(s.h + dy, min, 1 - s.y);
    if (d.mode.includes("w")) {
      x = clamp(s.x + dx, 0, s.x + s.w - min);
      w = s.w + (s.x - x);
    }
    if (d.mode.includes("n")) {
      y = clamp(s.y + dy, 0, s.y + s.h - min);
      h = s.h + (s.y - y);
    }
    if (ratio) {
      const unit = ratio / imageRatio;
      h = w / unit;
      if (y + h > 1) {
        h = 1 - y;
        w = h * unit;
      }
    }
    setCrop({ x, y, w, h });
  }

  const handle = "absolute size-3 border-2 border-white bg-ink";
  const pct = (v: number) => `${v * 100}%`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("cropTitle")}
      closeLabel={tc("close")}
      footer={
        <>
          <Button variant="ghost" onClick={onReset} disabled={busy}>
            {t("cropReset")}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button icon="crop" onClick={() => onSave(crop)} disabled={busy}>
            {busy ? t("saving") : t("cropSave")}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13px]">{t("cropHelp")}</p>
      <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("cropTitle")}>
        {RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={ratio === r.value}
            onClick={() => applyRatio(r.value)}
            className={cx(
              "rounded-pill px-3 py-1 text-[12px] font-semibold",
              ratio === r.value ? "bg-secondary-container text-on-secondary-container" : "border-line bg-paper text-ink border",
            )}
          >
            {r.id === "free" ? t("cropFree") : r.id}
          </button>
        ))}
      </div>
      <div
        ref={box}
        dir="ltr"
        className="relative mx-auto touch-none select-none"
        style={{ aspectRatio: `${width} / ${height}`, maxHeight: "55vh" }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="h-full w-full" />
        <div
          className="bg-ink/50 absolute inset-0"
          style={{
            clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(crop.x)} ${pct(crop.y)},${pct(crop.x)} ${pct(crop.y + crop.h)},${pct(crop.x + crop.w)} ${pct(crop.y + crop.h)},${pct(crop.x + crop.w)} ${pct(crop.y)},${pct(crop.x)} ${pct(crop.y)})`,
          }}
        />
        <div
          role="presentation"
          className="outline-ink absolute cursor-move border-2 border-white outline outline-1"
          style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
          onPointerDown={begin}
        >
          <span className={cx(handle, "-start-1.5 -top-1.5 cursor-nwse-resize")} data-mode="nw" />
          <span className={cx(handle, "-end-1.5 -top-1.5 cursor-nesw-resize")} data-mode="ne" />
          <span className={cx(handle, "-start-1.5 -bottom-1.5 cursor-nesw-resize")} data-mode="sw" />
          <span className={cx(handle, "-end-1.5 -bottom-1.5 cursor-nwse-resize")} data-mode="se" />
        </div>
      </div>
    </Modal>
  );
}
