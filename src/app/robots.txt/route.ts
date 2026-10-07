import { surfaceOfRequest } from "@/lib/server/host";
import { liveSite } from "@/lib/server/public";

// One robots.txt per address: artist sites, the marketing site, and the app (never indexed).
export async function GET() {
  const { kind, username, origin } = await surfaceOfRequest();
  let body: string;
  if (kind === "site" && username) {
    const site = await liveSite(username);
    const indexable = site && (site as { privacy?: { indexable?: boolean } }).privacy?.indexable !== false;
    body = indexable
      ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`
      : "User-agent: *\nDisallow: /\n";
  } else if (kind === "marketing") {
    body = `User-agent: *\nAllow: /\nDisallow: /kitchen-sink\nDisallow: /ar/kitchen-sink\nSitemap: ${origin}/sitemap.xml\n`;
  } else {
    body = "User-agent: *\nDisallow: /\n";
  }
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
