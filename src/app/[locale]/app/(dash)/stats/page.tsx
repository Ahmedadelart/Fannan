import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { imageSources } from "@/lib/media";
import { listProjects } from "@/lib/server/projects";
import { messagesInPeriod } from "@/lib/server/settings";
import { statsReport } from "@/lib/server/stats";
import { loadDashboard } from "../load";

// Stats.dc.html: date range, four numbers with change vs the previous period, a daily bar chart
// (lime on days the artist published), top projects, referrers and countries.

export async function generateMetadata({ params }: PageProps<"/[locale]/app/stats">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stats" });
  return { title: t("title"), robots: { index: false } };
}

const RANGES = [7, 30, 90] as const;

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("border-line bg-paper flex flex-col gap-3.5 rounded-lg border p-5", className)}>
      {children}
    </section>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-heading font-heading-weight text-[20px] leading-tight">{children}</h2>
);

export default async function StatsPage({ params, searchParams }: PageProps<"/[locale]/app/stats">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("stats");
  const format = await getFormatter();
  const { site, limits, siteUrl } = await loadDashboard();
  const pro = limits.statsDays >= 90;

  const asked = Number((await searchParams).range);
  const range = RANGES.includes(asked as 7) && asked <= limits.statsDays ? asked : 30;

  const [report, projects, { current: msgs, previous: prevMsgs }] = await Promise.all([
    statsReport(site.id, range, site.publishDays ?? []),
    listProjects(site.id),
    messagesInPeriod(site.id, range),
  ]);
  const { totals, previous } = report;

  const n = (v: number) => format.number(v, v >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : {});
  const time = (s: number) => {
    const m = Math.floor(s / 60);
    return m ? t("minutes", { m, s: s % 60 }) : t("seconds", { s });
  };
  const pct = (cur: number, prev: number) => {
    if (!prev) return cur ? t("deltaNew") : "";
    const d = Math.round(((cur - prev) / prev) * 100);
    return t("delta", { value: `${d > 0 ? "+" : ""}${format.number(d)}%` });
  };
  const kpis: Array<{ key: string; value: string; delta: string }> = [
    { key: "visitors", value: n(totals.visitors), delta: pct(totals.visitors, previous.visitors) },
    { key: "projectViews", value: n(totals.projectViews), delta: pct(totals.projectViews, previous.projectViews) },
    {
      key: "avgTime",
      value: totals.avgSeconds ? time(totals.avgSeconds) : "–",
      delta:
        totals.avgSeconds && previous.avgSeconds
          ? t("delta", { value: `${totals.avgSeconds >= previous.avgSeconds ? "+" : "−"}${time(Math.abs(totals.avgSeconds - previous.avgSeconds))}` })
          : "",
    },
    { key: "messages", value: n(msgs), delta: msgs - prevMsgs ? t("delta", { value: `${msgs > prevMsgs ? "+" : ""}${msgs - prevMsgs}` }) : "" },
  ];

  const max = Math.max(1, ...report.days.map((d) => d.visitors));
  const dayLabel = (d: string) =>
    format.dateTime(new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`), {
      day: "numeric",
      month: "short",
    });

  const byId = new Map(projects.map((p) => [p.id, p]));
  const top = Object.entries(report.byProject)
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const share = (rec: Record<string, number>) => {
    const total = Object.values(rec).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(rec)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => ({ key: k, pct: Math.round((v / total) * 100) }));
  };
  const refName = (k: string) =>
    ({ direct: t("ref.direct"), google: t("ref.google"), fannan: t("ref.fannan"), whatsapp: "WhatsApp" })[k] ??
    k.replace(/_/g, ".");
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const countryName = (c: string) => {
    try {
      return regions.of(c) ?? c;
    } catch {
      return c;
    }
  };
  const empty = totals.views === 0 && previous.views === 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">{t("title")}</h1>
          <p className="text-muted mt-1">{t("sub")}</p>
        </div>
        <nav aria-label={t("range")} className="border-line bg-paper flex gap-0.5 rounded-md border p-1">
          {RANGES.map((r) => {
            const locked = r > limits.statsDays;
            const on = r === range;
            return locked ? (
              <a
                key={r}
                href="/upgrade"
                className="text-muted flex h-[34px] items-center gap-1.5 rounded-[8px] px-3.5 font-semibold"
                title={t("proRange")}
              >
                {t("days", { n: r })}
                <Badge variant="pro">Pro</Badge>
              </a>
            ) : (
              <a
                key={r}
                href={`/stats?range=${r}`}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "flex h-[34px] items-center rounded-[8px] px-3.5 font-semibold",
                  on ? "bg-ink text-white" : "text-ink-soft hover:bg-mist",
                )}
              >
                {t("days", { n: r })}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" data-testid="kpis">
        {kpis.map((k) => (
          <Card key={k.key} className="gap-1.5">
            <span className="text-muted text-[13px]">{t(`kpi.${k.key}`)}</span>
            <span className="font-heading font-heading-weight text-[30px] leading-none" data-testid={`kpi-${k.key}`}>
              {k.value}
            </span>
            <span className="text-ink-soft min-h-[18px] text-[12px] font-semibold">{k.delta}</span>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <H>{t("kpi.visitors")}</H>
          <span className="text-muted flex gap-3.5 text-[12px]">
            <span className="flex items-center gap-1.5">
              <span className="bg-ink size-2.5 rounded-[2px]" />
              {t("kpi.visitors")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-lime size-2.5 rounded-[2px]" />
              {t("publishedDay")}
            </span>
          </span>
        </div>
        <div className="relative">
          <div
            className={cx(
              "border-line flex h-[200px] items-end border-b pt-2",
              range > 30 ? "gap-px" : range > 7 ? "gap-1" : "gap-2",
            )}
            aria-hidden
          >
            {report.days.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 items-end">
                <div
                  className={cx("w-full rounded-t-[4px]", d.published ? "bg-lime" : "bg-ink")}
                  style={{ height: d.visitors ? `${Math.max(2, (d.visitors / max) * 100)}%` : d.published ? "3px" : 0 }}
                />
                <span className="bg-ink shadow-float pointer-events-none absolute bottom-full start-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-[8px] px-2.5 py-1.5 text-[12px] whitespace-nowrap text-white group-hover:block rtl:translate-x-1/2">
                  {dayLabel(d.day)} · {t("visitorsCount", { count: d.visitors })}
                  {d.published && ` · ${t("publishedShort")}`}
                </span>
              </div>
            ))}
          </div>
          {empty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
              <span className="font-heading font-heading-weight text-[18px]">{t("emptyTitle")}</span>
              <span className="text-muted max-w-[300px] text-[13px]">{t("emptyText")}</span>
              <a href={siteUrl} className={cx(buttonClasses("outline", "sm"), "mt-2")}>
                {t("openSite")}
              </a>
            </div>
          )}
        </div>
        <div className="text-muted flex justify-between text-[12px]">
          <span>{t("daysAgo", { n: range })}</span>
          <span>{t("today")}</span>
        </div>
        <table className="sr-only">
          <caption>{t("kpi.visitors")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("day")}</th>
              <th scope="col">{t("kpi.visitors")}</th>
              <th scope="col">{t("views")}</th>
            </tr>
          </thead>
          <tbody>
            {report.days.map((d) => (
              <tr key={d.day}>
                <th scope="row">
                  {dayLabel(d.day)}
                  {d.published ? ` (${t("publishedShort")})` : ""}
                </th>
                <td>{d.visitors}</td>
                <td>{d.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        <Card>
          <H>{t("topProjects")}</H>
          {top.length === 0 && <p className="text-muted text-[13px]">{t("noneYet")}</p>}
          <ol className="flex flex-col gap-2.5" data-testid="top-projects">
            {top.map(([id, views]) => {
              const p = byId.get(id)!;
              const img = p.cover ? imageSources(p.cover, 400) : null;
              return (
                <li key={id} className="flex items-center gap-3">
                  <span className="bg-mist h-[33px] w-11 flex-none overflow-hidden rounded-sm">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.src} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                  <span className="text-muted text-[13px]">{t("viewsCount", { count: views })}</span>
                </li>
              );
            })}
          </ol>
        </Card>
        <Breakdown
          title={t("referrers")}
          locked={!pro}
          lockedText={t("proOnly")}
          upgrade={t("upgrade")}
          empty={t("noneYet")}
          rows={share(report.referrers).map((r) => ({ name: refName(r.key), pct: r.pct }))}
          bars
        />
        <Breakdown
          title={t("countries")}
          locked={!pro}
          lockedText={t("proOnly")}
          upgrade={t("upgrade")}
          empty={t("noneYet")}
          rows={share(report.countries).map((r) => ({ name: countryName(r.key), pct: r.pct }))}
          note={t("gaNote")}
        />
      </div>

      <Card className="flex-row flex-wrap items-center justify-between">
        <span className="flex flex-col">
          <H>{t("reachedOut")}</H>
          <span className="text-muted text-[13px]">{t("reachedOutSub")}</span>
        </span>
        <span className="flex items-center gap-4">
          <span className="font-heading font-heading-weight text-[30px]">{n(msgs)}</span>
          <a href="/messages" className={buttonClasses("primary", "md")}>
            <Icon name="messages" size={18} />
            {t("openMessages")}
          </a>
        </span>
      </Card>
    </>
  );
}

function Breakdown({
  title,
  rows,
  locked,
  lockedText,
  upgrade,
  empty,
  bars,
  note,
}: {
  title: string;
  rows: Array<{ name: string; pct: number }>;
  locked: boolean;
  lockedText: string;
  upgrade: string;
  empty: string;
  bars?: boolean;
  note?: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <H>{title}</H>
        {locked && <Badge variant="pro">Pro</Badge>}
      </div>
      {locked ? (
        <div className="bg-mist flex flex-1 flex-col items-start gap-2 rounded-md p-3.5 text-[13px]">
          <span className="text-ink-soft">{lockedText}</span>
          <a href="/upgrade" className={buttonClasses("lime", "sm")}>
            {upgrade}
          </a>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted text-[13px]">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5 text-[13px]">
          {rows.map((r) => (
            <li key={r.name} className="flex flex-col gap-1">
              <span className="flex justify-between gap-2">
                <span className="truncate font-semibold">{r.name}</span>
                <span className="text-muted">{r.pct}%</span>
              </span>
              {bars && (
                <span className="bg-mist h-1.5 rounded-[3px]">
                  <span className="bg-ink block h-1.5 rounded-[3px]" style={{ width: `${r.pct}%` }} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {note && !locked && (
        <p className="bg-mist text-ink-soft mt-auto rounded-[10px] p-3 text-[12px]">
          {note}
        </p>
      )}
    </Card>
  );
}

