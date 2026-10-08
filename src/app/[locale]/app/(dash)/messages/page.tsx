import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/ui/Surfaces";
import type { Locale } from "@/i18n/locales";
import { listMessages } from "@/lib/server/settings";
import { loadDashboard } from "../load";
import { Inbox } from "./Inbox";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/messages">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inbox" });
  return { title: t("title"), robots: { index: false } };
}

export default async function MessagesPage({ params }: PageProps<"/[locale]/app/messages">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("inbox");
  const { site, address } = await loadDashboard();
  const messages = await listMessages(site.id);
  const unread = messages.filter((m) => !m.read).length;

  return (
    <>
      <div>
        <h1 className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">{t("title")}</h1>
        <p className="text-muted mt-1">
          {messages.length ? t("sub", { count: messages.length, unread }) : t("subEmpty")}
        </p>
      </div>
      {messages.length === 0 ? (
        <EmptyState icon="messages" title={t("emptyTitle")} text={t("emptyText", { address: `⁦${address}⁩` })} />
      ) : (
        <Inbox initial={messages} siteTitle={site.title || address} />
      )}
    </>
  );
}
