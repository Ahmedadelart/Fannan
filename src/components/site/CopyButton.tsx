"use client";

import { useState } from "react";

/** Round 19: copies some text (an email address) to the clipboard; selects it where that isn't allowed. */
export function CopyButton({
  text,
  label,
  done,
  className,
  style,
}: {
  text: string;
  label: string;
  done: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [said, setSaid] = useState("");
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setSaid(done);
        } catch {
          const el = document.querySelector<HTMLElement>(`[data-copy-source="${CSS.escape(text)}"]`);
          if (el) {
            const r = document.createRange();
            r.selectNodeContents(el);
            const sel = getSelection();
            sel?.removeAllRanges();
            sel?.addRange(r);
          }
          setSaid(done);
        }
        setTimeout(() => setSaid(""), 1600);
      }}
    >
      {said || label}
    </button>
  );
}
