// Username rules (CLAUDE.md): lowercase a–z, 0–9 and hyphens, 3–30 characters,
// starts with a letter, not reserved, not starting with "fannan", no blocked words.
// Pure functions: safe on the server, in the proxy and in the browser.
import { blockedAnywhere, blockedWhole } from "./blocked-words.generated";
import { reservedUsernames } from "./reserved-usernames.generated";

export type UsernameProblem =
  "too-short" | "too-long" | "must-start-with-letter" | "bad-characters" | "hyphen-edges" | "reserved" | "blocked";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

function hasBlockedWord(name: string): boolean {
  const flat = name.replace(/-/g, "");
  if (blockedAnywhere.some((w) => flat.includes(w.replace(/-/g, "")))) return true;
  if (blockedWhole.has(name) || blockedWhole.has(flat)) return true;
  return name.split("-").some((part) => blockedWhole.has(part));
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
  if (hasBlockedWord(name)) return "blocked";
  return null;
}

/** Turns any text (a name, maybe in Arabic) into the start of a username. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[0-9-]+/, "")
    .slice(0, USERNAME_MAX)
    .replace(/-+$/, "");
}

/** Username ideas from the artist's name and discipline. Only rule-valid ones are returned. */
export function usernameIdeas(fullName: string, disciplineWord?: string): string[] {
  const parts = slugify(fullName).split("-").filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const word = slugify(disciplineWord ?? "").split("-")[0] ?? "";
  const ideas = [
    parts.join(""),
    parts.join("-"),
    first && last && first !== last ? `${first}${last[0]}` : "",
    first && word ? `${first}-${word}` : "",
    first ? `${first}draws` : "",
    first ? `${first}-studio` : "",
    first ? `${first}art` : "",
  ];
  return [...new Set(ideas)].filter((u) => u && checkUsername(u) === null);
}
