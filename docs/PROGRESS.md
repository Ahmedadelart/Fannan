# Progress

_Last updated: 7 Oct 2026, end of phase 1 (waiting for Ahmed's test)._

## Done

### Phase 0: Foundations
- **Project:** Next.js 16 (App Router, TypeScript) + Tailwind 4 + next-intl, in `D:\Fannan.net\fannan`, pushed to `github.com/Ahmedadelart/Fannan`.
- **Design → code:** `npm run generate` (runs automatically before `dev`/`build`) turns:
  - `design/tokens.json` → Tailwind theme (`src/styles/tokens.generated.css`). Tailwind's default palette is wiped, so blue can't be used by accident;
  - `design/icons/*.svg` → the `<Icon>` component (undo, redo and publish flip in Arabic);
  - `config/reserved-usernames.txt` → a lookup used by `checkUsername()` (`src/config/usernames.ts`).
- **Config:** `config/plans.json` is typed in `src/config/plans.ts` (limits, currency by country, monthly price).
- **Fonts:** Bricolage Grotesque 800, IBM Plex Sans + Plex Sans Arabic, Marhey 700 via `next/font`. Headings switch to Marhey on Arabic pages.
- **UI kit** (`src/components/ui/`): Button (primary/lime/outline/ghost, 3 sizes), IconButton, Input, Select, Toggle, Checkbox, Radio, Segmented, Slider, Badge (Live/Password/Draft/Hidden/…), Available pill, Chip, Card, Tile, NavItem, Modal, Popover/Menu, Toast, Empty state, Logo (EN/AR/on-lime), Highlight stroke.
- **Kitchen sink:** `/kitchen-sink` and `/ar/kitchen-sink` on the marketing surface.
- **Three surfaces by Host** (`src/proxy.ts`, Next 16's name for middleware):
  - `fannan.net` → marketing (EN, Arabic at `/ar`);
  - `app.fannan.net` → dashboard (language from a cookie that only exists on `app.`);
  - `{username}.fannan.net` → artist site placeholder;
  - `www.` → redirects to the bare domain; invalid subdomains → 404; internal paths unreachable.
  - On staging/local addresses a top bar switches surface (`SURFACE_SWITCHER=true`).
- **Firebase:** web apps registered in `fannan-510913` (production) and `fannan-staging`. Config in `src/config/firebase.ts`, chosen at runtime by `FIREBASE_ENV`. Client + admin helpers in `src/lib/firebase/`. Emulators configured (`npm run emulators`). Firestore and Storage rules are **deny-all** until each phase opens what it needs.
- **Google Cloud (project `fannan-510913`, region `europe-west1`):**
  - Artifact Registry repo `fannan`;
  - service accounts `github-deployer`, `web-staging`, `web-production`;
  - keyless GitHub → Google sign-in (Workload Identity Federation), limited to the `Ahmedadelart/Fannan` repo.
- **CI/CD:**
  - `.github/workflows/ci.yml`: every push runs typecheck, lint and the Playwright tests, then builds one image and deploys Cloud Run service `fannan-staging`;
  - `.github/workflows/production.yml`: manual "Run workflow" deploys the same image to `fannan-production`.
- **Tests:** 48 Playwright tests (routing + kitchen sink, EN/AR × desktop/mobile), including "no blue anywhere" and "no sideways scrolling".

### Phase 1: Sign-up flow, accounts, dashboard shell
- **Sign-up** (`app.fannan.net/signup`, `src/app/[locale]/app/signup/`): the 6 steps of ONBOARDING.md.
  - Anonymous Firebase user from the first second; email asked last.
  - Live preview on the right, using the real site renderer at small scale (`src/components/site/SiteRender.tsx`, seed of the phase-4 renderer).
  - Step 2 autocomplete over 62 disciplines in EN + AR with colloquial spellings (`config/disciplines.json`).
  - Step 3 makes the 4 starter sites (`src/lib/site/starter.ts`); step 4 shows them with the artist's name. The Reel / The Showcase depending on discipline; directors and story people see The Storyteller first.
  - Step 5 live username check (`/api/username/check`), friendly messages, suggestions; claims the name and creates the site + pages in Firestore.
  - Step 6 magic link or Google. Works on another device: a one-time claim token in the link moves the anonymous draft to the real account (`finishClaim` in `src/lib/server/data.ts`).
  - Resumes where they stopped on the same browser. Funnel events (step, time, layout, discipline, method; no personal data) go to `onboardingEvents`.
- **Homepage claim box** checks the name and hands it to step 1, which holds it for 30 minutes.
- **Usernames:** rules + `config/reserved-usernames.txt` + new `config/blocked-username-words.txt` (EN + Franco-Arab; whole-word vs anywhere).
- **Log in** (`/login`) with magic link or Google; `/auth/link` finishes email links (asks for the email when opened on another device).
- **Sessions:** Firebase ID token → httpOnly `__session` cookie on the app host only (`/api/session`). All Firestore reads/writes go through the server; browser access stays blocked by rules.
- **Dashboard shell** matching Dashboard.dc.html: sidebar with active lime tile, plan card (projects from `config/plans.json`), عربي switch, log out; "Your site" with link card (live preview, Share), Available-for-work card (saved, with Freelance/Full-time/Remote), Get-hired checklist (ticks itself, dismissible), Messages and Projects empty states. Editor/Projects/Stats/Settings/Upgrade show "Coming soon".
- **Language** remembered per account and applied on every device at sign-in.
- **Tests:** 56 Playwright tests, including the full sign-up in EN (desktop + phone) and AR (desktop + phone), log-in on a second device, Available toggle persisting, language following the account. Tests run against the Firebase emulators (Java 21 in CI).

## In progress
- Nothing.

## Blocked on Ahmed
- Billing on `fannan-staging` (needed before phase 2): Google refused to link it because the billing account already has its 5-project limit (fannan, zareef, feshar, artgym, klaket). Ahmed to request a higher limit or free a slot.

## Known issues and notes
- **SWC pinned:** `@swc/core` is pinned to 1.15.47 in `package.json` → `overrides`. Version 1.16 refuses to start on this Windows machine because of folder permissions on its cache. Remove the override once that's fixed upstream.
- **Cache Components is off** (`next.config.ts`). Pages are rendered per request; Cloudflare will do edge caching. Revisit for the public renderer in phase 4.
- **Production has no public address yet.** `fannan-production` only answers to `fannan.net` hosts, which get wired up through Cloudflare + a load balancer in phase 4. Until then, test on staging.
- **Staging Cloud Run lives in the production Google Cloud project** (one image store, one deploy identity) but uses the **fannan-staging Firebase project** for data. `fannan-staging` needs billing linked before phase 2 (Cloud Storage needs it).
- **New icons** added following ICONS.md: `chevron-down`, `close`, `check` (needed for selects, modals and checkboxes).
- **Two greys** from the screens that `tokens.json` doesn't name were added as `ink-soft` #3A3A40 and `line-strong` #CFCFC8.
- **Error colour (decided):** no red. Form errors use a 2px ink border and a small lime bar before the message.
- **Cards** use 22px corners per CLAUDE.md (Shapes screen shows 16px).
- **Firestore (decided):** databases created in `europe-west1` (Belgium) in both `fannan-510913` and `fannan-staging`.
- **First-run editor tips** (3 max) move to phase 3, because the editor they point at is built there.
- **Anonymous draft cleanup** (7 days) is written (`POST /api/cron/cleanup` with `CRON_SECRET`) but not scheduled yet; set up Cloud Scheduler with a Secret Manager secret in phase 7 (launch hardening).
- **Magic-link emails** currently come from Firebase's default sender (noreply@<project>.firebaseapp.com). They move to hello@fannan.net with the email provider in phase 4.
- **Rate limits** are per server instance (in memory). Cloudflare rate rules add a shared layer in phase 4.
- **Local emulators need Java 21**; this PC has Java 8 first on PATH, so start them with JAVA_HOME pointing at `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`.
- **Beta-artist quote** on step 6 is replaced by the "Publishing is free" promise until a real quote exists (AHMED-TODO).
- Terms and Content policy links on step 6 point to pages built in phase 7.
- **Firebase sign-in is on** in both projects (Anonymous, Email link, Google). Allowed domains: staging adds its run.app address, `staging.fannan.net` and `app.staging.fannan.net`; production adds `app.fannan.net`.
