import "server-only";

import { headers, cookies } from "next/headers";
import { hostname, surfaceForHost, surfaceFromCookie, SURFACE_COOKIE } from "@/lib/surface";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";
const SWITCHER = process.env.SURFACE_SWITCHER === "true";

/** The artist username this request is for (by Host, or the staging switcher cookie), if any. */
export async function artistFromRequest(): Promise<string | null> {
  const h = await headers();
  const surface = surfaceForHost(hostname(h.get("x-forwarded-host") ?? h.get("host")), ROOT_DOMAIN);
  if (surface?.kind === "site") return surface.username;
  if (surface === null && SWITCHER) {
    const s = surfaceFromCookie((await cookies()).get(SURFACE_COOKIE)?.value);
    if (s.kind === "site") return s.username;
  }
  return null;
}

export type RequestSurface = "marketing" | "app" | "site" | "other";

export async function surfaceOfRequest(): Promise<{ kind: RequestSurface; username?: string; origin: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  let surface = surfaceForHost(hostname(host), ROOT_DOMAIN);
  if (surface === null && SWITCHER) surface = surfaceFromCookie((await cookies()).get(SURFACE_COOKIE)?.value);
  if (!surface) return { kind: "other", origin };
  if (surface.kind === "site") return { kind: "site", username: surface.username, origin };
  if (surface.kind === "app") return { kind: "app", origin };
  if (surface.kind === "marketing") return { kind: "marketing", origin };
  return { kind: "other", origin };
}
