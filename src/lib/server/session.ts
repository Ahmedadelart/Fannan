import "server-only";

import { cookies, headers } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

// Server sessions for app.fannan.net.
// The browser signs in with Firebase, then trades its ID token for an httpOnly session cookie
// (POST /api/session). The cookie is host-only, so artist sites never receive it.

export const SESSION_COOKIE = "__session";
export const SESSION_DAYS = 14;

export interface Session {
  uid: string;
  isAnonymous: boolean;
  email?: string;
}

export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value);
    return {
      uid: decoded.uid,
      isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("not-signed-in");
  return s;
}

/** Secure cookies everywhere except plain-http local development. */
export async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "";
  if (proto) return proto.split(",")[0].trim() === "https";
  return !(h.get("host") ?? "").includes("localhost");
}

/** Visitor IP for rate limiting (Cloudflare first, then the load balancer's header). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "unknown";
}
