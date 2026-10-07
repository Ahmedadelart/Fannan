import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./locales";

// The proxy always rewrites to /{locale}/..., so the locale comes from the URL segment.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
