import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currencyForCountry, limitsFor, lowestMonthlyPrice } from "@/config/plans";
import type { Locale } from "@/i18n/locales";
import { countProjects, getSite, getUser } from "@/lib/server/data";
import { loadDraft, loadRenderData } from "@/lib/server/site";
import { getSession } from "@/lib/server/session";
import { DISPLAY_DOMAIN, surfaceUrls } from "@/lib/server/urls";

/** "112 EGP" in Egypt, "$6" elsewhere (Cloudflare's country header). Used in limit prompts. */
export async function priceLabel(locale: Locale) {
  const currency = currencyForCountry((await headers()).get("cf-ipcountry"));
  const n = lowestMonthlyPrice(currency);
  const num = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(n);
  return currency === "EGP" ? (locale === "ar" ? `${num} جنيه` : `${num} EGP`) : `$${n}`;
}

/** Everything the dashboard needs, loaded once per request. Sends people without a site to sign-up. */
export const loadDashboard = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUser(session.uid);
  if (!user?.siteId) redirect("/signup");
  const [site, draft, projects, urls, render] = await Promise.all([
    getSite(user.siteId),
    loadDraft(user.siteId),
    countProjects(user.siteId),
    surfaceUrls(),
    loadRenderData(user.siteId),
  ]);
  if (!site || !draft) redirect("/signup");

  const limits = limitsFor(user.plan);
  return {
    session,
    user,
    site,
    draft,
    render,
    projects,
    limits,
    address: `${site.username}.${DISPLAY_DOMAIN}`,
    siteUrl: urls.site(site.username),
    checklist: {
      project: projects > 0,
      about: !!site.aboutWritten,
      available: site.available.on,
      publish: site.publishedVersion !== null,
      share: !!site.sharedAt,
    },
  };
});
