import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { limitsFor } from "@/config/plans";
import { countProjects, getSite, getSiteDraft, getUser } from "@/lib/server/data";
import { getSession } from "@/lib/server/session";
import { DISPLAY_DOMAIN, surfaceUrls } from "@/lib/server/urls";

/** Everything the dashboard needs, loaded once per request. Sends people without a site to sign-up. */
export const loadDashboard = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getUser(session.uid);
  if (!user?.siteId) redirect("/signup");
  const [site, draft, projects, urls] = await Promise.all([
    getSite(user.siteId),
    getSiteDraft(user.siteId),
    countProjects(user.siteId),
    surfaceUrls(),
  ]);
  if (!site || !draft) redirect("/signup");

  const limits = limitsFor(user.plan);
  return {
    session,
    user,
    site,
    draft,
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
