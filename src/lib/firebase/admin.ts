import "server-only";

// Server-side Firebase (full access, bypasses security rules: use with care).
// On Cloud Run it signs in automatically as the service's own account; no key files.
// Locally it talks to the emulators.
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { EMULATOR_PORTS, firebaseEnv, firebaseWebConfig } from "@/config/firebase";

function init() {
  const existing = getApps()[0];
  if (existing) return existing;
  const env = firebaseEnv();
  const config = firebaseWebConfig(env);
  if (env === "emulator") {
    process.env.FIRESTORE_EMULATOR_HOST ??= `127.0.0.1:${EMULATOR_PORTS.firestore}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `127.0.0.1:${EMULATOR_PORTS.auth}`;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `127.0.0.1:${EMULATOR_PORTS.storage}`;
  }
  return initializeApp({ projectId: config.projectId, storageBucket: config.storageBucket });
}

export function adminAuth() {
  return getAuth(init());
}
export function adminDb() {
  return getFirestore(init());
}
export function adminStorage() {
  return getStorage(init());
}
