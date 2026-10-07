"use client";

import { useEffect } from "react";
import { parseVideoLink, videoEmbedUrl } from "@/lib/video";

// Small behaviours for public artist sites, attached to markers the server-rendered page carries
// (data-lightbox, data-video, data-before-after, data-hover-loop). Keeps the page itself static
// and the JavaScript tiny.

function openLightbox(items: Array<{ src: string; caption?: string }>, start: number, closeLabel: string) {
  let i = start;
  const dialog = document.createElement("dialog");
  dialog.className = "site-lightbox";
  const button = (cls: string, label: string, text: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.setAttribute("aria-label", label);
    b.textContent = text;
    return b;
  };
  const close = button("site-lightbox-close", closeLabel, "×");
  const prev = button("site-lightbox-prev", "‹", "‹");
  const next = button("site-lightbox-next", "›", "›");
  const figure = document.createElement("figure");
  const img = document.createElement("img");
  const cap = document.createElement("figcaption");
  figure.append(img, cap);
  dialog.append(close, prev, figure, next);

  const show = () => {
    img.src = items[i].src;
    img.alt = items[i].caption ?? "";
    cap.textContent = items[i].caption ?? "";
    prev.hidden = next.hidden = items.length < 2;
  };
  const go = (by: number) => {
    i = (i + by + items.length) % items.length;
    show();
  };
  const rtl = document.documentElement.dir === "rtl";
  close.addEventListener("click", () => dialog.close());
  prev.addEventListener("click", () => go(rtl ? 1 : -1));
  next.addEventListener("click", () => go(rtl ? -1 : 1));
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(rtl ? -1 : 1);
    if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
  });
  let x0: number | null = null;
  dialog.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  dialog.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(dx < 0 !== rtl ? 1 : -1);
    x0 = null;
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  show();
  dialog.showModal();
}

export function SiteEnhancer({ protectImages, closeLabel }: { protectImages: boolean; closeLabel: string }) {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Document,
      ev: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => {
      el.addEventListener(ev, fn as EventListener);
      cleanups.push(() => el.removeEventListener(ev, fn as EventListener));
    };

    // Lightbox: every marked picture on the page is part of one set.
    const boxes = [...document.querySelectorAll<HTMLElement>("[data-lightbox]")];
    const items = boxes.map((el) => ({ src: el.dataset.lightbox!, caption: el.dataset.lightboxCaption }));
    boxes.forEach((el, n) => {
      el.style.cursor = "zoom-in";
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      on(el, "click", () => openLightbox(items, n, closeLabel));
      on(el, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(items, n, closeLabel);
        }
      });
    });

    // Videos: a poster until clicked, then the privacy-friendly player.
    document.querySelectorAll<HTMLElement>("[data-video]").forEach((el) => {
      const v = parseVideoLink(el.dataset.video ?? "");
      if (!v) return;
      el.style.cursor = "pointer";
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      const play = () => {
        const frame = document.createElement("iframe");
        frame.src = videoEmbedUrl(v);
        frame.allow = "autoplay; fullscreen; picture-in-picture";
        frame.allowFullscreen = true;
        frame.title = el.querySelector("img")?.alt || "Video";
        frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0";
        el.replaceChildren(frame);
      };
      on(el, "click", play);
      on(el, "keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          play();
        }
      });
    });

    // Before / after: drag (or use arrow keys) to move the divider.
    document.querySelectorAll<HTMLElement>("[data-before-after]").forEach((el) => {
      const before = el.children[1] as HTMLElement;
      const line = el.children[2] as HTMLElement;
      const rtl = getComputedStyle(el).direction === "rtl";
      let pct = 50;
      const set = (p: number) => {
        pct = Math.min(100, Math.max(0, p));
        before.style.width = `${pct}%`;
        (before.firstElementChild as HTMLElement).style.width = `${(100 / Math.max(pct, 1)) * 100}%`;
        line.style.insetInlineStart = `${pct}%`;
        el.setAttribute("aria-valuenow", String(Math.round(pct)));
      };
      el.setAttribute("role", "slider");
      el.setAttribute("aria-valuemin", "0");
      el.setAttribute("aria-valuemax", "100");
      el.setAttribute("aria-valuenow", "50");
      el.tabIndex = 0;
      el.style.cursor = "ew-resize";
      el.style.touchAction = "pan-y";
      const fromEvent = (x: number) => {
        const r = el.getBoundingClientRect();
        set(((rtl ? r.right - x : x - r.left) / r.width) * 100);
      };
      let dragging = false;
      on(el, "pointerdown", (e) => {
        dragging = true;
        el.setPointerCapture(e.pointerId);
        fromEvent(e.clientX);
      });
      on(el, "pointermove", (e) => {
        if (dragging) fromEvent(e.clientX);
      });
      on(el, "pointerup", () => (dragging = false));
      on(el, "keydown", (e) => {
        if (e.key === "ArrowLeft") set(pct + (rtl ? 5 : -5));
        if (e.key === "ArrowRight") set(pct + (rtl ? -5 : 5));
      });
    });

    // Loops in galleries play while the pointer is over them.
    document.querySelectorAll<HTMLElement>("[data-hover-loop]").forEach((el) => {
      let video: HTMLVideoElement | null = null;
      on(el, "pointerenter", () => {
        if (!video) {
          video = document.createElement("video");
          video.src = el.dataset.hoverLoop!;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.style.cssText =
            "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:var(--site-radius)";
        }
        el.appendChild(video);
        void video.play().catch(() => {});
      });
      on(el, "pointerleave", () => video?.remove());
    });

    if (protectImages) {
      const stop = (e: Event) => {
        if ((e.target as HTMLElement).closest("img, picture, video")) e.preventDefault();
      };
      on(document, "contextmenu", stop);
      on(document, "dragstart", stop);
    }
    return () => cleanups.forEach((c) => c());
  }, [protectImages, closeLabel]);
  return null;
}
