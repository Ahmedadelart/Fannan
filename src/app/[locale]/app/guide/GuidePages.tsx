"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { moveTo, startSortDrag } from "@/components/editor/sortDrag";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import {
  folderTitle,
  newGuidePage,
  pageSuggestions,
  suggestionTitle,
  tidyPages,
  type GuideAnswers,
  type GuidePage,
  type GuidePageKind,
} from "@/lib/site/guide";
import { Kicker, outlineButton, Question } from "./ui";

/**
 * Step 4: the menu as a list of cards. Drag to reorder (a page dropped under a dropdown goes inside
 * it), click a name to rename it, turn a page into a dropdown, hide it from the menu or remove it.
 */
export function GuidePages({
  answers,
  setAnswers,
  language,
}: {
  answers: GuideAnswers;
  setAnswers: (fn: (a: GuideAnswers) => GuideAnswers) => void;
  language: Locale;
}) {
  const t = useTranslations("guide.pages");
  const pages = tidyPages(answers.pages);
  const list = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const setPages = (fn: (p: GuidePage[]) => GuidePage[]) => setAnswers((a) => ({ ...a, pages: tidyPages(fn(tidyPages(a.pages))) }));
  const change = (id: string, patch: Partial<GuidePage>) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const folders = pages.filter((p) => p.kind === "folder");

  const drop = (id: string, index: number) =>
    setPages((ps) => {
      const [home, ...rest] = ps;
      const dragged = rest.find((p) => p.id === id);
      if (!dragged) return ps;
      // A dropdown moves with the pages inside it.
      const group = dragged.kind === "folder" ? rest.filter((p) => p.parentId === id) : [];
      const others = rest.filter((p) => p.id !== id && !group.includes(p));
      const moved = moveTo([...others, dragged], id, index);
      const at = moved.indexOf(dragged);
      const above = moved[at - 1];
      // Dropped right under a dropdown or one of its pages: it joins that dropdown.
      const parentId =
        dragged.kind === "folder" ? null : above?.kind === "folder" ? above.id : above?.parentId ? above.parentId : null;
      moved[at] = { ...dragged, parentId };
      moved.splice(at + 1, 0, ...group);
      return [home, ...moved];
    });

  const addPage = (title: string, kind: GuidePageKind) =>
    setPages((ps) => [...ps, newGuidePage(title, kind)]);

  const taken = new Set(pages.map((p) => p.title.toLowerCase()));
  const suggestions = pageSuggestions(answers.discipline)
    .map((k) => ({ key: k, title: suggestionTitle(k, language) }))
    .filter((s) => !taken.has(s.title.toLowerCase()));

  return (
    <section className="flex flex-col gap-5">
      <Kicker>{t("kicker")}</Kicker>
      <Question>{t("title")}</Question>
      <p className="text-muted m-0 text-[16px]">{t("hint")}</p>

      <ul ref={list} className="relative m-0 flex list-none flex-col gap-2 p-0" data-testid="guide-pages">
        {pages.map((p, i) => {
          const isHome = i === 0;
          const kids = pages.filter((c) => c.parentId === p.id).length;
          return (
            <li
              key={p.id}
              data-page-id={p.id}
              data-home={isHome ? "1" : undefined}
              data-parent={p.parentId ?? undefined}
              className={cx(
                "border-line bg-paper relative flex min-h-[56px] items-center gap-2 rounded-[16px] border px-2 py-1.5",
                p.parentId && "ms-8",
                p.kind === "folder" && "bg-secondary-container/40 border-dashed",
                !p.inMenu && "opacity-60",
              )}
            >
              {isHome ? (
                <span className="text-muted flex w-8 flex-none justify-center" aria-hidden>
                  <Icon name="dashboard" size={18} />
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={t("drag", { page: p.title })}
                  className="text-muted hover:text-ink flex h-10 w-8 flex-none cursor-grab touch-none items-center justify-center"
                  onPointerDown={(e) =>
                    startSortDrag(e, {
                      dragId: p.id,
                      items: () =>
                        // A dropdown is dragged with its pages, so they don't count as places to drop.
                        Array.from(list.current?.querySelectorAll<HTMLElement>("li[data-page-id]:not([data-home])") ?? [])
                          .filter((el) => el.dataset.parent !== p.id)
                          .map((el) => ({ id: el.dataset.pageId!, el })),
                      onMark: (m) => {
                        const top = list.current?.getBoundingClientRect().top ?? 0;
                        setMark(m ? m.y - top : null);
                      },
                      onDrop: (index) => drop(p.id, index),
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const others = pages.slice(1).filter((x) => x.id !== p.id);
                    const now = pages.slice(1).findIndex((x) => x.id === p.id);
                    const at = now + (e.key === "ArrowUp" ? -1 : 1);
                    if (at >= 0 && at <= others.length) drop(p.id, at);
                  }}
                >
                  <Icon name="drag" size={18} />
                </button>
              )}
              {p.parentId && (
                <span aria-hidden className="text-muted">
                  ↳
                </span>
              )}
              {editing === p.id ? (
                <input
                  autoFocus
                  aria-label={t("rename")}
                  className="border-primary bg-paper h-10 min-w-0 flex-1 rounded-[10px] border px-2.5 text-[16px] font-semibold outline-none"
                  defaultValue={p.title}
                  maxLength={60}
                  onBlur={(e) => {
                    change(p.id, { title: e.target.value.trim() || p.title });
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  data-testid="guide-page-rename"
                />
              ) : (
                <button
                  type="button"
                  className="hover:bg-mist flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2.5 text-start text-[16px] font-semibold"
                  onClick={() => setEditing(p.id)}
                  title={t("rename")}
                  data-testid="guide-page-name"
                >
                  <span className="truncate">{p.title}</span>
                  {p.kind === "folder" && <Icon name="chevron-down" size={16} />}
                </button>
              )}
              <span className="text-muted hidden text-[12px] sm:inline">
                {isHome ? t("homeTag") : p.kind === "folder" ? t("folderTag", { count: kids }) : !p.inMenu ? t("hiddenTag") : ""}
              </span>
              {!isHome && (
                <span className="relative">
                  <button
                    type="button"
                    aria-label={t("more", { page: p.title })}
                    aria-expanded={menu === p.id}
                    className="text-muted hover:text-ink hover:bg-mist flex size-10 items-center justify-center rounded-full text-[20px] leading-none"
                    onClick={() => setMenu(menu === p.id ? null : p.id)}
                    data-testid="guide-page-menu"
                  >
                    ⋮
                  </button>
                  {menu === p.id && (
                    <span
                      role="menu"
                      className="bg-paper border-line absolute end-0 top-full z-20 mt-1 flex w-[240px] flex-col rounded-[16px] border p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.14)]"
                      onMouseLeave={() => setMenu(null)}
                      onClick={() => setMenu(null)}
                    >
                      {p.kind !== "folder" && !kids && (
                        <MenuButton
                          onClick={() => change(p.id, { kind: "folder", parentId: null, template: null })}
                          label={t("toFolder")}
                        />
                      )}
                      {p.kind === "folder" && (
                        <MenuButton onClick={() => change(p.id, { kind: "page", template: "d-title" })} label={t("toPage")} />
                      )}
                      {p.kind !== "folder" &&
                        folders
                          .filter((f) => f.id !== p.parentId)
                          .map((f) => (
                            <MenuButton key={f.id} onClick={() => change(p.id, { parentId: f.id })} label={t("moveInto", { folder: f.title })} />
                          ))}
                      {p.parentId && <MenuButton onClick={() => change(p.id, { parentId: null })} label={t("moveOut")} />}
                      <MenuButton onClick={() => change(p.id, { inMenu: !p.inMenu })} label={p.inMenu ? t("hide") : t("show")} />
                      <MenuButton
                        danger
                        onClick={() =>
                          setPages((ps) => ps.filter((x) => x.id !== p.id).map((x) => (x.parentId === p.id ? { ...x, parentId: null } : x)))
                        }
                        label={t("remove")}
                      />
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
        {mark !== null && <li aria-hidden className="bg-primary pointer-events-none absolute inset-x-0 h-1 rounded" style={{ top: mark - 4 }} />}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={outlineButton} onClick={() => addPage(t("newPage"), "page")} data-testid="guide-add-page">
          <Icon name="add" size={16} />
          {t("addPage")}
        </button>
        <button type="button" className={outlineButton} onClick={() => addPage(folderTitle(language), "folder")} data-testid="guide-add-folder">
          <Icon name="chevron-down" size={16} />
          {t("addFolder")}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-muted text-[13px] font-semibold">{t("suggestions")}</span>
          <div className="flex flex-wrap gap-2" data-testid="guide-suggestions">
            {suggestions.map((s) => (
              <button
                key={s.key}
                type="button"
                className="border-line bg-paper hover:bg-mist rounded-pill inline-flex h-9 items-center gap-1 border px-3 text-[14px] font-semibold"
                onClick={() => addPage(s.title, s.key === "work" ? "work" : "page")}
              >
                <Icon name="add" size={16} />
                {s.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-muted m-0 text-[13px]">{t("tip")}</p>
    </section>
  );
}

function MenuButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx("hover:bg-mist rounded-[10px] px-3 py-2 text-start text-[14px]", danger && "text-error")}
    >
      {label}
    </button>
  );
}
