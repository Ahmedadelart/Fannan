import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { isAdminEmail } from "@/config/admins";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DAY_MS } from "@/lib/plan";
import { listOrders, type Order } from "./billing";
import { userPlan, type UserDoc } from "./data";
import { escapeHtml, sendEmail } from "./email";
import { forgetDomainsFor } from "./domains";
import { forgetLiveSite } from "./public";
import { getSession } from "./session";
import { purgeSiteCache } from "./site";

// Ahmed's admin page: users, payments and revenue, Pro gifts, refunds, suspending a site.

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.isAnonymous || !isAdminEmail(session.email)) throw new Error("not-admin");
  return session;
}

export async function isAdmin() {
  const session = await getSession();
  return !!session && !session.isAnonymous && isAdminEmail(session.email);
}

export interface AdminUser {
  uid: string;
  name: string;
  email: string;
  username: string;
  siteId: string | null;
  plan: "free" | "pro";
  proUntil: number | null;
  inGrace: boolean;
  suspended: boolean;
  featured: boolean;
  published: boolean;
  createdAt: number;
}

async function withSites(docs: Array<{ id: string; data: UserDoc }>): Promise<AdminUser[]> {
  const db = adminDb();
  const siteIds = docs.map((d) => d.data.siteId).filter(Boolean) as string[];
  const sites = siteIds.length ? await db.getAll(...siteIds.map((id) => db.collection("sites").doc(id))) : [];
  const byId = new Map(sites.map((s) => [s.id, s.data()]));
  return docs.map(({ id, data }) => {
    const site = data.siteId ? byId.get(data.siteId) : undefined;
    const p = userPlan(data);
    return {
      uid: id,
      name: data.displayName ?? "",
      email: data.email ?? "",
      username: (site?.username as string) ?? "",
      siteId: data.siteId ?? null,
      plan: p.plan,
      proUntil: p.proUntil,
      inGrace: p.inGrace,
      suspended: !!site?.suspended,
      featured: !!site?.featured,
      published: site?.publishedVersion != null,
      createdAt: data.createdAt?.toMillis() ?? 0,
    };
  });
}

/** Recent sign-ups, or the people matching an email or a username. */
export async function findUsers(q: string): Promise<AdminUser[]> {
  const db = adminDb();
  const term = q.trim().toLowerCase();
  if (!term) {
    const snap = await db.collection("users").where("isAnonymous", "==", false).orderBy("createdAt", "desc").limit(50).get();
    return withSites(snap.docs.map((d) => ({ id: d.id, data: d.data() as UserDoc })));
  }
  const found = new Map<string, UserDoc>();
  const byEmail = await db.collection("users").where("email", "==", term).limit(10).get();
  byEmail.docs.forEach((d) => found.set(d.id, d.data() as UserDoc));
  const name = (await db.collection("usernames").doc(term.replace(/\.fannan\.net$/, "")).get()).data() as
    | { uid?: string }
    | undefined;
  if (name?.uid && !found.has(name.uid)) {
    const u = await db.collection("users").doc(name.uid).get();
    if (u.exists) found.set(u.id, u.data() as UserDoc);
  }
  return withSites([...found].map(([id, data]) => ({ id, data })));
}

export interface Overview {
  users: number;
  pro: number;
  revenue: Record<"EGP" | "USD", { all: number; last30: number }>;
  orders: Order[];
}

export async function overview(): Promise<Overview> {
  const db = adminDb();
  const now = Date.now();
  const [users, pro, orders] = await Promise.all([
    db.collection("users").where("isAnonymous", "==", false).count().get(),
    db.collection("users").where("proUntil", ">", Timestamp.fromMillis(now)).count().get(),
    listOrders({ limit: 500 }),
  ]);
  const revenue = { EGP: { all: 0, last30: 0 }, USD: { all: 0, last30: 0 } };
  for (const o of orders) {
    if (o.status !== "paid" || o.provider === "gift") continue;
    revenue[o.currency].all += o.amount;
    if ((o.paidAt ?? 0) > now - 30 * DAY_MS) revenue[o.currency].last30 += o.amount;
  }
  return { users: users.data().count, pro: pro.data().count, revenue, orders: orders.slice(0, 100) };
}

/** PRICING.md: refunds within 14 days if the site wasn't published on a custom domain. */
export async function refundAdvice(o: Order): Promise<"ok" | "late" | "domain"> {
  if ((o.paidAt ?? 0) < Date.now() - 14 * DAY_MS) return "late";
  const user = (await adminDb().collection("users").doc(o.uid).get()).data() as UserDoc | undefined;
  const site = user?.siteId ? (await adminDb().collection("sites").doc(user.siteId).get()).data() : undefined;
  return site?.customDomain ? "domain" : "ok";
}

export async function setSuspended(uid: string, suspended: boolean) {
  const db = adminDb();
  const user = (await db.collection("users").doc(uid).get()).data() as UserDoc | undefined;
  if (!user?.siteId) throw new Error("not-found");
  const ref = db.collection("sites").doc(user.siteId);
  await ref.update(suspended ? { suspended: true, suspendedReason: "admin" } : { suspended: false, suspendedReason: null });
  const username = (await ref.get()).data()?.username as string | undefined;
  if (username) {
    forgetLiveSite(username);
    forgetDomainsFor(username);
    await purgeSiteCache(username);
  }
}

/* ---------- reports queue (CONTENT-POLICY.md) ---------- */

export interface Report {
  id: string;
  kind: "report" | "copyright";
  username: string | null;
  siteId: string | null;
  url: string;
  reason: string;
  details: string;
  email: string;
  name?: string;
  original?: string;
  status: "open" | "done";
  action?: string;
  actedAt?: number | null;
  createdAt: number;
}

export async function listReports(status: "open" | "done" = "open"): Promise<Report[]> {
  const snap = await adminDb().collection("reports").where("status", "==", status).orderBy("createdAt", "desc").limit(100).get();
  return snap.docs.map((d) => {
    const r = d.data();
    // Only plain values reach the admin page (handled reports also carry actedAt).
    return {
      id: d.id,
      ...r,
      createdAt: (r.createdAt as Timestamp | undefined)?.toMillis() ?? 0,
      actedAt: (r.actedAt as Timestamp | undefined)?.toMillis?.() ?? null,
    } as Report;
  });
}

export type ModerationAction = "dismiss" | "hide-project" | "unpublish" | "suspend" | "ban";

const REASON_TEXT: Record<string, { en: string; ar: string }> = {
  porn: { en: "pornography or sexual services", ar: "إباحية أو خدمات جنسية" },
  minors: { en: "sexual content involving minors", ar: "محتوى جنسي يتضمن قاصرين" },
  illegal: { en: "illegal content", ar: "محتوى مخالف للقانون" },
  hate: { en: "hate against a group of people", ar: "كراهية ضد مجموعة من الناس" },
  threats: { en: "threats, harassment or incitement to violence", ar: "تهديد أو تحرش أو تحريض على العنف" },
  private: { en: "someone's private information or intimate images", ar: "معلومات خاصة أو صور حميمة لشخص آخر" },
  stolen: { en: "someone else's work shown as your own", ar: "عرض عمل غيرك على أنه عملك" },
  impersonation: { en: "impersonation", ar: "انتحال شخصية" },
  spam: { en: "spam, scam or phishing", ar: "سبام أو نصب أو تصيّد" },
  copyright: { en: "a copyright notice from the owner of the work", ar: "إخطار حقوق نشر من صاحب العمل" },
  other: { en: "a breach of our content policy", ar: "مخالفة لسياسة المحتوى" },
};

/** Acts on a report and tells the artist why (every action except dismiss). */
export async function actOnReport(id: string, action: ModerationAction, note: string, by: string) {
  const db = adminDb();
  const ref = db.collection("reports").doc(id);
  const report = (await ref.get()).data() as Omit<Report, "id"> | undefined;
  if (!report) throw new Error("not-found");
  const site = report.siteId ? (await db.collection("sites").doc(report.siteId).get()).data() : undefined;
  const uid = site?.ownerUid as string | undefined;

  if (action !== "dismiss") {
    if (!report.siteId || !uid) throw new Error("not-found");
    const siteRef = db.collection("sites").doc(report.siteId);
    if (action === "hide-project") {
      const slug = (() => {
        try {
          return new URL(report.url).pathname.split("/").filter(Boolean).filter((s) => s !== "ar" && s !== "en")[0] ?? "";
        } catch {
          return "";
        }
      })();
      const project = slug
        ? (await siteRef.collection("projects").where("slug", "==", slug).limit(1).get()).docs[0]
        : undefined;
      if (!project) throw new Error("no-project");
      await siteRef.update({ "moderation.hiddenProjects": FieldValue.arrayUnion(project.id) });
      await project.ref.update({ visibility: "hidden" });
    }
    if (action === "unpublish") await siteRef.update({ publishedVersion: null });
    if (action === "suspend" || action === "ban") await setSuspended(uid, true);
    if (action === "ban") {
      await db.collection("users").doc(uid).set({ banned: true }, { merge: true });
      await adminAuth().updateUser(uid, { disabled: true }).catch(() => {});
    }
    if (site?.username) {
      forgetLiveSite(site.username);
      await purgeSiteCache(site.username);
    }
    const user = (await db.collection("users").doc(uid).get()).data() as UserDoc | undefined;
    if (user?.email) await sendEmail(moderationEmail(user, action, report.reason, note));
  }
  await ref.update({ status: "done", action, note: note.slice(0, 500), actedBy: by, actedAt: FieldValue.serverTimestamp() });
}

function moderationEmail(user: UserDoc, action: ModerationAction, reason: string, note: string) {
  const ar = user.locale === "ar";
  const why = (REASON_TEXT[reason] ?? REASON_TEXT.other)[ar ? "ar" : "en"];
  const what = {
    "hide-project": ar ? "أخفينا أحد مشاريعك" : "We've hidden one of your projects",
    unpublish: ar ? "ألغينا نشر موقعك" : "We've unpublished your site",
    suspend: ar ? "أوقفنا موقعك" : "We've suspended your site",
    ban: ar ? "أغلقنا حسابك" : "We've closed your account",
    dismiss: "",
  }[action];
  const lines = ar
    ? [
        `${what} على فنان بسبب: ${why}.`,
        ...(note ? [note] : []),
        action === "ban"
          ? "إن كنت ترى أن هذا خطأ فراسل support@fannan.net."
          : "إن كنت ترى أن هذا خطأ، أو بعد تصحيح المشكلة، راسل support@fannan.net وسنراجع الأمر.",
      ]
    : [
        `${what} on Fannan because of ${why}.`,
        ...(note ? [note] : []),
        action === "ban"
          ? "If you believe this is a mistake, write to support@fannan.net."
          : "If you believe this is a mistake, or once you've fixed the problem, write to support@fannan.net and we'll take another look.",
      ];
  return {
    to: user.email!,
    subject: ar ? "إشعار بخصوص موقعك على فنان" : "About your Fannan site",
    text: lines.join("\n\n"),
    html: lines.map((l) => `<p${ar ? ' dir="rtl"' : ""}>${escapeHtml(l)}</p>`).join(""),
  };
}

/** "Show on Examples" (the artist agreed to be featured on fannan.net/examples). */
export async function setFeatured(uid: string, featured: boolean) {
  const user = (await adminDb().collection("users").doc(uid).get()).data() as UserDoc | undefined;
  if (!user?.siteId) throw new Error("not-found");
  await adminDb().collection("sites").doc(user.siteId).update({ featured });
}
