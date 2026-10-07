"use client";

// Browser-side Firebase. The server hands the config down (see src/config/firebase.ts),
// so the same build works on staging and production.
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { EMULATOR_PORTS, type FirebaseEnv, type FirebaseWebConfig } from "@/config/firebase";

let app: FirebaseApp | undefined;

export function firebaseClient(config: FirebaseWebConfig, env: FirebaseEnv) {
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    if (env === "emulator") {
      const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
      connectAuthEmulator(getAuth(app), `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), host, EMULATOR_PORTS.firestore);
      connectStorageEmulator(getStorage(app), host, EMULATOR_PORTS.storage);
    }
  }
  return { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
}
