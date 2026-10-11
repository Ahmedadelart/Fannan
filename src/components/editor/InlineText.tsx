"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ElementType } from "react";
import { editableHtml, sanitizeRich } from "@/lib/site/richtext";

// Text on the editor canvas that the artist edits in place (click and type). The page shows the
// text as it will look on the live site. React never renders the text itself: the browser owns it
// while typing, and it's written in only when the field isn't being edited (undo, other panels).
// Round 13: "rich" fields also take per-word formatting from the text toolbar (TextToolbar.tsx);
// what the browser produces is cleaned to the allowlist in lib/site/richtext.ts on every change.

export function InlineText({
  as: Tag = "span",
  value,
  onChange,
  placeholder,
  multiline,
  rich,
  className,
  style,
}: {
  as?: ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  rich?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  const read = () => {
    const el = ref.current;
    if (!el) return "";
    if (rich) {
      const v = sanitizeRich(el.innerHTML.replace(/&nbsp;| /g, " "));
      return multiline ? v.replace(/\n$/, "") : v.replace(/<br>/g, " ").replace(/\n/g, " ");
    }
    const text = (el.innerText ?? "").replace(/ /g, " ");
    return multiline ? text.replace(/\n$/, "") : text.replace(/\n/g, " ");
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (rich) {
      if (read() !== value) el.innerHTML = editableHtml(value);
    } else if (el.innerText !== value) el.textContent = value;
    // read() only looks at the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rich]);

  return (
    <Tag
      ref={ref}
      contentEditable={rich ? "true" : "plaintext-only"}
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline={multiline || undefined}
      aria-placeholder={placeholder}
      data-inline-text
      data-rich={rich || undefined}
      data-placeholder={placeholder}
      className={className}
      style={{ cursor: "text", ...(multiline && !rich ? { whiteSpace: "pre-line" } : {}), ...style }}
      onInput={() => onChange(read())}
      onBlur={() => {
        const text = read();
        if (text !== value) onChange(text);
      }}
      onPaste={
        rich
          ? (e: React.ClipboardEvent) => {
              // Pasted text comes in as plain words; formatting is added with the toolbar.
              e.preventDefault();
              const t = e.clipboardData.getData("text/plain");
              document.execCommand("insertText", false, multiline ? t : t.replace(/\s*\n\s*/g, " "));
            }
          : undefined
      }
      onDrop={
        rich
          ? (e: React.DragEvent) => {
              // Dragged-in text arrives as plain words too (files are handled by the picture tools).
              const t = e.dataTransfer.getData("text/plain");
              e.preventDefault();
              if (t) document.execCommand("insertText", false, multiline ? t : t.replace(/\s+/g, " "));
            }
          : undefined
      }
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          if (!multiline) {
            e.preventDefault();
            ref.current?.blur();
          } else if (rich) {
            e.preventDefault();
            document.execCommand("insertLineBreak");
          }
        }
        if (e.key === "Escape") ref.current?.blur();
      }}
      // Links in the preview (nav, buttons) never navigate while editing.
      onClick={(e: React.MouseEvent) => e.preventDefault()}
    />
  );
}
