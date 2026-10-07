import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/server/data";
import { getSession } from "@/lib/server/session";
import { readStream } from "@/lib/server/storage";

// Web versions of an artist's own media, for their dashboard and editor.
// Only the owner (session cookie on app.fannan.net) can read, and never the originals.
// Public sites get their own cached route in phase 4.

const TYPES: Record<string, string> = { webp: "image/webp", avif: "image/avif", mp4: "video/mp4" };

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/media/[...path]">) {
  const { path: parts } = await ctx.params;
  const path = parts.join("/");
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const user = await getUser(session.uid);
  if (!user?.siteId || parts[0] !== "variants" || parts[1] !== user.siteId || parts.includes("..")) {
    return new NextResponse(null, { status: 404 });
  }
  const type = TYPES[path.split(".").pop() ?? ""];
  if (!type) return new NextResponse(null, { status: 404 });
  const file = await readStream(path);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file.stream, {
    headers: {
      "content-type": type,
      "content-length": String(file.size),
      // Paths change whenever the file changes, so the browser can keep them.
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
