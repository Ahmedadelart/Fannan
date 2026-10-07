import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Locale } from "@/i18n/locales";

// The published language of an artist site, for the proxy (so <html lang/dir> is right).
const cache = new Map<string, { at: number; lang: Locale }>();
const TTL = 60_000;

export async function siteLanguage(username: string): Promise<Locale> {
  const hit = cache.get(username);
  if (hit && Date.now() - hit.at < TTL) return hit.lang;
  let lang: Locale = "en";
  try {
    const db = adminDb();
    const name = (await db.collection("usernames").doc(username).get()).data() as { siteId?: string } | undefined;
    if (name?.siteId) {
      const site = (await db.collection("sites").doc(name.siteId).get()).data() as
        { publishedLanguage?: string; language?: string } | undefined;
      lang = (site?.publishedLanguage ?? site?.language) === "ar" ? "ar" : "en";
    }
  } catch {
    /* fall back to English */
  }
  cache.set(username, { at: Date.now(), lang });
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return lang;
}
