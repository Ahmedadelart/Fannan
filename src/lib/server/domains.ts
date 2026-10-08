import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { firebaseEnv } from "@/config/firebase";
import { limitsFor } from "@/config/plans";
import { adminDb } from "@/lib/firebase/admin";
import { userPlan, type UserDoc } from "./data";
import { ProjectError, type Owner } from "./projects";
import { forgetLiveSite } from "./public";
import { sharedMap } from "./shared-memory";
import { purgeSiteCache } from "./site";

// Artists' own domains (Pro), through Cloudflare for SaaS: the artist points a CNAME at
// sites.fannan.net, Cloudflare checks it and issues the certificate, and our Worker sends the
// traffic to the app like any other artist site. One domain per site: domains/{hostname}.

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";
export const DNS_TARGET = process.env.CUSTOM_DOMAIN_TARGET ?? `sites.${ROOT_DOMAIN === "fannan.localhost" ? "fannan.net" : ROOT_DOMAIN}`;
const TTL = 60_000;

export type DomainStatus = "pending" | "issuing" | "active" | "failed";

export interface DomainInfo {
  hostname: string;
  /** The domain as bought ("ranakorany.com"); the DNS settings live there. */
  apex: string;
  /** The bare domain should forward to www (it can't point at us itself). */
  forwardApex: boolean;
  status: DomainStatus;
  /** `host` is what to type in the domain company's Name/Host box (they add the domain themselves). */
  records: Array<{ type: string; name: string; host: string; value: string }>;
  error: string | null;
}

type StoredRecord = { type: string; name: string; value: string };

// Country domains sold under a second level, e.g. name.com.eg, name.co.uk.
const SECOND_LEVEL = new Set(
  "com.eg net.eg org.eg edu.eg sci.eg co.uk org.uk com.sa net.sa com.ae co.ae com.kw com.qa com.bh com.om com.jo com.lb com.tn com.dz co.ma com.ma com.au co.za com.br co.jp com.tr co.nz co.in com.mx".split(" "),
);

/** "www.studio.nour.com.eg" → "nour.com.eg" */
export function apexOf(host: string): string {
  const labels = host.split(".");
  const n = SECOND_LEVEL.has(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.slice(-n).join(".");
}

function info(hostname: string, d: Pick<DomainDoc, "status" | "records" | "error">): DomainInfo {
  const apex = apexOf(hostname);
  const relative = (name: string) => (name === apex ? "@" : name.endsWith(`.${apex}`) ? name.slice(0, -apex.length - 1) : name);
  return {
    hostname,
    apex,
    forwardApex: hostname === `www.${apex}`,
    status: d.status,
    records: d.records.map((r) => ({ ...r, host: relative(r.name) })),
    // While waiting, Cloudflare's messages ("does not CNAME to this zone") only mean "not yet".
    error: d.status === "failed" ? d.error : null,
  };
}

interface DomainDoc {
  siteId: string;
  uid: string;
  username: string;
  cfId: string | null;
  status: DomainStatus;
  records: StoredRecord[];
  error: string | null;
}

const domains = () => adminDb().collection("domains");

/* ---------- Cloudflare ---------- */

function cloudflare() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  return token && zone ? { token, zone } : null;
}

async function cf<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = cloudflare()!;
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${c.zone}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as { success: boolean; result: T; errors: Array<{ code: number; message: string }> };
  if (!body.success) {
    const e = body.errors?.[0];
    // 1406: the hostname is already set up on Cloudflare (e.g. by another platform).
    throw new ProjectError(e?.code === 1406 ? "domain-taken" : "domain-error");
  }
  return body.result;
}

interface CfHostname {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status?: string; validation_records?: Array<{ txt_name?: string; txt_value?: string }>; validation_errors?: Array<{ message: string }> };
  ownership_verification?: { type?: string; name?: string; value?: string };
  verification_errors?: string[];
}

function fromCloudflare(h: CfHostname): Pick<DomainDoc, "status" | "records" | "error"> {
  const records: StoredRecord[] = [{ type: "CNAME", name: h.hostname, value: DNS_TARGET }];
  if (h.ownership_verification?.name && h.status !== "active") {
    records.push({ type: "TXT", name: h.ownership_verification.name, value: h.ownership_verification.value ?? "" });
  }
  for (const r of h.ssl?.validation_records ?? []) {
    if (r.txt_name && h.ssl?.status !== "active") records.push({ type: "TXT", name: r.txt_name, value: r.txt_value ?? "" });
  }
  const sslOk = h.ssl?.status === "active";
  const status: DomainStatus =
    h.status === "active" && sslOk ? "active" : h.status === "active" ? "issuing" : /blocked|moved|deleted/.test(h.status) ? "failed" : "pending";
  const error = h.verification_errors?.[0] ?? h.ssl?.validation_errors?.[0]?.message ?? null;
  return { status, records, error };
}

/* ---------- names ---------- */

/** "https://www.Nour.com/work" → "www.nour.com". Null when it isn't a domain we can connect. */
export function normalizeDomain(input: string): string | null {
  let host = String(input ?? "").trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (host.length > 253 || !host.includes(".")) return null;
  if (!host.split(".").every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
  if (host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`) || host.endsWith("fannan.net")) return null;
  // Local test domains only work against the emulators.
  if (host.endsWith(".localhost") && firebaseEnv() !== "emulator") return null;
  if (/^\d+(\.\d+){3}$/.test(host)) return null;
  return host;
}

/* ---------- the artist's side ---------- */

export async function getDomain(siteId: string): Promise<DomainInfo | null> {
  const site = (await adminDb().collection("sites").doc(siteId).get()).data();
  const host = site?.customDomain as string | undefined;
  if (!host) return null;
  const d = (await domains().doc(host).get()).data() as DomainDoc | undefined;
  return d ? info(host, d) : null;
}

export async function connectDomain(o: Owner, input: string): Promise<DomainInfo> {
  if (!limitsFor(o.plan).customDomain) throw new ProjectError("pro-only");
  let host = normalizeDomain(input);
  if (!host) throw new ProjectError("domain-invalid");
  // A bare domain (name.com) can't point at us with a CNAME at most domain companies:
  // connect www.name.com and forward the bare domain to it.
  if (host === apexOf(host)) host = `www.${host}`;
  const existing = (await domains().doc(host).get()).data() as DomainDoc | undefined;
  if (existing && existing.siteId !== o.siteId) throw new ProjectError("domain-taken");
  const current = (await adminDb().collection("sites").doc(o.siteId).get()).data()?.customDomain as string | undefined;
  if (current && current !== host) await removeDomain(o);
  if (existing) return (await refreshDomain(o))!;

  let doc: DomainDoc;
  if (cloudflare()) {
    const h = await cf<CfHostname>("/custom_hostnames", {
      method: "POST",
      body: JSON.stringify({ hostname: host, ssl: { method: "http", type: "dv" } }),
    });
    doc = { siteId: o.siteId, uid: o.uid, username: o.site.username, cfId: h.id, ...fromCloudflare(h) };
  } else {
    // Local and tests: no Cloudflare. The domain turns active on the first status check.
    doc = {
      siteId: o.siteId,
      uid: o.uid,
      username: o.site.username,
      cfId: null,
      status: "pending",
      records: [{ type: "CNAME", name: host, value: DNS_TARGET }],
      error: null,
    };
  }
  await domains().doc(host).set({ ...doc, createdAt: FieldValue.serverTimestamp() });
  await adminDb().collection("sites").doc(o.siteId).update({ customDomain: host });
  return info(host, doc);
}

/** Asks Cloudflare how the domain is doing (the settings page calls this every few seconds). */
export async function refreshDomain(o: Owner): Promise<DomainInfo | null> {
  const site = (await adminDb().collection("sites").doc(o.siteId).get()).data();
  const host = site?.customDomain as string | undefined;
  if (!host) return null;
  const ref = domains().doc(host);
  const d = (await ref.get()).data() as DomainDoc | undefined;
  if (!d) return null;
  let next: Pick<DomainDoc, "status" | "records" | "error">;
  if (d.cfId && cloudflare()) next = fromCloudflare(await cf<CfHostname>(`/custom_hostnames/${d.cfId}`));
  // Without Cloudflare only the local test setup pretends the DNS check passed.
  else if (firebaseEnv() === "emulator") next = { status: "active", records: d.records, error: null };
  else next = { status: "failed", records: d.records, error: "Own domains only work on fannan.net (not on staging)." };
  if (next.status !== d.status || next.error !== d.error) {
    await ref.update(next);
    forgetDomain(host, o.site.username);
    if (next.status === "active") await purgeSiteCache(o.site.username);
  }
  return info(host, next);
}

export async function removeDomain(o: Owner) {
  const site = (await adminDb().collection("sites").doc(o.siteId).get()).data();
  const host = site?.customDomain as string | undefined;
  if (!host) return;
  const d = (await domains().doc(host).get()).data() as DomainDoc | undefined;
  if (d?.cfId && cloudflare()) {
    await cf(`/custom_hostnames/${d.cfId}`, { method: "DELETE" }).catch((e) => console.error("remove hostname", e));
  }
  await domains().doc(host).delete();
  await adminDb().collection("sites").doc(o.siteId).update({ customDomain: null });
  forgetDomain(host, o.site.username);
  forgetLiveSite(o.site.username);
  await purgeSiteCache(o.site.username);
}

/* ---------- routing (used by the proxy on every request, so cached) ---------- */

const byHost = sharedMap<string, { at: number; value: { username: string; live: boolean } | null }>("domainByHost");
const byUser = sharedMap<string, { at: number; value: string | null }>("domainByUser");

function forgetDomain(host: string, username: string) {
  byHost.delete(host);
  byUser.delete(username);
}

/** After a plan change: whether this artist's own domain may be served changes too. */
export function forgetDomainsFor(username: string) {
  byUser.delete(username);
  for (const [host, v] of byHost) if (v.value?.username === username) byHost.delete(host);
}

async function ownerIsPro(uid: string) {
  const user = (await adminDb().collection("users").doc(uid).get()).data() as UserDoc | undefined;
  return userPlan(user).plan === "pro";
}

/** A request for someone's own domain: which artist, and whether it may be served (active, on Pro). */
export async function siteForHost(host: string): Promise<{ username: string; live: boolean } | null> {
  const hit = byHost.get(host);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value: { username: string; live: boolean } | null = null;
  try {
    const d = (await domains().doc(host).get()).data() as DomainDoc | undefined;
    if (d) value = { username: d.username, live: d.status === "active" && (await ownerIsPro(d.uid)) };
  } catch {
    /* treat as unknown */
  }
  byHost.set(host, { at: Date.now(), value });
  if (byHost.size > 5000) byHost.delete(byHost.keys().next().value!);
  return value;
}

/** The artist's own domain when it's active and they're on Pro: their fannan.net address forwards there. */
export async function liveDomainFor(username: string): Promise<string | null> {
  const hit = byUser.get(username);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value: string | null = null;
  try {
    const name = (await adminDb().collection("usernames").doc(username).get()).data() as { siteId?: string } | undefined;
    const site = name?.siteId ? (await adminDb().collection("sites").doc(name.siteId).get()).data() : undefined;
    const host = site?.customDomain as string | undefined;
    if (host) {
      const d = (await domains().doc(host).get()).data() as DomainDoc | undefined;
      if (d?.status === "active" && (await ownerIsPro(d.uid))) value = host;
    }
  } catch {
    /* no redirect */
  }
  byUser.set(username, { at: Date.now(), value });
  if (byUser.size > 5000) byUser.delete(byUser.keys().next().value!);
  return value;
}
