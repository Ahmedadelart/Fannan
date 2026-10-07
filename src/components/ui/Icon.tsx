import { cx } from "@/lib/cx";
import { iconBodies, type IconName } from "./icons.generated";

export type { IconName };
export const iconNames = Object.keys(iconBodies) as IconName[];

// Icons that point somewhere get flipped in Arabic. Objects (image, reel, lock, globe) don't.
const DIRECTIONAL = new Set<IconName>(["undo", "redo", "publish"]);

export type IconSize = 12 | 16 | 18 | 20 | 24 | 40;

interface IconProps {
  name: IconName;
  size?: IconSize;
  /** Give a label only when the icon stands alone and carries meaning. */
  label?: string;
  className?: string;
}

/** Renders one of the SVGs in design/icons/. Colour follows the text colour. */
export function Icon({ name, size = 20, label, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={cx("block flex-none overflow-visible", DIRECTIONAL.has(name) && "rtl-mirror", className)}
      dangerouslySetInnerHTML={{ __html: iconBodies[name] }}
    />
  );
}

/** An icon on a lime tile: the "active" state from ICONS.md. */
export function ActiveIcon({ name, size = 20 }: { name: IconName; size?: IconSize }) {
  return (
    <span className="bg-lime text-ink flex flex-none rounded-sm p-1">
      <Icon name={name} size={size} />
    </span>
  );
}
