"use client";

import { useState, type ReactNode } from "react";

/** "This project contains mature artwork. View?" — the artist's optional courtesy click-through. */
export function MatureGate({ text, button, children }: { text: string; button: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 p-12 text-center"
      style={{ background: "var(--site-surface)", borderRadius: "calc(var(--site-radius) * 2)", minHeight: 280 }}
    >
      <p className="m-0 max-w-[420px] text-[18px]">{text}</p>
      <button
        type="button"
        className="site-button border-0"
        style={{ cursor: "pointer", font: "inherit", fontWeight: 600 }}
        onClick={() => setOpen(true)}
      >
        {button}
      </button>
    </div>
  );
}
