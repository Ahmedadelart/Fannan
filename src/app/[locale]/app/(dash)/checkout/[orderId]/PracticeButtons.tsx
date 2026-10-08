"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { practicePay } from "../../upgrade/actions";

export function PracticeButtons({ orderId }: { orderId: string }) {
  const t = useTranslations("checkout");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async (success: boolean) => {
    setBusy(true);
    const r = await practicePay(orderId, success);
    if (!r.ok) {
      setBusy(false);
      return toast(t("error"));
    }
    window.location.href = `/billing/return?order=${orderId}`;
  };
  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" disabled={busy} onClick={() => go(true)}>
        {t("pay")}
      </Button>
      <Button size="lg" variant="outline" disabled={busy} onClick={() => go(false)}>
        {t("decline")}
      </Button>
    </div>
  );
}
