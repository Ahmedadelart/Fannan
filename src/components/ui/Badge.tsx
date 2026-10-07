import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./Icon";

// BRAND.md §6 status: Live (white + green dot) · Password (ink) · Draft (lime) · Hidden (mist).

export type BadgeVariant = "live" | "password" | "draft" | "hidden" | "neutral" | "brand" | "pro";

const styles: Record<BadgeVariant, string> = {
  live: "bg-paper border border-line text-ink",
  password: "bg-ink text-white",
  draft: "bg-lime text-ink",
  hidden: "bg-mist text-muted",
  neutral: "bg-line text-ink-soft",
  brand: "bg-lime text-ink",
  pro: "bg-mist text-ink",
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex flex-none items-center gap-[5px] rounded-sm px-2 py-[3px] text-[11px] leading-[16px] font-semibold whitespace-nowrap",
        styles[variant],
      )}
    >
      {variant === "live" && <span aria-hidden className="bg-lime-ink size-[7px] rounded-full" />}
      {variant === "password" && <Icon name="password" size={12} />}
      {variant === "hidden" && <Icon name="hidden" size={12} />}
      {children}
    </span>
  );
}

/** "Available for work": the only pill that's always lime. */
export function AvailablePill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-pill bg-lime text-ink inline-flex h-[34px] flex-none items-center gap-2 ps-2.5 pe-3.5 text-[13px] font-semibold whitespace-nowrap">
      <span aria-hidden className="bg-ink size-2 rounded-full" />
      {children}
    </span>
  );
}

/** Filter chip. The selected one is ink. */
export function Chip({
  selected,
  children,
  onClick,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "rounded-pill px-3 py-1 text-[12px] font-semibold transition-colors",
        selected ? "bg-ink text-white" : "border-line bg-paper text-ink hover:bg-mist border",
      )}
    >
      {children}
    </button>
  );
}
