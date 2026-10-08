import "server-only";

import { headers } from "next/headers";
import { requestHostHeader } from "@/lib/surface";

// Links between the three surfaces. On the real domain they are full addresses
// (https://app.fannan.net/...); on staging/local single-host setups they go through the
// surface switcher (/__surface?to=app&next=/signup).

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";

/** What artists see as their address. Always fannan.net outside local development. */
export const DISPLAY_DOMAIN = ROOT_DOMAIN.endsWith(".localhost") ? ROOT_DOMAIN : "fannan.net";

export interface SurfaceUrls {
  app: (path?: string) => string;
  marketing: (path?: string) => string;
  site: (username: string, path?: string) => string;
}

export async function surfaceUrls(): Promise<SurfaceUrls> {
  const h = await headers();
  const host = requestHostHeader(h);
  const hostname = host.replace(/:\d+$/, "");
  const port = host.match(/:\d+$/)?.[0] ?? "";
  const onRoot = hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`);

  if (!onRoot) {
    const via = (to: string, path = "/") => `/__surface?to=${encodeURIComponent(to)}&next=${encodeURIComponent(path)}`;
    return {
      app: (path) => via("app", path),
      marketing: (path) => via("marketing", path),
      site: (u, path) => via(`site:${u}`, path),
    };
  }
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (hostname.endsWith("localhost") ? "http" : "https");
  const at = (sub: string, path = "/") => `${proto}://${sub ? `${sub}.` : ""}${ROOT_DOMAIN}${port}${path}`;
  return {
    app: (path) => at("app", path),
    marketing: (path) => at("", path),
    site: (u, path) => at(u, path),
  };
}

/** A link into the dashboard for emails (no request to read the address from). */

export function appLink(path: string) {

  const origin = process.env.APP_ORIGIN;

  if (origin && process.env.SURFACE_SWITCHER === "true") {

    return `${origin}/__surface?to=app&next=${encodeURIComponent(path)}`;

  }

  return `${origin ?? `https://app.${ROOT_DOMAIN}`}${path}`;

}
