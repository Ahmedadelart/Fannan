"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { type SiteMedia } from "@/components/site/SiteRender";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { newProject } from "../../(dash)/projects/actions";
import { Text } from "../_ui/controls";
import { Thumb } from "../_ui/media";

/* ---------- Projects panel (rail) ---------- */

export function ProjectsPanel({
  projects,
  media,
  onOpen,
}: {
  projects: Array<{ id: string; title: string; coverId: string | null }>;
  media: Record<string, SiteMedia>;
  /** Opens a project in the editor's wide panel. */
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("editor.projectsPanel");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-muted text-[11px] font-semibold tracking-[0.1em] uppercase">{t("title")}</h2>
      <form
        className="bg-mist flex flex-col gap-2.5 rounded-[12px] p-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await newProject(title);
          setBusy(false);
          if (r.ok) {
            setTitle("");
            onOpen(r.id);
          }
        }}
      >
        <span className="font-heading font-heading-weight text-[20px] leading-tight">{t("create")}</span>
        <span className="text-muted text-[12px]">{t("createHint")}</span>
        <Text title={t("projectTitle")} value={title} onChange={setTitle} />
        <Button type="submit" variant="lime" size="sm" disabled={busy} className="self-start">
          {busy ? t("creating") : t("createButton")}
        </Button>
      </form>
      {projects.length === 0 && <p className="text-muted text-[13px]">{t("empty")}</p>}
      <ul className="flex flex-col gap-1.5">
        {projects.map((p) => (
          <li key={p.id}>
            <a
              href={`/projects/${p.id}`}
              onClick={(e) => {
                e.preventDefault();
                onOpen(p.id);
              }}
              className="hover:bg-mist flex items-center gap-3 rounded-[10px] p-1.5"
            >
              <Thumb m={p.coverId ? media[p.coverId] : undefined} className="h-10 w-14 flex-none rounded-[8px]" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.title}</span>
              <Icon name="site-editor" size={16} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
