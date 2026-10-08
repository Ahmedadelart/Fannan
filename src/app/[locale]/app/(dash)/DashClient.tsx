"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "firebase/auth";
import { endServerSession, useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { ActiveIcon, Icon, type IconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { hideChecklist, linkShared, setAvailable, setLocale } from "../actions";

/* ---------- sidebar ---------- */

export function DashNav({
  items,
  label,
}: {
  items: Array<{ href: string; icon: IconName; label: string; count?: number; countLabel?: string }>;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="-mx-1 flex gap-0.5 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0"
    >
      {items.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <a
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex h-10 flex-none items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] whitespace-nowrap transition-colors",
              active ? "bg-mist text-ink font-semibold" : "text-ink-soft hover:bg-mist/60 hover:text-ink font-medium",
            )}
          >
            {active ? (
              <span className="-ms-1">
                <ActiveIcon name={n.icon} size={20} />
              </span>
            ) : (
              <span className="-ms-1 flex p-1">
                <Icon name={n.icon} size={20} />
              </span>
            )}
            {n.label}
            {!!n.count && (
              <span
                className="bg-ink ms-auto flex h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-[11px] font-semibold text-white"
                data-testid="unread-count"
              >
                {n.count}
                <span className="sr-only"> {n.countLabel}</span>
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

export function LanguageButton({ locale, label }: { locale: Locale; label: string }) {
  const [pending, start] = useTransition();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      aria-label={label}
      lang={other}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setLocale(other);
          // The language decides the whole page (direction, fonts), so load it fresh.
          window.location.reload();
        })
      }
      className="border-line bg-paper text-ink hover:bg-mist h-8 flex-none rounded-[8px] border px-2.5 text-[13px] font-medium disabled:opacity-50"
    >
      {other === "ar" ? "عربي" : "English"}
    </button>
  );
}

export function LogoutButton({ label }: { label: string }) {
  const getAuth = useAuth();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut(getAuth()).catch(() => {});
        await endServerSession();
        router.replace("/login");
      }}
      className="text-muted hover:text-ink text-[13px] font-medium"
    >
      {label}
    </button>
  );
}

/* ---------- cards ---------- */

const WORK_TYPES = ["freelance", "full-time", "remote"] as const;

export function AvailabilityCard({ on, types }: { on: boolean; types: string[] }) {
  const t = useTranslations("dashboard.available");
  const toast = useToast();
  const [state, setState] = useState({ on, types });
  const [, start] = useTransition();

  function save(next: { on: boolean; types: string[] }) {
    setState(next);
    start(async () => {
      await setAvailable(next.on, next.types);
      toast(t("saved"), "check");
    });
  }

  return (
    <div className="border-line bg-paper flex flex-col gap-3.5 rounded-lg border p-5">
      <div className="font-semibold">{t("title")}</div>
      <div
        className={cx(
          "flex items-center justify-between gap-3 rounded-md p-3.5 transition-colors",
          state.on ? "bg-lime" : "bg-mist",
        )}
      >
        <span className="flex flex-col">
          <span className="font-heading font-heading-weight text-[20px] leading-tight">
            {state.on ? t("onTitle") : t("offTitle")}
          </span>
          <span className="text-ink-soft text-[13px]">{state.on ? t("onBody") : t("offBody")}</span>
        </span>
        <Toggle label={t("title")} hideLabel checked={state.on} onChange={(v) => save({ ...state, on: v })} />
      </div>
      <p className="text-muted text-[13px]">{t("note")}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("typesLabel")}>
        {WORK_TYPES.map((w) => {
          const selected = state.types.includes(w);
          return (
            <button
              key={w}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                save({ ...state, types: selected ? state.types.filter((x) => x !== w) : [...state.types, w] })
              }
              className={cx(
                "rounded-pill px-2.5 py-1 text-[12px] font-semibold transition-colors",
                selected ? "bg-ink text-white" : "bg-mist text-ink hover:bg-line",
              )}
            >
              {t(`types.${w}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShareButton({ url, label, copied }: { url: string; label: string; copied: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={cx(buttonClasses("outline", "md"), "flex-1")}
      onClick={async () => {
        const full = new URL(url, window.location.href).toString();
        try {
          if (navigator.share) await navigator.share({ url: full });
          else {
            await navigator.clipboard.writeText(full);
            toast(copied, "link");
          }
          void linkShared();
        } catch {
          /* closed the share sheet */
        }
      }}
    >
      <Icon name="link" size={18} />
      {label}
    </button>
  );
}

export function HideChecklistButton({ label }: { label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => start(() => hideChecklist())}
      className="text-ink hover:bg-mist flex size-8 items-center justify-center rounded-md"
    >
      <Icon name="close" size={16} />
    </button>
  );
}

export function TurnOnButton({ label, types }: { label: string; types: string[] }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setAvailable(true, types))}
      className={buttonClasses("lime", "md")}
    >
      {label}
    </button>
  );
}
