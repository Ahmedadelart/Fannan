// Works out which of the three surfaces a request is for, from its Host header.
//
//   fannan.net             -> marketing
//   app.fannan.net         -> app (dashboard, editors)
//   {username}.fannan.net  -> an artist site
//
// On hosts outside the root domain (localhost, the Cloud Run staging URL) and when
// SURFACE_SWITCHER is on, a cookie picks the surface so all three can be tested on one URL.
// Custom artist domains are added in phase 6.

export type Surface =
  | { kind: "marketing" }
  | { kind: "app" }
  | { kind: "site"; username: string }
  | { kind: "redirect"; host: string }
  | { kind: "unknown" };

export const SURFACE_COOKIE = "fannan_preview_surface";

export function hostname(hostHeader: string | null): string {
  return (hostHeader ?? "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function surfaceForHost(host: string, rootDomain: string): Surface | null {
  if (host === rootDomain) return { kind: "marketing" };
  if (host === `www.${rootDomain}`) return { kind: "redirect", host: rootDomain };
  if (host === `app.${rootDomain}`) return { kind: "app" };
  if (host.endsWith(`.${rootDomain}`)) {
    const label = host.slice(0, -rootDomain.length - 1);
    if (/^[a-z][a-z0-9-]{1,29}$/.test(label)) return { kind: "site", username: label };
    return { kind: "unknown" };
  }
  return null; // not our domain
}

/** Value stored in the preview cookie: "marketing", "app" or "site:username". */
export function surfaceFromCookie(value: string | undefined): Surface {
  if (value === "app") return { kind: "app" };
  if (value?.startsWith("site:")) {
    const username = value.slice(5);
    if (/^[a-z][a-z0-9-]{1,29}$/.test(username)) return { kind: "site", username };
  }
  return { kind: "marketing" };
}
