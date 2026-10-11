"use client";

// Round 13: "Create your new project": a thumbnail and a title, then straight into the project.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses, type ButtonSize } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { IMAGE_ACCEPT, uploadFile } from "@/components/editor/upload";
import { newProject } from "./actions";

export function NewProjectButton({ label, title, size = "md" }: { label: string; title: string; size?: ButtonSize }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClasses("primary", size)} onClick={() => setOpen(true)} data-testid="new-project">
        <Icon name="add" size={18} />
        {label}
      </button>
      {open && <NewProjectDialog fallbackTitle={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewProjectDialog({ fallbackTitle, onClose }: { fallbackTitle: string; onClose: () => void }) {
  const t = useTranslations("projects.create");
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const pick = (f?: File | null) => {
    if (!f || !(f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|svg)$/i.test(f.name))) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  async function save() {
    setBusy(true);
    const r = await newProject(name.trim() || fallbackTitle).catch(() => null);
    if (!r?.ok) return window.location.assign("/projects?limit=1");
    // The first picture in a project becomes its cover.
    if (file) await uploadFile(r.id, file).catch(() => null);
    window.location.assign(`/projects/${r.id}`);
  }
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
      aria-labelledby="new-project-title"
      className="bg-paper text-ink shadow-float backdrop:bg-ink/40 m-auto w-[min(520px,calc(100vw-32px))] rounded-[28px] p-0"
      data-testid="new-project-dialog"
    >
      <form
        className="flex flex-col gap-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 id="new-project-title" className="font-heading font-heading-weight text-[24px] leading-tight">
          {t("title")}
        </h2>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={cx(
            "relative flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[16px] border-2 border-dashed text-[14px]",
            over ? "border-ink bg-mist" : "border-line hover:bg-mist",
          )}
          data-testid="new-project-thumb"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <Icon name="upload" size={24} />
              <span className="font-semibold">{t("thumb")}</span>
              <span className="text-muted text-[13px]">{t("thumbHint")}</span>
            </>
          )}
        </button>
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          data-testid="new-project-file"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("name")}
          <input
            autoFocus
            value={name}
            maxLength={120}
            placeholder={fallbackTitle}
            onChange={(e) => setName(e.target.value)}
            className="border-line focus:border-ink h-12 rounded-[12px] border bg-white px-4 text-[16px] font-normal outline-none"
            data-testid="new-project-name"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClasses("outline", "md")} onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button type="submit" className={buttonClasses("primary", "md")} disabled={busy} data-testid="new-project-save">
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
