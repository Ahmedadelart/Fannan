"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getUser } from "@/lib/server/data";
import { sendEmail, escapeHtml } from "@/lib/server/email";
import { ownerOf, ProjectError } from "@/lib/server/projects";
import { rateLimit } from "@/lib/server/rate-limit";
import { requireSession } from "@/lib/server/session";
import {
  cancelDeletion,
  changeUsername,
  deleteMessage,
  markMessage,
  requestDeletion,
  saveSettings,
  saveSiteBasics,
  setSitePassword,
  type SiteSettings,
} from "@/lib/server/settings";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** A friendly, expected refusal ("taken", "invalid"...), shown to the artist as-is. */
class Refused extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function attempt<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof ProjectError || e instanceof Refused) return { ok: false, error: e.code };
    console.error(e);
    return { ok: false, error: "error" };
  }
}

async function owner() {
  const { uid } = await requireSession();
  return ownerOf(uid);
}

/* ---------- site settings (live straight away) ---------- */

export async function saveSiteSettings(patch: Partial<SiteSettings>) {
  return attempt(async () => {
    await saveSettings(await owner(), patch);
    return {};
  });
}

export async function saveBasics(patch: { language?: string; faviconMediaId?: string | null }) {
  return attempt(async () => {
    await saveSiteBasics(await owner(), patch);
    return {};
  });
}

export async function saveSitePassword(password: string) {
  return attempt(async () => {
    await setSitePassword(await owner(), String(password ?? ""));
    return {};
  });
}

export async function renameSite(name: string) {
  const { uid } = await requireSession();
  if (!rateLimit(`rename:${uid}`, 10, 60 * 60_000)) return { ok: false as const, error: "slow-down" };
  return attempt(async () => {
    const r = await changeUsername(await ownerOf(uid), String(name ?? ""));
    if (!r.ok) throw new Refused(r.reason);
    return { username: r.username! };
  });
}

/* ---------- messages ---------- */

export async function setMessageRead(id: string, read: boolean) {
  return attempt(async () => {
    await markMessage(await owner(), String(id), !!read);
    return {};
  });
}

export async function removeMessage(id: string) {
  return attempt(async () => {
    await deleteMessage(await owner(), String(id));
    return {};
  });
}

/* ---------- account ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Sends a confirmation link to the new address; the email only changes once it's clicked. */
export async function changeEmail(next: string) {
  const session = await requireSession();
  if (session.isAnonymous) return { ok: false as const, error: "anonymous" };
  if (!rateLimit(`email-change:${session.uid}`, 5, 60 * 60_000)) return { ok: false as const, error: "slow-down" };
  const email = String(next ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  if (!EMAIL_RE.test(email)) return { ok: false as const, error: "invalid" };
  return attempt(async () => {
    const auth = adminAuth();
    const me = await auth.getUser(session.uid);
    if (!me.email) throw new ProjectError("not-found");
    if (me.email === email) return {};
    const taken = await auth.getUserByEmail(email).catch(() => null);
    if (taken) throw new Refused("taken");
    const link = await auth.generateVerifyAndChangeEmailLink(me.email, email);
    const user = await getUser(session.uid);
    const ar = user?.locale === "ar";
    await sendEmail({
      to: email,
      subject: ar ? "أكّد بريدك الجديد على فنان" : "Confirm your new email for Fannan",
      text: ar
        ? `اضغط هذا الرابط لتغيير بريدك على فنان إلى ${email}:\n\n${link}\n\nإن لم تطلب ذلك فتجاهل هذه الرسالة.`
        : `Click this link to change your Fannan email to ${email}:\n\n${link}\n\nIf you didn't ask for this, ignore this email.`,
      html: ar
        ? `<p dir="rtl">اضغط الرابط لتغيير بريدك على فنان إلى <b>${escapeHtml(email)}</b>:</p><p dir="rtl"><a href="${escapeHtml(link)}">تأكيد البريد الجديد</a></p><p dir="rtl" style="color:#6A6A70">إن لم تطلب ذلك فتجاهل هذه الرسالة.</p>`
        : `<p>Click the link to change your Fannan email to <b>${escapeHtml(email)}</b>:</p><p><a href="${escapeHtml(link)}">Confirm new email</a></p><p style="color:#6A6A70">If you didn't ask for this, ignore this email.</p>`,
    });
    return {};
  });
}

export async function deleteAccount(confirmName: string) {
  return attempt(async () => {
    const o = await owner();
    if (String(confirmName ?? "").trim().toLowerCase() !== o.site.username) throw new Refused("invalid");
    return { at: await requestDeletion(o) };
  });
}

export async function undoDeleteAccount() {
  return attempt(async () => {
    await cancelDeletion(await owner());
    return {};
  });
}

/** Keeps our copy of the sign-in email in step after a confirmed change. */
export async function syncEmail() {
  const { uid } = await requireSession();
  const me = await adminAuth().getUser(uid);
  if (me.email) await adminDb().collection("users").doc(uid).set({ email: me.email }, { merge: true });
}
