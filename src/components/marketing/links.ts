import type { Locale } from "@/i18n/locales";

/** Marketing pages: English at /path, Arabic at /ar/path. */
export const mHref = (locale: Locale, path: string) =>
  locale === "ar" ? (path === "/" ? "/ar" : `/ar${path}`) : path;
