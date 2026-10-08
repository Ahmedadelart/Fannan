// Who can open app.fannan.net/admin. Signed-in email must match (Google or magic link, so it's verified).
// ADMIN_EMAILS (comma-separated) adds more, e.g. a test account in automated tests.
const OWNERS = ["adel4art@gmail.com", "fannan.team@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const extra = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const e = email.trim().toLowerCase();
  // "*@example.test" entries (tests only) match a whole email domain.
  return [...OWNERS, ...extra].some((a) => (a.startsWith("*@") ? e.endsWith(a.slice(1)) : a === e));
}
