// Deploys infra/edge-worker.js to Cloudflare and points fannan.net, *.fannan.net and artists' own domains at it.
// Usage: CLOUDFLARE_API_TOKEN=... node infra/deploy-edge.mjs <cloud-run-url>
import { readFileSync } from "node:fs";

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "19ac27bdffe430177f1bf4d4803b1168";
const ZONE = process.env.CLOUDFLARE_ZONE_ID ?? "ee75c783272f2a590bb5c44b0eccf85c";
const ORIGIN = process.argv[2];
const NAME = "fannan-edge";
if (!TOKEN || !ORIGIN) throw new Error("usage: CLOUDFLARE_API_TOKEN=... node infra/deploy-edge.mjs https://...run.app");

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
  });
  const body = await res.json();
  if (!body.success) throw new Error(`${path}: ${JSON.stringify(body.errors)}`);
  return body.result;
};
const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// 1. The script, with ORIGIN as a plain-text setting.
const form = new FormData();
form.append(
  "metadata",
  JSON.stringify({
    main_module: "worker.js",
    compatibility_date: "2026-09-01",
    bindings: [{ type: "plain_text", name: "ORIGIN", text: ORIGIN }],
  }),
);
form.append(
  "worker.js",
  new Blob([readFileSync(new URL("./edge-worker.js", import.meta.url))], { type: "application/javascript+module" }),
  "worker.js",
);
await api(`/accounts/${ACCOUNT}/workers/scripts/${NAME}`, { method: "PUT", body: form });
console.log("worker uploaded");

// 2. DNS: proxied placeholder records so traffic reaches Cloudflare (the Worker answers, not this address).
for (const name of ["fannan.net", "*.fannan.net"]) {
  const existing = await api(`/zones/${ZONE}/dns_records?type=A&name=${encodeURIComponent(name)}`);
  const record = {
    type: "A",
    name,
    content: "192.0.2.1",
    proxied: true,
    ttl: 1,
    comment: "Served by the fannan-edge Worker",
  };
  if (existing.length) await api(`/zones/${ZONE}/dns_records/${existing[0].id}`, json("PUT", record));
  else await api(`/zones/${ZONE}/dns_records`, json("POST", record));
  console.log("dns", name);
}

// 3. Routes.
const routes = await api(`/zones/${ZONE}/workers/routes`);
for (const pattern of ["fannan.net/*", "*.fannan.net/*"]) {
  if (!routes.some((r) => r.pattern === pattern))
    await api(`/zones/${ZONE}/workers/routes`, json("POST", { pattern, script: NAME }));
  console.log("route", pattern);
}

// 4. Artists' own domains (Cloudflare for SaaS): they point a CNAME at sites.fannan.net, the fallback
//    origin; the */* route sends their traffic through the same Worker (more specific routes win).
{
  const name = "sites.fannan.net";
  const existing = await api(`/zones/${ZONE}/dns_records?type=A&name=${name}`);
  const record = { type: "A", name, content: "192.0.2.1", proxied: true, ttl: 1, comment: "Fallback origin for artists' domains" };
  if (existing.length) await api(`/zones/${ZONE}/dns_records/${existing[0].id}`, json("PUT", record));
  else await api(`/zones/${ZONE}/dns_records`, json("POST", record));
  await api(`/zones/${ZONE}/custom_hostnames/fallback_origin`, json("PUT", { origin: name }));
  const all = await api(`/zones/${ZONE}/workers/routes`);
  if (!all.some((r) => r.pattern === "*/*")) await api(`/zones/${ZONE}/workers/routes`, json("POST", { pattern: "*/*", script: NAME }));
  console.log("custom domains: fallback origin", name, "+ route */*");
}

// 5. HTTPS everywhere.
await api(`/zones/${ZONE}/settings/always_use_https`, json("PATCH", { value: "on" }));
await api(`/zones/${ZONE}/settings/min_tls_version`, json("PATCH", { value: "1.2" }));
console.log("https on");
