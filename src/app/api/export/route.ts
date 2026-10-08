import { NextResponse } from "next/server";
import { PassThrough, Readable } from "node:stream";
import archiver from "archiver";
import { adminDb } from "@/lib/firebase/admin";
import { getUser } from "@/lib/server/data";
import { rateLimit } from "@/lib/server/rate-limit";
import { getSession } from "@/lib/server/session";
import { listMessages } from "@/lib/server/settings";
import { readStream } from "@/lib/server/storage";

// "Export my site": a zip with every original file plus the site's words and settings as JSON.
// Streams straight from storage, so large portfolios don't sit in memory.

export const maxDuration = 300;

const safe = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, "-")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100) || "file";

/** Drops secrets and internal bookkeeping before anything leaves our servers. */
function clean<T extends Record<string, unknown>>(doc: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (/^(passwordHash|pending|v$)/.test(k)) continue;
    out[k] = v && typeof v === "object" && "toDate" in v ? (v as { toDate(): Date }).toDate().toISOString() : v;
  }
  return out;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "sign-in" }, { status: 401 });
  if (!rateLimit(`export:${session.uid}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "slow-down" }, { status: 429 });
  }
  const user = await getUser(session.uid);
  if (!user?.siteId) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const ref = adminDb().collection("sites").doc(user.siteId);
  const [site, pages, projects, media, messages] = await Promise.all([
    ref.get(),
    ref.collection("pages").orderBy("order").get(),
    ref.collection("projects").get(),
    ref.collection("media").get(),
    listMessages(user.siteId, 5000),
  ]);
  const siteData = site.data() ?? {};
  const username = String(siteData.username ?? "site");
  const folderFor = new Map(projects.docs.map((p) => [p.id, safe(String(p.data().slug || p.data().title || p.id))]));

  const zip = archiver("zip", { zlib: { level: 6 } });
  const out = new PassThrough();
  zip.on("error", (e) => out.destroy(e));
  zip.pipe(out);

  const json = {
    exportedAt: new Date().toISOString(),
    site: clean(siteData),
    pages: pages.docs.map((d) => ({ id: d.id, ...clean(d.data()) })),
    projects: projects.docs.map((d) => ({ id: d.id, ...clean(d.data()) })),
    media: media.docs.map((d) => ({ id: d.id, ...clean(d.data()) })),
  };
  zip.append(JSON.stringify(json, null, 2), { name: "site.json" });
  zip.append(JSON.stringify(messages, null, 2), { name: "messages.json" });
  zip.append(
    "Your Fannan export\n\n" +
      "originals/  every file you uploaded, as you uploaded it, one folder per project\n" +
      "site.json   your pages, projects, captions, credits and settings\n" +
      "messages.json  messages from your contact form\n",
    { name: "README.txt" },
  );

  // Files are added one after another so only one is open at a time.
  void (async () => {
    const used = new Set<string>();
    for (const d of media.docs) {
      const m = d.data() as { original?: string | null; fileName?: string; projectId?: string };
      if (!m.original) continue;
      const file = await readStream(m.original).catch(() => null);
      if (!file) continue;
      const folder = m.projectId && folderFor.has(m.projectId) ? folderFor.get(m.projectId)! : "library";
      let name = `originals/${folder}/${safe(m.fileName || d.id)}`;
      if (used.has(name)) name = name.replace(/(\.[^.]*)?$/, `-${d.id.slice(0, 6)}$1`);
      used.add(name);
      const stream = Readable.fromWeb(file.stream as import("node:stream/web").ReadableStream);
      await new Promise<void>((resolve, reject) => {
        zip.once("entry", () => resolve());
        stream.once("error", reject);
        zip.append(stream, { name });
      }).catch((e) => console.error("export file", d.id, e));
    }
    await zip.finalize();
  })().catch((e) => out.destroy(e));

  return new NextResponse(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${username}-fannan-export.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
