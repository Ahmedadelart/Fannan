import { NextResponse, type NextRequest } from "next/server";
import { fulfilOrder, verifyPaymobHmac } from "@/lib/server/billing";

// Paymob's "transaction processed" callback (server to server). Signed with HMAC-SHA512; anything
// unsigned or tampered with is ignored. Paymob retries, and fulfilOrder() only acts once per order.

export async function POST(req: NextRequest) {
  const hmac = req.nextUrl.searchParams.get("hmac") ?? "";
  const body = (await req.json().catch(() => null)) as { type?: string; obj?: Record<string, unknown> } | null;
  const obj = body?.obj;
  if (!obj || !verifyPaymobHmac(obj, hmac)) {
    return NextResponse.json({ error: "bad-signature" }, { status: 401 });
  }
  if (body?.type !== "TRANSACTION" || obj.is_refunded === true || obj.is_voided === true) {
    return NextResponse.json({ ok: true });
  }
  const order = obj.order as { merchant_order_id?: string } | undefined;
  const orderId = order?.merchant_order_id;
  if (!orderId) return NextResponse.json({ ok: true });
  // A pending transaction (e.g. Fawry, paid later at a kiosk) calls back again when it completes.
  if (obj.pending === true) return NextResponse.json({ ok: true });
  await fulfilOrder(orderId, {
    success: obj.success === true,
    transactionId: String(obj.id ?? ""),
    chargeCents: Number(obj.amount_cents),
    chargeCurrency: String(obj.currency ?? ""),
  });
  return NextResponse.json({ ok: true });
}
