import { cx } from "@/lib/cx";

// BRAND.md §1. The stroke sits behind "fannan" only, never behind ".net".
// Arabic: فنان in Marhey 700, stroke mirrored (handled by the [dir=rtl] tokens).
// Built from live fonts until the final vector logo is drawn (AHMED-TODO, phase 7).

interface LogoProps {
  /** "en" = fannan.net, "ar" = فنان */
  lang?: "en" | "ar";
  /** Hide ".net" in tight spaces. */
  short?: boolean;
  /** Font size in px. Minimum width on screen is 96px. */
  size?: number;
  /** On a lime ground the stroke turns white (BRAND.md §1 "On lime"). */
  onLime?: boolean;
  className?: string;
}

export function Logo({ lang = "en", short, size = 28, onLime, className }: LogoProps) {
  const stroke = onLime ? "[--hl-color:var(--color-white)]" : undefined;
  if (lang === "ar") {
    return (
      <span
        dir="rtl"
        lang="ar"
        className={cx("font-arabic text-ink inline-flex leading-[1.25] font-bold", className)}
        style={{ fontSize: size }}
        aria-label="فنان"
      >
        <span className="relative inline-block">
          <span aria-hidden className={cx("hl-stroke", stroke)} />
          <span className="relative">فنان</span>
        </span>
      </span>
    );
  }
  return (
    <span
      dir="ltr"
      lang="en"
      className={cx("font-display text-ink inline-flex leading-[1.1] font-extrabold tracking-[-0.03em]", className)}
      style={{ fontSize: size }}
      aria-label={short ? "fannan" : "fannan.net"}
    >
      <span
        className="relative inline-block"
        style={{ ["--hl-skew" as string]: "-14deg", ["--hl-rotate" as string]: "-1.5deg" }}
      >
        <span
          aria-hidden
          className={cx("hl-stroke", stroke)}
          style={{ insetInlineStart: "-0.18em", insetInlineEnd: "-0.09em" }}
        />
        <span className="relative">fannan</span>
      </span>
      {!short && <span>.net</span>}
    </span>
  );
}
