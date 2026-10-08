import "server-only";

import { headers, cookies } from "next/headers";
import {
  hostname,
  requestHostHeader,
  requestOrigin,
  surfaceForHost,
  surfaceFromCookie,
  SURFACE_COOKIE,
} from "@/lib/surface";
import { siteForHost } from "./domains";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";
const SWITCHER = process.env.SURFACE_SWITCHER === "true";

/** The artist username this request is for (by Host, or the staging switcher cookie), if any. */
export async function artistFromRequest(): Promise<string | null> {
  const h = await headers();
  const host = hostname(requestHostHeader(h));
  const surface = surfaceForHost(host, ROOT_DOMAIN);
  if (surface?.kind === "site") return surface.username;
  if (surface === null) {
    const custom = await siteForHost(host);
    if (custom?.live) return custom.username;
  }
  if (surface === null && SWITCHER) {
    const s = surfaceFromCookie((await cookies()).get(SURFACE_COOKIE)?.value);
    if (s.kind === "site") return s.username;
  }
  return null;
}

export type RequestSurface = "marketing" | "app" | "site" | "other";

export async function surfaceOfRequest(): Promise<{ kind: RequestSurface; username?: string; origin: string }> {
  const h = await headers();
  const host = requestHostHeader(h);
  const origin = requestOrigin(h);
  let surface = surfaceForHost(hostname(host), ROOT_DOMAIN);
  if (surface === null) {
    const custom = await siteForHost(hostname(host));
    if (custom?.live) return { kind: "site", username: custom.username, origin };
  }
  if (surface === null && SWITCHER) surface = surfaceFromCookie((await cookies()).get(SURFACE_COOKIE)?.value);
  if (!surface) return { kind: "other", origin };
  if (surface.kind === "site") return { kind: "site", username: surface.username, origin };
  if (surface.kind === "app") return { kind: "app", origin };
  if (surface.kind === "marketing") return { kind: "marketing", origin };
  return { kind: "other", origin };
}
