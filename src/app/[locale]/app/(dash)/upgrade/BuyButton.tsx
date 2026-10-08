"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { buyPro } from "./actions";

export function BuyButton({
  months,
  label,
  primary,
  disabled,
}: {
  months: number;
  label: string;
  primary: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("upgrade");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={primary ? "primary" : "outline"}
      className="w-full"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        const r = await buyPro(months);
        if (!r.ok) {
          setBusy(false);
          return toast(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : t("errors.error"));
        }
        // Paymob's checkout or the practice one; a server-side redirect wouldn't survive the host routing.
        window.location.href = r.url;
      }}
    >
      {busy ? t("opening") : label}
    </Button>
  );
}
