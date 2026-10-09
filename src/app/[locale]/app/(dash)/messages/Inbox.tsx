"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import type { Message } from "@/lib/server/settings";
import { removeMessage, setMessageRead } from "../settings/actions";

const KNOWN_FIELDS = ["projectType", "budget", "deadline"];

export function Inbox({ initial, siteTitle }: { initial: Message[]; siteTitle: string }) {
  const t = useTranslations("inbox");
  const format = useFormatter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const shown = filter === "unread" ? items.filter((m) => !m.read) : items;
  const unread = items.filter((m) => !m.read).length;

  const setRead = (id: string, read: boolean) => {
    setItems((list) => list.map((m) => (m.id === id ? { ...m, read } : m)));
    void setMessageRead(id, read).then((r) => {
      if (!r.ok) toast(t("error"));
    });
  };

  const toggle = (m: Message) => {
    setOpen(open === m.id ? null : m.id);
    if (!m.read) setRead(m.id, true);
  };

  const remove = async (m: Message) => {
    if (!window.confirm(t("deleteConfirm", { name: m.name }))) return;
    const r = await removeMessage(m.id);
    if (!r.ok) return toast(t("error"));
    setItems((list) => list.filter((x) => x.id !== m.id));
    toast(t("deleted"));
  };

  return (
    <section className="border-line bg-paper flex flex-col rounded-lg border">
      <div className="border-line flex items-center gap-1 border-b p-2" role="radiogroup" aria-label={t("filter")}>
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={cx(
              "h-8 rounded-[8px] px-3 text-[13px] font-semibold",
              filter === f ? "bg-secondary-container text-on-secondary-container" : "text-ink-soft hover:bg-mist",
            )}
          >
            {f === "all" ? t("all") : t("unread", { count: unread })}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-muted p-6 text-center text-[14px]">{t("noUnread")}</p>}
      <ul className="divide-line divide-y">
        {shown.map((m) => {
          const isOpen = open === m.id;
          const fields = Object.entries(m.fields);
          const subject = t("replySubject", { site: siteTitle });
          return (
            <li key={m.id} data-testid="message" data-read={m.read}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(m)}
                className="hover:bg-mist/60 flex w-full items-start gap-3 px-4 py-3.5 text-start"
              >
                <span
                  aria-hidden
                  className={cx("mt-2 size-2 flex-none rounded-full", m.read ? "bg-transparent" : "bg-ink")}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={cx("truncate text-[15px]", m.read ? "font-medium" : "font-semibold")}>
                      {!m.read && <span className="sr-only">{t("new")} · </span>}
                      {m.name}
                    </span>
                    <time className="text-muted flex-none text-[12px]" dateTime={new Date(m.createdAt).toISOString()}>
                      {format.dateTime(new Date(m.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </span>
                  <span dir="ltr" className="text-muted truncate text-start text-[13px] rtl:text-end">
                    {m.email}
                  </span>
                  {!isOpen && <span className="text-ink-soft mt-0.5 line-clamp-1 text-[13px]">{m.body}</span>}
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-3 px-4 pb-4 ps-9">
                  {fields.length > 0 && (
                    <dl className="bg-mist grid gap-1 rounded-md p-3 text-[13px] sm:grid-cols-[auto_1fr] sm:gap-x-4">
                      {fields.map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-muted font-semibold">{KNOWN_FIELDS.includes(k) ? t(`fields.${k}`) : k}</dt>
                          <dd className="mb-1 sm:mb-0">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="text-[14px] whitespace-pre-line">{m.body}</p>
                  {m.page && (
                    <p className="text-muted text-[12px]">
                      {t("sentFrom")} <span dir="ltr">{m.page}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(subject)}`}
                      className={buttonClasses("primary", "sm")}
                    >
                      <Icon name="email" size={16} />
                      {t("reply")}
                    </a>
                    <button type="button" onClick={() => setRead(m.id, false)} className={buttonClasses("outline", "sm")}>
                      {t("markUnread")}
                    </button>
                    <button type="button" onClick={() => remove(m)} className={buttonClasses("ghost", "sm")}>
                      <Icon name="delete" size={16} />
                      {t("delete")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
