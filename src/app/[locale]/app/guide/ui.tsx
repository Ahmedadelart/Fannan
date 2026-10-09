// Small pieces shared by the guided setup's steps (same look as sign-up).

import type { ReactNode } from "react";
import type { SiteMedia } from "@/components/site/SiteRender";
import { Icon } from "@/components/ui/Icon";
import type { Uploaded } from "@/components/editor/upload";
import { cx } from "@/lib/cx";
import { imageSources } from "@/lib/media";
import { toneFill } from "@/lib/site/samples";

export const bigButton =
  "inline-flex h-[52px] flex-none items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-primary px-7 text-[16px] font-medium text-on-primary transition-colors hover:brightness-110 disabled:opacity-40";
export const outlineButton =
  "inline-flex h-10 flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border border-outline bg-paper px-4 text-[14px] font-semibold text-ink hover:bg-mist disabled:opacity-40";
export const backButton = "inline-flex h-[52px] items-center px-1.5 text-[15px] font-semibold text-muted hover:text-ink";
export const fieldCls =
  "h-11 w-full rounded-[12px] border border-outline bg-paper px-3.5 text-[15px] text-ink outline-none focus:border-primary";
export const areaCls =
  "min-h-[88px] w-full rounded-[12px] border border-outline bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-primary";

export function Kicker({ children }: { children: ReactNode }) {
  return <span className="text-muted text-[13px] font-semibold tracking-[0.08em] uppercase">{children}</span>;
}

export function Question({ children }: { children: ReactNode }) {
  return <h1 className="font-heading font-heading-weight m-0 text-[32px] leading-[1.08] tracking-[-0.02em] md:text-[42px]">{children}</h1>;
}

export function Problem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-ink m-0 flex items-center gap-2 text-[14px] font-semibold">
      <span aria-hidden className="hl-bar h-[6px] w-3" />
      {children}
    </p>
  );
}

export function toSiteMedia(m: Uploaded): SiteMedia {
  return {
    id: m.id,
    type: m.type,
    variants: m.variants,
    poster: m.poster,
    loop: m.loop,
    width: m.width,
    height: m.height,
    alt: m.alt,
    caption: m.caption,
  } as SiteMedia;
}

/** A small picture: the upload when there is one, else sample art. */
export function Thumb({ m, tone, className }: { m?: SiteMedia | Uploaded | null; tone?: string; className?: string }) {
  const src = m ? imageSources(m, 400)?.src : null;
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={cx("block object-cover", className)} />
    );
  if (tone) return <span aria-hidden className={cx("block", className)} style={{ background: toneFill(tone) }} />;
  return (
    <span aria-hidden className={cx("bg-mist text-muted flex items-center justify-center", className)}>
      <Icon name="image" size={20} />
    </span>
  );
}
