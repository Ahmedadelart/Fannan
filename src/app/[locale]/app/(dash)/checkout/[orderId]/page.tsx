import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { checkoutProvider, getOrder } from "@/lib/server/billing";
import { loadDashboard } from "../../load";
import { PracticeButtons } from "./PracticeButtons";

// The practice checkout: stands in for Paymob on local and staging so the whole Pro flow can be
// tried without real money. Never available in production.

export async function generateMetadata({ params }: PageProps<"/[locale]/app/checkout/[orderId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function PracticeCheckout({ params }: PageProps<"/[locale]/app/checkout/[orderId]">) {
  const { locale, orderId } = (await params) as { locale: Locale; orderId: string };
  setRequestLocale(locale);
  const t = await getTranslations("checkout");
  const tu = await getTranslations("upgrade");
  const format = await getFormatter();
  const { session } = await loadDashboard();
  const order = await getOrder(orderId);
  if (checkoutProvider() !== "practice" || !order || order.uid !== session.uid || order.provider !== "practice") notFound();

  const money = (n: number, c: string) => (c === "EGP" ? tu("egp", { n: format.number(n) }) : `$${format.number(n)}`);

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
      <div className="bg-ink rounded-lg p-4 text-[14px] text-white">
        <span className="font-semibold">{tu("practiceTitle")}</span> {tu("practiceText")}
      </div>
      <section className="border-line bg-paper flex flex-col gap-4 rounded-lg border p-6">
        <h1 className="font-heading font-heading-weight text-[28px] leading-tight">{t("title")}</h1>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-[14px]">
          <dt className="text-muted">{t("item")}</dt>
          <dd className="font-semibold">{tu("pro", { months: order.months })}</dd>
          <dt className="text-muted">{t("price")}</dt>
          <dd className="font-semibold" data-testid="checkout-price">
            {money(order.amount, order.currency)}
          </dd>
          {order.chargeCurrency !== order.currency && (
            <>
              <dt className="text-muted">{t("charged")}</dt>
              <dd className="font-semibold">{money(Math.round(order.chargeCents / 100), order.chargeCurrency)}</dd>
            </>
          )}
        </dl>
        {order.status === "pending" ? (
          <PracticeButtons orderId={order.id} />
        ) : (
          <a href={`/billing/return?order=${order.id}`} className="text-[14px] font-semibold underline">
            {t("done")}
          </a>
        )}
      </section>
    </div>
  );
}
