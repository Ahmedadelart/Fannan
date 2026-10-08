// Drag to reorder (pages in the list, sections on the canvas). Pointer events, so it works with a
// mouse, a pen or a finger; while dragging, a line shows where the item will land.

export interface DropMark {
  /** Position among the other items (the dragged one left out). */
  index: number;
  /** Where to draw the line, in client (viewport) pixels. */
  y: number;
}

export function startSortDrag(
  e: React.PointerEvent,
  opts: {
    dragId: string;
    items: () => Array<{ id: string; el: HTMLElement }>;
    onMark: (mark: DropMark | null) => void;
    onDrop: (index: number) => void;
    /** Scrolls while the pointer is near its top or bottom edge. */
    scroller?: HTMLElement | null;
  },
) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const startY = e.clientY;
  let moved = false;
  let mark: DropMark | null = null;

  const measure = (y: number): DropMark | null => {
    const others = opts.items().filter((i) => i.id !== opts.dragId);
    if (!others.length) return null;
    let index = others.length;
    let lineY = others[others.length - 1].el.getBoundingClientRect().bottom;
    for (let n = 0; n < others.length; n++) {
      const r = others[n].el.getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        index = n;
        lineY = r.top;
        break;
      }
    }
    return { index, y: lineY };
  };

  const move = (ev: PointerEvent) => {
    if (!moved && Math.abs(ev.clientY - startY) < 4) return;
    moved = true;
    const s = opts.scroller;
    if (s) {
      const r = s.getBoundingClientRect();
      if (ev.clientY < r.top + 48) s.scrollBy(0, -14);
      else if (ev.clientY > r.bottom - 48) s.scrollBy(0, 14);
    }
    mark = measure(ev.clientY);
    opts.onMark(mark);
  };
  const end = (drop: boolean) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key);
    opts.onMark(null);
    document.body.style.removeProperty("user-select");
    if (drop && moved && mark) opts.onDrop(mark.index);
  };
  const up = () => end(true);
  const key = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") end(false);
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key);
}

/** The list with one item moved to `index` (an index among the other items). */
export function moveTo<T extends { id: string }>(list: T[], id: string, index: number): T[] {
  const item = list.find((x) => x.id === id);
  if (!item) return list;
  const rest = list.filter((x) => x.id !== id);
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, item);
  return rest;
}
