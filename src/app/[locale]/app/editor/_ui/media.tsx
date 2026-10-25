"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { type SiteMedia } from "@/components/site/SiteRender";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlays";
import { cx } from "@/lib/cx";
import { imageSources } from "@/lib/media";
import { beginUpload, completeUpload } from "../../(dash)/projects/actions";

/* ---------- media ---------- */

export type MediaKind = "image" | "loop" | "pdf";
export const accepts: Record<MediaKind, string[]> = {
  image: ["image", "gif", "svg"],
  loop: ["gif", "loop"],
  pdf: ["pdf"],
};
export const uploadTypes: Record<MediaKind, string> = {
  image: ".jpg,.jpeg,.png,.gif,.webp,.svg,image/*",
  loop: ".gif,.mp4,image/gif,video/mp4",
  pdf: ".pdf,application/pdf",
};
export const EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
};

export function Thumb({ m, className }: { m?: SiteMedia; className?: string }) {
  const src = m ? imageSources(m, 400) : null;
  if (!src) {
    return (
      <span className={cx("bg-mist text-muted flex items-center justify-center", className)}>
        <Icon name="image" size={20} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src.src} alt={m?.alt ?? ""} className={cx("object-cover", className)} />;
}

export function MediaPicker({
  open,
  kind,
  media,
  onClose,
  onPick,
  onUploaded,
}: {
  open: boolean;
  kind: MediaKind;
  media: Record<string, SiteMedia>;
  onClose: () => void;
  onPick: (id: string) => void;
  onUploaded: (m: SiteMedia) => void;
}) {
  const t = useTranslations("editor.picker");
  const tp = useTranslations("projects");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const items = Object.values(media).filter((m) => accepts[kind].includes(m.type));

  async function upload(file: File) {
    setBusy(true);
    setProblem(null);
    const type = EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
    const start = await beginUpload("_library", { name: file.name, type, size: file.size });
    if (!start.ok) {
      setBusy(false);
      return setProblem(
        tp.has(`errors.${start.error}`) ? tp(`errors.${start.error}`, { image: 30, pdf: 50 }) : tp("errors.error"),
      );
    }
    const put = await fetch(start.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": start.contentType },
      body: file,
    }).catch(() => null);
    if (!put?.ok) {
      setBusy(false);
      return setProblem(tp("errors.error"));
    }
    const done = await completeUpload(start.mediaId);
    setBusy(false);
    if (!done.ok)
      return setProblem(
        tp.has(`errors.${done.error}`) ? tp(`errors.${done.error}`, { image: 30, pdf: 50 }) : tp("errors.error"),
      );
    const m = done.media;
    const sm: SiteMedia = {
      id: m.id,
      type: m.type,
      variants: m.variants,
      poster: m.poster,
      loop: m.loop,
      width: m.width,
      height: m.height,
      alt: m.alt,
      caption: m.caption,
      pages: m.pages,
    };
    onUploaded(sm);
    onPick(m.id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      closeLabel={t("close")}
      footer={
        <>
          <input
            ref={input}
            type="file"
            accept={uploadTypes[kind]}
            className="sr-only"
            data-testid="picker-file"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <Button variant="lime" icon="upload" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? t("uploading") : t("upload")}
          </Button>
        </>
      }
    >
      {problem && <p className="text-ink mb-2 font-semibold">{problem}</p>}
      {items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto">
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              className="hover:border-ink overflow-hidden rounded-md border-2 border-transparent"
              data-testid="picker-item"
            >
              <Thumb m={m} className="aspect-square w-full" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function MediaField({
  title,
  id,
  kind,
  media,
  onChange,
  openPicker,
}: {
  title: string;
  id: string | null;
  kind: MediaKind;
  media: Record<string, SiteMedia>;
  onChange: (id: string | null) => void;
  openPicker: (kind: MediaKind, done: (id: string) => void) => void;
}) {
  const t = useTranslations("editor.fields");
  const m = id ? media[id] : undefined;
  return (
    <div className="flex flex-col gap-1.5 text-[12px] font-semibold">
      {title}
      <div className="flex items-center gap-2.5">
        <Thumb m={m} className="size-14 flex-none rounded-md" />
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => openPicker(kind, onChange)}>
            {m ? t("replace") : t("choose")}
          </Button>
          {m && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              {t("clear")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
