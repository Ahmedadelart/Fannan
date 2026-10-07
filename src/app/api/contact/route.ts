import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getUser } from "@/lib/server/data";
import { escapeHtml, sendEmail } from "@/lib/server/email";
import { artistFromRequest } from "@/lib/server/host";
import { liveSite } from "@/lib/server/public";
import { rateLimit } from "@/lib/server/rate-limit";
import { verifyTurnstile } from "@/lib/server/turnstile";

// The contact form on artist sites. Saves to the artist's Fannan inbox and emails them.
// Spam guards: a hidden honeypot field, per-IP and per-site limits, and Turnstile.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim()
        .slice(0, max)
    : "";

export async function POST(req: NextRequest) {
  const username = await artistFromRequest();
  const site = username ? await liveSite(username) : null;
  if (!site) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
  if (!rateLimit(`contact:${ip}`, 5, 10 * 60_000) || !rateLimit(`contact-site:${site.siteId}`, 60, 60 * 60_000)) {
    return NextResponse.json({ error: "slow-down" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  // Bots fill every field; people never see this one.
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const message = clean(body.message, 5000);
  if (!name || !EMAIL_RE.test(email) || message.length < 2) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!(await verifyTurnstile(clean(body.turnstile, 3000), ip))) {
    return NextResponse.json({ error: "check-failed" }, { status: 400 });
  }

  await adminDb()
    .collection("messages")
    .add({
      siteId: site.siteId,
      ownerUid: site.ownerUid,
      name,
      email,
      body: message,
      page: clean(body.page, 300),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

  const owner = await getUser(site.ownerUid);
  if (owner?.email) {
    const ar = site.language === "ar";
    await sendEmail({
      to: owner.email,
      replyTo: email,
      subject: ar ? `رسالة جديدة من ${name} عبر موقعك على فنان` : `New message from ${name} via your Fannan site`,
      text: `${name} <${email}>\n\n${message}\n\n— ${username}.fannan.net`,
      html: `<p><b>${escapeHtml(name)}</b> &lt;${escapeHtml(email)}&gt;</p><p style="white-space:pre-line">${escapeHtml(message)}</p><p style="color:#6A6A70">— ${escapeHtml(username!)}.fannan.net · ${ar ? "اضغط «رد» للرد مباشرة" : "Press Reply to answer them directly"}</p>`,
    });
  }
  return NextResponse.json({ ok: true });
}
