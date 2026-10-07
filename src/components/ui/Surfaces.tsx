import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { buttonClasses } from "./Button";
import { ActiveIcon, Icon, type IconName } from "./Icon";

/** White card with a 1px line and 22px corners. No shadow: cards don't float. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("border-line bg-paper flex flex-col gap-3 rounded-lg border p-5", className)}>{children}</div>
  );
}

/** Heading inside a card. Follows the page language (Bricolage / Marhey). */
export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-heading font-heading-weight text-[18px] leading-tight">{children}</h3>;
}

/**
 * Block tile from the editor's Blocks panel: 24px icon + label, 52px tall.
 * Selected: 2px ink outline and the icon on a lime tile.
 */
export function Tile({
  icon,
  label,
  selected,
  badge,
  onClick,
}: {
  icon: IconName;
  label: ReactNode;
  selected?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "flex h-[52px] w-full items-center gap-2.5 rounded-md px-3 text-start text-[13px] font-semibold transition-colors",
        selected ? "border-ink bg-mist border-2 px-[11px]" : "border-line bg-paper hover:bg-mist border",
      )}
    >
      {selected ? <ActiveIcon name={icon} size={24} /> : <Icon name={icon} size={24} />}
      <span className="flex-1">{label}</span>
      {badge}
    </button>
  );
}

/** Sidebar navigation item. The active one gets a lime tile behind its icon. */
export function NavItem({
  icon,
  label,
  active,
  href,
}: {
  icon: IconName;
  label: ReactNode;
  active?: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-[42px] items-center gap-3 rounded-[10px] px-2.5 text-[14px] font-semibold transition-colors",
        active ? "bg-paper text-ink" : "text-ink-soft hover:bg-paper/60 hover:text-ink",
      )}
    >
      {active ? (
        <ActiveIcon name={icon} />
      ) : (
        <span className="flex p-1">
          <Icon name={icon} />
        </span>
      )}
      {label}
    </a>
  );
}

/** Empty state: a 40px icon on a lime tile, one line pointing to the next step, one lime button. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: IconName;
  title: ReactNode;
  text: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="border-line-strong flex flex-col items-center gap-2.5 rounded-lg border-2 border-dashed px-4 py-6 text-center">
      <span className="bg-lime text-ink flex flex-none rounded-[14px] p-3">
        <Icon name={icon} size={40} />
      </span>
      <h3 className="font-heading font-heading-weight text-[20px] leading-tight">{title}</h3>
      <p className="text-ink-soft max-w-[260px] text-[13px]">{text}</p>
      {action && (
        <button type="button" onClick={onAction} className={buttonClasses("lime", "md")}>
          {action}
        </button>
      )}
    </div>
  );
}

/** A label in small caps style: "DESIGN LANGUAGE". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-muted text-[12px] font-semibold tracking-[0.08em] uppercase">{children}</div>;
}

/** Text with the slanted lime stroke behind it. Page titles, one or two words. */
export function Highlight({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block">
      <span aria-hidden className="hl-stroke" />
      <span className="relative">{children}</span>
    </span>
  );
}
