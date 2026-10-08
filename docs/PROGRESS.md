# Progress

_Last updated: 8 Oct 2026, phase 8 (Editor 2.0) under way: 8A and 8B done, 8C next._

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

### Phase 2: Projects and media
- **Project editor** (`app.fannan.net/projects/{id}`) matching Project.dc.html:
  - drag-and-drop or button uploads, several at once, 3 in parallel, with progress; clear errors for wrong type, size, too-long loops, full storage;
  - YouTube/Vimeo links become embeds (title and poster fetched); text blocks;
  - items: reorder (drag, or Move earlier/later for phones and keyboards), crop (Free/16:9/4:3/1:1/3:4, original kept), set cover, caption, alt text (with a nudge when empty), replace, delete, Full width / Lightbox / Autoplay;
  - credits (title, category, year, role, client, studio, team, description, tags), visibility (Public / Password (Pro only) / Hidden), mature flag, SEO title/description, project link (follows the title until edited), optional Arabic fields;
  - everything autosaves; "Saved · N items".
- **Projects list** (`/projects`) and project tiles on the dashboard with Live / Password / Draft / Hidden badges. Free plan stops at 8 projects with "You've used 8 of 8 projects. Go Pro from 112 EGP / $6 a month" (currency from Cloudflare's country header).
- **Storage meter** in the sidebar: percentage only, calm until 80%.
- **Uploads:** browser → private bucket with a 15-minute signed link (`src/lib/server/storage.ts`); the server checks the real file type from its first bytes and the size, then calls the media function.
- **Media function** `functions/media` (Cloud Functions 2nd gen, `fannan-media-staging` and `fannan-media`): WebP + AVIF at 400/800/1600/2560, upright, no EXIF/GPS; GIFs stay animated (animated WebP + still poster); SVGs only ever published as pictures (scripts can't run); MP4 loops ≤ 30 s, sound removed, fast-start, poster frame; PDFs get a page-1 cover and page count. Only the app's own server accounts can call it.
- **Media serving (owner only for now):** `/api/media/...` streams web versions to the signed-in owner, never originals.
- **Buckets:** `fannan-media-staging`, `fannan-media-production` in project `fannan-510913` (europe-west1, private, uniform access).
- **Tests:** 62 Playwright tests. New: full project with photo, GIF, loop, PDF and YouTube link; wrong-type and too-long refusal; crop to 1:1; cover and order survive reload; 8-project limit; editor in Arabic. Local tests run the media function against a folder (`.local-storage/`).

### Phase 3: Site editor
- **Editor** (`app.fannan.net/editor`) matching Editor.dc.html:
  - top bar: page selector, desktop/tablet/phone canvas, undo/redo (also Ctrl/Cmd+Z), save state ("Saved", "Unpublished changes", "Live site is up to date"), Preview, Publish;
  - **Blocks** tab: search, 4 groups with icons and the Fannan tag; click to add below the selected block, or drag onto the canvas (drop line shows where); move up/down, duplicate, remove;
  - **20 launch blocks**: Fullscreen cover, Text, Columns, Hero headline, Grid, Masonry, Slider (one Gallery block with Grid/Masonry/Slider/Fullscreen layouts), Image, Video (YouTube/Vimeo), Loop/GIF, Before/after, PDF, Reel, Credits, Logo wall, About/CV, Contact form, Hire-me badge, Social links, Quote — each with its settings panel (gallery settings as in the design);
  - **Style** tab: 6 presets (Gallery, Studio, Paper, Lime, Night, Sand), heading/body/Arabic fonts (12 Google fonts), background/text/accent colours, corner radius, 5 nav layouts, logo and favicon, site name, tagline, site language;
  - **Pages** tab: Gallery / Custom / About-CV / External link pages; rename, address, show in nav, reorder, delete; page password (Pro only, stored as a hash, never sent to the browser);
  - media picker with uploads into a site-wide library (`_library`), so blocks can use any image, loop or PDF;
  - first-run tips (3, one at a time, pointing at the real controls), shown once per account;
  - on phones the side panels become drawers and the canvas starts in phone view.
- **Renderer** `src/components/site/SiteRender.tsx`: all blocks, all themes, nav layouts, container queries (the phone preview and a real phone get the same layout), Free-plan footer credit, galleries from real projects (sample art only while editing).
- **Autosave** (0.8 s after the last change, retries on failure); **Publish** saves first, then writes an immutable snapshot to `sites/{id}/published/{version}` (draft + projects + only the media they use; password hashes stay server-side), keeps the last 5, marks projects Live. Cache purge is a stub until Cloudflare (phase 4).
- **Old drafts** from phases 1–2 are upgraded on read (`src/lib/site/normalize.ts`).
- **Dashboard** preview now shows real media and projects; "Edit site" opens the editor; the checklist ticks "Write your About" and "Publish your site".
- **Tests:** 66 (64 run per size). New: build → phone preview → publish → edit again, checking in the database that the published copy did not change; editor on a phone in Arabic.

### Phase 4: Public artist sites (code)
- **Renderer route** `src/app/[locale]/site/[username]/[[...path]]`: reads only the published snapshot (`liveSite()` in `src/lib/server/public.ts`, 30 s per-instance cache). Pages by address, project pages by slug (hidden projects open by direct link), 404 for anything else, "not published yet" before the first publish.
- **Project pages:** title, category, credits (role, client, studio, year, team), description, media in order (images with lightbox, animated GIFs, loops, PDFs with cover and download, YouTube/Vimeo click-to-play, text), mature click-through, Arabic fields on Arabic sites.
- **Live behaviours** (`src/components/site/live/SiteEnhancer.tsx`, tiny): lightbox with keyboard and swipe, click-to-play videos (youtube-nocookie / Vimeo), before/after drag, loops play on hover in galleries, optional image protection.
- **Available for work:** badge + "Hire me" (jumps to the contact form) show straight away without publishing again.
- **Contact form:** saves to `messages` (the inbox in phase 5) and emails the artist via Resend (reply goes straight to the sender). Spam: honeypot, 5 per 10 min per IP, 60 per hour per site, Turnstile when its secret is set. Without a Resend key, emails go to `.local-storage/outbox.log` (dev/tests only).
- **Passwords:** pages and projects (Pro) ask on the server and set a signed, site-only cookie (30 days); their media is served only with a 1-hour signed token, so guessed image addresses get 403. Password projects show no cover in galleries.
- **Public media route** `/m/...`: only files in the published snapshot; never other originals (PDF downloads are the one exception). Drafts and unpublished uploads return 404.
- **SEO:** real titles/descriptions, canonical, Open Graph image from the cover, favicon, JSON-LD (Person / CreativeWork), noindex for password/hidden; `robots.txt` and `sitemap.xml` per address (artist, marketing, app never indexed).
- **Language:** the proxy looks up the published language so Arabic sites are served as `<html lang="ar" dir="rtl">`.
- **Free plan credit** "Made with Fannan" → fannan.net.
- **Cache purge** on publish and on Available changes (Cloudflare by hostname; active once the token is set).
- **Speed (Lighthouse, phone, local):** performance 97–99, accessibility 100, best practices 100, SEO 100.
- **Tests:** 72 (68 run). New: published site end to end (gallery → project → lightbox; contact form → inbox + email; Hire me; drafts and draft media never public; sitemap/robots; 404), password project incl. guessed image URL refused, Arabic site RTL on a phone.

### Phase 4: Live on fannan.net
- **Front door: a Cloudflare Worker** (`infra/edge-worker.js`, deployed with `infra/deploy-edge.mjs`) instead of a Google load balancer (~$18/month). Free up to 100k requests/day, then $5/month. It forwards every request on `fannan.net/*` and `*.fannan.net/*` to Cloud Run `fannan-production`, passing the visitor's address in `X-Forwarded-Host`. The app reads that header for routing, redirects, links and server-action origin checks. Cloud Run answers 404 to direct visits.
- **DNS** (all proxied, placeholder 192.0.2.1 because the Worker answers): `fannan.net`, `*.fannan.net`, plus explicit `www` and `app` records. Explicit records were needed: an old site ("Fannan - Digital Sanctuary for Artists", probably on another Cloudflare-based host) still claimed `www.fannan.net` and the wildcard alone didn't outrank it. `www` now redirects to `fannan.net`. Always-HTTPS and TLS 1.2+ on.
- **Production** `fannan-production` deployed through the "Deploy to production" workflow; Firebase project `fannan-510913`; bucket `fannan-media-production`; media function `fannan-media`.
- **Turnstile** widget "Fannan contact forms" (fannan.net + the staging address); secret in Secret Manager (`turnstile-secret`), site key in env. It loads only once a visitor starts using the form (it is ~800 KB).
- **Secrets wired:** `site-signing-secret-{staging,production}`, `turnstile-secret`, `resend-api-key` (staging + production), `cloudflare-api-token` + zone id (production, for cache purge by hostname; purge by host works on the Free plan).
- **Checked live:** homepage name box → app.fannan.net sign-up → publish → `{name}.fannan.net` with contact form and credit. Lighthouse (phone, production): performance 92–95, accessibility/best practices/SEO 100.
- **Fonts:** all 12 fonts ship in `src/fonts` (SIL Open Font License, from Fontsource). Google Fonts sometimes serves files at extension-less URLs, which crashed builds in CI; no font is downloaded at build time any more.

- **Email:** Resend sends from hello@fannan.net (domain verified); Cloudflare Email Routing forwards support@ and hello@fannan.net to fannan.team@gmail.com. DMARC is `p=none` for now; tighten after a few weeks of clean sending.

### Phase 5: Inbox, stats, settings, account
- **Messages** (`app.fannan.net/messages`, nav item with an unread count): every contact-form message, newest first; All / Unread; opening marks it read; mark unread; reply by email (opens your mail app addressed to the sender); delete. Extra answers (project type, budget, deadline, your own question) show above the message. The dashboard's Messages card lists the latest three.
- **Stats** (`/stats`, matching Stats.dc.html), counted by our own server, **no cookies and no IP addresses stored**: a visitor is a daily-changing scrambled code of (site, IP, browser), so nobody can be followed across days. Bots and headless browsers are ignored. Visitors, project views, average time on site, messages, each with change vs the previous period; a daily bar chart (lime on days you published, hover for the number, a hidden table for screen readers); top projects; where visitors came from; countries (from Cloudflare). Free: 7 and 30 days. Pro: 90 days, referrers and countries. One Firestore document per site per day (`stats/{siteId}_{YYYYMMDD}`).
- **Settings** (`/settings`, matching Settings.dc.html). Live straight away, no publishing needed:
  - **Domain:** change your Fannan address; the old one forwards visitors (and keeps its path) for 30 days, then it's free for others. Own domain shows as Pro, coming in phase 6.
  - **Privacy:** whole-site password (Pro, checked on the server, media behind signed links, never indexed), protect images, show in Fannan search (saved; the search itself comes later), let Google index (robots meta, `robots.txt`, sitemap).
  - **Contact & hiring:** Fannan inbox (always), email copy on/off, extra questions (project type, budget, deadline, one custom question), social links (shown in the site footer and in search engines' "same as" data), CV PDF (download link in the footer). WhatsApp shows as "coming soon".
  - **Search & sharing:** site title, description, share image. **Language and favicon** go into the draft and change the live site on the next publish ("English and Arabic" shows as coming soon).
  - **Integrations:** Google Analytics ID and Meta Pixel ID (format-checked, loaded only when set); custom code (Pro, later); ArtStation/Behance import (later); **Export my site**: a zip of every original file (one folder per project), `site.json` (pages, projects, captions, credits, settings; no password hashes) and `messages.json`, streamed straight from storage.
  - **Plan & billing:** current plan and Pro prices from `config/plans.json` in EGP or USD; buying arrives in phase 6.
  - **Account:** change sign-in email (we email a confirmation link to the new address; nothing changes until it's clicked); delete account: the site goes offline at once, everything (site, files, messages, stats, usernames, sign-in) is deleted for good after 14 days by the daily cleanup; logging in before then shows "Keep my account".
- **Firestore indexes** for messages (`firestore.indexes.json`); the visitor-code map in stats documents is excluded from indexing.
- **Tests:** `tests/e2e/settings.spec.ts`: stats move when a (non-bot) visitor arrives and repeat visits don't double count; contact extra questions with the email copy off; inbox read/unread/reply/delete; every live setting shows on the site without publishing; export zip; address change forwards; delete and keep account; whole-site password on Pro; email-change confirmation; Arabic + phone fit.

### Phase 6: Pro (prepaid), payments, own domains, admin
- **Pro period** (`src/lib/plan.ts`): `proUntil` on the user; buying again stacks after the current end; 7-day grace; then Free. The plan in effect is worked out on every request (`userPlan()`), so nothing has to run at midnight for a site to change.
- **Move to Free, hide never delete** (`applyPlan()` in `src/lib/server/public.ts`): password pages and projects hidden, projects beyond the newest 8 hidden (open by direct link like any hidden project), the footer credit returns, the own domain forwards to `name.fannan.net`. All of it comes back with Pro. The projects page explains it. (A whole-site password stays on, so private work never becomes public.)
- **Checkout** (`src/lib/server/billing.ts`): an order records months, the price shown (EGP in Egypt, USD elsewhere, locked when the order is made), what's charged, the exchange rate and the launch offer flag. USD prices are charged in EGP at the day's rate (open.er-api.com, cached 6 h) until `config/plans.json → payments.chargeUsd` is turned on; the page says "your bank may show about X EGP".
  - **Paymob** (Intention API + Unified Checkout) switches on when `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_INTEGRATION_IDS` and `PAYMOB_HMAC_SECRET` are set. The signed callback (`/api/paymob/callback`, HMAC-SHA512 over Paymob's 20 fields) is the only thing that marks an order paid; amounts and currency must match; repeats are ignored.
  - **Practice checkout** stands in until then on local and staging (Pay / Decline buttons, same code path). Never in production: without Paymob, production shows "Buying Pro opens very soon".
  - Receipt email; return page waits for the confirmation; payment history in Settings → Plan & billing.
- **Upgrade page** `/upgrade` (Free vs 3/6/12 months, prices from `config/plans.json`, launch offer from config, off). Sidebar shows "Pro plan · until …" and "Add more time".
- **Reminders:** daily job (`/api/cron/cleanup`) emails at 14, 3 and 0 days and when the site moves to Free, each once per period; dashboard banner at the same moments. The email has an "Add more time" button.
- **Own domains (Pro)** via Cloudflare for SaaS: Settings → Domain → Your own domain; shows the exact DNS record (CNAME → `sites.fannan.net`, plus any TXT Cloudflare asks for), status updates live (Waiting for DNS → Issuing the certificate → Active); SSL automatic; `name.fannan.net` forwards to the domain once active; disconnect anytime. Cloudflare: fallback origin `sites.fannan.net`, Worker route `*/*` (`infra/deploy-edge.mjs`). Works on fannan.net only (staging isn't behind Cloudflare). A bare domain (name.com) connects as www.name.com, because most registrars can't CNAME the bare name; the steps show the names as typed at the registrar and the forwarding step. **Checked live:** www.ranakorany.com (GoDaddy) went Active with SSL, ranakorany.com forwards to it.
- **Admin** `app.fannan.net/admin` for adel4art@gmail.com and fannan.team@gmail.com only (others get a 404): accounts, Pro now, revenue in EGP and USD separately (all time and 30 days), users search, give Pro N months (stacks, shows as a gift), set the Pro end date (to try reminders and the move to Free), suspend/unsuspend a site, payments with refunds (takes the months back; warns outside the 14-day / own-domain rule), "Run daily jobs now". The reports queue arrives with the Report link in phase 7.
- **Tests:** `tests/e2e/pro.spec.ts`: EGP purchase after a declined card, USD charged in EGP and stacked, 9 projects + own domain + no credit, admin refund, 14-day email and banner, grace, Free (credit back, 8 projects shown, domain forwards back), Pro again via gift, suspend; Go Pro page in Arabic on a phone.

## In progress
- Nothing.

### Phase 7: Marketing site, legal, launch readiness
- **fannan.net** (Home-EN/AR.dc.html): header, hero with the claim box, disciplines strip, how it works, built to get you hired, examples, pricing (EGP in Egypt, USD elsewhere, from `config/plans.json`), closing CTA, footer. Arabic at /ar in the design's Egyptian voice. Copy adjusted where the design promised things not built yet (WhatsApp, ArtStation/Behance import).
- **Pages (EN + AR):** /pricing (all durations, comparison, payment FAQ), /examples (real sites Ahmed features from Admin → Show on Examples), /help (17 questions), /contact (to support@fannan.net), /terms, /privacy, /content-policy (drafts naming Big Cat Animation LLC; **lawyer review needed**), /copyright (takedown notice form), /report.
- **Report this site:** link in every artist site's footer → /report with the site and page filled in → `reports` → Admin → Reports (with a count on the tab and an email to support@). Actions: dismiss, hide project (gone from the live site at once, even by direct link), unpublish site, suspend account, ban (also blocks sign-in). Every action emails the artist the reason, with an optional note.
- **Onboarding emails** (once each): welcome (account saved), "your site is live" (first publish), "your first message" (first contact message; folded into the message email when email copies are on).
- **Accessibility:** automatic axe checks (WCAG A/AA) on the homepage EN/AR, dashboard, settings and an artist site, now in the tests; fixed two unlabelled "images" (site previews and empty project placeholders). Focus ring, contrast and alt-text nudges were already in place.
- **Running it (fannan-510913):** daily Firestore backups (14 days); Cloud Scheduler job `fannan-daily` at 03:00 Cairo calls `/api/cron/cleanup` with `CRON_SECRET` (Secret Manager `cron-secret`); uptime checks (fannan.net, app.fannan.net/login, www.ranakorany.com) every 5 minutes; alert policies "Fannan is down" and "Fannan server errors" email fannan.team@gmail.com; Error Reporting picks up server errors on its own (instead of Sentry: no extra account). Staging has no backups (no billing; test data only).
- **Load test** (autocannon, 20 connections, 30 s, production artist site through Cloudflare): ~43 requests/s, median 397 ms, p97.5 677 ms. Pages aren't edge-cached yet; that's the next lever if traffic grows.
- **Tests:** `tests/e2e/launch.spec.ts` (marketing EN/AR on desktop and phone, prices by country, every page 200 in both languages, contact form, onboarding emails, report → hide project → artist email, Examples).
- **Beta sign-off:** `docs/BETA-CHECKLIST.md`.

### Phase 8A: Every kind of artist
- **131 disciplines** (was 63) across 21 fields: photography, film and video, design, architecture and interiors, fashion, fine art, crafts, music and sound, performance, beauty, writing, plus the original animation, illustration, comics, concept, 3D and games. English and Arabic names with colloquial and transliterated synonyms (مصور، فوتوجرافر…).
- **Sign-up suggestions** span fields (Illustrator, Photographer, Graphic designer, 2D animator, Architect, 3D modeler, Fashion designer, Calligrapher, UX designer, Concept artist, Contemporary artist, Filmmaker). "The Reel" is offered to people whose work moves (animation, motion, 3D, film, performance); stills-first fields (photography, architecture, fashion, fine art, crafts, beauty, design) see The Grid first; writers and directors The Storyteller. Storyteller headlines and sample colours fit each field.
- **Project categories** in grouped menus (`src/config/categories.ts`): animation and motion, illustration and comics, design, photography and film, architecture and interiors, fashion, fine art and crafts, 3D and games, music and performance, writing, other.
- **Starter and marketing wording** no longer assumes animation (block placeholders, homepage strip and examples, help, SEO placeholder).
- Quick fixes from Ahmed's review: the marketing header no longer shifts on inner pages; sign-up shows the signed-in email with "Not you? Sign out".

### Phase 8B: Drag, click, type
- **Type on the page:** every text in the editor preview (headings, paragraphs, captions, labels, buttons, credits, logo names, quotes, the site name in the header) is edited in place: click and type, Enter finishes one-line text, Esc leaves. Empty fields show "Type here" on the selected section. The settings panel stays in sync, undo/redo works, and the live site stays plain HTML (`InlineText` is only used on the editor canvas).
- **Section toolbar:** clicking a section shows a small toolbar on its top edge: drag handle (also arrow keys), settings, add below, duplicate, delete. The old up/down/duplicate/delete buttons in the side panel are gone.
- **Drag sections** by the handle with a "Drop here" line, auto-scrolling near the edges; **Reorder** in the top bar zooms the page out so whole sections are dragged, then Done.
- **Pages** are dragged into menu order by a handle (arrow keys too); the home page stays first.
- New icons (Swiss style, ICONS.md): duplicate, reorder.
- **Tests:** `tests/e2e/editor2.spec.ts` (type on the page incl. the site name, toolbar drag + keyboard, duplicate/delete, reorder view, page drag, everything published; Arabic typing).

## Not done yet from the phase 6 "done when"
- Buying through **Paymob test mode** from Egypt (EGP) and abroad (USD): waiting for Ahmed's go-ahead (he asked to build and test the whole experience first with the practice checkout).

## Blocked on Ahmed
- **Paymob (when he's ready):** test-mode Secret key + HMAC (into Secret Manager as `paymob-secret-key`, `paymob-hmac-secret`), Public key and integration IDs (card, wallet/Fawry if any), and whether the account can charge USD.
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
- **Uploads live in the main project's buckets** (fannan-510913) for staging too, because `fannan-staging` still has no billing. The staging bucket is separate from production, so data never mixes.
- **Design file vs plan:** Project.dc.html lists "MP4 up to 4K, MOV, MP3/WAV, Before/after". Built to the decided plan instead: no video hosting (loops ≤ 30 s), audio later, before/after is an editor block (phase 3).
- **Crop** works on the picture as it is now; "Reset" goes back to the full original.
- **Rate limits** loosened (40 sign-up actions per minute per IP) so a class on one Wi-Fi can sign up together; `RATE_LIMITS=off` only in automated tests.
- **"Publish project" and "Preview"** from the design arrive with publishing (phase 3) and the public renderer (phase 4).
- **Checked on staging:** photo, GIF, loop and PDF processed by the cloud function in about 9 s. A Vimeo link was added but came back as "Vimeo video" with no poster: Vimeo's info service may refuse requests from Google's servers. YouTube titles and posters work. Revisit in phase 4 (fallback: the Vimeo player shows its own poster).
- Sign-up funnel events sent right before a page change can be dropped by the browser; switch them to `navigator.sendBeacon` (site stats already use it).
- **Turbopack bug:** Readex Pro and Alexandria must load as variable fonts (no explicit weights), or the build fails with "next/font/google queries have exactly one entry".
- **Editing in place** on the canvas (typing directly into headings) isn't built; text is edited in the right panel with a live canvas. Candidate for a later polish pass.
- **Contact form and lightbox** look right in the editor; they start working on the live site in phase 4.
- **Project order in galleries** is newest first; manual ordering can come later if artists ask.
- **Production builds use webpack** (`next build --webpack`, Tailwind via `postcss.config.mjs`). Turbopack intermittently failed to fetch Google fonts at build time (it broke two CI runs). Dev still uses Turbopack.
- **No server-side redirects from server actions.** With host-based rewrites, Next renders the redirect target at its internal path (404). Actions return a result and the browser navigates (`NewProjectButton`, delete project, password unlock).
- **In-memory caches are process-wide** (`src/lib/server/shared-memory.ts`); webpack can load a module once per route bundle.
- **Load balancer script** `infra/setup-domain.sh` kept for later if traffic outgrows the Worker; not used.
- **Login lifetimes on this PC:** `gcloud` and the Firebase CLI logins expire about daily; re-run `gcloud auth login` / `firebase login --reauth` when commands fail with re-authentication errors.
- **Stats limits:** a site's daily document holds the visitor codes for that day; about 40,000 different visitors a day per site fit. Plenty for portfolios; if a site ever goes viral we'd move the codes to their own documents.
- **Own visits count** in stats (we can't tell the artist apart without cookies). The test "visit your site from another device" therefore moves the numbers too.
- **Cold starts:** production scales to zero; the first visit after a quiet spell takes a few extra seconds. A minimum of 1 instance (~$7/month) would remove that; decide after launch.
