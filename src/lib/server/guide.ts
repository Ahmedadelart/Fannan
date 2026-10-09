import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { buildFromGuide, GUIDE_STEPS, type GuideAnswers, type GuideState } from "@/lib/site/guide";
import { getUser } from "./data";
import { saveSettings } from "./settings";
import { loadDraft, loadRenderData, saveDraft } from "./site";
import { ProjectError, updateProject, type Owner } from "./projects";

// The guided setup's saved answers (on the user) and the backups it makes before rebuilding a site.

const users = () => adminDb().collection("users");
const backups = (siteId: string) => adminDb().collection("sites").doc(siteId).collection("backups");

const MAX_BYTES = 200_000;
const KEEP_DAYS = 30;

export async function loadGuide(uid: string): Promise<{ state: GuideState | null; offered: boolean }> {
  const user = (await getUser(uid)) as (Awaited<ReturnType<typeof getUser>> & { guide?: GuideState; guideOffered?: boolean }) | null;
  return { state: user?.guide ?? null, offered: !!user?.guideOffered || !!user?.guide };
}

/** Answers are saved after every step, so leaving and coming back resumes where people stopped. */
export async function saveGuideState(uid: string, step: number, answers: unknown) {
  if (!answers || typeof answers !== "object") throw new ProjectError("bad-type");
  const json = JSON.stringify(answers);
  if (Buffer.byteLength(json) > MAX_BYTES) throw new ProjectError("too-big");
  const s = Math.max(0, Math.min(GUIDE_STEPS.length - 1, Math.floor(Number(step) || 0)));
  // Stored as given (the build step checks everything again through the draft's own rules).
  await users()
    .doc(uid)
    .set({ guide: { step: s, answers: JSON.parse(json), done: false }, guideOffered: true }, { merge: true });
}

export async function markGuideOffered(uid: string) {
  await users().doc(uid).set({ guideOffered: true }, { merge: true });
}

/** Saves the current draft so "Bring back my old site" can restore it. */
export async function backupDraft(o: Owner) {
  const draft = await loadDraft(o.siteId);
  if (!draft) return null;
  const ref = backups(o.siteId).doc();
  await ref.set({
    draft: JSON.parse(JSON.stringify(draft)),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 86_400_000),
  });
  return ref.id;
}

export async function latestBackup(siteId: string): Promise<{ id: string; at: number } | null> {
  const snap = await backups(siteId).orderBy("createdAt", "desc").limit(1).get();
  const d = snap.docs[0];
  if (!d) return null;
  const expires = (d.data().expiresAt as Timestamp | undefined)?.toMillis() ?? 0;
  if (expires < Date.now()) return null;
  return { id: d.id, at: (d.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0 };
}

export async function restoreBackup(o: Owner, id: string) {
  const snap = await backups(o.siteId).doc(String(id).slice(0, 40)).get();
  if (!snap.exists) throw new ProjectError("not-found");
  await saveDraft(o, snap.data()!.draft);
  await snap.ref.delete();
}

/**
 * Builds the site from the answers: a backup of the current draft first, then the new pages,
 * the projects' card settings and the social links.
 */
export async function buildGuide(o: Owner, answers: GuideAnswers) {
  const [draft, render] = await Promise.all([loadDraft(o.siteId), loadRenderData(o.siteId)]);
  if (!draft) throw new ProjectError("not-found");
  await backupDraft(o);
  const site = buildFromGuide(answers, {
    language: draft.language,
    title: draft.title,
    projects: render.projects,
    header: draft.header,
  });
  await saveDraft(o, site);
  const known = new Set(render.projects.map((p) => p.id));
  for (const p of answers.projects ?? []) {
    if (known.has(p.id)) await updateProject(o, p.id, { cardSize: p.size, cardText: p.text });
  }
  const social = (answers.social ?? []).filter((s) => s && typeof s.url === "string" && s.url.trim());
  if (social.length) await saveSettings(o, { social });
  await users().doc(o.uid).set({ guide: { done: true } }, { merge: true });
}
