// Username rules (CLAUDE.md): lowercase a–z, 0–9 and hyphens, 3–30 characters,
// starts with a letter, not reserved, not starting with "fannan".
// The offensive-words check is added in phase 1.
import { reservedUsernames } from "./reserved-usernames.generated";

export type UsernameProblem =
  "too-short" | "too-long" | "must-start-with-letter" | "bad-characters" | "hyphen-edges" | "reserved";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Returns null when the username is allowed, otherwise the first problem found. */
export function checkUsername(input: string): UsernameProblem | null {
  const name = normalizeUsername(input);
  if (name.length < USERNAME_MIN) return "too-short";
  if (name.length > USERNAME_MAX) return "too-long";
  if (!/^[a-z]/.test(name)) return "must-start-with-letter";
  if (!/^[a-z0-9-]+$/.test(name)) return "bad-characters";
  if (name.endsWith("-") || name.includes("--")) return "hyphen-edges";
  if (reservedUsernames.has(name) || name.startsWith("fannan")) return "reserved";
  return null;
}
