"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "./Icon";

interface FieldShellProps {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-ink-soft text-[12px] font-semibold">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-ink flex items-center gap-1.5 text-[12px] font-medium">
          <span aria-hidden className="hl-bar h-[5px] w-2.5" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-muted text-[12px]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const boxBase =
  "flex h-10 items-center gap-2 rounded-md border bg-paper px-3 text-[14px] text-ink transition-colors " +
  "focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--color-primary)] has-[:disabled]:bg-mist has-[:disabled]:opacity-60";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  /** Friendly message. Never just "invalid". */
  error?: string;
  icon?: IconName;
  /** Text glued to the end of the input, e.g. ".fannan.net". */
  suffix?: string;
}

export function Input({ label, hint, error, icon, suffix, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      <div className={cx(boxBase, error ? "border-ink border-2 px-[11px]" : "border-line", className)}>
        {icon && <Icon name={icon} size={18} className="text-muted" />}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${inputId}-msg` : undefined}
          className="placeholder:text-muted h-full min-w-0 flex-1 bg-transparent outline-none focus-visible:shadow-none"
          {...rest}
        />
        {suffix && (
          <span dir="ltr" className="text-muted flex-none">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, hint, error, options, id, className, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldShell id={selectId} label={label} hint={hint} error={error}>
      <div className={cx(boxBase, "relative p-0", error ? "border-ink border-2" : "border-line", className)}>
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${selectId}-msg` : undefined}
          className="h-full w-full cursor-pointer appearance-none bg-transparent ps-3 pe-9 outline-none focus-visible:shadow-none"
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={18} className="text-ink pointer-events-none absolute end-3" />
      </div>
    </FieldShell>
  );
}
