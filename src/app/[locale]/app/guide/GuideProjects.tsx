"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { moveTo, startSortDrag } from "@/components/editor/sortDrag";
import { IMAGE_ACCEPT, uploadFile, type Uploaded } from "@/components/editor/upload";
import type { GalleryProject, SiteMedia } from "@/components/site/SiteRender";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Controls";
import { cx } from "@/lib/cx";
import type { GuideAnswers, GuideProject } from "@/lib/site/guide";
import type { CardSize, CardText } from "@/lib/site/types";
import {
  addTextItem,
  makeCover,
  newProject,
  removeItem,
  removeProject,
  reorder,
  saveMedia,
  saveProject,
} from "../(dash)/projects/actions";
import { projectItems } from "./actions";
import { areaCls, bigButton, fieldCls, Kicker, outlineButton, Problem, Question, Thumb } from "./ui";

type SetAnswers = (fn: (a: GuideAnswers) => GuideAnswers) => void;

const SAMPLE_TONES = ["sample:02", "sample:05", "sample:08", "sample:11", "sample:14", "sample:03"];

/** Little drawings of each card size: the card in a row of three. */
function SizeIcon({ size }: { size: CardSize }) {
  const cells = size === "l" ? [[0, 0, 2, 2]] : size === "wide" ? [[0, 0, 2, 1]] : [[0, 0, 1, 1]];
  return (
    <svg viewBox="0 0 30 20" className="h-7 w-10" aria-hidden>
      {[0, 1, 2].flatMap((x) => [0, 1].map((y) => <rect key={`${x}${y}`} x={x * 10 + 1} y={y * 10 + 1} width={8} height={8} rx={1.5} fill="currentColor" opacity={0.18} />))}
      {cells.map(([x, y, w, h], i) => (
        <rect key={i} x={x * 10 + 1} y={y * 10 + 1} width={w * 10 - 2} height={h * 10 - 2} rx={1.5} fill="currentColor" />
      ))}
    </svg>
  );
}

/* ---------- 5. Your projects ---------- */

export function GuideProjects({
  answers,
  setAnswers,
  projects,
  setProjects,
  media,
  addMedia,
  limit,
}: {
  answers: GuideAnswers;
  setAnswers: SetAnswers;
  projects: GalleryProject[];
  setProjects: (fn: (p: GalleryProject[]) => GalleryProject[]) => void;
  media: Record<string, SiteMedia>;
  addMedia: (m: Uploaded) => void;
  limit: number | null;
}) {
  const t = useTranslations("guide.projects");
  const tp = useTranslations("projects");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const errorText = (code: string) => (tp.has(`errors.${code}`) ? tp(`errors.${code}`, { image: 30, pdf: 50 }) : tp("errors.error"));

  // Projects made before the guide are offered too: they start in the list, unticked.
  const chosen = (id: string) => answers.projects.find((p) => p.id === id);
  const setProject = (id: string, patch: Partial<GuideProject>) =>
    setAnswers((a) => ({ ...a, projects: a.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  async function add() {
    const name = title.trim();
    if (!name) return;
    setBusy(true);
    setProblem(null);
    const r = await newProject(name).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      if (r?.error === "limit") return setFull(true);
      return setProblem(errorText(r?.error ?? "error"));
    }
    setProjects((ps) => [
      { id: r.id, slug: "", title: name, category: "", client: "", role: "", visibility: "public", coverId: null, mature: false },
      ...ps,
    ]);
    setAnswers((a) => ({ ...a, projects: [...a.projects, { id: r.id, size: "m", text: "title", inMenu: false }] }));
    setTitle("");
  }

  return (
    <section className="flex flex-col gap-5">
      <Kicker>{t("kicker")}</Kicker>
      <Question>{t("title")}</Question>
      <p className="text-muted m-0 text-[16px]">{t("hint")}</p>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          className={cx(fieldCls, "h-[52px] min-w-[220px] flex-1 rounded-[16px] text-[17px]")}
          placeholder={t("namePlaceholder")}
          aria-label={t("name")}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="guide-project-name"
        />
        <button type="submit" className={bigButton} disabled={busy || !title.trim()} data-testid="guide-project-add">
          <Icon name="add" size={18} />
          {t("add")}
        </button>
      </form>
      {full && (
        <p className="bg-secondary-container/60 m-0 rounded-[16px] p-3.5 text-[14px]" data-testid="guide-project-limit">
          {t("limit", { count: limit ?? 0 })}{" "}
          <a href="/upgrade" className="text-primary font-semibold">
            {t("goPro")}
          </a>
        </p>
      )}
      {problem && <Problem>{problem}</Problem>}

      <ul className="m-0 flex list-none flex-col gap-3 p-0" data-testid="guide-projects">
        {projects.map((p, i) => {
          const c = chosen(p.id);
          return (
            <li key={p.id} className={cx("border-line bg-paper flex flex-col gap-3 rounded-[24px] border p-3.5", !c && "opacity-70")}>
              <div className="flex items-center gap-3">
                <CoverButton
                  project={p}
                  tone={SAMPLE_TONES[i % SAMPLE_TONES.length]}
                  media={media}
                  onUploaded={(m) => {
                    addMedia(m);
                    setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, coverId: m.id } : x)));
                  }}
                  onProblem={(code) => setProblem(errorText(code))}
                />
                <input
                  className={cx(fieldCls, "min-w-0 flex-1 font-semibold")}
                  aria-label={t("name")}
                  defaultValue={p.title}
                  maxLength={120}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (!v || v === p.title) return;
                    setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, title: v } : x)));
                    void saveProject(p.id, { title: v });
                  }}
                />
                {c ? (
                  <button
                    type="button"
                    aria-label={t("remove", { project: p.title })}
                    className="text-muted hover:text-ink hover:bg-mist flex size-10 flex-none items-center justify-center rounded-full"
                    onClick={async () => {
                      if (!window.confirm(t("removeConfirm", { project: p.title }))) return;
                      await removeProject(p.id).catch(() => null);
                      setProjects((ps) => ps.filter((x) => x.id !== p.id));
                      setAnswers((a) => ({ ...a, projects: a.projects.filter((x) => x.id !== p.id) }));
                    }}
                  >
                    <Icon name="delete" size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={outlineButton}
                    onClick={() => setAnswers((a) => ({ ...a, projects: [...a.projects, { id: p.id, size: p.card?.size ?? "m", text: p.card?.text ?? "title", inMenu: false }] }))}
                  >
                    {t("include")}
                  </button>
                )}
              </div>
              {c && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold">{t("size")}</span>
                    <div role="radiogroup" aria-label={t("size")} className="grid grid-cols-3 gap-1.5">
                      {(["m", "l", "wide"] as CardSize[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={c.size === s}
                          aria-label={t(`sizes.${s}`)}
                          onClick={() => setProject(p.id, { size: s })}
                          className={cx(
                            "flex flex-col items-center gap-0.5 rounded-[12px] border py-1.5 text-[11px] font-semibold",
                            c.size === s ? "border-primary bg-secondary-container text-on-secondary-container" : "border-line hover:bg-mist",
                          )}
                        >
                          <SizeIcon size={s} />
                          {t(`sizes.${s}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold">{t("text")}</span>
                    <div role="radiogroup" aria-label={t("text")} className="grid grid-cols-3 gap-1.5">
                      {(["none", "title", "details"] as CardText[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={c.text === s}
                          onClick={() => setProject(p.id, { text: s })}
                          className={cx(
                            "flex h-[54px] items-center justify-center rounded-[12px] border px-1 text-center text-[12px] font-semibold",
                            c.text === s ? "border-primary bg-secondary-container text-on-secondary-container" : "border-line hover:bg-mist",
                          )}
                        >
                          {t(`texts.${s}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                    <span className="flex flex-col">
                      <span className="text-[14px] font-semibold">{t("inMenu")}</span>
                      <span className="text-muted text-[12px]">{t("inMenuHint")}</span>
                    </span>
                    <Toggle label={t("inMenu")} hideLabel checked={c.inMenu} onChange={(v) => setProject(p.id, { inMenu: v })} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {projects.length === 0 && <p className="text-muted m-0 text-[14px]">{t("none")}</p>}
      {answers.projects.filter((p) => p.inMenu).length > 1 && (
        <div className="border-line bg-paper flex items-center justify-between gap-3 rounded-[16px] border p-3.5">
          <span className="text-[14px] font-semibold">{t("group")}</span>
          <Toggle label={t("group")} hideLabel checked={answers.groupProjects} onChange={(v) => setAnswers((a) => ({ ...a, groupProjects: v }))} />
        </div>
      )}
    </section>
  );
}

function CoverButton({
  project,
  tone,
  media,
  onUploaded,
  onProblem,
}: {
  project: GalleryProject;
  tone: string;
  media: Record<string, SiteMedia>;
  onUploaded: (m: Uploaded) => void;
  onProblem: (code: string) => void;
}) {
  const t = useTranslations("guide.projects");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        className="group relative size-16 flex-none overflow-hidden rounded-[14px]"
        onClick={() => input.current?.click()}
        aria-label={t("cover", { project: project.title })}
        title={t("cover", { project: project.title })}
      >
        <Thumb m={project.coverId ? media[project.coverId] : null} tone={tone} className="size-16" />
        <span className={cx("absolute inset-0 flex items-center justify-center bg-black/35 text-white", busy ? "flex" : "hidden group-hover:flex")}>
          {busy ? "…" : <Icon name="upload" size={18} />}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        aria-label={t("cover", { project: project.title })}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          const r = await uploadFile(project.id, f);
          if (r.ok) {
            await makeCover(project.id, r.media.id).catch(() => null);
            onUploaded(r.media);
          } else onProblem(r.error);
          setBusy(false);
        }}
      />
    </>
  );
}

/* ---------- 6. Inside each project ---------- */

type Item = Uploaded;

export function GuideInside({
  answers,
  projects,
  setProjects,
  addMedia,
}: {
  answers: GuideAnswers;
  projects: GalleryProject[];
  setProjects: (fn: (p: GalleryProject[]) => GalleryProject[]) => void;
  addMedia: (m: Uploaded) => void;
}) {
  const t = useTranslations("guide.inside");
  const tp = useTranslations("projects");
  const mine = projects.filter((p) => answers.projects.some((x) => x.id === p.id));
  const [current, setCurrent] = useState(mine[0]?.id ?? null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [mark, setMark] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const errorText = (code: string) => (tp.has(`errors.${code}`) ? tp(`errors.${code}`, { image: 30, pdf: 50 }) : tp("errors.error"));

  useEffect(() => {
    // The chosen project's pictures and parts, from the server.
    if (!current) return;
    let live = true;
    void projectItems(current)
      .catch(() => null)
      .then((r) => {
        if (!live) return;
        setItems(r?.ok ? (r.media as Item[]) : []);
        if (r?.ok) setDescription(r.description);
      });
    return () => {
      live = false;
    };
  }, [current]);

  if (!mine.length || !current) {
    return (
      <section className="flex flex-col gap-5">
        <Kicker>{t("kicker")}</Kicker>
        <Question>{t("title")}</Question>
        <p className="text-muted m-0 text-[16px]">{t("noProjects")}</p>
      </section>
    );
  }

  const later = (key: string, fn: () => void) => {
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(fn, 600));
  };

  async function addFiles(files: FileList) {
    const id = current!;
    const all = Array.from(files).slice(0, 60);
    setUploading((n) => n + all.length);
    setProblem(null);
    // Three at a time, in the order they were picked.
    const queue = [...all];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const r = await uploadFile(id, f);
        setUploading((n) => n - 1);
        if (!r.ok) {
          setProblem(errorText(r.error));
          continue;
        }
        addMedia(r.media);
        setItems((xs) => (xs ? [...xs, r.media] : [r.media]));
        setProjects((ps) => ps.map((p) => (p.id === id && !p.coverId ? { ...p, coverId: r.media.id } : p)));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  async function addPart() {
    const r = await addTextItem(current!, { title: t("partDefault") }).catch(() => null);
    if (r?.ok) setItems((xs) => [...(xs ?? []), r.media]);
  }

  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs?.map((x) => (x.id === id ? { ...x, ...p } : x)) ?? xs);

  return (
    <section className="flex flex-col gap-5">
      <Kicker>{t("kicker")}</Kicker>
      <Question>{t("title")}</Question>
      <p className="text-muted m-0 text-[16px]">{t("hint")}</p>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("projects")}>
        {mine.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === current}
            onClick={() => {
              if (p.id === current) return;
              setItems(null);
              setCurrent(p.id);
            }}
            className={cx(
              "rounded-pill h-9 max-w-[220px] truncate px-3.5 text-[14px] font-semibold",
              p.id === current ? "bg-secondary-container text-on-secondary-container" : "border-line bg-paper hover:bg-mist border",
            )}
          >
            {p.title}
          </button>
        ))}
      </div>

      <div
        className="border-outline bg-paper flex flex-col items-center gap-3 rounded-[24px] border-2 border-dashed px-4 py-7 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
        }}
        data-testid="guide-drop"
      >
        <Icon name="upload" size={24} />
        <span className="text-[16px] font-semibold">{t("drop")}</span>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={bigButton} onClick={() => input.current?.click()}>
            {t("choose")}
          </button>
          <button type="button" className={outlineButton} onClick={addPart} data-testid="guide-add-part">
            <Icon name="text" size={16} />
            {t("addPart")}
          </button>
        </div>
        {uploading > 0 && <span className="text-muted text-[13px]">{t("uploading", { count: uploading })}</span>}
        <input
          ref={input}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          className="sr-only"
          aria-label={t("choose")}
          data-testid="guide-files"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {problem && <Problem>{problem}</Problem>}

      {items === null ? (
        <p className="text-muted m-0 text-[14px]">…</p>
      ) : (
        <ul ref={list} className="relative m-0 flex list-none flex-col gap-1.5 p-0" data-testid="guide-items">
          {items.map((m) => (
            <li
              key={m.id}
              data-item-id={m.id}
              className={cx(
                "border-line flex items-center gap-2.5 rounded-[14px] border p-1.5",
                m.type === "text" ? "bg-secondary-container/40 items-start" : "bg-paper",
              )}
            >
              <button
                type="button"
                aria-label={t("drag")}
                className="text-muted hover:text-ink flex h-10 w-7 flex-none cursor-grab touch-none items-center justify-center"
                onPointerDown={(e) =>
                  startSortDrag(e, {
                    dragId: m.id,
                    items: () =>
                      Array.from(list.current?.querySelectorAll<HTMLElement>("li[data-item-id]") ?? []).map((el) => ({ id: el.dataset.itemId!, el })),
                    onMark: (mk) => {
                      const top = list.current?.getBoundingClientRect().top ?? 0;
                      setMark(mk ? mk.y - top : null);
                    },
                    onDrop: (index) => {
                      const next = moveTo(items, m.id, index);
                      setItems(next);
                      void reorder(current, next.map((x) => x.id));
                    },
                  })
                }
              >
                <Icon name="drag" size={18} />
              </button>
              {m.type === "text" ? (
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
                  <input
                    className={cx(fieldCls, "h-10 font-semibold")}
                    aria-label={t("partTitle")}
                    value={m.title ?? ""}
                    placeholder={t("partTitle")}
                    onChange={(e) => {
                      const v = e.target.value;
                      patch(m.id, { title: v });
                      later(`${m.id}t`, () => void saveMedia(m.id, { title: v }));
                    }}
                    data-testid="guide-part-title"
                  />
                  <textarea
                    className={cx(areaCls, "min-h-[60px]")}
                    aria-label={t("partText")}
                    placeholder={t("partText")}
                    value={m.text ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      patch(m.id, { text: v });
                      later(`${m.id}x`, () => void saveMedia(m.id, { text: v }));
                    }}
                  />
                </div>
              ) : (
                <>
                  <Thumb m={m} className="size-14 flex-none rounded-[10px]" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{m.fileName}</span>
                </>
              )}
              <button
                type="button"
                aria-label={t("removeItem")}
                className="text-muted hover:text-ink flex size-9 flex-none items-center justify-center"
                onClick={async () => {
                  setItems((xs) => xs?.filter((x) => x.id !== m.id) ?? xs);
                  await removeItem(current, m.id).catch(() => null);
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
          {mark !== null && <li aria-hidden className="bg-primary pointer-events-none absolute inset-x-0 h-1 rounded" style={{ top: mark - 3 }} />}
        </ul>
      )}
      {items?.length === 0 && <p className="text-muted m-0 text-[14px]">{t("empty")}</p>}

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {t("description")}
        <textarea
          className={areaCls}
          value={description}
          maxLength={4000}
          onChange={(e) => {
            const v = e.target.value;
            setDescription(v);
            later("desc", () => void saveProject(current, { description: v }));
          }}
        />
      </label>
    </section>
  );
}
