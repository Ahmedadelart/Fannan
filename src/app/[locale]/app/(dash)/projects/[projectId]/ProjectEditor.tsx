"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Checkbox, Toggle } from "@/components/ui/Controls";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlays";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { imageSources, mediaUrl } from "@/lib/media";
import type { MediaDoc, ProjectForEditor, ProjectPatch } from "@/lib/server/projects";
import {
  addTextItem,
  addVideoLink,
  beginUpload,
  completeUpload,
  cropItem,
  makeCover,
  removeItem,
  removeProject,
  reorder,
  saveMedia,
  saveProject,
} from "../actions";
import { CropModal, type Crop } from "./CropModal";

type Item = MediaDoc & { id: string; progress?: number; problem?: string };
type ErrorCode = string;

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
};
const ACCEPT = Object.keys(EXT_TYPES)
  .map((e) => `.${e}`)
  .concat(Object.values(EXT_TYPES))
  .join(",");

const kindIcon: Record<string, IconName> = {
  image: "image",
  gif: "loop-gif",
  svg: "image",
  loop: "loop-gif",
  pdf: "pdf",
  embed: "video-4k",
  text: "text",
};

/* ---------- small building blocks matching Project.dc.html ---------- */

const inputCls =
  "h-10 w-full rounded-[10px] border border-line bg-paper px-3 text-[14px] font-normal text-ink outline-none focus:border-ink";
const areaCls =
  "min-h-[76px] w-full resize-y rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[14px] font-normal text-ink outline-none focus:border-ink";

function Panel({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-line bg-paper flex flex-col gap-3.5 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading font-heading-weight text-[18px] leading-tight">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="text-ink-soft flex flex-col gap-1.5 text-[12px] font-semibold">
      {label}
      {children}
      {hint && <span className="text-muted font-normal">{hint}</span>}
    </label>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-ink flex items-start gap-2 text-[13px] font-semibold">
      <span aria-hidden className="hl-bar mt-1.5 h-[5px] w-2.5" />
      {children}
    </p>
  );
}

function Thumb({ m, className, want = 400 }: { m: Item; className?: string; want?: number }) {
  const src = imageSources(m, want);
  if (m.type === "text") {
    return (
      <span
        className={cx("bg-mist text-ink-soft flex items-center justify-center p-3 text-start text-[11px]", className)}
      >
        <span className="line-clamp-4">{m.text || "Aa"}</span>
      </span>
    );
  }
  if (!src) {
    return (
      <span className={cx("bg-mist text-muted flex items-center justify-center", className)}>
        <Icon name={kindIcon[m.type] ?? "image"} size={24} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src.src} srcSet={src.srcSet} sizes="200px" alt={m.alt} className={cx("object-cover", className)} />
  );
}

/* ---------- autosave ---------- */

function useAutosave(projectId: string, onError: (code: ErrorCode) => void) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(0);

  const save = useCallback(
    (key: string, patch: ProjectPatch, delay = 600, after?: (r: { slug: string }) => void) => {
      clearTimeout(timers.current.get(key));
      setState("saving");
      timers.current.set(
        key,
        setTimeout(async () => {
          inFlight.current++;
          const r = await saveProject(projectId, patch).catch(() => ({ ok: false as const, error: "error" as const }));
          inFlight.current--;
          if (!r.ok) onError(r.error);
          else after?.(r as unknown as { slug: string });
          if (inFlight.current === 0) setState("saved");
        }, delay),
      );
    },
    [projectId, onError],
  );
  return { state, save };
}

/* ---------- the editor ---------- */

export function ProjectEditor({
  initialProject,
  initialMedia,
  address,
  canPassword,
  maxImageMb,
  maxFileMb,
  limits,
}: {
  initialProject: ProjectForEditor;
  initialMedia: Item[];
  address: string;
  canPassword: boolean;
  maxImageMb: number;
  maxFileMb: number;
  limits: { image: number; pdf: number; loop: number };
}) {
  const t = useTranslations("projects");
  const toast = useToast();
  const [p, setP] = useState(initialProject);
  const [items, setItems] = useState<Item[]>(initialMedia);
  const [selectedId, setSelectedId] = useState<string | null>(initialMedia[0]?.id ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [fieldProblem, setFieldProblem] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [busyCrop, setBusyCrop] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const queue = useRef<Array<() => Promise<void>>>([]);
  const running = useRef(0);

  const errorText = useCallback(
    (code: ErrorCode) =>
      t.has(`errors.${code}`) ? t(`errors.${code}`, { image: maxImageMb, pdf: maxFileMb }) : t("errors.error"),
    [t, maxImageMb, maxFileMb],
  );
  const onSaveError = useCallback((code: ErrorCode) => setFieldProblem(errorText(code)), [errorText]);
  const { state: saveState, save } = useAutosave(p.id, onSaveError);

  const selected = items.find((m) => m.id === selectedId) ?? null;
  const patchItem = (id: string, patch: Partial<Item>) =>
    setItems((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  function setField<K extends keyof ProjectForEditor>(
    key: K,
    value: ProjectForEditor[K],
    patch: ProjectPatch,
    delay?: number,
  ) {
    setP((x) => ({ ...x, [key]: value }));
    setFieldProblem(null);
    save(String(key), patch, delay);
  }

  /* ---------- uploads (3 at a time) ---------- */

  function pump() {
    while (running.current < 3 && queue.current.length) {
      const job = queue.current.shift()!;
      running.current++;
      void job().finally(() => {
        running.current--;
        pump();
      });
    }
  }

  function put(url: string, file: File, type: string, onProgress: (n: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", type);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(file);
    });
  }

  function fileType(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    return EXT_TYPES[ext] ?? (Object.values(EXT_TYPES).includes(f.type) ? f.type : "");
  }

  function localCheck(f: File, type: string): ErrorCode | null {
    if (!type) return "bad-type";
    const max = type === "application/pdf" ? limits.pdf : type === "video/mp4" ? limits.loop : limits.image;
    return f.size > max ? "too-big" : null;
  }

  function addFiles(files: FileList | File[], replaceId?: string) {
    setProblem(null);
    for (const f of Array.from(files)) {
      const type = fileType(f);
      const bad = localCheck(f, type);
      if (bad) {
        setProblem(`${f.name}: ${errorText(bad)}`);
        continue;
      }
      queue.current.push(async () => {
        const start = await beginUpload(p.id, { name: f.name, type, size: f.size }, replaceId);
        if (!start.ok) {
          setProblem(`${f.name}: ${errorText(start.error)}`);
          return;
        }
        const id = start.mediaId;
        if (replaceId) patchItem(id, { status: "uploading", progress: 0, problem: undefined });
        else {
          const placeholder: Item = {
            id,
            projectId: p.id,
            type: "image",
            status: "uploading",
            progress: 0,
            fileName: f.name,
            sizeBytes: f.size,
            gen: 0,
            caption: "",
            alt: "",
            display: { fullWidth: false, lightbox: true, autoplay: true },
          };
          setItems((list) => [...list, placeholder]);
          setSelectedId((s) => s ?? id);
        }
        try {
          await put(start.uploadUrl, f, start.contentType, (n) => patchItem(id, { progress: n }));
        } catch {
          patchItem(id, { status: "failed", problem: errorText("error") });
          return;
        }
        patchItem(id, { status: "processing", progress: 100 });
        const done = await completeUpload(id).catch(() => ({ ok: false as const, error: "error" as const }));
        if (done.ok) {
          setItems((list) => list.map((m) => (m.id === id ? (done.media as Item) : m)));
          setP((x) => ({
            ...x,
            media: x.media.includes(id) ? x.media : [...x.media, id],
            coverMediaId: x.coverMediaId ?? id,
          }));
        } else {
          patchItem(id, { status: replaceId ? "ready" : "failed", problem: errorText(done.error) });
          setProblem(`${f.name}: ${errorText(done.error)}`);
        }
      });
    }
    pump();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  /* ---------- items ---------- */

  async function addVideo() {
    if (!video) return;
    const r = await addVideoLink(p.id, video);
    if (!r.ok) return setProblem(errorText(r.error));
    setItems((list) => [...list, r.media as Item]);
    setP((x) => ({ ...x, media: [...x.media, r.media.id], coverMediaId: x.coverMediaId ?? r.media.id }));
    setSelectedId(r.media.id);
    setVideo(null);
  }

  async function addText() {
    const r = await addTextItem(p.id);
    if (!r.ok) return setProblem(errorText(r.error));
    setItems((list) => [...list, r.media as Item]);
    setSelectedId(r.media.id);
  }

  const mediaTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  function editItem(id: string, patch: Parameters<typeof saveMedia>[1], local: Partial<Item>) {
    patchItem(id, local);
    const key = `${id}:${Object.keys(patch).join()}`;
    clearTimeout(mediaTimers.current.get(key));
    mediaTimers.current.set(
      key,
      setTimeout(async () => {
        const r = await saveMedia(id, patch);
        if (!r.ok) setProblem(errorText(r.error));
      }, 500),
    );
  }

  async function persistOrder(next: Item[]) {
    setItems(next);
    const r = await reorder(
      p.id,
      next.map((m) => m.id),
    );
    if (!r.ok) setProblem(errorText(r.error));
  }

  function move(id: string, by: number) {
    const i = items.findIndex((m) => m.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    void persistOrder(next);
  }

  async function del(id: string) {
    const r = await removeItem(p.id, id);
    if (!r.ok && r.error !== "not-found") return setProblem(errorText(r.error));
    const rest = items.filter((m) => m.id !== id);
    setItems(rest);
    setP((x) => ({
      ...x,
      media: x.media.filter((m) => m !== id),
      coverMediaId: x.coverMediaId === id ? (rest[0]?.id ?? null) : x.coverMediaId,
    }));
    setSelectedId(rest[0]?.id ?? null);
  }

  async function cover(id: string) {
    const r = await makeCover(p.id, id);
    if (!r.ok) return setProblem(errorText(r.error));
    setP((x) => ({ ...x, coverMediaId: id }));
  }

  async function saveCrop(c: Crop | null) {
    if (!selected) return;
    setBusyCrop(true);
    // The picture on screen may already be cropped: turn the new frame into original coordinates.
    const prev = selected.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const crop = c && { x: prev.x + c.x * prev.w, y: prev.y + c.y * prev.h, w: c.w * prev.w, h: c.h * prev.h };
    const r = await cropItem(selected.id, crop);
    setBusyCrop(false);
    if (!r.ok) return setProblem(errorText(r.error));
    setItems((list) => list.map((m) => (m.id === selected.id ? (r.media as Item) : m)));
    setCropOpen(false);
    toast(t("saved"), "check");
  }

  async function savePassword() {
    const r = await saveProject(p.id, { password, visibility: "password" });
    if (!r.ok) return setFieldProblem(errorText(r.error));
    setP((x) => ({ ...x, hasPassword: true, visibility: "password" }));
    setPassword("");
    toast(t("saved"), "password");
  }

  // Warn before leaving while files are still uploading.
  const uploading = items.some((m) => m.status === "uploading" || m.status === "processing");
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const statusText =
    saveState === "saving" || uploading
      ? t("saving")
      : t("savedItems", { items: t("items", { count: items.filter((m) => m.status !== "failed").length }) });

  const categories = Object.keys(t.raw("categories") as Record<string, string>);
  const formats = t.raw("drop.formats") as string[];
  const kindLabel = (m: Item) => (t.has(`kinds.${m.type}`) ? t(`kinds.${m.type}`) : m.type);

  /* ---------- render ---------- */
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <a href="/projects" className="text-muted hover:text-ink flex items-center gap-1 text-[13px]">
            <span aria-hidden className="rtl:-scale-x-100">
              ←
            </span>{" "}
            {t("allProjects")}
          </a>
          <h1 className="font-heading font-heading-weight truncate text-[32px] leading-[1.1] tracking-[-0.02em]">
            {p.title || t("newTitle")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted me-1.5 text-[13px]" role="status" data-testid="save-state">
            {statusText}
          </span>
          <Button variant="outline" icon="delete" onClick={() => setConfirmDelete(true)}>
            {t("deleteProject")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* Left: media */}
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-4">
          <div
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragOver(true);
              }
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cx(
              "bg-paper flex flex-col items-center gap-2.5 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              dragOver ? "border-ink bg-mist" : "border-line-strong",
            )}
          >
            <span className="bg-lime flex rounded-md p-2.5">
              <Icon name="upload" size={24} />
            </span>
            <div className="font-heading font-heading-weight text-[22px]">{t("drop.title")}</div>
            <p className="text-muted max-w-[520px]">{t("drop.text")}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {formats.map((f) => (
                <span key={f} className="rounded-pill bg-mist px-2.5 py-1 text-[12px] font-semibold">
                  {f}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap justify-center gap-2">
              <button type="button" className={buttonClasses("lime", "md")} onClick={() => fileInput.current?.click()}>
                <Icon name="upload" size={18} />
                {t("drop.upload")}
              </button>
              <button type="button" className={buttonClasses("outline", "md")} onClick={() => setVideo(video ?? "")}>
                <Icon name="link" size={18} />
                {t("drop.video")}
              </button>
              <button type="button" className={buttonClasses("outline", "md")} onClick={addText}>
                <Icon name="text" size={18} />
                {t("drop.text_")}
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              aria-label={t("drop.upload")}
              data-testid="file-input"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {video !== null && (
              <form
                className="mt-2 flex w-full max-w-[520px] gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addVideo();
                }}
              >
                <input
                  autoFocus
                  dir="ltr"
                  aria-label={t("videoLabel")}
                  placeholder={t("videoPlaceholder")}
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                  className={inputCls}
                />
                <Button type="submit">{t("add")}</Button>
              </form>
            )}
            <p className="text-muted text-[12px]">{t("drop.longVideo")}</p>
            {problem && <Problem>{problem}</Problem>}
          </div>

          <Panel title={t("media")} aside={<span className="text-muted text-[13px]">{t("mediaHint")}</span>}>
            {items.length === 0 ? (
              <p className="text-muted">{t("nothingSelected")}</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3" data-testid="media-grid">
                {items.map((m) => {
                  const on = m.id === selectedId;
                  return (
                    <li
                      key={m.id}
                      draggable={m.status === "ready"}
                      onDragStart={() => setDragId(m.id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => {
                        if (!dragId || dragId === m.id) return;
                        e.preventDefault();
                        const from = items.findIndex((x) => x.id === dragId);
                        const to = items.findIndex((x) => x.id === m.id);
                        const next = [...items];
                        next.splice(to, 0, next.splice(from, 1)[0]);
                        setItems(next);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId) void persistOrder(items);
                      }}
                    >
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSelectedId(m.id)}
                        className={cx(
                          "bg-paper flex w-full flex-col gap-1.5 rounded-md border-2 p-1.5 text-start",
                          on ? "border-ink" : "hover:border-line border-transparent",
                          dragId === m.id && "opacity-50",
                        )}
                        data-testid="media-item"
                      >
                        <span className="relative block aspect-[4/3] overflow-hidden rounded-[8px]">
                          <Thumb m={m} className="h-full w-full" />
                          <span className="text-ink absolute start-1.5 bottom-1.5 rounded-[5px] bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">
                            {kindLabel(m)}
                          </span>
                          {p.coverMediaId === m.id && m.status === "ready" && (
                            <span
                              className="bg-lime text-ink absolute end-1.5 top-1.5 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold"
                              title={t("cover")}
                            >
                              ★ {t("cover")}
                            </span>
                          )}
                          {(m.status === "uploading" || m.status === "processing" || m.status === "failed") && (
                            <span className="bg-paper/85 absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-[11px] font-semibold">
                              {m.status === "failed" ? (
                                t("failed")
                              ) : (
                                <>
                                  <span>
                                    {m.status === "uploading"
                                      ? t("uploading", { percent: m.progress ?? 0 })
                                      : t("processing")}
                                  </span>
                                  <span className="bg-line h-1.5 w-4/5 overflow-hidden rounded-[3px]">
                                    <span
                                      className={cx("bg-ink block h-1.5", m.status === "processing" && "animate-pulse")}
                                      style={{ width: `${m.status === "processing" ? 100 : (m.progress ?? 0)}%` }}
                                    />
                                  </span>
                                </>
                              )}
                            </span>
                          )}
                        </span>
                        <span className="truncate text-[12px] font-semibold">
                          {m.type === "embed" ? m.embed?.title : m.type === "text" ? t("kinds.text") : m.fileName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {selected && (
            <Panel
              title={t("selected", {
                name:
                  selected.type === "embed"
                    ? (selected.embed?.title ?? "")
                    : selected.type === "text"
                      ? t("kinds.text")
                      : (selected.fileName ?? ""),
              })}
              aside={<Badge variant="pro">{kindLabel(selected)}</Badge>}
            >
              {selected.problem && <Problem>{selected.problem}</Problem>}
              <div className="flex flex-wrap gap-4">
                {selected.type !== "text" && (
                  <div className="bg-mist flex-[1_1_260px] overflow-hidden rounded-md" data-testid="selected-preview">
                    {selected.type === "loop" && selected.loop ? (
                      <video
                        src={mediaUrl(selected.loop)}
                        poster={imageSources(selected, 800)?.src}
                        muted
                        loop
                        autoPlay
                        playsInline
                        className="w-full"
                      />
                    ) : (
                      <Thumb m={selected} want={1600} className="max-h-[420px] w-full object-contain" />
                    )}
                  </div>
                )}
                <div className="flex flex-[1_1_260px] flex-col gap-3">
                  {selected.type === "text" ? (
                    <Field label={t("textBody")}>
                      <textarea
                        className={cx(areaCls, "min-h-[160px]")}
                        value={selected.text ?? ""}
                        onChange={(e) => editItem(selected.id, { text: e.target.value }, { text: e.target.value })}
                      />
                    </Field>
                  ) : (
                    <>
                      <Field label={t("caption")}>
                        <input
                          className={inputCls}
                          value={selected.caption}
                          onChange={(e) =>
                            editItem(selected.id, { caption: e.target.value }, { caption: e.target.value })
                          }
                        />
                      </Field>
                      <Field label={t("alt")} hint={!selected.alt ? t("altMissing") : undefined}>
                        <input
                          className={inputCls}
                          value={selected.alt}
                          onChange={(e) => editItem(selected.id, { alt: e.target.value }, { alt: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                  {selected.type === "pdf" && selected.pages && (
                    <p className="text-muted text-[13px]">{t("pages", { count: selected.pages })}</p>
                  )}
                  {selected.type === "loop" && selected.duration && (
                    <p className="text-muted text-[13px]">{t("seconds", { count: Math.round(selected.duration) })}</p>
                  )}
                  {selected.type === "embed" && selected.embed && (
                    <a
                      href={selected.embed.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-lime-ink text-[13px] font-semibold underline"
                    >
                      {t("openLink")}
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(selected.type === "image" || selected.type === "svg") && selected.status === "ready" && (
                      <Button variant="outline" size="sm" icon="crop" onClick={() => setCropOpen(true)}>
                        {t("crop")}
                      </Button>
                    )}
                    {selected.type !== "text" && selected.status === "ready" && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon="cover"
                        disabled={p.coverMediaId === selected.id}
                        onClick={() => cover(selected.id)}
                      >
                        {p.coverMediaId === selected.id ? t("isCover") : t("setCover")}
                      </Button>
                    )}
                    {selected.original && (
                      <Button variant="outline" size="sm" icon="upload" onClick={() => replaceInput.current?.click()}>
                        {t("replace")}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" icon="undo" onClick={() => move(selected.id, -1)}>
                      {t("moveEarlier")}
                    </Button>
                    <Button variant="outline" size="sm" icon="redo" onClick={() => move(selected.id, 1)}>
                      {t("moveLater")}
                    </Button>
                    <Button variant="outline" size="sm" icon="delete" onClick={() => del(selected.id)}>
                      {t("delete")}
                    </Button>
                  </div>
                  <input
                    ref={replaceInput}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      if (e.target.files?.[0]) addFiles([e.target.files[0]], selected.id);
                      e.target.value = "";
                    }}
                  />
                  {selected.type !== "text" && (
                    <div className="flex flex-wrap gap-3.5 text-[13px]">
                      <Checkbox
                        label={t("fullWidth")}
                        checked={selected.display.fullWidth}
                        onChange={(e) =>
                          editItem(
                            selected.id,
                            { display: { fullWidth: e.target.checked } },
                            { display: { ...selected.display, fullWidth: e.target.checked } },
                          )
                        }
                      />
                      <Checkbox
                        label={t("lightbox")}
                        checked={selected.display.lightbox}
                        onChange={(e) =>
                          editItem(
                            selected.id,
                            { display: { lightbox: e.target.checked } },
                            { display: { ...selected.display, lightbox: e.target.checked } },
                          )
                        }
                      />
                      {(selected.type === "loop" || selected.type === "gif") && (
                        <Checkbox
                          label={t("autoplay")}
                          checked={selected.display.autoplay}
                          onChange={(e) =>
                            editItem(
                              selected.id,
                              { display: { autoplay: e.target.checked } },
                              { display: { ...selected.display, autoplay: e.target.checked } },
                            )
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* Right: credits and settings */}
        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
          <Panel title={t("credits")}>
            {fieldProblem && <Problem>{fieldProblem}</Problem>}
            <Field label={t("fields.title")}>
              <input
                className={inputCls}
                value={p.title}
                maxLength={120}
                onChange={(e) => {
                  setP((x) => ({ ...x, title: e.target.value }));
                  setFieldProblem(null);
                  save(
                    "title",
                    { title: e.target.value },
                    600,
                    (r) => r?.slug && setP((x) => ({ ...x, slug: r.slug })),
                  );
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label={t("fields.category")}>
                <select
                  className={inputCls}
                  value={p.category}
                  onChange={(e) => setField("category", e.target.value, { category: e.target.value }, 0)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("fields.year")}>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={p.year}
                  maxLength={9}
                  onChange={(e) => setField("year", e.target.value, { year: e.target.value })}
                />
              </Field>
              <Field label={t("fields.role")}>
                <input
                  className={inputCls}
                  value={p.role}
                  onChange={(e) => setField("role", e.target.value, { role: e.target.value })}
                />
              </Field>
              <Field label={t("fields.client")}>
                <input
                  className={inputCls}
                  value={p.client}
                  onChange={(e) => setField("client", e.target.value, { client: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("fields.studio")}>
              <input
                className={inputCls}
                value={p.studio}
                onChange={(e) => setField("studio", e.target.value, { studio: e.target.value })}
              />
            </Field>
            <Field label={t("fields.team")}>
              <input
                className={inputCls}
                placeholder={t("fields.teamPlaceholder")}
                value={p.team}
                onChange={(e) => setField("team", e.target.value, { team: e.target.value })}
              />
            </Field>
            <Field label={t("fields.description")}>
              <textarea
                className={areaCls}
                value={p.description}
                onChange={(e) => setField("description", e.target.value, { description: e.target.value })}
              />
            </Field>
            <Field label={t("fields.tags")} hint={t("fields.tagsHint")}>
              <input
                className={inputCls}
                defaultValue={p.tags.join(", ")}
                onChange={(e) => save("tags", { tags: e.target.value })}
              />
            </Field>
          </Panel>

          <Panel title={t("visibility.title")}>
            <div role="radiogroup" aria-label={t("visibility.title")} className="flex flex-col gap-2">
              {(["public", "password", "hidden"] as const).map((v) => {
                const on = p.visibility === v;
                const locked = v === "password" && !canPassword;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={locked}
                    onClick={() => {
                      if (v === "password" && !p.hasPassword) setP((x) => ({ ...x, visibility: v }));
                      else setField("visibility", v, { visibility: v }, 0);
                    }}
                    className={cx(
                      "flex flex-col items-start gap-0.5 rounded-[10px] border-2 px-3 py-2.5 text-start",
                      on ? "border-ink bg-mist" : "border-line bg-paper",
                      locked && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {t(`visibility.${v}`)}
                      {locked && <Badge variant="brand">{t("visibility.pro")}</Badge>}
                    </span>
                    <span className="text-muted text-[12px]">{t(`visibility.${v}Desc`)}</span>
                  </button>
                );
              })}
            </div>
            {p.visibility === "password" && canPassword && (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (password) void savePassword();
                }}
              >
                <Field
                  label={t("visibility.passwordLabel")}
                  hint={p.hasPassword ? t("visibility.passwordSet") : undefined}
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputCls}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Button type="submit" size="sm" variant="outline" disabled={!password}>
                  {t("visibility.savePassword")}
                </Button>
              </form>
            )}
            <div className="border-line flex items-start justify-between gap-3 border-t pt-3.5">
              <span className="flex flex-col">
                <span className="font-semibold">{t("mature")}</span>
                <span className="text-muted text-[12px]">{t("matureDesc")}</span>
              </span>
              <Toggle
                label={t("mature")}
                hideLabel
                checked={p.mature}
                onChange={(v) => setField("mature", v, { mature: v }, 0)}
              />
            </div>
          </Panel>

          <Panel title={t("seo.title")}>
            <Field label={t("seo.pageTitle")} hint={t("seo.pageTitleHint")}>
              <input
                className={inputCls}
                value={p.seo.title}
                placeholder={p.title}
                onChange={(e) => {
                  setP((x) => ({ ...x, seo: { ...x.seo, title: e.target.value } }));
                  save("seoTitle", { seoTitle: e.target.value });
                }}
              />
            </Field>
            <Field label={t("seo.description")}>
              <textarea
                className={areaCls}
                value={p.seo.description}
                onChange={(e) => {
                  setP((x) => ({ ...x, seo: { ...x.seo, description: e.target.value } }));
                  save("seoDescription", { seoDescription: e.target.value });
                }}
              />
            </Field>
            <Field label={t("seo.link")}>
              <span dir="ltr" className={cx(inputCls, "focus-within:border-ink flex items-center gap-0")}>
                <span className="text-muted flex-none">{address}/</span>
                <input
                  className="h-full min-w-0 flex-1 bg-transparent outline-none focus-visible:shadow-none"
                  value={p.slug}
                  aria-label={t("seo.link")}
                  onChange={(e) =>
                    setP((x) => ({ ...x, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))
                  }
                  onBlur={() =>
                    save("slug", { slug: p.slug }, 0, (r) => r?.slug && setP((x) => ({ ...x, slug: r.slug })))
                  }
                />
              </span>
            </Field>
          </Panel>

          <Panel
            title={t("arabic.title")}
            aside={
              <Toggle
                label={t("arabic.title")}
                hideLabel
                checked={p.arabic}
                onChange={(v) => setField("arabic", v, { arabic: v }, 0)}
              />
            }
          >
            <p className="text-muted -mt-2 text-[12px]">{t("arabic.desc")}</p>
            {p.arabic && (
              <div dir="rtl" lang="ar" className="flex flex-col gap-2.5">
                <Field label={t("arabic.projectTitle")}>
                  <input
                    className={inputCls}
                    value={p.ar.title}
                    onChange={(e) => {
                      setP((x) => ({ ...x, ar: { ...x.ar, title: e.target.value } }));
                      save("arTitle", { arTitle: e.target.value });
                    }}
                  />
                </Field>
                <Field label={t("arabic.role")}>
                  <input
                    className={inputCls}
                    value={p.ar.role}
                    onChange={(e) => {
                      setP((x) => ({ ...x, ar: { ...x.ar, role: e.target.value } }));
                      save("arRole", { arRole: e.target.value });
                    }}
                  />
                </Field>
                <Field label={t("arabic.description")}>
                  <textarea
                    className={areaCls}
                    value={p.ar.description}
                    onChange={(e) => {
                      setP((x) => ({ ...x, ar: { ...x.ar, description: e.target.value } }));
                      save("arDescription", { arDescription: e.target.value });
                    }}
                  />
                </Field>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {selected && (selected.type === "image" || selected.type === "svg") && selected.status === "ready" && (
        <CropModal
          key={`${selected.id}-${selected.gen}`}
          open={cropOpen}
          src={imageSources(selected, 1600)?.src ?? ""}
          width={selected.width ?? 4}
          height={selected.height ?? 3}
          busy={busyCrop}
          onClose={() => setCropOpen(false)}
          onSave={(c) => saveCrop(c)}
          onReset={() => saveCrop(null)}
        />
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("deleteConfirmTitle")}
        closeLabel={t("cancel")}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t("cancel")}
            </Button>
            <Button
              icon="delete"
              onClick={async () => {
                const r = await removeProject(p.id);
                if (r.ok) window.location.assign("/projects");
                else setProblem(errorText(r.error));
              }}
            >
              {t("deleteProject")}
            </Button>
          </>
        }
      >
        {t("deleteConfirm")}
      </Modal>
    </div>
  );
}
