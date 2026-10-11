"use client";

// Round 13: clone and delete right on a project card (shown on hover, always reachable by keyboard).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlays";
import { cloneProject, removeProject } from "@/app/[locale]/app/(dash)/projects/actions";

export function ProjectCardActions({ id, title }: { id: string; title: string }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const btn =
    "bg-paper/95 text-ink hover:bg-paper flex size-9 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,.18)] disabled:opacity-50";
  return (
    <>
      <div
        className="absolute end-2.5 top-2.5 flex gap-1.5 opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100 max-md:opacity-100"
        data-testid="project-card-actions"
      >
        <button
          type="button"
          className={btn}
          disabled={pending}
          title={t("clone")}
          aria-label={`${t("clone")}: ${title}`}
          data-testid="project-clone"
          onClick={() =>
            start(async () => {
              const r = await cloneProject(id, t("copySuffix"));
              if (r.ok) router.refresh();
              else if (r.error === "limit") window.location.assign("/projects?limit=1");
            })
          }
        >
          <Icon name="duplicate" size={18} />
        </button>
        <button
          type="button"
          className={btn}
          disabled={pending}
          title={t("deleteProject")}
          aria-label={`${t("deleteProject")}: ${title}`}
          data-testid="project-delete"
          onClick={() => setConfirm(true)}
        >
          <Icon name="delete" size={18} />
        </button>
      </div>
      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(false)}
          title={t("deleteConfirmTitle")}
          closeLabel={t("cancel")}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                {t("cancel")}
              </Button>
              <Button
                disabled={pending}
                data-testid="project-delete-confirm"
                onClick={() =>
                  start(async () => {
                    await removeProject(id);
                    setConfirm(false);
                    router.refresh();
                  })
                }
              >
                {t("delete")}
              </Button>
            </>
          }
        >
          <p>
            <strong>{title}</strong> · {t("deleteConfirm")}
          </p>
        </Modal>
      )}
    </>
  );
}
