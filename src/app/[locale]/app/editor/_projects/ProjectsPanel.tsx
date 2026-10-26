"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { type SiteMedia } from "@/components/site/SiteRender";
import { Icon } from "@/components/ui/Icon";
import { NewProjectDialog } from "../../(dash)/projects/NewProjectButton";
import { Thumb } from "../_ui/media";

/* ---------- Projects panel (rail): one "New project" dialog everywhere (round 18) ---------- */

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
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-3 px-3 pt-3 pb-6">
      <h2 className="px-1 text-[15px] font-semibold">{t("title")}</h2>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="bg-lime text-on-lime flex h-10 items-center justify-center gap-1.5 rounded-pill text-[13px] font-semibold"
        data-testid="new-project"
      >
        <Icon name="add" size={16} />
        {t("createButton")}
      </button>
      {creating && <NewProjectDialog fallbackTitle={t("untitled")} onClose={() => setCreating(false)} onCreated={(id) => onOpen(id)} />}
      {projects.length === 0 && <p className="text-muted px-1 text-[13px]">{t("empty")}</p>}
      <ul className="grid grid-cols-2 gap-2.5">
        {projects.map((p) => (
          <li key={p.id} className="min-w-0">
            <a
              href={`/projects/${p.id}`}
              onClick={(e) => {
                e.preventDefault();
                onOpen(p.id);
              }}
              className="hover:bg-mist flex flex-col gap-1.5 rounded-[12px] p-1"
            >
              <Thumb m={p.coverId ? media[p.coverId] : undefined} className="aspect-[4/3] w-full rounded-[8px]" />
              <span className="truncate px-0.5 text-[12px] font-semibold">{p.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
