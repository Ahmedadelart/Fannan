// The editor's own clipboard (Ctrl+C / Ctrl+X / Ctrl+V): a whole section, or items from a free-form
// section. It lives for the session, so things can be copied from one page and pasted on another.
import type { Block, FreeItem } from "@/lib/site/types";

export type Clip = { kind: "section"; block: Block } | { kind: "items"; items: FreeItem[] } | null;

let clip: Clip = null;

export const getClip = () => clip;
export const setClip = (c: Clip) => {
  clip = c ? structuredClone(c) : null;
};

/** True for Ctrl (Windows) or Cmd (Mac) shortcuts. */
export const mod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

/** Typing in a field or in text on the page: shortcuts leave the keys alone. */
export const typing = (e: KeyboardEvent) =>
  !!(e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]");
