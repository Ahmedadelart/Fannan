"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Auth, User } from "firebase/auth";
import type { FirebaseEnv, FirebaseWebConfig } from "@/config/firebase";
import { firebaseAuth } from "@/lib/firebase/client";

/** Remembers which email a magic link was sent to, so this browser needn't ask again. */
export const EMAIL_KEY = "fannan.emailForSignIn";

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({
  config,
  env,
  children,
}: {
  config: FirebaseWebConfig;
  env: FirebaseEnv;
  children: ReactNode;
}) {
  const auth = useMemo(() => (typeof window === "undefined" ? null : firebaseAuth(config, env)), [config, env]);
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/** Returns a getter: Firebase Auth only exists in the browser, so call it from effects and handlers. */
export function useAuth(): () => Auth {
  const auth = useContext(AuthContext);
  return () => {
    if (!auth) throw new Error("Firebase Auth is only available in the browser");
    return auth;
  };
}

/** Wait for Firebase to restore the signed-in user from this browser (or null). */
export function currentUser(auth: Auth): Promise<User | null> {
  return auth.authStateReady().then(() => auth.currentUser);
}

/** Give the server a session cookie for this user. */
export async function startServerSession(user: User, locale: string): Promise<{ ok: boolean; locale?: string }> {
  const idToken = await user.getIdToken(true);
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken, locale }),
  });
  if (!res.ok) return { ok: false };
  return (await res.json()) as { ok: boolean; locale?: string };
}

export async function endServerSession() {
  await fetch("/api/session", { method: "DELETE" });
}
