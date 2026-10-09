"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IMAGE_ACCEPT, uploadFile, type Uploaded } from "@/components/editor/upload";
import { ScaledSite } from "@/components/site/ScaledSite";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Controls";
import { cx } from "@/lib/cx";
import { kindByKey, networkName, SOCIAL_NETWORKS } from "@/lib/site/blocks";
import {
  blankExtra,
  EXTRAS,
  isProExtra,
  TEMPLATES,
  tidyPages,
  type ExtraKey,
  type ExtraSpec,
  type GuideAnswers,
  type GuideExtra,
  type GuideItem,
  type GuidePage,
} from "@/lib/site/guide";
import type { Block, SiteDraft } from "@/lib/site/types";
import { areaCls, fieldCls, Kicker, outlineButton, Problem, Question, Thumb } from "./ui";

type SetAnswers = (fn: (a: GuideAnswers) => GuideAnswers) => void;

/** Step 7: one screen per page — how it starts, its pictures, project cards and extra sections. */
export function GuidePageByPage({
  answers,
  setAnswers,
  at,
  setAt,
  draft,
  media,
  addMedia,
  projects,
}: {
  answers: GuideAnswers;
  setAnswers: SetAnswers;
  at: number;
  setAt: (n: number) => void;
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  addMedia: (m: Uploaded) => void;
  projects: GalleryProject[];
}) {
  const t = useTranslations("guide.page");
  const tp = useTranslations("projects");
  const pages = tidyPages(answers.pages).filter((p) => p.kind !== "folder");
  const page = pages[Math.max(0, at)];
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  if (!page) return null;
  const kind = page.kind === "folder" ? "page" : page.kind;
  const set = (patch: Partial<GuidePage>) =>
    setAnswers((a) => ({ ...a, pages: a.pages.map((p) => (p.id === page.id ? { ...p, ...patch } : p)) }));
  const setExtra = (key: ExtraKey, patch: Partial<GuideExtra>) =>
    setAnswers((a) => ({
      ...a,
      pages: a.pages.map((p) =>
        p.id === page.id ? { ...p, extras: { ...p.extras, [key]: { ...blankExtra(), ...p.extras[key], ...patch } } } : p,
      ),
    }));
  const errorText = (code: string) => (tp.has(`errors.${code}`) ? tp(`errors.${code}`, { image: 30, pdf: 50 }) : tp("errors.error"));

  async function upload(files: File[], done: (m: Uploaded) => void) {
    setUploading((n) => n + files.length);
    setProblem(null);
    for (const f of files) {
      const r = await uploadFile("_library", f);
      setUploading((n) => n - 1);
      if (!r.ok) {
        setProblem(errorText(r.error));
        continue;
      }
      addMedia(r.media);
      done(r.media);
    }
  }
  const mine = projects.filter((p) => answers.projects.some((x) => x.id === p.id));

  return (
    <section className="flex flex-col gap-6">
      <Kicker>{t("kicker", { n: at + 1, total: pages.length })}</Kicker>
      <Question>{t("title", { page: page.title })}</Question>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("pages")}>
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={i === at}
            onClick={() => setAt(i)}
            className={cx(
              "rounded-pill h-9 px-3.5 text-[14px] font-semibold",
              i === at ? "bg-secondary-container text-on-secondary-container" : "border-line bg-paper hover:bg-mist border",
            )}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* How the page starts */}
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-[18px] font-semibold">{t("start")}</h2>
        <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3" role="radiogroup" aria-label={t("start")} data-testid="guide-templates">
          {TEMPLATES[kind].map((key) => (
            <TemplateTile key={key} k={key} on={page.template === key} draft={draft} media={media} onPick={() => set({ template: key })} />
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={page.template === null}
            onClick={() => set({ template: null })}
            className={cx(
              "text-muted flex min-h-[90px] items-center justify-center rounded-[16px] border-2 border-dashed text-[14px] font-semibold",
              page.template === null ? "border-primary text-ink" : "border-line hover:bg-mist",
            )}
          >
            {t("noStart")}
          </button>
        </div>
      </div>

      {/* Pictures */}
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-[18px] font-semibold">{t("pictures")}</h2>
        <p className="text-muted m-0 text-[14px]">{t("picturesHint")}</p>
        <div className="flex flex-wrap gap-2" data-testid="guide-page-pictures">
          {page.mediaIds.map((id) => (
            <span key={id} className="relative">
              <Thumb m={media[id]} className="size-20 rounded-[12px]" />
              <button
                type="button"
                aria-label={t("removePicture")}
                className="bg-paper absolute -end-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full shadow"
                onClick={() => set({ mediaIds: page.mediaIds.filter((x) => x !== id) })}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="border-outline text-muted hover:bg-mist flex size-20 flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed text-[12px] font-semibold"
            onClick={() => input.current?.click()}
          >
            <Icon name="add" size={18} />
            {uploading ? `${uploading}…` : t("add")}
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept={IMAGE_ACCEPT}
            className="sr-only"
            aria-label={t("pictures")}
            data-testid="guide-page-files"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 40);
              e.target.value = "";
              const pageId = page.id;
              void upload(files, (m) =>
                setAnswers((a) => ({
                  ...a,
                  pages: a.pages.map((p) => (p.id === pageId ? { ...p, mediaIds: [...p.mediaIds, m.id] } : p)),
                })),
              );
            }}
          />
        </div>
        {problem && <Problem>{problem}</Problem>}
      </div>

      {/* Project cards */}
      <div className="border-line bg-paper flex flex-col gap-3 rounded-[20px] border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[16px] font-semibold">{t("projects")}</span>
            <span className="text-muted text-[13px]">{mine.length ? t("projectsHint") : t("projectsNone")}</span>
          </span>
          <Toggle label={t("projects")} hideLabel checked={page.showProjects} onChange={(v) => set({ showProjects: v })} />
        </div>
        {page.showProjects && mine.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {mine.map((p) => {
              const on = page.projectIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ projectIds: on ? page.projectIds.filter((x) => x !== p.id) : [...page.projectIds, p.id] })}
                  className={cx(
                    "rounded-pill h-8 px-3 text-[13px] font-semibold",
                    on ? "bg-secondary-container text-on-secondary-container" : "border-line hover:bg-mist border",
                  )}
                >
                  {p.title}
                </button>
              );
            })}
            <span className="text-muted self-center text-[12px]">{t("projectsPick")}</span>
          </div>
        )}
      </div>

      {/* Extra sections: tick to add, then fill in only what it needs */}
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-[18px] font-semibold">{t("extras")}</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="guide-extras">
          {EXTRAS.map((spec) => {
            const e = page.extras[spec.key];
            const on = !!e?.on;
            return (
              <li key={spec.key} className={cx("border-line rounded-[16px] border", on ? "bg-paper" : "bg-paper/60")}>
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-3">
                  <input
                    type="checkbox"
                    className="accent-primary size-5"
                    checked={on}
                    onChange={() => setExtra(spec.key, { on: !on, items: e?.items.length ? e.items : spec.fields ? [blankItem()] : [] })}
                    data-testid={`guide-extra-${spec.key}`}
                  />
                  <span className="flex-1 text-[15px] font-semibold">{t(`x.${spec.key}`)}</span>
                  {isProExtra(spec.key) && <Badge variant="brand">Pro</Badge>}
                </label>
                {on && (
                  <div className="border-line flex flex-col gap-2.5 border-t px-3.5 py-3">
                    <ExtraFields
                      spec={spec}
                      extra={{ ...blankExtra(), ...e }}
                      set={(patch) => setExtra(spec.key, patch)}
                      answers={answers}
                      setAnswers={setAnswers}
                      media={media}
                      upload={upload}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function blankItem(): GuideItem {
  return { title: "", text: "", meta: "", mediaId: null };
}

/** A small real preview of a section in the artist's look. */
function TemplateTile({
  k,
  on,
  draft,
  media,
  onPick,
}: {
  k: string;
  on: boolean;
  draft: SiteDraft;
  media: Record<string, SiteMedia>;
  onPick: () => void;
}) {
  const tb = useTranslations("editor.blocks");
  const sample = useMemo(() => kindByKey(k)?.make(draft.language) ?? null, [k, draft.language]);
  if (!sample) return null;
  const site: SiteDraft = { ...draft, pages: [{ id: "t", slug: "", title: "", type: "custom", showInNav: false, blocks: [sample as Block] }] };
  const h = sample.type === "free" ? Math.round(sample.rows * 47 + 40 + (sample.style ? sample.style.padTop + sample.style.padBottom : 0)) : 560;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={tb(k)}
      onClick={onPick}
      className={cx("flex flex-col gap-1.5 overflow-hidden rounded-[16px] border-2 p-1 text-start", on ? "border-primary" : "border-line hover:border-outline")}
    >
      <span className="block overflow-hidden rounded-[12px]">
        <ScaledSite width={1200} height={Math.min(h, 900)}>
          <SiteRender site={site} pageId="t" media={media} editing bare />
        </ScaledSite>
      </span>
      <span className="px-1 pb-0.5 text-[13px] font-semibold">{tb(k)}</span>
    </button>
  );
}

function ExtraFields({
  spec,
  extra,
  set,
  answers,
  setAnswers,
  media,
  upload,
}: {
  spec: ExtraSpec;
  extra: GuideExtra;
  set: (patch: Partial<GuideExtra>) => void;
  answers: GuideAnswers;
  setAnswers: SetAnswers;
  media: Record<string, SiteMedia>;
  upload: (files: File[], done: (m: Uploaded) => void) => Promise<void>;
}) {
  const t = useTranslations("guide.page");
  if (spec.asks === "social") {
    const links = answers.social.length ? answers.social : [{ network: "instagram", url: "" }];
    const setLinks = (next: typeof links) => setAnswers((a) => ({ ...a, social: next }));
    return (
      <>
        <p className="text-muted m-0 text-[13px]">{t("socialHint")}</p>
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-[130px_1fr_auto] gap-1.5">
            <select
              className={fieldCls}
              aria-label={t("network")}
              value={l.network}
              onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, network: e.target.value } : x)))}
            >
              {SOCIAL_NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {networkName(n, "")}
                </option>
              ))}
            </select>
            <input
              className={fieldCls}
              dir="ltr"
              placeholder="https://"
              aria-label={t("link")}
              value={l.url}
              onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
            />
            <button type="button" aria-label={t("removeRow")} className="text-muted flex size-11 items-center justify-center" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        {links.length < 8 && (
          <button type="button" className={cx(outlineButton, "self-start")} onClick={() => setLinks([...links, { network: "instagram", url: "" }])}>
            <Icon name="add" size={16} />
            {t("addRow")}
          </button>
        )}
      </>
    );
  }

  if (spec.asks === "text" || spec.asks === "photoText") {
    return (
      <>
        {spec.asks === "photoText" && (
          <PictureField label={t("photo")} id={extra.mediaId} media={media} onFiles={(f) => upload(f.slice(0, 1), (m) => set({ mediaId: m.id }))} />
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t(`xText.${spec.key}`)}
          <textarea className={areaCls} value={extra.text} maxLength={2000} onChange={(e) => set({ text: e.target.value })} />
        </label>
      </>
    );
  }

  // Lists: logos, testimonials, CV lines, offers, questions, numbers.
  const items = extra.items.length ? extra.items : [blankItem()];
  const setItem = (i: number, patch: Partial<GuideItem>) => set({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className="border-line flex flex-col gap-1.5 rounded-[12px] border p-2.5">
          {spec.fields?.includes("media") && (
            <PictureField label={t(`f.${spec.key}.media`)} id={it.mediaId} media={media} onFiles={(f) => upload(f.slice(0, 1), (m) => setItem(i, { mediaId: m.id }))} />
          )}
          {(["title", "meta", "text"] as const)
            .filter((f) => spec.fields?.includes(f))
            .map((f) =>
              f === "text" ? (
                <textarea
                  key={f}
                  className={cx(areaCls, "min-h-[64px]")}
                  aria-label={t(`f.${spec.key}.${f}`)}
                  placeholder={t(`f.${spec.key}.${f}`)}
                  value={it[f]}
                  maxLength={600}
                  onChange={(e) => setItem(i, { [f]: e.target.value })}
                />
              ) : (
                <input
                  key={f}
                  className={fieldCls}
                  aria-label={t(`f.${spec.key}.${f}`)}
                  placeholder={t(`f.${spec.key}.${f}`)}
                  value={it[f]}
                  maxLength={160}
                  onChange={(e) => setItem(i, { [f]: e.target.value })}
                />
              ),
            )}
          {items.length > 1 && (
            <button type="button" className="text-muted self-end text-[12px] font-semibold hover:underline" onClick={() => set({ items: items.filter((_, j) => j !== i) })}>
              {t("removeRow")}
            </button>
          )}
        </div>
      ))}
      {items.length < 12 && (
        <button type="button" className={cx(outlineButton, "self-start")} onClick={() => set({ items: [...items, blankItem()] })}>
          <Icon name="add" size={16} />
          {t("addRow")}
        </button>
      )}
    </>
  );
}

function PictureField({
  label,
  id,
  media,
  onFiles,
}: {
  label: string;
  id: string | null;
  media: Record<string, SiteMedia>;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2.5">
      <Thumb m={id ? media[id] : null} className="size-12 flex-none rounded-[10px]" />
      <button type="button" className={outlineButton} onClick={() => input.current?.click()}>
        <Icon name="upload" size={16} />
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
