import { NextResponse, type NextRequest } from "next/server";
import { liveDomainFor, siteForHost } from "@/lib/server/domains";
import { siteLanguage } from "@/lib/server/site-language";
import { defaultLocale, LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/locales";
import {
  hostname,
  requestHostHeader,
  requestOrigin,
  surfaceForHost,
  surfaceFromCookie,
  SURFACE_COOKIE,
  type Surface,
} from "@/lib/surface";

// Every page request lands here first. We decide the surface from the Host header and the
// language from the path (marketing, artist sites) or a cookie (dashboard), then rewrite to
// the internal route: /{locale}/marketing/..., /{locale}/app/..., /{locale}/site/{username}/...
// Visitors never see these internal paths, and can't reach them directly: every request is rewritten.

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";
const SWITCHER = process.env.SURFACE_SWITCHER === "true";

const YEAR = 60 * 60 * 24 * 365;

function safeBackPath(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** "/ar/x" -> { locale: "ar", rest: "/x" }; "/x" -> { locale: "en", rest: "/x" } */
function splitLocalePath(pathname: string): { locale: Locale; rest: string; explicitDefault: boolean } {
  const [, first, ...more] = pathname.split("/");
  if (isLocale(first)) {
    return { locale: first, rest: "/" + more.join("/"), explicitDefault: first === defaultLocale };
  }
  return { locale: defaultLocale, rest: pathname, explicitDefault: false };
}

function appLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = request.headers.get("accept-language") ?? "";
  return /^\s*ar\b/i.test(accept) ? "ar" : defaultLocale;
}

function rewrite(request: NextRequest, path: string, surface: Surface, locale: Locale) {
  const url = request.nextUrl.clone();
  url.pathname = path.replace(/\/+$/, "") || "/";
  const headers = new Headers(request.headers);
  headers.set("x-fannan-surface", surface.kind === "site" ? `site:${surface.username}` : surface.kind);
  headers.set("x-fannan-locale", locale);
  headers.set("x-fannan-switcher", SWITCHER ? "1" : "0");
  return NextResponse.rewrite(url, { request: { headers } });
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams, search } = request.nextUrl;
  const host = hostname(requestHostHeader(request.headers));
  // Redirects must use the visitor's address, not Cloud Run's internal one.
  const origin = requestOrigin(request.headers);
  const to = (path: string) => new URL(path, origin);

  let surface = surfaceForHost(host, ROOT_DOMAIN);
  let ownDomain = false;
  let fromSwitcher = false;
  if (surface === null) {
    // An artist's own domain (Pro)?
    const custom = await siteForHost(host);
    if (custom && !custom.live) {
      // Not active yet, or Pro has ended: their fannan.net address still works.
      const url = to(pathname + search);
      url.hostname = `${custom.username}.${ROOT_DOMAIN}`;
      return NextResponse.redirect(url, 302);
    }
    if (custom) {
      surface = { kind: "site", username: custom.username };
      ownDomain = true;
    }
  }
  if (surface === null) {
    // Not one of our hosts. Only allowed on local/staging, where a cookie picks the surface.
    if (!SWITCHER) return new NextResponse("Not found", { status: 404 });
    fromSwitcher = true;

    if (pathname === "/__surface") {
      const target = searchParams.get("to") ?? "marketing";
      const res = NextResponse.redirect(to(safeBackPath(searchParams.get("next"))));
      res.cookies.set(SURFACE_COOKIE, target, { path: "/", httpOnly: true, sameSite: "lax", maxAge: YEAR });
      return res;
    }
    surface = surfaceFromCookie(request.cookies.get(SURFACE_COOKIE)?.value);
  }

  switch (surface.kind) {
    case "redirect": {
      const url = to(pathname + search);
      url.hostname = surface.host;
      return NextResponse.redirect(url, 308);
    }
    case "unknown":
      return new NextResponse("Not found", { status: 404 });

    case "app": {
      // Language switch for the dashboard: /__locale?to=ar&back=/somewhere
      if (pathname === "/__locale") {
        const lang = searchParams.get("to");
        const res = NextResponse.redirect(to(safeBackPath(searchParams.get("back"))));
        if (isLocale(lang)) {
          res.cookies.set(LOCALE_COOKIE, lang, { path: "/", httpOnly: true, sameSite: "lax", maxAge: YEAR });
        }
        return res;
      }
      const locale = appLocale(request);
      return rewrite(request, `/${locale}/app${pathname}`, surface, locale);
    }

    case "marketing":
    case "site": {
      const { locale, rest, explicitDefault } = splitLocalePath(pathname);
      if (explicitDefault) {
        // /en/x -> /x, so each page has one English address.
        return NextResponse.redirect(to(rest + search), 308);
      }
      if (surface.kind === "site" && !ownDomain && !fromSwitcher) {
        // Once an artist's own domain is live, their fannan.net address forwards to it.
        const domain = await liveDomainFor(surface.username);
        if (domain) {
          const url = to(pathname + search);
          url.hostname = domain;
          return NextResponse.redirect(url, 302);
        }
      }
      if (surface.kind === "site") {
        // Artist sites speak the language they were published in, unless the address says otherwise.
        const explicit = isLocale(pathname.split("/")[1]);
        const lang = explicit ? locale : await siteLanguage(surface.username);
        return rewrite(request, `/${lang}/site/${surface.username}${rest}`, surface, lang);
      }
      return rewrite(request, `/${locale}/marketing${rest}`, surface, locale);
    }
  }
}

export const config = {
  // Skip Next internals, API routes and files with an extension (images, fonts, robots.txt...).
  matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"],
};
