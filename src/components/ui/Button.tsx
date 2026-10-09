import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "./Icon";

// Material 3 buttons (round 4, stage C): primary = filled (the main action, one per view) ·
// lime = filled tonal in the brand colour (upload, upgrade, hire) · outline = outlined ·
// ghost = text button. Fully rounded; heights 32 / 40 / 44.

export type ButtonVariant = "primary" | "lime" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:shadow-[0_1px_3px_1px_rgba(26,28,22,.15),0_1px_2px_rgba(26,28,22,.3)] hover:brightness-110",
  lime: "bg-lime text-on-lime hover:brightness-95 hover:shadow-[0_1px_3px_1px_rgba(26,28,22,.15)]",
  outline: "bg-transparent text-primary border border-outline hover:bg-primary/8",
  ghost: "text-primary hover:bg-primary/8",
};

const sizes: Record<ButtonSize, { box: string; icon: 16 | 18 }> = {
  sm: { box: "h-8 px-3.5 text-[13px]", icon: 16 },
  md: { box: "h-10 px-5 text-[14px]", icon: 18 },
  lg: { box: "h-11 px-6 text-[15px]", icon: 18 },
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cx(
    "inline-flex flex-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-40",
    variants[variant],
    sizes[size].box,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx(buttonClasses(variant, size), className)} {...rest}>
      {icon && <Icon name={icon} size={sizes[size].icon} />}
      {children}
    </button>
  );
}

export type IconButtonVariant = "outline" | "mist" | "ghost" | "active";

const iconButtonVariants: Record<IconButtonVariant, string> = {
  outline: "border border-line bg-paper text-ink-soft hover:bg-mist",
  mist: "bg-mist text-ink-soft hover:bg-surface-high",
  ghost: "text-ink-soft hover:bg-ink/8",
  active: "bg-lime text-on-lime",
};

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Spoken name of the button; also shown as a tooltip. */
  label: string;
  variant?: IconButtonVariant;
  size?: "sm" | "md";
}

/** Square icon-only button, 40 × 40 (32 × 32 small). */
export function IconButton({
  icon,
  label,
  variant = "outline",
  size = "md",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex flex-none items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "md" ? "size-10" : "size-8",
        iconButtonVariants[variant],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size === "md" ? 20 : 16} />
    </button>
  );
}
