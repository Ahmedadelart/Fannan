"use client";

// Round 16, "Bring your work in": a folder of the artist's own files becomes projects (one per
// subfolder, full-quality originals), or a Behance / ArtStation / Dribbble link starts a project
// from the preview that site publishes. Either way the artist confirms the work is theirs.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses, type ButtonSize } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { UPLOAD_TYPES, uploadFile } from "@/components/editor/upload";
import { newProject, previewLink, projectFromLink } from "./actions";

type Found = { file: File; path: string };
type Group = { key: string; title: string; files: File[]; on: boolean };

export function ImportButton({ label, remaining, size = "md" }: { label: string; remaining: number | null; size?: ButtonSize }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClasses("outline", size)} onClick={() => setOpen(true)} data-testid="import-work">
        <Icon name="upload" size={18} />
        {label}
      </button>
      {open && <ImportDialog remaining={remaining} onClose={() => setOpen(false)} />}
    </>
  );
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
const accepted = (name: string) => !name.startsWith(".") && !!UPLOAD_TYPES[name.split(".").pop()?.toLowerCase() ?? ""];

/** "02_fever-dreams_gallery" → "Fever dreams gallery". */
export function folderTitle(name: string): string {
  const t = name
    .replace(/^\d+[\s._-]*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : name;
}

/** Files → projects: each first-level subfolder is a project; loose files form one named after the folder. */
export function groupFiles(found: Found[], fallback: string): Group[] {
  const files = found.filter((f) => accepted(f.file.name));
  const parts = files.map((f) => f.path.split("/").filter(Boolean));
  // One folder dropped (or chosen): its name is the shared first part; leave it out.
  const root = parts.length && parts.every((p) => p.length > 1 && p[0] === parts[0][0]) ? parts[0][0] : "";
  const byKey = new Map<string, File[]>();
  files.forEach((f, i) => {
    const p = root ? parts[i].slice(1) : parts[i];
    const key = p.length > 1 ? p[0] : root || fallback;
    byKey.set(key, [...(byKey.get(key) ?? []), f.file]);
  });
  return [...byKey.entries()]
    .sort(([a], [b]) => natural(a, b))
    .map(([key, list]) => ({ key, title: folderTitle(key).slice(0, 120), files: list.sort((a, b) => natural(a.name, b.name)), on: true }));
}

/** Everything inside dropped folders (browsers hand folders over as entries to walk). */
async function walkDrop(items: DataTransferItemList): Promise<Found[]> {
  const out: Found[] = [];
  const visit = async (entry: FileSystemEntry | null, prefix: string): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)).catch(() => null);
      if (file) out.push({ file, path: `${prefix}${file.name}` });
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res) => reader.readEntries(res, () => res([])));
      if (!batch.length) break;
      for (const e of batch) await visit(e, `${prefix}${entry.name}/`);
    }
  };
  const entries = [...items].map((i) => i.webkitGetAsEntry?.() ?? null);
  for (const e of entries) await visit(e, "");
  return out;
}

function ImportDialog({ remaining, onClose }: { remaining: number | null; onClose: () => void }) {
  const t = useTranslations("projects.import");
  const ref = useRef<HTMLDialogElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"folder" | "link">("folder");
  const [groups, setGroups] = useState<Group[]>([]);
  const [over, setOver] = useState(false);
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ project: number; projects: number; done: number; total: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  // Link mode.
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<{ site: string; image: string } | null>(null);
  const [title, setTitle] = useState("");
  const [words, setWords] = useState("");
  const [useImage, setUseImage] = useState(true);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const thumbs = useMemo(() => groups.map((g) => URL.createObjectURL(g.files[0])), [groups]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const take = (found: Found[]) => {
    const next = groupFiles(found, t("untitled"));
    // Free plans: only as many projects as there's room for are ticked.
    let room = remaining ?? Infinity;
    setGroups(next.map((g) => ({ ...g, on: room-- > 0 })));
    setNotice(next.length ? "" : t("noPictures"));
  };
  const chosen = groups.filter((g) => g.on);
  const tooMany = remaining !== null && chosen.length > remaining;

  async function importFolders() {
    setBusy(true);
    setNotice("");
    let failed = 0;
    let stopped = false;
    const total = chosen.reduce((n, g) => n + g.files.length, 0);
    let done = 0;
    for (const [i, g] of chosen.entries()) {
      setProgress({ project: i + 1, projects: chosen.length, done, total });
      const r = await newProject(g.title || t("untitled")).catch(() => null);
      if (!r?.ok) {
        setNotice(r && r.error === "limit" ? t("limit") : t("failed"));
        stopped = true;
        break;
      }
      // Three at a time, in the folder's order (the first picture becomes the cover).
      const queue = [...g.files];
      const first = queue.shift()!;
      const one = async (f: File) => {
        const u = await uploadFile(r.id, f).catch(() => ({ ok: false as const, error: "error" }));
        if (!u.ok) failed++;
        done++;
        setProgress({ project: i + 1, projects: chosen.length, done, total });
        return u;
      };
      const firstResult = await one(first);
      if (!firstResult.ok && firstResult.error === "storage-full") {
        setNotice(t("storageFull"));
        stopped = true;
        break;
      }
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          for (let f = queue.shift(); f; f = queue.shift()) await one(f);
        }),
      );
    }
    // Anything that went wrong stays on screen; otherwise straight back to the projects.
    if (failed || stopped) {
      if (failed) setNotice(t("someFailed", { count: failed }));
      setBusy(false);
      setGroups([]);
      setDone(true);
      return;
    }
    window.location.assign("/projects");
  }

  async function readLink() {
    setBusy(true);
    setNotice("");
    const r = await previewLink(url).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setPreview(null);
      setNotice(t("badLink"));
      return;
    }
    setPreview({ site: r.preview.site, image: r.preview.image });
    setTitle(r.preview.title);
    setWords(r.preview.description);
    setUseImage(!!r.preview.image);
    if (!r.preview.title) setNotice(t("couldntRead", { site: r.preview.site }));
  }

  async function createFromLink() {
    setBusy(true);
    const r = await projectFromLink({ url, title: title || t("untitled"), description: words, image: useImage && preview?.image ? preview.image : undefined }).catch(() => null);
    if (!r?.ok) {
      setBusy(false);
      setNotice(r && r.error === "limit" ? t("limit") : t("failed"));
      return;
    }
    window.location.assign(`/projects/${r.id}`);
  }

  const tab = (m: "folder" | "link", text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setNotice("");
      }}
      className={cx("rounded-pill h-9 px-4 text-[14px] font-semibold", mode === m ? "bg-primary text-on-primary" : "hover:bg-mist")}
      data-testid={`import-tab-${m}`}
    >
      {text}
    </button>
  );
  const confirm = (
    <label className="flex items-start gap-2.5 text-[14px]">
      <input type="checkbox" className="accent-primary mt-0.5 size-4 flex-none" checked={mine} onChange={(e) => setMine(e.target.checked)} data-testid="import-mine" />
      <span>{t("mine")}</span>
    </label>
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
      aria-labelledby="import-title"
      className="bg-paper text-ink shadow-float backdrop:bg-ink/40 m-auto w-[min(640px,calc(100vw-32px))] rounded-[28px] p-0"
      data-testid="import-dialog"
    >
      <div className="flex max-h-[85vh] flex-col gap-5 overflow-y-auto p-6">
        <div className="flex flex-col gap-1">
          <h2 id="import-title" className="font-heading font-heading-weight text-[24px] leading-tight">
            {t("title")}
          </h2>
          <p className="text-muted text-[14px]">{t("sub")}</p>
        </div>
        <div role="tablist" aria-label={t("title")} className="bg-mist rounded-pill flex w-fit gap-1 p-1">
          {tab("folder", t("fromFolder"))}
          {tab("link", t("fromLink"))}
        </div>

        {mode === "folder" ? (
          <>
            <button
              type="button"
              onClick={() => folderInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setOver(false);
                take(await walkDrop(e.dataTransfer.items));
              }}
              disabled={busy}
              className={cx(
                "flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed p-6 text-center text-[14px]",
                over ? "border-ink bg-mist" : "border-line hover:bg-mist",
              )}
              data-testid="import-drop"
            >
              <Icon name="upload" size={24} />
              <span className="font-semibold">{t("drop")}</span>
              <span className="text-muted text-[13px]">{t("dropHint")}</span>
            </button>
            <input
              ref={folderInput}
              type="file"
              multiple
              hidden
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              data-testid="import-folder"
              onChange={(e) => {
                const list = [...(e.target.files ?? [])];
                take(list.map((file) => ({ file, path: file.webkitRelativePath || file.name })));
                e.target.value = "";
              }}
            />
            {groups.length > 0 && (
              <ul className="flex flex-col gap-2" data-testid="import-groups">
                {groups.map((g, i) => (
                  <li key={g.key} className={cx("border-line flex items-center gap-3 rounded-[16px] border p-2", !g.on && "opacity-55")}>
                    <input
                      type="checkbox"
                      className="accent-primary size-4 flex-none"
                      checked={g.on}
                      aria-label={g.title}
                      onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbs[i]} alt="" className="size-14 flex-none rounded-[10px] object-cover" />
                    <input
                      value={g.title}
                      maxLength={120}
                      aria-label={t("projectName")}
                      onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      className="border-line focus:border-ink h-10 min-w-0 flex-1 rounded-[12px] border bg-white px-3 text-[15px] outline-none"
                    />
                    <span className="text-muted flex-none px-1 text-[13px] tabular-nums">{t("pictures", { count: g.files.length })}</span>
                  </li>
                ))}
              </ul>
            )}
            {tooMany && <p className="text-[14px]">{t("roomFor", { count: remaining ?? 0 })}</p>}
            {groups.length > 0 && confirm}
          </>
        ) : (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void readLink();
              }}
            >
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.behance.net/gallery/…"
                aria-label={t("link")}
                className="border-line focus:border-ink h-12 min-w-0 flex-1 rounded-[12px] border bg-white px-4 text-[15px] outline-none"
                data-testid="import-link"
                dir="ltr"
              />
              <button type="submit" className={buttonClasses("outline", "md")} disabled={busy || !url.trim()} data-testid="import-read">
                {t("read")}
              </button>
            </form>
            <p className="text-muted -mt-3 text-[13px]">{t("linkHint")}</p>
            {preview && (
              <div className="flex flex-col gap-3" data-testid="import-preview">
                {preview.image && (
                  <label className="flex items-center gap-3 text-[14px]">
                    {/* The site's own preview picture, shown as the site serves it. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.image} alt="" referrerPolicy="no-referrer" className="h-20 w-32 flex-none rounded-[10px] object-cover" />
                    <input type="checkbox" className="accent-primary size-4" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} />
                    {t("useImage")}
                  </label>
                )}
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  {t("projectName")}
                  <input
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-line focus:border-ink h-12 rounded-[12px] border bg-white px-4 text-[16px] font-normal outline-none"
                    data-testid="import-title-field"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  {t("description")}
                  <textarea
                    value={words}
                    rows={3}
                    maxLength={1000}
                    onChange={(e) => setWords(e.target.value)}
                    className="border-line focus:border-ink rounded-[12px] border bg-white px-4 py-3 text-[15px] font-normal outline-none"
                  />
                </label>
                <p className="text-muted text-[13px]">{t("linkKept", { site: preview.site })}</p>
                {confirm}
              </div>
            )}
          </>
        )}

        {progress && (
          <div className="flex flex-col gap-1.5" role="status" data-testid="import-progress">
            <span className="text-[14px] font-semibold">{t("progress", progress)}</span>
            <span className="bg-mist block h-2 overflow-hidden rounded-full">
              <span className="bg-primary block h-full" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </span>
          </div>
        )}
        {notice && (
          <p role="alert" className="text-[14px]" data-testid="import-notice">
            {notice}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClasses("outline", "md")} onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          {done ? (
            <button type="button" className={buttonClasses("primary", "md")} onClick={() => window.location.assign("/projects")}>
              {t("seeProjects")}
            </button>
          ) : mode === "folder" ? (
            <button
              type="button"
              className={buttonClasses("primary", "md")}
              disabled={busy || !mine || !chosen.length || tooMany}
              onClick={() => void importFolders()}
              data-testid="import-go"
            >
              {busy ? t("importing") : t("importCount", { count: chosen.length })}
            </button>
          ) : (
            <button
              type="button"
              className={buttonClasses("primary", "md")}
              disabled={busy || !mine || !preview}
              onClick={() => void createFromLink()}
              data-testid="import-create"
            >
              {busy ? t("importing") : t("create")}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
