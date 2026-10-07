import "server-only";

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { firebaseEnv } from "@/config/firebase";

// Transactional email (Resend). Without a key — local development and tests — messages are
// written to .local-storage/outbox.log instead, so nothing is ever sent by accident.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

const FROM = process.env.EMAIL_FROM ?? "Fannan <hello@fannan.net>";

export async function sendEmail(mail: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (firebaseEnv() === "emulator") {
      const dir = join(process.cwd(), ".local-storage");
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, "outbox.log"), JSON.stringify({ at: new Date().toISOString(), ...mail }) + "\n");
    } else {
      console.warn("sendEmail: RESEND_API_KEY is not set; email not sent", mail.subject);
    }
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) console.error("sendEmail failed", res?.status, await res?.text().catch(() => ""));
  return !!res?.ok;
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
