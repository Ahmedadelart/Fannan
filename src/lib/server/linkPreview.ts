// "Bring your work in" (round 16): read the preview a portfolio site publishes for a project link
// (its title, description and picture, the same thing WhatsApp shows when a link is pasted).
// Only the open preview tags are read: no scraping of the project itself, and only from known
// portfolio sites, so a pasted link can't make the server fetch anything else.

/** Sites a project link may come from, and the hosts their preview pictures are served from. */
const SITES: Array<{ name: string; hosts: string[] }> = [
  { name: "Behance", hosts: ["behance.net", "be.net"] },
  { name: "ArtStation", hosts: ["artstation.com"] },
  { name: "Dribbble", hosts: ["dribbble.com"] },
];

const MAX_PAGE = 1_500_000;
const MAX_IMAGE = 30 * 1024 * 1024;

export interface LinkPreview {
  url: string;
  site: string;
  title: string;
  description: string;
  /** The preview picture's address (on the site's own picture host), or "". */
  image: string;
}

const onHost = (host: string, base: string) => host === base || host.endsWith(`.${base}`);

/** The portfolio site a link belongs to, or null when it isn't one we read from. */
export function siteOf(raw: string): { url: URL; name: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  const site = SITES.find((s) => s.hosts.some((h) => onHost(url.hostname.toLowerCase(), h)));
  return site ? { url, name: site.name } : null;
}

/** Fetches an address on a known site, following at most 3 redirects, each checked again. */
async function fetchKnown(raw: string, accept: string, timeoutMs: number): Promise<Response | null> {
  let at = raw;
  for (let hop = 0; hop < 4; hop++) {
    if (!siteOf(at)) return null;
    const res = await fetch(at, {
      redirect: "manual",
      headers: { "User-Agent": "FannanLinkPreview/1.0 (+https://fannan.net)", Accept: accept },
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null);
    if (!res) return null;
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) return res.ok ? res : null;
    at = new URL(next, at).toString();
  }
  return null;
}

async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > max) return null;
  const reader = res.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** The preview tags of a page (attributes in either order), by property or name. */
export function previewTags(html: string): Record<string, string> {
  const head = html.slice(0, MAX_PAGE);
  const tags: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /\bcontent\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /\bcontent\s*=\s*'([^']*)'/i.exec(tag)?.[1];
    if (key && content !== undefined && !(key in tags)) tags[key] = decode(content).trim();
  }
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1];
  if (title) tags["html:title"] = decode(title).trim();
  return tags;
}

const clean = (s: string, max: number) =>
  s
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Turns a page's tags into a project title, description and picture. */
export function previewFrom(url: string, site: string, tags: Record<string, string>): LinkPreview {
  let title = tags["og:title"] || tags["twitter:title"] || tags["html:title"] || "";
  // ArtStation: "Title, Artist name"; page titles: "ArtStation - Title" or "Title :: Behance".
  if (site === "ArtStation" && title.includes(", ")) title = title.slice(0, title.lastIndexOf(", "));
  title = title.replace(/^ArtStation\s*-\s*/i, "").replace(/\s*(::|\|)\s*Behance\s*$/i, "").replace(/\s+on Behance$/i, "");
  const image = tags["og:image"] || tags["twitter:image"] || "";
  const imageSite = image ? siteOf(image) : null;
  return {
    url,
    site,
    title: clean(title, 120),
    description: clean(tags["og:description"] || tags["description"] || tags["twitter:description"] || "", 1000),
    image: imageSite ? imageSite.url.toString() : "",
  };
}

/** The preview of a project link, or just the site name when the page can't be read (some sites turn servers away). */
export async function linkPreview(raw: string): Promise<LinkPreview | null> {
  const site = siteOf(raw);
  if (!site) return null;
  const url = site.url.toString();
  const blank = { url, site: site.name, title: "", description: "", image: "" };
  const res = await fetchKnown(url, "text/html", 8000);
  if (!res || !(res.headers.get("content-type") ?? "").includes("html")) return blank;
  const body = await readCapped(res, MAX_PAGE);
  return body ? previewFrom(url, site.name, previewTags(body.toString("utf8"))) : blank;
}

/** A preview picture's bytes, only from a known site's picture host and only up to 30 MB. */
export async function fetchPreviewImage(raw: string): Promise<Buffer | null> {
  const res = await fetchKnown(raw, "image/*", 20_000);
  return res ? readCapped(res, MAX_IMAGE) : null;
}
