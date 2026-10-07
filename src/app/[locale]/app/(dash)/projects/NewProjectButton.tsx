"use client";

import { useTransition } from "react";
import { buttonClasses, type ButtonSize } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { newProject } from "./actions";

export function NewProjectButton({ label, title, size = "md" }: { label: string; title: string; size?: ButtonSize }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClasses("primary", size)}
      onClick={() =>
        start(async () => {
          const r = await newProject(title);
          window.location.assign(r.ok ? `/projects/${r.id}` : "/projects?limit=1");
        })
      }
    >
      <Icon name="add" size={18} />
      {label}
    </button>
  );
}
