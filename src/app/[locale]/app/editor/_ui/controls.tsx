"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";

/* ---------- small form pieces (Editor.dc.html right panel) ---------- */

export const inputCls =
  "h-10 w-full rounded-[10px] border border-line bg-paper px-3 text-[14px] font-normal text-ink outline-none focus:border-primary";
export const areaCls =
  "min-h-[96px] w-full resize-y rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px] font-normal text-ink outline-none focus:border-primary";

export function Label({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="text-ink flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      {children}
      {hint && <span className="text-muted font-normal">{hint}</span>}
    </label>
  );
}

export function Text({
  title,
  value,
  onChange,
  dir,
  placeholder,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr";
  placeholder?: string;
}) {
  return (
    <Label title={title}>
      <input
        className={inputCls}
        value={value}
        dir={dir}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Label>
  );
}

export function Area({
  title,
  value,
  onChange,
  hint,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <Label title={title} hint={hint}>
      <textarea className={areaCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </Label>
  );
}

export function Choice<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      <div
        role="radiogroup"
        aria-label={title}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}
      >
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={v === value}
            onClick={() => onChange(v)}
            className={cx(
              "h-9 rounded-[8px] px-2 text-[12px] font-semibold",
              v === value
                ? "bg-secondary-container text-on-secondary-container"
                : "border-line bg-paper text-ink hover:bg-mist border",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Range({
  title,
  value,
  min,
  max,
  unit = "",
  step,
  onChange,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-semibold">
      <span className="flex justify-between">
        {title}
        <span className="text-muted font-normal tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="fannan-range"
        style={{ ["--pct" as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
    </label>
  );
}

export function Switch({
  title,
  checked,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span>{title}</span>
      <Toggle label={title} hideLabel checked={checked} onChange={onChange} />
    </div>
  );
}

export function ColorField({
  title,
  value,
  themeLabel,
  onChange,
}: {
  title: string;
  value: string | null;
  themeLabel: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={cx(
            "h-9 rounded-[8px] px-3 text-[12px] font-semibold",
            value === null
              ? "bg-secondary-container text-on-secondary-container"
              : "border-line bg-paper hover:bg-mist border",
          )}
        >
          {themeLabel}
        </button>
        <input
          type="color"
          aria-label={title}
          value={value ?? "#141414"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="border-line h-9 w-12 cursor-pointer rounded-[8px] border bg-white p-1"
        />
      </div>
    </div>
  );
}

/** Round 18: settings used less often, folded under "More options" (about 8 stay in view). */
export function More({ children, testId = "content-more" }: { children: ReactNode; testId?: string }) {
  const t = useTranslations("editor.design2");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="border-line hover:bg-mist flex h-10 items-center justify-between rounded-[12px] border px-3 text-[13px] font-semibold"
        data-testid={testId}
      >
        {open ? t("fewer") : t("more")}
        <Icon name="chevron-down" size={16} className={cx("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </>
  );
}
