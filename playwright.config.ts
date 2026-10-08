import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Tests run against a production build on port 3100.
// *.localhost addresses resolve to this computer, so we can test the three surfaces by host:
//   fannan.localhost (marketing) · app.fannan.localhost (dashboard) · ahmed.fannan.localhost (artist site)
// Against staging, set BASE_URL to the staging address; host-based tests then use the surface switcher.

const PORT = 3100;
export const ROOT = `fannan.localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://${ROOT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      // Firebase Auth + Firestore emulators (need Java 11+). Nothing touches real projects.
      command: "npx firebase emulators:start --only auth,firestore --project demo-fannan",
      port: 9099,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // The media processor (functions/media), working on the local storage folder.
      command: "npm --prefix functions/media start",
      port: 8090,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { LOCAL_STORAGE_ROOT: join(process.cwd(), ".local-storage") },
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/kitchen-sink`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        ROOT_DOMAIN: "fannan.localhost",
        SURFACE_SWITCHER: "true",
        FIREBASE_ENV: "emulator",
        RATE_LIMITS: "off",
        // Phase 6: test admins, a fixed exchange rate, and the practice checkout (no Paymob keys).
        ADMIN_EMAILS: "*@admin.test",
        USD_EGP_RATE: "50",
      },
    },
  ],
});
