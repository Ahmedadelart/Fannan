import { NextResponse } from "next/server";
import { resolveShortLink } from "@/lib/server/shortlinks";
import { surfaceUrls } from "@/lib/server/urls";

// fannan.net/l/{code}: a short link to a page on an artist's site (round 9).
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const urls = await surfaceUrls();
  const hit = await resolveShortLink(code.toLowerCase()).catch(() => null);
  const to = hit ? urls.site(hit.username, hit.path) : urls.marketing("/");
  return NextResponse.redirect(new URL(to, req.url), 302);
}
