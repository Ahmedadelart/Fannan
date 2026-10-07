import { surfaceOfRequest } from "@/lib/server/host";
import { liveSite } from "@/lib/server/public";

// Sitemap per artist site: home, pages and public projects (nothing behind a password or hidden).
const xml = (urls: Array<{ loc: string; lastmod?: string }>) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url><loc>${u.loc.replace(/&/g, "&amp;")}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
    )
    .join("\n")}\n</urlset>\n`;

export async function GET() {
  const { kind, username, origin } = await surfaceOfRequest();
  let urls: Array<{ loc: string; lastmod?: string }> = [];
  if (kind === "site" && username) {
    const site = await liveSite(username);
    if (site && (site as { privacy?: { indexable?: boolean } }).privacy?.indexable !== false) {
      const lastmod = new Date(site.publishedAt).toISOString().slice(0, 10);
      urls = [
        ...site.pages
          .filter((p) => p.type !== "link" && !p.passwordHash)
          .map((p) => ({ loc: `${origin}/${p.slug}`, lastmod })),
        ...site.projects.filter((p) => p.visibility === "public").map((p) => ({ loc: `${origin}/${p.slug}`, lastmod })),
      ];
    }
  } else if (kind === "marketing") {
    urls = [{ loc: `${origin}/` }, { loc: `${origin}/ar` }];
  } else {
    return new Response("Not found", { status: 404 });
  }
  return new Response(xml(urls), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
