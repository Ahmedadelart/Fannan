import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/i18n/locales";
import { getOrder } from "@/lib/server/billing";
import { loadDashboard } from "../../load";
import { WaitForPayment } from "./WaitForPayment";

// Where Paymob (or the practice checkout) sends the artist back. The order's status comes from
// our own records, which only Paymob's signed callback can change; the address bar is never trusted.

export async function generateMetadata({ params }: PageProps<"/[locale]/app/billing/return">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function BillingReturn({ params, searchParams }: PageProps<"/[locale]/app/billing/return">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("checkout");
  const format = await getFormatter();
  const { session } = await loadDashboard();
  const id = String((await searchParams).order ?? "");
  const order = id ? await getOrder(id) : null;
  if (!order || order.uid !== session.uid) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
      <section
        className="border-line bg-paper flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
        data-testid="payment-result"
        data-status={order.status}
      >
        {order.status === "paid" && (
          <>
            <span className="bg-lime flex rounded-[14px] p-3">
              <Icon name="check" size={40} />
            </span>
            <h1 className="font-heading font-heading-weight text-[28px] leading-tight">{t("paidTitle")}</h1>
            <p className="text-ink-soft">
              {t("paidText", { date: format.dateTime(new Date(order.proUntilAfter!), { dateStyle: "long" }) })}
            </p>
            <a href="/" className={buttonClasses("primary", "md")}>
              {t("toDashboard")}
            </a>
          </>
        )}
        {order.status === "failed" && (
          <>
            <h1 className="font-heading font-heading-weight text-[28px] leading-tight">{t("failedTitle")}</h1>
            <p className="text-ink-soft">{t("failedText")}</p>
            <a href={`/upgrade?months=${order.months}`} className={buttonClasses("primary", "md")}>
              {t("tryAgain")}
            </a>
          </>
        )}
        {order.status === "pending" && (
          <>
            <h1 className="font-heading font-heading-weight text-[28px] leading-tight">{t("pendingTitle")}</h1>
            <p className="text-ink-soft">{t("pendingText")}</p>
            <WaitForPayment />
          </>
        )}
        {order.status === "refunded" && (
          <h1 className="font-heading font-heading-weight text-[28px] leading-tight">{t("refundedTitle")}</h1>
        )}
      </section>
    </div>
  );
}
