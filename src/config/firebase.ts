// Firebase web settings for each environment. These identify the project; they are not secrets
// (access is controlled by the security rules in firestore.rules and storage.rules).
// The server picks one with FIREBASE_ENV at runtime, so one container image serves staging and production.

export type FirebaseEnv = "emulator" | "staging" | "production";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const configs: Record<FirebaseEnv, FirebaseWebConfig> = {
  // Local emulators: no real project is touched. "demo-" projects can't reach Google at all.
  emulator: {
    apiKey: "demo-key",
    authDomain: "demo-fannan.firebaseapp.com",
    projectId: "demo-fannan",
    storageBucket: "demo-fannan.appspot.com",
    messagingSenderId: "0",
    appId: "demo",
  },
  staging: {
    apiKey: "AIzaSyBfpZdht0YmGpdkZs4lfyzPZ1FYKycoH1I",
    authDomain: "fannan-staging.firebaseapp.com",
    projectId: "fannan-staging",
    storageBucket: "fannan-staging.firebasestorage.app",
    messagingSenderId: "369321717857",
    appId: "1:369321717857:web:b3afc236192ede71e1ba20",
  },
  production: {
    apiKey: "AIzaSyAEkG4qkS__mShfJJQF46s66TisgcmuPAs",
    authDomain: "fannan-510913.firebaseapp.com",
    projectId: "fannan-510913",
    storageBucket: "fannan-510913.firebasestorage.app",
    messagingSenderId: "129265233489",
    appId: "1:129265233489:web:90dec9c1594cc6e8895270",
  },
};

export function firebaseEnv(): FirebaseEnv {
  const v = process.env.FIREBASE_ENV;
  return v === "staging" || v === "production" ? v : "emulator";
}

export function firebaseWebConfig(env: FirebaseEnv = firebaseEnv()): FirebaseWebConfig {
  return configs[env];
}

export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, storage: 9199 } as const;
