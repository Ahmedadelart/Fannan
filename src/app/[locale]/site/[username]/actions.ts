"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword } from "@/lib/server/passwords";
import { accessCookieName, accessCookieValue, liveSite } from "@/lib/server/public";
import { rateLimit } from "@/lib/server/rate-limit";

/** Password screen on an artist site: checks on the server and sets a signed cookie for this site only. */
export async function unlock(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const scope = String(formData.get("scope") ?? "");
  const back = String(formData.get("back") ?? "/");
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
  if (!rateLimit(`unlock:${ip}:${username}`, 10, 10 * 60_000)) redirect(`${safeBack}?wrong=1`);

  const site = await liveSite(username);
  if (!site) redirect("/");
  const hash =
    site.pages.find((p) => p.id === scope)?.passwordHash ??
    site.projects.find((p) => p.id === scope)?.passwordHash ??
    null;
  if (!hash || !(await checkPassword(hash, password))) redirect(`${safeBack}?wrong=1`);

  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim();
  (await cookies()).set(accessCookieName(scope), accessCookieValue(site.siteId, scope, site.version), {
    httpOnly: true,
    secure: proto ? proto === "https" : !(h.get("host") ?? "").includes("localhost"),
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  redirect(safeBack);
}
