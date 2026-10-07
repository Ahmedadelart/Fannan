// Turning stored web versions into <img>/<picture> sources. Safe in the browser and on the server.

export interface VariantSet {
  webp: Record<string, string>;
  avif: Record<string, string>;
}

export interface MediaLike {
  type: string;
  status?: string;
  variants?: VariantSet | null;
  poster?: VariantSet | null;
  loop?: string | null;
  embed?: { poster: string | null } | null;
  width?: number;
  height?: number;
}

/** Owner-only route on app.fannan.net (public sites get their own in phase 4). */
export const mediaUrl = (path: string) => `/api/media/${path}`;

function srcSet(set: Record<string, string>) {
  return Object.entries(set)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([w, p]) => `${mediaUrl(p)} ${w}w`)
    .join(", ");
}

function pick(set: Record<string, string>, want: number) {
  const sizes = Object.keys(set)
    .map(Number)
    .sort((a, b) => a - b);
  const w = sizes.find((s) => s >= want) ?? sizes.at(-1);
  return w ? mediaUrl(set[String(w)]) : null;
}

/** Still image sources for a thumbnail or preview. For GIFs this is the animation itself. */
export function imageSources(m: MediaLike, want = 800): { src: string; srcSet?: string; avifSet?: string } | null {
  if (m.type === "embed") return m.embed?.poster ? { src: m.embed.poster } : null;
  const set = m.type === "loop" || m.type === "pdf" ? m.variants : m.variants;
  if (!set || !Object.keys(set.webp).length) return null;
  const src = pick(set.webp, want);
  if (!src) return null;
  return {
    src,
    srcSet: srcSet(set.webp),
    avifSet: Object.keys(set.avif ?? {}).length ? srcSet(set.avif) : undefined,
  };
}
