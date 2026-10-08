"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { AdminUser } from "@/lib/server/admin";
import { adminGivePro, adminRefund, adminRunDaily, adminSetProUntil, adminSuspend } from "./actions";

function useRun() {
  const t = useTranslations("admin");
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t("errors.error"));
    toast(done, "check");
    router.refresh();
  };
  return { busy, run, t };
}

export function RunDaily() {
  const { busy, run, t } = useRun();
  return (
    <Button variant="outline" disabled={busy} onClick={() => run(adminRunDaily, t("dailyDone"))}>
      {t("runDaily")}
    </Button>
  );
}

export function UserRow({ user }: { user: AdminUser }) {
  const { busy, run, t } = useRun();
  const format = useFormatter();
  const [months, setMonths] = useState("3");
  const [note, setNote] = useState("");
  const [until, setUntil] = useState(user.proUntil ? new Date(user.proUntil).toISOString().slice(0, 10) : "");
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 py-3" data-testid="admin-user" data-username={user.username}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">
            {user.name || "–"} <span className="text-muted font-normal">· {user.username || "–"}</span>
          </span>
          <span dir="ltr" className="text-muted truncate text-start text-[13px] rtl:text-end">
            {user.email}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant={user.plan === "pro" ? "brand" : "neutral"}>
            {user.plan === "pro" ? "Pro" : "Free"}
            {user.proUntil ? ` · ${format.dateTime(new Date(user.proUntil), { dateStyle: "medium" })}` : ""}
            {user.inGrace ? ` · ${t("grace")}` : ""}
          </Badge>
          {user.suspended && <Badge variant="password">{t("suspended")}</Badge>}
          <button type="button" className="text-ink-soft text-[13px] font-semibold underline" onClick={() => setOpen(!open)} aria-expanded={open}>
            {t("manage")}
          </button>
        </span>
      </div>
      {open && (
        <div className="bg-mist grid gap-3 rounded-[10px] p-3 text-[13px] md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("givePro")}</span>
            <div className="flex gap-1.5">
              <select
                aria-label={t("months")}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="border-line bg-paper h-9 rounded-md border px-2"
              >
                {[1, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {t("monthsN", { n: m })}
                  </option>
                ))}
              </select>
              <input
                aria-label={t("note")}
                placeholder={t("note")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="border-line bg-paper h-9 min-w-0 flex-1 rounded-md border px-2"
              />
            </div>
            <Button size="sm" disabled={busy} onClick={() => run(() => adminGivePro(user.uid, Number(months), note), t("given"))}>
              {t("give")}
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("setEnd")}</span>
            <input
              type="date"
              aria-label={t("setEnd")}
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="border-line bg-paper h-9 rounded-md border px-2"
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => adminSetProUntil(user.uid, until ? `${until}T12:00:00Z` : ""), t("saved"))}>
              {t("saveEnd")}
            </Button>
            <span className="text-muted text-[12px]">{t("setEndHint")}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("site")}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !user.siteId}
              onClick={() => {
                if (!user.suspended && !window.confirm(t("suspendConfirm", { name: user.username }))) return;
                void run(() => adminSuspend(user.uid, !user.suspended), user.suspended ? t("unsuspended") : t("suspendedDone"));
              }}
            >
              {user.suspended ? t("unsuspend") : t("suspend")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export interface PaymentRowData {
  id: string;
  date: number;
  who: string;
  email: string;
  months: number;
  amount: string;
  charged: string | null;
  provider: string;
  status: string;
  note: string;
  advice: "ok" | "late" | "domain";
}

export function PaymentRow({ order }: { order: PaymentRowData }) {
  const { busy, run, t } = useRun();
  const format = useFormatter();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]" data-testid="admin-payment">
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">
          {order.who} · {t("monthsN", { n: order.months })} · {order.amount}
        </span>
        <span className="text-muted">
          {format.dateTime(new Date(order.date), { dateStyle: "medium", timeStyle: "short" })} · {t(`providers.${order.provider}`)}
          {order.charged && ` · ${order.charged}`}
          {order.note && ` · ${order.note}`}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Badge variant={order.status === "paid" ? "live" : "neutral"}>{t(`status.${order.status}`)}</Badge>
        {order.status === "paid" && order.provider !== "gift" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              const warn = order.advice === "ok" ? t("refundConfirm") : t(`refundWarn.${order.advice}`);
              if (window.confirm(warn)) void run(() => adminRefund(order.id), t("refunded"));
            }}
          >
            {t("refund")}
          </Button>
        )}
      </span>
    </li>
  );
}
