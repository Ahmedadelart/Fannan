"use client";

import { useEffect } from "react";

// Round 4, stage B: the editor is the app. Dashboard pages (home, projects, messages, stats,
// settings, Pro) open inside the editor's wide panel. There they drop their own sidebar (the
// html[data-embed] flag, set before paint by the script in the layout), and links that belong to
// the whole window (the editor, sign-up, checkout, admin) open there instead of inside the panel.

const TOP = [/^\/$/, /^\/editor/, /^\/signup/, /^\/login/, /^\/admin/, /^\/checkout/, /^\/billing/];

export const EMBED_SCRIPT = "if(window.top!==window.self)document.documentElement.dataset.embed='1'";

/** Sends the whole window somewhere (used for checkout from inside the editor's panel). */
export function goTop(url: string) {
  if (window.top && window.top !== window.self) window.top.location.href = url;
  else window.location.href = url;
}

export function EmbedBridge() {
  useEffect(() => {
    if (window.top === window.self) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) {
        a.target = "_blank";
        a.rel = "noopener";
        return;
      }
      if (TOP.some((r) => r.test(url.pathname))) {
        e.preventDefault();
        goTop(url.href);
      }
    };
    document.addEventListener("click", onClick, true);
    // Tell the editor what's open, so it can refresh the site preview when the panel closes.
    window.parent.postMessage({ fannan: "panel", path: window.location.pathname }, window.location.origin);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
