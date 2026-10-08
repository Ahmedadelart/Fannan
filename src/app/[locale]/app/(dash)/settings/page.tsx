import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { currencyForCountry } from "@/config/plans";
import { checkoutProvider, listOrders, priceList } from "@/lib/server/billing";
import { getDomain } from "@/lib/server/domains";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Locale } from "@/i18n/locales";
import { imageSources } from "@/lib/media";
import type { MediaDoc } from "@/lib/server/projects";
import { settingsFrom } from "@/lib/server/settings";
import { DISPLAY_DOMAIN } from "@/lib/server/urls";
import { loadDashboard } from "../load";
import { SettingsForm, type SettingsData } from "./SettingsForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SettingsPage({ params }: PageProps<"/[locale]/app/settings">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const { session, user, site, limits, siteUrl, pro } = await loadDashboard();

  const settings = settingsFrom(site as Parameters<typeof settingsFrom>[0]);
  const ids = [settings.seo.shareImageId, settings.cvMediaId, site.theme.faviconMediaId].filter(Boolean) as string[];
  const docs = ids.length
    ? await adminDb().getAll(...ids.map((id) => adminDb().collection("sites").doc(site.id).collection("media").doc(id)))
    : [];
  const media = new Map(docs.filter((d) => d.exists).map((d) => [d.id, d.data() as MediaDoc]));
  const pic = (id: string | null) => {
    const m = id ? media.get(id) : undefined;
    const src = m ? imageSources(m, 800)?.src : undefined;
    return id && src ? { id, src } : null;
  };
  const cv = settings.cvMediaId ? media.get(settings.cvMediaId) : undefined;

  // Our copy of the email follows a confirmed change made through the link we sent.
  const authUser = session.isAnonymous ? null : await adminAuth().getUser(session.uid).catch(() => null);
  const email = authUser?.email ?? user.email ?? "";

  const currency = currencyForCountry((await headers()).get("cf-ipcountry"));
  const [prices, ownDomain, orders] = await Promise.all([
    priceList(currency),
    getDomain(site.id),
    session.isAnonymous ? Promise.resolve([]) : listOrders({ uid: session.uid, limit: 20 }),
  ]);
  const money = (n: number) =>
    currency === "EGP"
      ? t("plan.egp", { n: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(n) })
      : `$${n}`;

  const data: SettingsData = {
    username: site.username,
    domain: DISPLAY_DOMAIN,
    siteUrl,
    pro: pro.plan === "pro",
    canPassword: limits.passwordProtection,
    settings,
    language: site.language,
    favicon: pic(site.theme.faviconMediaId),
    shareImage: pic(settings.seo.shareImageId),
    cv: cv && settings.cvMediaId ? { id: settings.cvMediaId, name: cv.fileName ?? "CV.pdf" } : null,
    defaults: { title: site.title, description: site.tagline },
    email,
    emailChanged: !!authUser?.email && authUser.email !== user.email,
    anonymous: session.isAnonymous,
    deletionAt: user.deletion?.at?.toMillis() ?? null,
    plans: prices.map((d) => ({
      months: d.months,
      price: money(d.amount),
      perMonth: money(d.perMonth),
      label: d.label,
    })),
    canDomain: limits.customDomain,
    ownDomain,
    billing: {
      proUntil: pro.proUntil,
      inGrace: pro.inGrace,
      gift: pro.plan === "pro" && pro.proUntil === null,
      canBuy: checkoutProvider() !== null && !session.isAnonymous,
      orders: orders
        .filter((o) => o.status !== "pending")
        .map((o) => ({
          id: o.id,
          date: o.paidAt ?? o.createdAt,
          months: o.months,
          amount:
            o.provider === "gift"
              ? "–"
              : o.currency === "EGP"
                ? t("plan.egp", { n: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(o.amount) })
                : `$${o.amount}`,
          status: o.status,
          gift: o.provider === "gift",
        })),
    },
  };

  return (
    <>
      <div>
        <h1 className="font-heading font-heading-weight text-[34px] leading-[1.1] tracking-[-0.02em]">{t("title")}</h1>
        <p className="text-muted mt-1">{t("sub")}</p>
      </div>
      <SettingsForm data={data} />
    </>
  );
}
