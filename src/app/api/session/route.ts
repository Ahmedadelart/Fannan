import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, defaultLocale } from "@/i18n/locales";
import { adminAuth } from "@/lib/firebase/admin";
import { ensureUser, getUser } from "@/lib/server/data";
import { rateLimit } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/server/session";

// Trade a fresh Firebase ID token for an httpOnly session cookie on this host only.

const MAX_TOKEN_AGE_S = 5 * 60;

function secure(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return proto ? proto === "https" : req.nextUrl.protocol === "https:";
}

function ip(req: NextRequest) {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`session:${ip(req)}`, 80, 60_000)) {
    return NextResponse.json({ error: "slow-down" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { idToken?: string; locale?: string } | null;
  if (!body?.idToken) return NextResponse.json({ error: "missing-token" }, { status: 400 });

  try {
    const decoded = await adminAuth().verifyIdToken(body.idToken);
    if (Date.now() / 1000 - decoded.auth_time > MAX_TOKEN_AGE_S && decoded.firebase.sign_in_provider !== "anonymous") {
      return NextResponse.json({ error: "sign-in-again" }, { status: 401 });
    }
    const isAnonymous = decoded.firebase.sign_in_provider === "anonymous";
    const requested = isLocale(body.locale) ? body.locale : defaultLocale;
    await ensureUser(decoded.uid, { locale: requested, isAnonymous, email: decoded.email });
    const user = await getUser(decoded.uid);

    const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
    const cookie = await adminAuth().createSessionCookie(body.idToken, { expiresIn });
    const res = NextResponse.json({ ok: true, locale: user?.locale ?? requested });
    const base = { httpOnly: true, secure: secure(req), sameSite: "lax" as const, path: "/" };
    res.cookies.set(SESSION_COOKIE, cookie, { ...base, maxAge: expiresIn / 1000 });
    // Same language on every device: the account's language wins once it exists.
    res.cookies.set(LOCALE_COOKIE, user?.locale ?? requested, { ...base, maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch {
    return NextResponse.json({ error: "invalid-token" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: secure(req), sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
