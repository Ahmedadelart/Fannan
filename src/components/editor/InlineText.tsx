"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ElementType } from "react";

// Text on the editor canvas that the artist edits in place (click and type). The page shows the
// text as it will look on the live site. React never renders the text itself: the browser owns it
// while typing, and it's written in only when the field isn't being edited (undo, other panels).

export function InlineText({
  as: Tag = "span",
  value,
  onChange,
  placeholder,
  multiline,
  className,
  style,
}: {
  as?: ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== value) el.textContent = value;
  }, [value]);

  const read = () => {
    const text = (ref.current?.innerText ?? "").replace(/ /g, " ");
    return multiline ? text.replace(/\n$/, "") : text.replace(/\n/g, " ");
  };

  return (
    <Tag
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline={multiline || undefined}
      aria-placeholder={placeholder}
      data-inline-text
      data-placeholder={placeholder}
      className={className}
      style={{ cursor: "text", ...(multiline ? { whiteSpace: "pre-line" } : {}), ...style }}
      onInput={() => onChange(read())}
      onBlur={() => {
        const text = read();
        if (text !== value) onChange(text);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
        }
        if (e.key === "Escape") ref.current?.blur();
      }}
      // Links in the preview (nav, buttons) never navigate while editing.
      onClick={(e: React.MouseEvent) => e.preventDefault()}
    />
  );
}
