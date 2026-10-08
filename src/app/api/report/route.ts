import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { escapeHtml, sendEmail } from "@/lib/server/email";
import { rateLimit } from "@/lib/server/rate-limit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { REPORT_REASONS, type ReportReason } from "@/config/reports";

// fannan.net's public forms: "Contact us" (to the support inbox), "Report this site" and copyright
// notices (to the admin queue, with a note to the support inbox). Honeypot, per-IP limit, Turnstile.

const SUPPORT = process.env.SUPPORT_EMAIL ?? "support@fannan.net";
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim()
        .slice(0, max)
    : "";

/** "https://nour.fannan.net/fever" → "nour" (artist sites only). */
function usernameFromUrl(url: string): string | null {
  try {
    const host = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.toLowerCase();
    if (!host.endsWith(`.${ROOT_DOMAIN}`) && !host.endsWith(".fannan.net")) return null;
    const label = host.split(".")[0];
    return /^[a-z][a-z0-9-]{1,29}$/.test(label) && label !== "app" && label !== "www" ? label : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "?";
  if (!rateLimit(`report:${ip}`, 5, 10 * 60_000)) return NextResponse.json({ error: "slow-down" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });
  if (!(await verifyTurnstile(clean(body.turnstile, 3000), ip))) {
    return NextResponse.json({ error: "check-failed" }, { status: 400 });
  }
  const kind = body.kind;
  const db = adminDb();

  if (kind === "contact") {
    const name = clean(body.name, 120);
    const email = clean(body.email, 200);
    const topic = clean(body.topic, 40);
    const message = clean(body.message, 5000);
    if (!name || !EMAIL_RE.test(email) || message.length < 2) return NextResponse.json({ error: "invalid" }, { status: 400 });
    await db.collection("support").add({ name, email, topic, message, createdAt: FieldValue.serverTimestamp() });
    await sendEmail({
      to: SUPPORT,
      replyTo: email,
      subject: `[Fannan · ${topic || "contact"}] ${name}`,
      text: `${name} <${email}>\n\n${message}`,
      html: `<p><b>${escapeHtml(name)}</b> &lt;${escapeHtml(email)}&gt;</p><p style="white-space:pre-line">${escapeHtml(message)}</p>`,
    });
    return NextResponse.json({ ok: true });
  }

  if (kind === "report" || kind === "copyright") {
    const url = clean(body.url, 500);
    const username = clean(body.site, 40).toLowerCase() || usernameFromUrl(url);
    const email = clean(body.email, 200);
    const details = clean(body.details, 5000);
    const doc: Record<string, unknown> = {
      kind,
      username: username && /^[a-z][a-z0-9-]{1,29}$/.test(username) ? username : null,
      url,
      email: EMAIL_RE.test(email) ? email : "",
      details,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
    };
    if (kind === "report") {
      const reason = clean(body.reason, 40);
      if (!REPORT_REASONS.includes(reason as ReportReason) || !doc.username) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
      }
      doc.reason = reason;
    } else {
      const name = clean(body.name, 120);
      const original = clean(body.original, 1000);
      const signature = clean(body.signature, 120);
      if (!name || !EMAIL_RE.test(email) || !url || !original || !signature || body.goodFaith !== true || body.accurate !== true) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
      }
      Object.assign(doc, { reason: "copyright", name, original, signature });
    }
    if (doc.username) {
      const name = (await db.collection("usernames").doc(String(doc.username)).get()).data();
      doc.siteId = name?.siteId ?? null;
    }
    const ref = await db.collection("reports").add(doc);
    await sendEmail({
      to: SUPPORT,
      subject: `[Fannan · ${kind === "copyright" ? "copyright notice" : `report: ${doc.reason}`}] ${doc.username ?? url}`,
      text: `${kind === "copyright" ? "Copyright notice" : `Report (${doc.reason})`} about ${doc.username ?? "?"}\n${url}\n\n${details}\n\nOpen the admin queue: https://app.${ROOT_DOMAIN}/admin?tab=reports (#${ref.id})`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad-request" }, { status: 400 });
}
