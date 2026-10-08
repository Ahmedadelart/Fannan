import { NextResponse, type NextRequest } from "next/server";
import { artistFromRequest } from "@/lib/server/host";
import { liveSite } from "@/lib/server/public";
import { rateLimit } from "@/lib/server/rate-limit";
import { BOT_RE, recordTime, recordView, referrerName } from "@/lib/server/stats";

// Page-view beacon from artist sites (navigator.sendBeacon). No cookies; see src/lib/server/stats.ts.
export async function POST(req: NextRequest) {
  const ok = new NextResponse(null, { status: 204 });
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_RE.test(ua)) return ok;
  const username = await artistFromRequest();
  const site = username ? await liveSite(username) : null;
  if (!site) return ok;
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
  if (!rateLimit(`hit:${ip}`, 120, 60_000)) return ok;

  const body = (await req.text().catch(() => "")).slice(0, 2000);
  let data: { t?: string; p?: string; r?: string; d?: number } = {};
  try {
    data = JSON.parse(body);
  } catch {
    return ok;
  }
  if (data.t === "leave") {
    await recordTime(site.siteId, Number(data.d) || 0).catch(() => {});
    return ok;
  }
  const slug = String(data.p ?? "/").replace(/^\/(ar\/|en\/)?/, "").split(/[/?#]/)[0];
  const project = slug ? site.projects.find((p) => p.slug === slug) : undefined;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  await recordView({
    siteId: site.siteId,
    ip,
    ua,
    projectId: project?.id ?? null,
    referrer: referrerName(String(data.r ?? ""), host.replace(/:\d+$/, "")),
    country: req.headers.get("cf-ipcountry"),
  }).catch((e) => console.error("recordView", e));
  return ok;
}
