"use client";

// Browser-side Firebase: sign-in only. All data goes through the server.
// The server hands the config down (src/config/firebase.ts), so one build serves staging and production.
import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { EMULATOR_PORTS, type FirebaseEnv, type FirebaseWebConfig } from "@/config/firebase";

let auth: Auth | undefined;

export function firebaseAuth(config: FirebaseWebConfig, env: FirebaseEnv): Auth {
  if (auth) return auth;
  const app = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);
  if (env === "emulator") {
    connectAuthEmulator(auth, `http://127.0.0.1:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
  }
  return auth;
}
