// YouTube / Vimeo links. Safe in the browser and on the server.

export type VideoLink = { provider: "youtube" | "vimeo"; id: string; hash?: string };

export function parseVideoLink(raw: string): VideoLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] ?? "";
    return /^[\w-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:\/video)?\/(\d{6,12})(?:\/([0-9a-f]{6,20}))?/);
    if (!m) return null;
    return { provider: "vimeo", id: m[1], hash: m[2] ?? url.searchParams.get("h") ?? undefined };
  }
  return null;
}

/** A still for the video, when we can know it without asking the provider. */
export function videoPoster(v: VideoLink | null): string | null {
  return v?.provider === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : null;
}

/** Privacy-friendly player address (used by the public site's click-to-play). */
export function videoEmbedUrl(v: VideoLink): string {
  return v.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${v.id}?autoplay=1${v.hash ? `&h=${v.hash}` : ""}`;
}
