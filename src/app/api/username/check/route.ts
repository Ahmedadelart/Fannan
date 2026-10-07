import { NextResponse, type NextRequest } from "next/server";
import { usernameIdeas } from "@/config/usernames";
import { adminAuth } from "@/lib/firebase/admin";
import { usernameAvailability } from "@/lib/server/data";
import { rateLimit } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session";

// Live username check for sign-up step 5 and the homepage claim box.
// GET /api/username/check?name=ahmed&from=Ahmed%20Hassan&what=animator

export async function GET(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
  if (!rateLimit(`username:${ip}`, 90, 60_000)) {
    return NextResponse.json({ error: "slow-down" }, { status: 429 });
  }
  const name = req.nextUrl.searchParams.get("name") ?? "";
  let uid: string | null = null;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie)
    uid = await adminAuth()
      .verifySessionCookie(cookie)
      .then(
        (d) => d.uid,
        () => null,
      );

  const result = await usernameAvailability(name, uid);
  let suggestions: string[] = [];
  if (!result.ok) {
    const from = req.nextUrl.searchParams.get("from") || name;
    const ideas = usernameIdeas(from, req.nextUrl.searchParams.get("what") ?? undefined);
    const checks = await Promise.all(ideas.slice(0, 6).map((u) => usernameAvailability(u, uid)));
    suggestions = ideas
      .slice(0, 6)
      .filter((_, i) => checks[i].ok)
      .slice(0, 3);
  }
  return NextResponse.json({ ...result, suggestions }, { headers: { "cache-control": "no-store" } });
}
