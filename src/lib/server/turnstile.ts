import "server-only";

// Cloudflare Turnstile: a quiet "are you human?" check on the contact form.
// Skipped when no secret is configured (local development and tests).

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? process.env.TURNSTILE_SITE_KEY ?? "";

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return false;
  return ((await res.json()) as { success?: boolean }).success === true;
}
