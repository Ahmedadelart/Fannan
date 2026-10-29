import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

// fannan.net's pieces (round 20, design/MARKETING.md): bands, pills, the lime marker, the squiggle
// ribbon, sticker frames, wavy edges and badges. Server components; no state anywhere.

export type Tone = "ink" | "surface" | "mist" | "lime" | "paper" | "sage" | "peach";

const TONES: Record<Tone, string> = {
  ink: "bg-ink text-paper",
  surface: "bg-surface text-ink",
  mist: "bg-mist text-ink",
  lime: "bg-lime text-on-lime",
  paper: "bg-paper text-ink",
  sage: "bg-secondary-container text-on-secondary-container",
  peach: "bg-tertiary-container text-on-tertiary-container",
};
const FILLS: Record<Tone, string> = {
  ink: "text-ink",
  surface: "text-surface",
  mist: "text-mist",
  lime: "text-lime",
  paper: "text-paper",
  sage: "text-secondary-container",
  peach: "text-tertiary-container",
};

/** The 1280 px column with Talabat's 24 px gutters (32 on wide screens). */
export function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[1328px] px-6 md:px-8", className)}>{children}</div>;
}

/** An uneven edge, drawn in the band's own colour so it eats into the neighbour above or below. */
export function Wave({ tone, flip, className }: { tone: Tone; flip?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1512 10"
      preserveAspectRatio="none"
      className={cx("block h-[12px] w-full md:h-[16px]", FILLS[tone], flip && "rotate-180", className)}
    >
      <path
        fill="currentColor"
        d="M0 10V5.2C96 2.4 214 7.6 356 4.8 498 2 612 .6 744 3.4c132 2.8 236 6.2 372 3.4C1252 4 1360 1.2 1512 5.6V10H0Z"
      />
    </svg>
  );
}

/** A full-width band in one tone. `wave` gives it Talabat's uneven top and/or bottom edge. */
export function Band({
  tone,
  wave,
  id,
  className,
  children,
  label,
}: {
  tone: Tone;
  wave?: "top" | "bottom" | "both";
  id?: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <section id={id} aria-label={label} className={cx("relative", id && "scroll-mt-4")}>
      {(wave === "top" || wave === "both") && <Wave tone={tone} className="-mb-px" />}
      <div className={cx(TONES[tone], className)}>{children}</div>
      {(wave === "bottom" || wave === "both") && <Wave tone={tone} flip className="-mt-px" />}
    </section>
  );
}

/** Pill buttons: lime is the one action on a page, ink the quieter one, paper on a dark band. */
export function Pill({
  tone = "lime",
  size = "md",
  href,
  children,
  className,
  type,
  disabled,
  ...rest
}: {
  tone?: "lime" | "ink" | "paper" | "outline" | "outline-paper";
  size?: "md" | "sm";
  href?: string;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  lang?: string;
  hrefLang?: string;
  dir?: "ltr" | "rtl";
  "data-testid"?: string;
}) {
  const cls = cx(
    "mk-pill inline-flex items-center justify-center gap-2 rounded-pill font-bold whitespace-nowrap transition-[transform,filter,background-color] duration-200 select-none",
    size === "md" ? "h-14 px-7 text-[18px]" : "h-11 px-5 text-[15px]",
    tone === "lime" && "bg-lime text-on-lime hover:brightness-95",
    tone === "ink" && "bg-ink text-paper hover:brightness-125",
    tone === "paper" && "bg-paper text-ink hover:bg-mist",
    tone === "outline" && "border-2 border-ink text-ink hover:bg-ink hover:text-paper",
    tone === "outline-paper" && "border-2 border-paper/70 text-paper hover:bg-paper hover:text-ink",
    "hover:-translate-y-px active:translate-y-0",
    disabled && "pointer-events-none opacity-50",
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

/** The marker: a lime box cut like the brand's chisel stroke, with ink words on it. */
export function Marker({ children }: { children: ReactNode }) {
  return <span className="mk-marker">{children}</span>;
}

/** A lime sticker badge ("Illustrator", "Best value"). */
export function Badge({
  children,
  tone = "lime",
  className,
}: {
  children: ReactNode;
  tone?: "lime" | "paper" | "ink";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "rounded-pill inline-flex h-9 items-center px-4 text-[14px] font-bold whitespace-nowrap",
        tone === "lime" && "bg-lime text-on-lime",
        tone === "paper" && "bg-paper text-ink",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A display heading with the lime ribbon running behind it, like Talabat's orange squiggle. */
export function Squiggle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <svg
        aria-hidden
        viewBox="0 0 1512 600"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-[-10vw] top-1/2 h-[170%] w-[120vw] -translate-y-1/2 rtl:-scale-x-100"
      >
        <path
          d="M-60 70C160 50 300 60 420 130S640 330 860 350s330-70 460-40 220 90 320 110"
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

/** A photo (here: a real site) cut in a soft, slightly irregular shape with a thick outline, tilted. */
export function Sticker({
  children,
  outline = "ink",
  tilt = -3,
  className,
  style,
}: {
  children: ReactNode;
  outline?: "ink" | "paper";
  tilt?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("mk-sticker", outline === "paper" ? "border-paper" : "border-ink", className)}
      style={{ ["--mk-tilt" as string]: `${tilt}deg`, ...style }}
    >
      {children}
    </div>
  );
}

/** One word with a hand-drawn ring around it (the CTA card). */
export function Circled({ children, stroke = "paper" }: { children: ReactNode; stroke?: "paper" | "ink" | "lime" }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <svg
        aria-hidden
        viewBox="0 0 200 80"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -inset-x-[8%] -inset-y-[22%] h-[144%] w-[116%]"
      >
        <path
          d="M28 20C70 2 190 0 196 36c4 28-60 44-120 42S0 60 6 34c4-16 36-24 74-26"
          fill="none"
          stroke={
            stroke === "paper" ? "var(--color-paper)" : stroke === "lime" ? "var(--color-lime)" : "var(--color-ink)"
          }
          strokeWidth="5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** Talabat's two-column intro: a title, then the words in two columns, set in from the start. */
export function Intro({
  title,
  columns,
  cta,
  inset = true,
  className,
}: {
  title: ReactNode;
  columns: ReactNode[];
  cta?: ReactNode;
  inset?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-7", inset && "md:ms-[12.5%]", className)}>
      <h2 className="mk-title m-0 text-[clamp(28px,3.2vw,36px)]">{title}</h2>
      <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
        {columns.map((c, i) => (
          <p key={i} className="m-0 max-w-[42ch] text-[17px] leading-[1.6] opacity-90">
            {c}
          </p>
        ))}
      </div>
      {cta && <div>{cta}</div>}
    </div>
  );
}

/** A section heading with a short line beside it, like Talabat's "What we bring to the table". */
export function SectionHead({ title, line, className }: { title: ReactNode; line?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-10 flex flex-col gap-3", className)}>
      <h2 className="mk-title m-0 text-[clamp(28px,3.2vw,36px)]">{title}</h2>
      {line && <p className="m-0 max-w-[60ch] text-[17px] leading-[1.6] opacity-90">{line}</p>}
    </div>
  );
}

/** A rounded tile: 40 px corners like Talabat's photos and numbers. */
export function Tile({
  tone = "paper",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx("rounded-[28px] md:rounded-[40px]", TONES[tone], className)}>{children}</div>;
}
