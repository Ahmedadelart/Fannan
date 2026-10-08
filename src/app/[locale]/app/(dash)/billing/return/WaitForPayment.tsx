"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Paymob's confirmation can arrive a few seconds after the artist is sent back: check again. */
export function WaitForPayment() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      if (++n > 40) return clearInterval(timer);
      router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return <span aria-hidden className="border-line border-t-ink size-6 animate-spin rounded-full border-2" />;
}
