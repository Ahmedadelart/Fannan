"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { moveTo, startSortDrag } from "@/components/editor/sortDrag";
import { type GalleryProject } from "@/components/site/SiteRender";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { newId } from "@/lib/site/blocks";
import { hasOwnPage } from "@/lib/site/pages";
import { linksBlock } from "@/lib/site/links";
import type { PageDraft, PageType, SiteDraft } from "@/lib/site/types";
import { Label, Switch, Text, inputCls } from "../_ui/controls";

/* ---------- Pages tab ---------- */

export function PagesTab({
  draft,
  pageId,
  setPageId,
  setDraft,
  canPassword,
  onPassword,
  part = "all",
  projects = [],
}: {
  /** "list": the page switcher (drag to reorder, add pages); "settings": the current page's settings. */
  part?: "all" | "list" | "settings";
  /** The artist's projects, for "project" menu items (round 8). */
  projects?: GalleryProject[];
  draft: SiteDraft;
  pageId: string;
  setPageId: (id: string) => void;
  setDraft: (fn: (d: SiteDraft) => SiteDraft, key?: string) => void;
  canPassword: boolean;
  onPassword: (pageId: string, pw: string) => Promise<boolean>;
}) {
  const t = useTranslations("editor.pages");
  const locale = useLocale() as Locale;
  const [pw, setPw] = useState("");
  const page = draft.pages.find((p) => p.id === pageId) ?? draft.pages[0];
  const index = draft.pages.indexOf(page);
  const setPage = (patch: Partial<PageDraft>, key?: string) =>
    setDraft((d) => ({ ...d, pages: d.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)) }), key);
  // The home page stays first; the others are dragged into the order they appear in the menu.
  const list = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState<number | null>(null);
  const movePage = (id: string, toIndex: number) =>
    setDraft((d) => {
      const [home, ...rest] = d.pages;
      return { ...d, pages: [home, ...moveTo(rest, id, toIndex)] };
    });
  const dragPage = (e: React.PointerEvent, id: string) =>
    startSortDrag(e, {
      dragId: id,
      items: () =>
        [...(list.current?.querySelectorAll<HTMLElement>("[data-page-id]") ?? [])]
          .filter((el) => el.dataset.home !== "1")
          .map((el) => ({ id: el.dataset.pageId!, el })),
      onMark: (m) => {
        const top = list.current?.getBoundingClientRect().top ?? 0;
        setMark(m ? m.y - top : null);
      },
      onDrop: (i) => movePage(id, i),
    });
  const add = (type: PageType) => {
    const id = newId();
    // A project menu item starts with a project that isn't in the menu yet.
    const project =
      type === "project" ? (projects.find((x) => !draft.pages.some((p) => p.projectId === x.id)) ?? projects[0]) : undefined;
    const title = project?.title.slice(0, 60) || t(`newTitles.${type}`);
    void locale;
    setDraft((d) => ({
      ...d,
      pages: [
        ...d.pages,
        {
          id,
          type,
          title,
          slug: `${
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "page"
          }-${d.pages.length}`,
          showInNav: true,
          blocks: [],
          ...(type === "link" ? { url: "" } : {}),
          ...(project ? { projectId: project.id } : {}),
          // A link page starts with its own section, in the site's language.
          ...(type === "links" ? { blocks: [linksBlock(d.language, d.title)] } : {}),
        },
      ],
    }));
    setPageId(id);
  };

  return (
    <div className="flex flex-col gap-4 px-3.5 pt-4 pb-6">
      {part !== "settings" && (
        <ul ref={list} className="relative flex flex-col gap-1" data-testid="page-list">
          {draft.pages.map((p, i) => (
            <li
              key={p.id}
              data-page-id={p.id}
              data-home={i === 0 ? "1" : undefined}
              className="flex items-center gap-1"
            >
              {i === 0 ? (
                <span className="w-7 flex-none" aria-hidden />
              ) : (
                <button
                  type="button"
                  aria-label={t("drag", { page: p.title })}
                  title={t("drag", { page: p.title })}
                  className="text-muted hover:text-ink flex h-[42px] w-7 flex-none cursor-grab touch-none items-center justify-center"
                  onPointerDown={(e) => dragPage(e, p.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const others = draft.pages.slice(1).map((x) => x.id);
                    const at = others.indexOf(p.id) + (e.key === "ArrowUp" ? -1 : 1);
                    if (at >= 0 && at < others.length) movePage(p.id, at);
                  }}
                >
                  <Icon name="drag" size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setPageId(p.id)}
                aria-current={p.id === page.id}
                className={cx(
                  "flex h-[42px] min-w-0 flex-1 items-center justify-between rounded-[10px] px-2.5 text-start",
                  p.parentId && "ms-5",
                  p.id === page.id ? "bg-mist font-semibold" : "hover:bg-mist/60",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {p.parentId && (
                    <span aria-hidden className="text-muted">
                      ↳
                    </span>
                  )}
                  {p.title}
                </span>
                <span className="text-muted text-[12px]">
                  {i === 0 ? t("home") : p.hasPassword ? "🔒" : t(`types.${p.type}`)}
                </span>
              </button>
            </li>
          ))}
          {mark !== null && (
            <li
              aria-hidden
              className="bg-ink pointer-events-none absolute inset-x-0 h-1 rounded"
              style={{ top: mark - 3 }}
            />
          )}
        </ul>
      )}

      {part !== "list" && (
        <div className="border-line flex flex-col gap-3 rounded-md border p-3">
          <Text title={t("name")} value={page.title} onChange={(v) => setPage({ title: v }, `page-title-${page.id}`)} />
          {page.type === "project" && (
            <Label title={t("project")} hint={t("projectHint")}>
              <select
                className={inputCls}
                value={page.projectId ?? ""}
                onChange={(e) => {
                  const p = projects.find((x) => x.id === e.target.value);
                  setPage({ projectId: e.target.value, ...(p ? { title: p.title.slice(0, 60) } : {}) });
                }}
                data-testid="page-project"
              >
                {projects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </Label>
          )}
          {index > 0 && hasOwnPage(page) && (
            <Text
              title={t("slug")}
              dir="ltr"
              value={page.slug}
              onChange={(v) => setPage({ slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "") }, `page-slug-${page.id}`)}
            />
          )}
          {page.type === "link" && (
            <Text
              title={t("url")}
              dir="ltr"
              placeholder="https://"
              value={page.url ?? ""}
              onChange={(v) => setPage({ url: v }, `page-url-${page.id}`)}
            />
          )}
          <Switch title={t("inNav")} checked={page.showInNav} onChange={(v) => setPage({ showInNav: v })} />
          {index > 0 && (
            <Label
              title={t("inside")}
              hint={
                draft.pages.some((x) => x.parentId === page.id)
                  ? t("hasPages")
                  : page.type === "folder"
                    ? t("folderHint")
                    : t("insideHint")
              }
            >
              <select
                className={inputCls}
                value={page.parentId ?? ""}
                disabled={draft.pages.some((x) => x.parentId === page.id) || page.type === "folder"}
                onChange={(e) => setPage({ parentId: e.target.value || null })}
                data-testid="page-parent"
              >
                <option value="">{t("topLevel")}</option>
                {draft.pages.slice(1)
                  .filter((x) => x.id !== page.id && !x.parentId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
              </select>
            </Label>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              icon="delete"
              disabled={draft.pages.length <= 1 || index === 0}
              onClick={() => {
                setDraft((d) => ({
                  ...d,
                  pages: d.pages
                    .filter((p) => p.id !== page.id)
                    .map((p) => (p.parentId === page.id ? { ...p, parentId: null } : p)),
                }));
                setPageId(draft.pages[0].id);
              }}
            >
              {t("delete")}
            </Button>
          </div>
          {hasOwnPage(page) && (
            <div className="border-line flex flex-col gap-1.5 border-t pt-3">
              {canPassword ? (
                <form
                  className="flex flex-col gap-1.5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await onPassword(page.id, pw)) setPw("");
                  }}
                >
                  <Label title={t("password")} hint={page.hasPassword ? t("passwordSet") : undefined}>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputCls}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                    />
                  </Label>
                  <div className="flex gap-1.5">
                    <Button size="sm" type="submit" variant="outline" disabled={!pw}>
                      {t("savePassword")}
                    </Button>
                    {page.hasPassword && (
                      <Button size="sm" variant="ghost" onClick={() => onPassword(page.id, "")}>
                        {t("removePassword")}
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
                <p className="text-muted flex items-center gap-2 text-[12px]">
                  <Badge variant="brand">Pro</Badge> {t("proOnly")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {part !== "settings" && (
        <>
          <div className="text-muted text-[11px] font-semibold tracking-[0.08em] uppercase">{t("add")}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["gallery", "custom", "about", "links", "link", "folder", "project"] as PageType[])
              .filter((type) => type !== "project" || projects.length > 0)
              .map((type) => (
              <Button key={type} size="sm" variant="outline" onClick={() => add(type)}>
                {t(`types.${type}`)}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
