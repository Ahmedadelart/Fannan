import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Passwords for protected projects and pages. Only the hash is stored.
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function scryptHash(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function checkPassword(stored: string | null, pw: string): Promise<boolean> {
  if (!stored) return false;
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const got = await scrypt(pw, Buffer.from(salt, "base64"), 32);
  const want = Buffer.from(hash, "base64");
  return want.length === got.length && timingSafeEqual(want, got);
}
