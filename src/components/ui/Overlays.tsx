"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { IconButton } from "./Button";

/* ---------- Modal: native <dialog>, 22px corners, floats so it gets the shadow ---------- */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, closeLabel, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      className="bg-paper text-ink shadow-float backdrop:bg-ink/40 m-auto w-[min(480px,calc(100vw-32px))] rounded-lg p-0"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-heading font-heading-weight text-[22px] leading-tight">
            {title}
          </h2>
          <IconButton icon="close" label={closeLabel} variant="ghost" size="sm" onClick={onClose} />
        </div>
        <div className="text-ink-soft text-[14px]">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}

/* ---------- Popover / menu: anchored under its trigger, closes on outside click or Escape ---------- */

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}

export function Popover({ trigger, children, align = "start", className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div
          id={id}
          className={cx(
            "bg-paper shadow-float absolute top-[calc(100%+8px)] z-20 min-w-[220px] rounded-lg p-2",
            align === "start" ? "start-0" : "end-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-mist flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-start text-[14px] font-medium"
    >
      {children}
    </button>
  );
}
