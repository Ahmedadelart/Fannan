import "server-only";

import { sharedMap } from "./shared-memory";

// Simple per-instance limiter: N requests per window per key (usually IP + action).
// Good enough to stop scripts hammering one server; Cloudflare rate rules add a
// shared layer in front once the domain is live (phase 4).

const buckets = sharedMap<string, { count: number; resetAt: number }>("rateLimit");

// Automated tests sign up many accounts a minute from one machine.
const OFF = process.env.RATE_LIMITS === "off";

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  if (OFF) return true;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
