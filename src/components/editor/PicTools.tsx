"use client";

// Round 13: pictures straight on the canvas (like Carbonmade).
// - Drop files from the computer onto any picture to put them there; onto an Images section to add them all;
//   anywhere else to get a new picture section.
// - Hovering a picture shows Replace and Crop.
// Pictures on the canvas carry data-pic="blockId|path" (SiteRender / FreeEditor); this file only reads that.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { imageSources, type MediaLike } from "@/lib/media";
import type { Crop } from "@/lib/site/types";
import { IMAGE_ACCEPT, uploadFile, type Uploaded } from "./upload";

const PICTURE = /\.(jpe?g|png|gif|webp|svg)$/i;

/** "blockId|path"; path is "mediaId", "items.3.mediaId", "#freeItemId" or "+" (add to an Images section). */
export type PicTarget = string;

type Box = { top: number; left: number; width: number; height: number };
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

export function PicTools({
  root,
  media,
  onUploaded,
  onPlace,
  onLoose,
  cropOf,
  onCrop,
  disabled,
}: {
  /** The canvas element to watch. */
  root: React.RefObject<HTMLElement | null>;
  media: Record<string, MediaLike>;
  onUploaded: (m: Uploaded) => void;
  /** Put these new pictures at the target (several only for "+"). */
  onPlace: (target: PicTarget, ids: string[]) => void;
  /** Files dropped where no picture is: blockId is the section under the pointer, if any. */
  onLoose: (ids: string[], nearBlockId: string | null) => void;
  cropOf: (target: PicTarget) => { mediaId: string | null; crop?: Crop } | null;
  onCrop: (target: PicTarget, crop: Crop | undefined) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("editor.pic");
  const [hover, setHover] = useState<{ target: PicTarget; box: Box } | null>(null);
  const [drop, setDrop] = useState<{ target: PicTarget | null; box: Box | null } | null>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState(false);
  const [crop, setCrop] = useState<{ target: PicTarget; ratio: number } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<PicTarget | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);

  async function upload(files: File[]): Promise<string[]> {
    const pics = files.filter((f) => PICTURE.test(f.name) || f.type.startsWith("image/"));
    if (!pics.length) return [];
    setError(false);
    setBusy({ done: 0, total: pics.length });
    const ids: string[] = [];
    for (const f of pics) {
      const r = await uploadFile("_library", f);
      if (r.ok) {
        onUploaded(r.media);
        ids.push(r.media.id);
      } else setError(true);
      setBusy((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    setBusy(null);
    return ids;
  }

  // Where a drop at this point would go: a single picture, or the Images section around it for several.
  function targetAt(el: Element | null, many: boolean): HTMLElement | null {
    const pic = el?.closest<HTMLElement>("[data-pic]") ?? null;
    if (!pic) return null;
    if (many) return pic.closest<HTMLElement>('[data-pic$="|+"]') ?? pic;
    return pic;
  }

  useEffect(() => {
    const el = root.current;
    if (!el || disabled) return;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
      const many = (e.dataTransfer?.items?.length ?? 1) > 1;
      const tg = targetAt(e.target as Element, many);
      setHover(null);
      setDrop({ target: tg?.dataset.pic ?? null, box: tg ? boxOf(tg) : null });
    };
    const onLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node)) setDrop(null);
    };
    const onDrop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const files = [...(e.dataTransfer?.files ?? [])];
      const tg = targetAt(e.target as Element, files.length > 1);
      const near = (e.target as Element)?.closest<HTMLElement>("[data-block-id]")?.dataset.blockId ?? null;
      setDrop(null);
      const ids = await upload(files);
      if (!ids.length) return;
      const target = tg?.dataset.pic;
      if (target && (target.endsWith("|+") || ids.length === 1)) onPlace(target, ids);
      else if (target) {
        // Several files on one picture: the first goes there, the rest after it as a new section.
        onPlace(target, ids.slice(0, 1));
        if (ids.length > 1) onLoose(ids.slice(1), near);
      } else onLoose(ids, near);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return setHover(null);
      if (toolbar.current?.contains(e.target as Node)) return;
      const pic = (e.target as Element)?.closest<HTMLElement>("[data-pic]");
      const target = pic?.dataset.pic;
      if (!pic || !target || target.endsWith("|+")) return setHover(null);
      setHover((h) => (h?.target === target ? { target, box: boxOf(pic) } : { target, box: boxOf(pic) }));
    };
    const onOut = (e: PointerEvent) => {
      if (!el.contains(e.relatedTarget as Node) && !toolbar.current?.contains(e.relatedTarget as Node)) setHover(null);
    };
    const onScroll = () => setHover(null);
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop, true);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerout", onOut);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop, true);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", onScroll, true);
    };
    // Re-attached each render so the handlers see the latest props.
  });

  const info = hover ? cropOf(hover.target) : null;
  const btn =
    "bg-ink/85 hover:bg-ink flex size-9 items-center justify-center rounded-full text-white shadow-[0_2px_10px_rgba(0,0,0,.25)] backdrop-blur";

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <input
        ref={file}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        data-testid="pic-replace-input"
        onChange={async (e) => {
          const f = [...(e.target.files ?? [])];
          e.target.value = "";
          const target = replaceFor.current;
          if (!target || !f.length) return;
          const ids = await upload(f);
          if (ids.length) onPlace(target, target.endsWith("|+") ? ids : ids.slice(0, 1));
        }}
      />
      {hover && !drop && !busy && (
        <div
          ref={toolbar}
          className="fixed z-[45] flex gap-1.5"
          style={{ top: hover.box.top + 10, left: hover.box.left + hover.box.width - 10, transform: "translateX(-100%)" }}
          data-testid="pic-tools"
          onPointerLeave={(e) => {
            if (!root.current?.contains(e.relatedTarget as Node)) setHover(null);
          }}
        >
          <button
            type="button"
            className={btn}
            title={t("replace")}
            aria-label={t("replace")}
            data-testid="pic-replace"
            onClick={() => {
              replaceFor.current = hover.target;
              file.current?.click();
            }}
          >
            <Icon name="upload" size={18} />
          </button>
          {info?.mediaId && (
            <button
              type="button"
              className={btn}
              title={t("crop")}
              aria-label={t("crop")}
              data-testid="pic-crop"
              onClick={() => setCrop({ target: hover.target, ratio: hover.box.width / Math.max(1, hover.box.height) })}
            >
              <Icon name="crop" size={18} />
            </button>
          )}
        </div>
      )}
      {drop && (
        <div className="pointer-events-none fixed inset-0 z-[45]" data-testid="pic-drop">
          {drop.box ? (
            <div
              className="border-lime bg-ink/40 absolute flex items-center justify-center rounded-[6px] border-[3px]"
              style={{ top: drop.box.top, left: drop.box.left, width: drop.box.width, height: drop.box.height }}
            >
              <span className="bg-lime text-on-lime flex items-center gap-2 rounded-pill px-4 py-2 text-[14px] font-semibold">
                <Icon name="upload" size={18} />
                {t("dropToUpload")}
              </span>
            </div>
          ) : (
            <span className="bg-ink absolute start-1/2 bottom-8 flex -translate-x-1/2 items-center gap-2 rounded-pill px-4 py-2 text-[14px] font-semibold text-white rtl:translate-x-1/2">
              <Icon name="upload" size={18} />
              {t("dropToUpload")}
            </span>
          )}
        </div>
      )}
      {(busy || error) && (
        <div
          role="status"
          className={cx(
            "fixed start-1/2 bottom-8 z-[46] flex -translate-x-1/2 items-center gap-3 rounded-pill px-4 py-2 text-[14px] font-semibold text-white rtl:translate-x-1/2",
            "bg-ink",
          )}
          data-testid="pic-status"
          onClick={() => setError(false)}
        >
          {busy ? (
            <>
              <Ring value={busy.done / busy.total} />
              {t("uploading")} {busy.total > 1 && `${busy.done}/${busy.total}`}
            </>
          ) : (
            t("uploadFailed")
          )}
        </div>
      )}
      {crop &&
        (() => {
          const c = cropOf(crop.target);
          const m = c?.mediaId ? media[c.mediaId] : null;
          const src = m ? imageSources(m, 1600, "/api/media/")?.src : null;
          if (!src) return null;
          return (
            <CropDialog
              src={src}
              ratio={crop.ratio}
              value={c?.crop}
              onClose={() => setCrop(null)}
              onDone={(v) => {
                onCrop(crop.target, v);
                setCrop(null);
              }}
            />
          );
        })()}
    </>,
    document.body,
  );
}

function Ring({ value }: { value: number }) {
  const c = 2 * Math.PI * 8;
  return (
    <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="#C6F432" strokeWidth="3" strokeDasharray={`${c * Math.max(0.06, value)} ${c}`} />
    </svg>
  );
}

/** Choose what part of a picture shows: drag to move, slider to zoom. Saves {x, y, zoom}; the file is untouched. */
export function CropDialog({
  src,
  ratio,
  value,
  onClose,
  onDone,
}: {
  src: string;
  ratio: number;
  value?: Crop;
  onClose: () => void;
  onDone: (c: Crop | undefined) => void;
}) {
  const t = useTranslations("editor.pic");
  const ref = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [c, setC] = useState<Crop>(value ?? { x: 50, y: 50, zoom: 1 });
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const r = Math.min(3, Math.max(0.33, ratio || 1));
  // Fit the frame inside the dialog whatever the shape.
  const w = r >= 1 ? 560 : Math.round(420 * r);
  const h = Math.round(w / r);
  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, c };
    const move = (ev: PointerEvent) => {
      const f = frame.current?.getBoundingClientRect();
      if (!f) return;
      const k = 100 / start.c.zoom;
      setC({
        ...start.c,
        x: Math.round(Math.min(100, Math.max(0, start.c.x - ((ev.clientX - start.x) / f.width) * k))),
        y: Math.round(Math.min(100, Math.max(0, start.c.y - ((ev.clientY - start.y) / f.height) * k))),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    setC((v) => ({ ...v, x: Math.min(100, Math.max(0, v.x + d[0])), y: Math.min(100, Math.max(0, v.y + d[1])) }));
  };
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={t("cropTitle")}
      className="bg-paper text-ink shadow-float backdrop:bg-ink/50 m-auto max-w-[calc(100vw-32px)] rounded-[28px] p-0"
      data-testid="crop-dialog"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 className="font-heading text-[20px] font-semibold">{t("cropTitle")}</h2>
        <div
          ref={frame}
          tabIndex={0}
          role="slider"
          aria-label={t("dragHint")}
          aria-valuenow={c.x}
          aria-valuetext={`${c.x}%, ${c.y}%`}
          onPointerDown={drag}
          onKeyDown={key}
          className="bg-mist relative mx-auto cursor-grab touch-none overflow-hidden rounded-[12px] select-none active:cursor-grabbing"
          style={{ width: w, height: h, maxWidth: "100%" }}
          data-testid="crop-frame"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none block h-full w-full object-cover"
            style={{ objectPosition: `${c.x}% ${c.y}%`, transform: `scale(${c.zoom})`, transformOrigin: `${c.x}% ${c.y}%` }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="border border-white/30" />
            ))}
          </div>
        </div>
        <p className="text-muted text-center text-[13px]">{t("dragHint")}</p>
        <label className="flex items-center gap-3 text-[13px] font-semibold">
          {t("zoom")}
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={c.zoom}
            onChange={(e) => setC({ ...c, zoom: Number(e.target.value) })}
            className="accent-ink flex-1"
            data-testid="crop-zoom"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="hover:bg-mist me-auto rounded-pill px-4 py-2 text-[14px] font-semibold" onClick={() => setC({ x: 50, y: 50, zoom: 1 })}>
            {t("reset")}
          </button>
          <button type="button" className="border-line hover:bg-mist rounded-pill border px-4 py-2 text-[14px] font-semibold" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="bg-primary rounded-pill px-5 py-2 text-[14px] font-semibold text-white"
            data-testid="crop-done"
            onClick={() => onDone(c.x === 50 && c.y === 50 && c.zoom === 1 ? undefined : c)}
          >
            {t("done")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
