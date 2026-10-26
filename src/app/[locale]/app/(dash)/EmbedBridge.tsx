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

/** Round 18: Settings tells the editor around it what changed (language, social links, CV), so the
 *  editor shows it at once and never saves an older copy over it. Outside the editor it does nothing. */
export function tellEditor(changed: { language?: "en" | "ar"; social?: Array<{ network: string; url: string }>; cvMediaId?: string | null }) {
  if (window.top === window.self) return;
  window.parent.postMessage({ fannan: "changed", ...changed }, window.location.origin);
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
      // A link to one of the editor's own panels (Settings → "Change in Design") just opens that panel.
      const panel = url.searchParams.get("panel");
      if (panel && /^(\/ar)?\/editor\/?$/.test(url.pathname)) {
        e.preventDefault();
        window.parent.postMessage({ fannan: "open", panel, detail: url.searchParams.get("detail") }, window.location.origin);
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
