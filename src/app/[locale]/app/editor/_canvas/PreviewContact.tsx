"use client";

import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import type { Locale } from "@/i18n/locales";
import type { BlockOf } from "@/lib/site/types";
import { CONTACT_WORDS, contactFormOf, type LegacyContactFields } from "@/lib/site/contact";

/* ---------- the contact form in the preview: looks real, sends nothing ---------- */

export function PreviewContact({
  block,
  language,
  fallback,
}: {
  block: BlockOf<"contact">;
  language: Locale;
  fallback: LegacyContactFields;
}) {
  const t = useTranslations("editor");
  const toast = useToast();
  const form = contactFormOf(block, fallback);
  const w = CONTACT_WORDS[language];
  const box = {
    border: "1px solid var(--site-line)",
    borderRadius: "var(--site-radius)",
    background: "var(--site-bg)",
    color: "var(--site-text)",
  };
  const field = (label: string, tall?: boolean) => (
    <label key={label} className="grid gap-1.5 text-[14px] font-semibold">
      {label}
      {tall ? (
        <textarea rows={4} className="w-full px-3.5 py-3 text-[16px] outline-none" style={box} />
      ) : (
        <input className="w-full px-3.5 py-3 text-[16px] outline-none" style={box} />
      )}
    </label>
  );
  return (
    <form
      className="site-form mt-2 grid w-full max-w-[560px] gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        toast(t("previewSend"), "messages");
      }}
    >
      {field(form.labels.name || w.name)}
      {field(form.labels.email || w.email)}
      {form.projectType && field(w.projectType)}
      {form.budget && field(w.budget)}
      {form.deadline && field(w.deadline)}
      {form.custom && field(form.custom)}
      {field(form.labels.message || w.message, true)}
      <button
        type="submit"
        className="site-button justify-self-start border-0"
        style={{ cursor: "pointer", font: "inherit", fontWeight: 600 }}
      >
        {block.button}
      </button>
    </form>
  );
}
