import "server-only";

import { GoogleAuth } from "google-auth-library";
import { firebaseEnv } from "@/config/firebase";
import { BUCKET } from "./storage";

// Calls the media function (functions/media). In the cloud the call is signed with this
// service's own identity; only the app's accounts may invoke it.

export type ProcessKind = "image" | "svg" | "gif" | "loop" | "pdf";

export interface Variants {
  webp: Record<string, string>;
  avif: Record<string, string>;
}

export interface ProcessResult {
  width?: number;
  height?: number;
  variants?: Variants;
  poster?: Variants;
  loop?: string;
  duration?: number;
  pages?: number;
  error?: "too-long" | "not-a-video" | "unreadable" | "bad-request";
}

const URL_ = process.env.MEDIA_FUNCTION_URL ?? (firebaseEnv() === "emulator" ? "http://127.0.0.1:8090" : "");
let auth: GoogleAuth | undefined;

export async function processMedia(input: {
  source: string;
  dest: string;
  kind: ProcessKind;
  crop?: { x: number; y: number; w: number; h: number };
}): Promise<ProcessResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (firebaseEnv() !== "emulator") {
    auth ??= new GoogleAuth();
    const client = await auth.getIdTokenClient(URL_);
    Object.assign(headers, await client.getRequestHeaders());
  }
  const res = await fetch(URL_, {
    method: "POST",
    headers,
    body: JSON.stringify({ bucket: BUCKET, ...input }),
    signal: AbortSignal.timeout(280_000),
  });
  if (res.status !== 200 && res.status !== 422) return { error: "unreadable" };
  return (await res.json()) as ProcessResult;
}
