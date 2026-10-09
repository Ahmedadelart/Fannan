import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { isAdminEmail } from "@/config/admins";
import { countUnread, settingsFrom } from "@/lib/server/settings";
import { loadDashboard } from "../(dash)/load";
import { Editor } from "./Editor";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/editor">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "editor" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function EditorPage({ params }: PageProps<"/[locale]/app/editor">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { user, site, draft, render, limits, session, pro } = await loadDashboard();
  const unread = await countUnread(site.id).catch(() => 0);
  const tp = await getTranslations("projects");
  const categories = Object.fromEntries(
    Object.keys(tp.raw("categories") as Record<string, string>)
      .filter(Boolean)
      .map((k) => [k, tp(`categories.${k}`)]),
  );
  const draftAt = (site as { draftUpdatedAt?: { toMillis(): number } }).draftUpdatedAt?.toMillis() ?? 0;
  const publishedAt = (site as { publishedAt?: { toMillis(): number } }).publishedAt?.toMillis() ?? 0;

  const settings = settingsFrom(site as Parameters<typeof settingsFrom>[0]);

  return (
    <Editor
      account={{
        name: (user as { displayName?: string }).displayName ?? site.title,
        admin: !session.isAnonymous && isAdminEmail(session.email),
        pro: pro.plan === "pro",
        unread,
        deletionPending: !!(user as { deletion?: unknown }).deletion,
      }}
      initialSettings={{ social: settings.social, cvMediaId: settings.cvMediaId, contact: settings.contact }}
      initialDraft={draft}
      media={render.media}
      projects={render.projects}
      categories={categories}
      available={site.available.on}
      published={{ version: site.publishedVersion, dirty: site.publishedVersion === null || draftAt > publishedAt }}
      canPassword={limits.passwordProtection}
      showTips={!(user as { editorTipsSeen?: boolean }).editorTipsSeen}
      credit={limits.footerCredit}
      isPro={limits.customDomain}
    />
  );
}
