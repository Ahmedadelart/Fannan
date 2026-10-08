import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { isAdminEmail } from "@/config/admins";
import { adminDb } from "@/lib/firebase/admin";
import { DAY_MS } from "@/lib/plan";
import { listOrders, type Order } from "./billing";
import { userPlan, type UserDoc } from "./data";
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
