"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { moveTo, startSortDrag } from "@/components/editor/sortDrag";
import { socialPath as socialIconPath } from "@/components/site/socialIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { SOCIAL_NETWORKS, networkName } from "@/lib/site/blocks";
import { linkItem, networkOf } from "@/lib/site/links";
import type { BlockOf, LinkItem, LinkKind, PageDraft } from "@/lib/site/types";
import { clicksPerLink, moveShortLink, newShortLink, removeShortLink, shortLinks } from "./actions";
import { Choice, ColorField, inputCls, Switch, Text, Area, type MediaKind } from "./Panels";

type LinksBlock = BlockOf<"links">;

const ICONS: string[] = [...SOCIAL_NETWORKS, "email", "sparkle", "film", "camera", "brush", "book", "heart", "star", "download", "map", "clock", "pen"];

/** The link page's settings (round 9): profile, buttons, their look, and sharing (QR, short links). */
export function LinksSettings({
  block,
  set,
  mediaField,
  isPro,
  siteUrl,
  shortBase,
  pages,
  page,
}: {
  block: LinksBlock;
  set: (patch: Partial<LinksBlock>, key?: string) => void;
  mediaField: (title: string, id: string | null, kind: MediaKind, apply: (id: string | null) => void) => ReactNode;
  isPro: boolean;
  siteUrl: string;
  shortBase: string;
  pages: PageDraft[];
  page: PageDraft;
}) {
  const t = useTranslations("editor.links");
  const [open, setOpen] = useState<string | null>(null);
  const [clicks, setClicks] = useState<Record<string, number> | null>(null);
  const [mark, setMark] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const k = (name: string) => `${block.id}-${name}`;
  const setItems = (items: LinkItem[], key?: string) => set({ items }, key);
  const change = (id: string, patch: Partial<LinkItem>, key?: string) =>
    setItems(block.items.map((x) => (x.id === id ? { ...x, ...patch } : x)), key);

  useEffect(() => {
    if (!isPro) return;
    let live = true;
    void clicksPerLink()
      .catch(() => null)
      .then((r) => {
        if (live && r?.ok) setClicks(r.clicks);
      });
    return () => {
      live = false;
    };
  }, [isPro]);

  const add = (kind: LinkKind) => {
    const it = linkItem({ kind, title: kind === "header" ? t("newHeader") : "", icon: kind === "embed" ? "film" : "" });
    setItems([...block.items, it]);
    if (kind !== "header") setOpen(it.id);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="links-settings">
      <ShareCard siteUrl={siteUrl} shortBase={shortBase} pages={pages} page={page} isPro={isPro} />

      {/* Profile */}
      <section className="flex flex-col gap-3">
        <h3 className="m-0 text-[13px] font-semibold">{t("profile")}</h3>
        {mediaField(t("photo"), block.photoId, "image", (id) => set({ photoId: id }))}
        <Text title={t("name")} value={block.name} onChange={(v) => set({ name: v }, k("name"))} />
        <Area title={t("bio")} value={block.bio} onChange={(v) => set({ bio: v }, k("bio"))} />
        <Switch title={t("social")} checked={block.social} onChange={(v) => set({ social: v })} />
        <Switch title={t("share")} checked={block.share} onChange={(v) => set({ share: v })} />
      </section>

      {/* Links */}
      <section className="border-line flex flex-col gap-2 border-t pt-4">
        <h3 className="m-0 text-[13px] font-semibold">{t("links")}</h3>
        <ul ref={list} className="relative m-0 flex list-none flex-col gap-1.5 p-0" data-testid="links-list">
          {block.items.map((it) => (
            <li key={it.id} data-item-id={it.id} className={cx("border-line bg-paper rounded-[12px] border", it.hidden && "opacity-60")}>
              <div className="flex items-center gap-1 p-1.5">
                <button
                  type="button"
                  aria-label={t("drag")}
                  className="text-muted hover:text-ink flex h-9 w-6 flex-none cursor-grab touch-none items-center justify-center"
                  onPointerDown={(e) =>
                    startSortDrag(e, {
                      dragId: it.id,
                      items: () =>
                        Array.from(list.current?.querySelectorAll<HTMLElement>("li[data-item-id]") ?? []).map((el) => ({ id: el.dataset.itemId!, el })),
                      onMark: (m) => {
                        const top = list.current?.getBoundingClientRect().top ?? 0;
                        setMark(m ? m.y - top : null);
                      },
                      onDrop: (index) => setItems(moveTo(block.items, it.id, index)),
                    })
                  }
                >
                  <Icon name="drag" size={16} />
                </button>
                <button
                  type="button"
                  className="hover:bg-mist flex min-w-0 flex-1 flex-col items-start rounded-[8px] px-1.5 py-1 text-start"
                  onClick={() => setOpen(open === it.id ? null : it.id)}
                  aria-expanded={open === it.id}
                  data-testid="link-row"
                >
                  <span className="w-full truncate text-[13px] font-semibold">
                    {it.kind === "header" ? `— ${it.title || t("header")} —` : it.title || t("untitled")}
                  </span>
                  {it.kind !== "header" && (
                    <span className="text-muted w-full truncate text-[11px]" dir="ltr">
                      {it.url || t("noUrl")}
                    </span>
                  )}
                </button>
                {clicks && it.kind !== "header" && (
                  <span className="text-muted flex-none text-[11px] tabular-nums" title={t("clicks30")}>
                    {t("clicks", { count: clicks[it.id] ?? 0 })}
                  </span>
                )}
                {(it.from || it.until) && <Icon name="clock" size={16} />}
                <button
                  type="button"
                  aria-label={it.hidden ? t("show") : t("hide")}
                  aria-pressed={!it.hidden}
                  className="text-muted hover:text-ink flex size-8 flex-none items-center justify-center"
                  onClick={() => change(it.id, { hidden: !it.hidden })}
                >
                  <Icon name={it.hidden ? "hidden" : "preview"} size={16} />
                </button>
              </div>
              {open === it.id && (
                <div className="border-line flex flex-col gap-3 border-t p-3">
                  <Text title={it.kind === "header" ? t("headerText") : t("title")} value={it.title} onChange={(v) => change(it.id, { title: v }, k(`t${it.id}`))} />
                  {it.kind !== "header" && (
                    <Text
                      title={it.kind === "embed" ? t("embedUrl") : t("url")}
                      dir="ltr"
                      placeholder={it.kind === "embed" ? "https://youtu.be/…" : "https://"}
                      value={it.url}
                      onChange={(v) => change(it.id, { url: v }, k(`u${it.id}`))}
                    />
                  )}
                  {it.kind === "embed" && <p className="text-muted m-0 text-[12px]">{t("embedHint")}</p>}
                  {it.kind !== "header" && (
                    <>
                      {mediaField(t("thumb"), it.mediaId, "image", (id) => change(it.id, { mediaId: id }))}
                      {!it.mediaId && (
                        <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
                          {t("icon")}
                          <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label={t("icon")}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={!it.icon}
                              onClick={() => change(it.id, { icon: "" })}
                              className={cx("flex h-8 items-center justify-center rounded-[8px] border text-[10px]", !it.icon ? "border-primary bg-secondary-container" : "border-line hover:bg-mist")}
                              title={t("iconAuto")}
                            >
                              {t("auto")}
                            </button>
                            {ICONS.map((name) => (
                              <button
                                key={name}
                                type="button"
                                role="radio"
                                aria-checked={it.icon === name}
                                aria-label={SOCIAL_NETWORKS.includes(name) ? networkName(name, "") : name}
                                onClick={() => change(it.id, { icon: name })}
                                className={cx("flex h-8 items-center justify-center rounded-[8px] border", it.icon === name ? "border-primary bg-secondary-container" : "border-line hover:bg-mist")}
                              >
                                <LinkIcon name={name} />
                              </button>
                            ))}
                          </div>
                          {!it.icon && it.url && <span className="text-muted font-normal">{t("iconGuess", { name: networkName(networkOf(it.url) || "website", it.url) })}</span>}
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <span className="flex items-center gap-2 text-[12px] font-semibold">
                          {t("highlight")} {!isPro && <Badge variant="brand">Pro</Badge>}
                        </span>
                        <Choice
                          title=""
                          value={it.highlight}
                          options={(["none", "wiggle", "pulse", "glow", "shine"] as const).map((h) => [h, t(`highlights.${h}`)])}
                          onChange={(v) => change(it.id, { highlight: v })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-2 text-[12px] font-semibold">
                          {t("schedule")} {!isPro && <Badge variant="brand">Pro</Badge>}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1 text-[11px]">
                            {t("from")}
                            <input type="date" className={inputCls} value={it.from} onChange={(e) => change(it.id, { from: e.target.value })} data-testid="link-from" />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px]">
                            {t("until")}
                            <input type="date" className={inputCls} value={it.until} onChange={(e) => change(it.id, { until: e.target.value })} />
                          </label>
                        </div>
                        {!isPro && (it.highlight !== "none" || it.from || it.until) && <p className="text-muted m-0 text-[12px]">{t("proNote")}</p>}
                      </div>
                    </>
                  )}
                  <Button size="sm" variant="ghost" icon="delete" onClick={() => setItems(block.items.filter((x) => x.id !== it.id))}>
                    {t("remove")}
                  </Button>
                </div>
              )}
            </li>
          ))}
          {mark !== null && <li aria-hidden className="bg-primary pointer-events-none absolute inset-x-0 h-1 rounded" style={{ top: mark - 3 }} />}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" icon="add" onClick={() => add("link")} data-testid="links-add">
            {t("addLink")}
          </Button>
          <Button size="sm" variant="outline" icon="text" onClick={() => add("header")}>
            {t("addHeader")}
          </Button>
          <Button size="sm" variant="outline" icon="film" onClick={() => add("embed")}>
            {t("addEmbed")}
          </Button>
        </div>
        {!isPro && <p className="text-muted m-0 text-[12px]">{t("statsPro")}</p>}
      </section>

      {/* Buttons */}
      <section className="border-line flex flex-col gap-3 border-t pt-4">
        <h3 className="m-0 text-[13px] font-semibold">{t("buttons")}</h3>
        <Choice
          title={t("style")}
          value={block.button.style}
          options={(["fill", "outline", "soft", "shadow"] as const).map((s) => [s, t(`styles.${s}`)])}
          onChange={(v) => set({ button: { ...block.button, style: v } })}
        />
        <Choice
          title={t("shape")}
          value={block.button.shape}
          options={(["square", "rounded", "pill"] as const).map((s) => [s, t(`shapes.${s}`)])}
          onChange={(v) => set({ button: { ...block.button, shape: v } })}
        />
        <ColorField title={t("color")} value={block.button.color} themeLabel={t("themeColor")} onChange={(v) => set({ button: { ...block.button, color: v } }, k("bc"))} />
        <ColorField title={t("textColor")} value={block.button.textColor} themeLabel={t("auto")} onChange={(v) => set({ button: { ...block.button, textColor: v } }, k("btc"))} />
        <p className="text-muted m-0 text-[12px]">{t("bgHint")}</p>
      </section>
    </div>
  );
}

function LinkIcon({ name }: { name: string }) {
  if (SOCIAL_NETWORKS.includes(name) || name === "email")
    return (
      <svg viewBox="0 0 24 24" className="block size-4" style={{ fill: "currentColor" }} aria-hidden>
        <path d={socialIconPath(name)} />
      </svg>
    );
  return <Icon name={name as IconName} size={16} />;
}

/* ---------- sharing: the address, a QR code, short links ---------- */

function ShareCard({
  siteUrl,
  shortBase,
  pages,
  page,
  isPro,
}: {
  siteUrl: string;
  shortBase: string;
  pages: PageDraft[];
  page: PageDraft;
  isPro: boolean;
}) {
  const t = useTranslations("editor.links");
  const tp = useTranslations("projects");
  const toast = useToast();
  const pageUrl = `${siteUrl.replace(/\/$/, "")}${page.slug ? `/${page.slug}` : ""}`;
  const [links, setLinks] = useState<Array<{ code: string; path: string; custom: boolean; clicks: number }> | null>(null);
  const [qrFor, setQrFor] = useState(pageUrl);
  const [qr, setQr] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorText = (code: string) =>
    code === "limit" ? t("shortLimit") : code === "slug-taken" ? t("shortTaken") : code === "bad-link" ? t("shortBad") : tp.has(`errors.${code}`) ? tp(`errors.${code}`, { image: 30, pdf: 50 }) : tp("errors.error");

  useEffect(() => {
    let live = true;
    void shortLinks()
      .catch(() => null)
      .then((r) => {
        if (live) setLinks(r?.ok ? r.links : []);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(qrFor, { margin: 1, width: 480, color: { dark: "#141414", light: "#FFFFFF" } }).then((d) => {
      if (live) setQr(d);
    });
    return () => {
      live = false;
    };
  }, [qrFor]);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast(t("copied"), "check");
  };
  const download = async (kind: "png" | "svg") => {
    const name = `qr-${qrFor.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`;
    const href =
      kind === "png"
        ? await QRCode.toDataURL(qrFor, { margin: 2, width: 1200 })
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await QRCode.toString(qrFor, { type: "svg", margin: 2 }))}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = `${name}.${kind}`;
    a.click();
  };
  const make = async (code?: string) => {
    setBusy(true);
    setProblem(null);
    const r = await newShortLink(page.slug ? `/${page.slug}` : "/", code).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setProblem(errorText(r?.error ?? "error"));
    setLinks((ls) => [r.link, ...(ls ?? [])]);
    setQrFor(`${shortBase}${r.link.code}`);
    setCustom("");
  };
  const own = pages.filter((p) => p.type !== "link" && p.type !== "folder" && p.type !== "project");

  return (
    <section className="bg-secondary-container/40 border-line flex flex-col gap-3 rounded-[16px] border p-3" data-testid="links-share">
      <h3 className="m-0 flex items-center gap-2 text-[13px] font-semibold">
        <Icon name="link" size={16} />
        {t("shareTitle")}
      </h3>
      <div className="flex items-center gap-1.5">
        <input readOnly className={cx(inputCls, "min-w-0 flex-1 text-[12px]")} dir="ltr" value={pageUrl} aria-label={t("address")} />
        <Button size="sm" variant="outline" onClick={() => copy(pageUrl)}>
          {t("copy")}
        </Button>
      </div>
      <p className="text-muted m-0 text-[11px]">{t("publishFirst")}</p>

      <div className="flex flex-wrap items-start gap-3">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={t("qrAlt", { url: qrFor })} className="size-28 flex-none rounded-[8px] bg-white" data-testid="links-qr" />
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-muted truncate text-[11px]" dir="ltr">
            {qrFor.replace(/^https?:\/\//, "")}
          </span>
          <span className="text-[12px] font-semibold">{t("downloadQr")}</span>
          <span className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" icon="download" onClick={() => void download("png")} title={t("downloadPng")}>
              PNG
            </Button>
            <Button size="sm" variant="outline" icon="download" onClick={() => void download("svg")} title={t("downloadSvg")}>
              SVG
            </Button>
          </span>
          {qrFor !== pageUrl && (
            <button type="button" className="text-primary text-start text-[12px] font-semibold hover:underline" onClick={() => setQrFor(pageUrl)}>
              {t("qrPage")}
            </button>
          )}
        </div>
      </div>

      <div className="border-line flex flex-col gap-2 border-t pt-3">
        <span className="text-[12px] font-semibold">{t("shortLinks")}</span>
        {links === null ? (
          <span className="text-muted text-[12px]">…</span>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="short-links">
            {links.map((l) => {
              const url = `${shortBase}${l.code}`;
              return (
                <li key={l.code} className="bg-paper border-line flex flex-col gap-1.5 rounded-[10px] border p-2">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold" dir="ltr" data-testid="short-link">
                      {url.replace(/^https?:\/\//, "")}
                    </span>
                    <span className="text-muted text-[11px] tabular-nums">{t("visits", { count: l.clicks })}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    <select
                      className={cx(inputCls, "h-8 w-auto max-w-[140px] text-[12px]")}
                      aria-label={t("goesTo")}
                      value={l.path}
                      onChange={(e) => {
                        const path = e.target.value;
                        setLinks((ls) => ls?.map((x) => (x.code === l.code ? { ...x, path } : x)) ?? ls);
                        void moveShortLink(l.code, path);
                      }}
                    >
                      {own.map((p) => (
                        <option key={p.id} value={p.slug ? `/${p.slug}` : "/"}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" onClick={() => copy(url)}>
                      {t("copy")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setQrFor(url)}>
                      QR
                    </Button>
                    <button
                      type="button"
                      aria-label={t("deleteShort")}
                      className="text-muted hover:text-ink ms-auto flex size-8 items-center justify-center"
                      onClick={async () => {
                        if (!window.confirm(t("deleteShortConfirm"))) return;
                        setLinks((ls) => ls?.filter((x) => x.code !== l.code) ?? ls);
                        if (qrFor === url) setQrFor(pageUrl);
                        await removeShortLink(l.code).catch(() => null);
                      }}
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Button size="sm" variant="outline" icon="add" disabled={busy} onClick={() => void make()} data-testid="short-make">
          {t("makeShort")}
        </Button>
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-[12px] font-semibold">
            {t("customShort")} {!isPro && <Badge variant="brand">Pro</Badge>}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted flex-none text-[12px]" dir="ltr">
              {shortBase.replace(/^https?:\/\//, "")}
            </span>
            <input
              className={cx(inputCls, "min-w-0 flex-1 text-[12px]")}
              dir="ltr"
              placeholder="nour"
              value={custom}
              disabled={!isPro}
              onChange={(e) => setCustom(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              aria-label={t("customShort")}
              data-testid="short-custom"
            />
            <Button size="sm" variant="outline" disabled={!isPro || busy || custom.length < 3} onClick={() => void make(custom)}>
              {t("create")}
            </Button>
          </div>
          {!isPro && <span className="text-muted text-[11px]">{t("customPro")}</span>}
        </div>
        {problem && (
          <p role="alert" className="m-0 text-[12px] font-semibold">
            {problem}
          </p>
        )}
      </div>
    </section>
  );
}
