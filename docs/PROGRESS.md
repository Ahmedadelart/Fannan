# Progress

_Last updated: 7 Oct 2026, end of phase 0._

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

## In progress
- Nothing.

## Blocked on Ahmed
- Error colour decision, Firestore location (recommend europe-west1), billing on fannan-staging (before phase 2).

## Known issues and notes
- **SWC pinned:** `@swc/core` is pinned to 1.15.47 in `package.json` → `overrides`. Version 1.16 refuses to start on this Windows machine because of folder permissions on its cache. Remove the override once that's fixed upstream.
- **Cache Components is off** (`next.config.ts`). Pages are rendered per request; Cloudflare will do edge caching. Revisit for the public renderer in phase 4.
- **Production has no public address yet.** `fannan-production` only answers to `fannan.net` hosts, which get wired up through Cloudflare + a load balancer in phase 4. Until then, test on staging.
- **Staging Cloud Run lives in the production Google Cloud project** (one image store, one deploy identity) but uses the **fannan-staging Firebase project** for data. `fannan-staging` needs billing linked before phase 2 (Cloud Storage needs it).
- **New icons** added following ICONS.md: `chevron-down`, `close`, `check` (needed for selects, modals and checkboxes).
- **Two greys** from the screens that `tokens.json` doesn't name were added as `ink-soft` #3A3A40 and `line-strong` #CFCFC8.
- **Error colour:** there's no red in the brand. Form errors use a 2px ink border and a small lime bar before the message. Waiting for Ahmed's call.
- **Cards** use 22px corners per CLAUDE.md (Shapes screen shows 16px).
- Firestore database location not chosen yet (needed in phase 1; recommendation: `europe-west1`, same as Cloud Run).
