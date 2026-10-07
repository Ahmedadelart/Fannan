import { NextResponse, type NextRequest } from "next/server";
import { artistFromRequest } from "@/lib/server/host";
import { checkMediaToken, liveSite, protectedMedia } from "@/lib/server/public";
import { readStream } from "@/lib/server/storage";

// Media for public artist sites, on the artist's own address:
//   /m/variants/{siteId}/{mediaId}/{gen}/{file}         published, public
//   /m/t/{token}/variants/...                           behind a password (1-hour token)
//   /m/pdf/{siteId}/{mediaId}                           download of a published PDF
// Only files that are part of the published snapshot are served. Never other originals.

const TYPES: Record<string, string> = {
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

const notFound = () => new NextResponse(null, { status: 404 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/m/[...path]">) {
  const { path: parts } = await ctx.params;
  if (parts.includes("..")) return notFound();
  const username = await artistFromRequest();
  if (!username) return notFound();
  const site = await liveSite(username);
  if (!site) return notFound();

  let token: string | null = null;
  let rest = parts;
  if (parts[0] === "t") {
    token = parts[1] ?? null;
    rest = parts.slice(2);
  }

  let path: string;
  let mediaId: string;
  let filename: string | undefined;
  if (rest[0] === "pdf") {
    mediaId = rest[2];
    const m = site.media[mediaId] as { type?: string; original?: string | null; caption?: string } | undefined;
    if (rest[1] !== site.siteId || m?.type !== "pdf" || !m.original) return notFound();
    path = m.original;
    filename = `${(m.caption || "document").replace(/[^\w\- ]+/g, "").slice(0, 60) || "document"}.pdf`;
  } else {
    if (rest[0] !== "variants" || rest[1] !== site.siteId) return notFound();
    mediaId = rest[2];
    path = rest.join("/");
    if (!site.media[mediaId]) return notFound();
  }

  const lockedBy = protectedMedia(site).get(mediaId);
  if (lockedBy) {
    const scope = token ? checkMediaToken(token, site.siteId) : null;
    if (scope !== lockedBy) return new NextResponse(null, { status: 403 });
  }

  const type = TYPES[path.split(".").pop() ?? ""];
  if (!type) return notFound();
  const file = await readStream(path);
  if (!file) return notFound();
  return new NextResponse(file.stream, {
    headers: {
      "content-type": type,
      "content-length": String(file.size),
      "cache-control": lockedBy ? "private, max-age=3600" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      ...(filename ? { "content-disposition": `attachment; filename="${filename}"` } : {}),
    },
  });
}
