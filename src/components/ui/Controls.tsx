"use client";

import { useId, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

/* ---------- Toggle: ink track, lime knob when on ---------- */

interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label: ReactNode;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
  disabled?: boolean;
}

export function Toggle({ checked, defaultChecked = false, onChange, label, hideLabel, disabled }: ToggleProps) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  const id = useId();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => {
          setInner(!on);
          onChange?.(!on);
        }}
        className={cx(
          "rounded-pill relative h-[26px] w-11 flex-none transition-colors disabled:opacity-40",
          on ? "bg-ink" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute start-[3px] top-[3px] size-5 rounded-full transition-transform",
            on ? "bg-lime translate-x-[18px] rtl:-translate-x-[18px]" : "bg-white",
          )}
        />
      </button>
      <label htmlFor={id} className={cx("cursor-pointer text-[14px] font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
    </span>
  );
}

/* ---------- Checkbox and Radio ---------- */

interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

export function Checkbox({ label, className, ...rest }: CheckProps) {
  return (
    <label className={cx("inline-flex cursor-pointer items-center gap-2.5 text-[14px]", className)}>
      <span className="relative flex size-5 flex-none">
        <input type="checkbox" className="peer absolute inset-0 m-0 cursor-pointer opacity-0" {...rest} />
        <span
          aria-hidden
          className="border-line-strong bg-paper peer-checked:border-ink peer-checked:bg-ink flex size-5 items-center justify-center rounded-sm border-[1.5px] peer-focus-visible:shadow-[0_0_0_2px_var(--color-ink),0_0_0_6px_var(--color-lime)] peer-disabled:opacity-40 peer-checked:[&>svg]:opacity-100"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0"
          >
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </span>
      </span>
      {label}
    </label>
  );
}

export function Radio({ label, className, ...rest }: CheckProps) {
  return (
    <label className={cx("inline-flex cursor-pointer items-center gap-2.5 text-[14px]", className)}>
      <span className="relative flex size-5 flex-none">
        <input type="radio" className="peer absolute inset-0 m-0 cursor-pointer opacity-0" {...rest} />
        <span
          aria-hidden
          className="border-line-strong bg-paper peer-checked:border-ink flex size-5 items-center justify-center rounded-full border-[1.5px] peer-checked:border-2 peer-focus-visible:shadow-[0_0_0_2px_var(--color-ink),0_0_0_6px_var(--color-lime)] peer-disabled:opacity-40 peer-checked:[&>span]:opacity-100"
        >
          <span className="bg-ink size-2 rounded-full opacity-0" />
        </span>
      </span>
      {label}
    </label>
  );
}

/* ---------- Segmented control: one choice from a few, selected is ink ---------- */

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: ReactNode }>;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  /** Spoken name of the group. */
  label: string;
}

export function Segmented<T extends string>({ options, value, defaultValue, onChange, label }: SegmentedProps<T>) {
  const [inner, setInner] = useState<T>(defaultValue ?? options[0].value);
  const current = value ?? inner;
  return (
    <div role="radiogroup" aria-label={label} className="bg-mist inline-flex gap-0.5 self-start rounded-md p-1">
      {options.map((o) => {
        const selected = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              setInner(o.value);
              onChange?.(o.value);
            }}
            className={cx(
              "flex h-8 items-center gap-2 rounded-[8px] px-3.5 text-[13px] font-semibold transition-colors",
              selected ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Slider: ink fill, white knob with an ink ring ---------- */

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: string;
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Shows the value next to the slider with this unit, e.g. "px". */
  unit?: string;
}

export function Slider({ label, min = 0, max = 100, defaultValue = 50, onChange, unit, ...rest }: SliderProps) {
  const [v, setV] = useState(defaultValue);
  const id = useId();
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-ink-soft text-[12px] font-semibold">
          {label}
        </label>
        {unit !== undefined && (
          <span className="text-muted text-[12px] tabular-nums">
            {v}
            {unit}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={v}
        onChange={(e) => {
          setV(Number(e.target.value));
          onChange?.(Number(e.target.value));
        }}
        className="fannan-range"
        style={{ "--pct": `${pct}%` } as CSSProperties}
        {...rest}
      />
    </div>
  );
}
