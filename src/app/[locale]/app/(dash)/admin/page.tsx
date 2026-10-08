import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { findUsers, isAdmin, listReports, overview, refundAdvice } from "@/lib/server/admin";
import { surfaceUrls } from "@/lib/server/urls";
import { checkoutProvider } from "@/lib/server/billing";
import { PaymentRow, ReportRow, RunDaily, UserRow } from "./AdminClient";

// Admin (Ahmed only): numbers, users, payments, Pro gifts, refunds, suspending sites.
// Anyone else gets a plain 404, so the page's existence isn't revealed.

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Admin", robots: { index: false } };
}

const TABS = ["users", "payments", "reports"] as const;

export default async function AdminPage({ params, searchParams }: PageProps<"/[locale]/app/admin">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  if (!(await isAdmin())) notFound();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab as "users") ? (sp.tab as (typeof TABS)[number]) : "users";
  const q = typeof sp.q === "string" ? sp.q : "";
  const [stats, users, reports, done] = await Promise.all([
    overview(),
    tab === "users" ? findUsers(q) : Promise.resolve([]),
    listReports("open"),
    tab === "reports" ? listReports("done") : Promise.resolve([]),
  ]);
  const urls = await surfaceUrls();
  const advice =
    tab === "payments"
      ? await Promise.all(stats.orders.map(async (o) => [o.id, o.status === "paid" ? await refundAdvice(o) : "ok"] as const))
      : [];
  const adviceById = new Map(advice);
  const n = (v: number) => format.number(v);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">{t("title")}</h1>
          <p className="text-muted mt-1">
            {t("sub")} · {t(`provider.${checkoutProvider() ?? "none"}`)}
          </p>
        </div>
        <RunDaily />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" data-testid="admin-numbers">
        {[
          [t("users"), n(stats.users)],
          [t("proNow"), n(stats.pro)],
          [t("revenueEgp"), `${n(stats.revenue.EGP.all)} EGP`, t("last30", { v: `${n(stats.revenue.EGP.last30)} EGP` })],
          [t("revenueUsd"), `$${n(stats.revenue.USD.all)}`, t("last30", { v: `$${n(stats.revenue.USD.last30)}` })],
        ].map(([label, value, sub]) => (
          <section key={label} className="border-line bg-paper flex flex-col gap-1 rounded-lg border p-5">
            <span className="text-muted text-[13px]">{label}</span>
            <span className="font-heading font-heading-weight text-[28px] leading-none">{value}</span>
            {sub && <span className="text-muted text-[12px]">{sub}</span>}
          </section>
        ))}
      </div>

      <nav className="flex gap-1" aria-label={t("sections")}>
        {TABS.map((k) => (
          <a
            key={k}
            href={`/admin?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cx(
              "flex h-9 items-center rounded-[8px] px-3.5 text-[14px] font-semibold",
              tab === k ? "bg-ink text-white" : "border-line bg-paper text-ink-soft border",
            )}
          >
            {t(`tabs.${k}`)}
            {k === "reports" && reports.length > 0 && ` (${reports.length})`}
          </a>
        ))}
      </nav>

      {tab === "users" && (
        <section className="border-line bg-paper flex flex-col gap-3 rounded-lg border p-5">
          <form className="flex gap-2" action="/admin">
            <input type="hidden" name="tab" value="users" />
            <input
              name="q"
              defaultValue={q}
              placeholder={t("search")}
              aria-label={t("search")}
              className="border-line h-10 min-w-0 flex-1 rounded-md border px-3"
            />
            <button className="bg-ink h-10 rounded-md px-4 text-[14px] font-semibold text-white">{t("find")}</button>
          </form>
          {users.length === 0 && <p className="text-muted text-[13px]">{t("noUsers")}</p>}
          <ul className="divide-line divide-y">
            {users.map((u) => (
              <UserRow key={u.uid} user={u} />
            ))}
          </ul>
        </section>
      )}

      {tab === "payments" && (
        <section className="border-line bg-paper flex flex-col gap-3 rounded-lg border p-5">
          {stats.orders.length === 0 && <p className="text-muted text-[13px]">{t("noPayments")}</p>}
          <ul className="divide-line divide-y">
            {stats.orders.map((o) => (
              <PaymentRow
                key={o.id}
                order={{
                  id: o.id,
                  date: o.paidAt ?? o.createdAt,
                  who: o.username || o.email,
                  email: o.email,
                  months: o.months,
                  amount: o.provider === "gift" ? "–" : o.currency === "EGP" ? `${n(o.amount)} EGP` : `$${n(o.amount)}`,
                  charged:
                    o.chargeCurrency !== o.currency
                      ? `${n(Math.round(o.chargeCents / 100))} ${o.chargeCurrency} @ ${o.rate?.toFixed(2)}`
                      : null,
                  provider: o.provider,
                  status: o.status,
                  note: o.note ?? "",
                  advice: adviceById.get(o.id) ?? "ok",
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {tab === "reports" && (
        <section className="border-line bg-paper flex flex-col gap-3 rounded-lg border p-5">
          <h2 className="text-[16px] font-semibold">{t("openReports", { count: reports.length })}</h2>
          {reports.length === 0 && <p className="text-muted text-[13px]">{t("noReports")}</p>}
          <ul className="divide-line divide-y">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} siteHref={r.username ? urls.site(r.username, "/") : null} />
            ))}
          </ul>
          {done.length > 0 && (
            <details>
              <summary className="text-ink-soft cursor-pointer text-[14px] font-semibold">{t("doneReports")}</summary>
              <ul className="divide-line divide-y">
                {done.slice(0, 30).map((r) => (
                  <ReportRow key={r.id} report={r} siteHref={null} />
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </>
  );
}
