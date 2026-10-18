// Looping videos (GIFs and loops on covers) load and play only when they're near the screen, and
// pause when they leave it. Pages stay light: a long portfolio doesn't download every loop at once.
// The markup carries the address in data-loop-src; this attaches it. Used by the live site and the editor.

export function watchLoops(root: ParentNode = document): () => void {
  if (typeof window === "undefined") return () => {};
  const start = (v: HTMLVideoElement) => {
    if (!v.src && v.dataset.loopSrc) v.src = v.dataset.loopSrc;
    void v.play().catch(() => {});
  };
  if (!("IntersectionObserver" in window)) {
    root.querySelectorAll<HTMLVideoElement>("video[data-loop-src]").forEach(start);
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) start(v);
        else if (!v.paused) v.pause();
      }
    },
    { rootMargin: "300px 0px" },
  );
  const seen = new WeakSet<Element>();
  const scan = () =>
    root.querySelectorAll<HTMLVideoElement>("video[data-loop-src]").forEach((v) => {
      if (seen.has(v)) return;
      seen.add(v);
      io.observe(v);
    });
  scan();
  // New loops appear as the editor re-renders; pick them up too.
  const mo = new MutationObserver(scan);
  if (root instanceof Node) mo.observe(root, { childList: true, subtree: true });
  return () => {
    io.disconnect();
    mo.disconnect();
  };
}
