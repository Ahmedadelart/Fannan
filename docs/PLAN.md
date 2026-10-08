# Fannan — build plan

Read `CLAUDE.md` first. Build one phase at a time. Each phase ends with something Ahmed can open and test. Don't start a phase until its **Needs from Ahmed** items are done; if one is missing, build with test or sandbox values and say so.

---

## Product in one paragraph

An artist goes through a one-minute, Carbonmade-style sign-up (`docs/ONBOARDING.md`), claims `yourname.fannan.net`, uploads projects (images, GIFs, loops, PDFs, video links) with proper credits, arranges them into a site from ready-made blocks and themes, switches on **Available for work**, and sends one link to studios. Studios contact them through a form that lands in the Fannan inbox and in their email (WhatsApp later). It works the same in English and Arabic. Pro (prepaid for 3, 6 or 12 months, priced in EGP in Egypt and USD elsewhere) adds a custom domain, unlimited projects, more storage, password pages, full stats and no Fannan credit.

## Feature scope (Carbonmade parity + Fannan extras)

| Area | Launch (phases 0–7) | Later (phase 8+) |
|---|---|---|
| Site building | Pages; blocks (list below); 6 theme presets; fonts (EN + AR); colours; corner radius; 5 navigation layouts; logo and favicon; desktop/mobile preview; undo/redo; draft → publish | Gradient backgrounds, custom CSS (Pro) |
| Projects | Upload images (JPG/PNG/GIF/SVG/WebP), PDF, short loops (MP4 ≤ 30s, ≤ 50 MB); YouTube/Vimeo embeds for anything longer; reorder; crop; captions; alt text; cover; credits (title, category, year, role, client, studio, team, tags); Public / Password / Hidden; optional "mature work" flag; per-project SEO; optional Arabic version | Audio files. **No video hosting**: decided, long video stays YouTube/Vimeo |
| Getting hired | Available-for-work badge + "Hire me" button; contact form → inbox + email; credits block; reel block; logo wall; About/CV with PDF download; social links | WhatsApp alerts; Fannan search directory for studios |
| Domains | `username.fannan.net` with SSL; custom domain on Pro (Cloudflare for SaaS) | Buying a domain through Fannan |
| Privacy | Password per project and per site; hide project; image protection (no right-click, optional watermark); search-engine opt-out | |
| Stats | Visitors, project views, messages, top projects, referrers, countries; 7/30/90 days; Google Analytics ID field | |
| Billing | Free + prepaid Pro (3 / 6 / 12 months), EGP in Egypt / USD elsewhere, via Paymob one-time payments; reminders before expiry; limits enforced | Recurring billing if Paymob adds it |
| Import | — | ArtStation / Behance import (check feasibility first, see phase 8) |
| Languages | Dashboard and marketing site in EN + AR (RTL); each artist site is EN, AR or both | |

**Launch blocks (19):** Fullscreen cover, Text, Hero headline, Columns, Grid, Masonry, Slider, Image, Video (embed), Loop/GIF, Before/after, PDF, Reel, Credits, Logo wall, About/CV, Contact form, Hire-me badge, Social links, Quote.

**Later blocks:** Video background, Audio, Fullscreen grid, Video gallery, Embed (generic).

Every block has an icon in `design/icons/` and a settings panel like the "Gallery settings" panel in `design/screens/product/Editor.dc.html`.

---

## Data model (Firestore, first draft; refine as needed)

```
users/{uid}                 email, displayName, locale, plan, createdAt
usernames/{username}        uid                      (uniqueness lock, reserved names pre-seeded)
sites/{siteId}              ownerUid, username, customDomain?, language (en|ar|both),
                            theme {preset, fonts, colors, radius, nav}, logo, favicon,
                            available {on, types[]}, password?, seo {title, desc, ogImage},
                            privacy {indexable, protectImages}, contact {email, whatsapp?, fields[]},
                            social[], gaId?, publishedVersion
sites/{siteId}/pages/{pageId}        title, slug, order, type, password?, blocks[] (draft)
sites/{siteId}/projects/{projectId}  title, slug, category, year, role, client, studio, team, tags,
                                      description, visibility (public|password|hidden), password?,
                                      coverMediaId, media[] (ordered), seo, ar {title, role, description}?
sites/{siteId}/media/{mediaId}       type, storagePath, variants{}, width, height, caption, alt, sizeBytes
sites/{siteId}/published/{version}   full snapshot used by the public renderer
messages/{id}               siteId, name, email, fields{}, body, read, createdAt
stats/{siteId_YYYYMMDD}     visitors, views, byProject{}, referrers{}, countries{}
subscriptions/{uid}         plan, cycle, status, paymobToken (reference only), renewsAt
domains/{hostname}          siteId, status, cloudflareId
```

---

## Phase 0 — Foundations

**Build**
- Repo, Next.js + TypeScript + Tailwind, ESLint/Prettier, Playwright.
- Load `config/plans.json` and `config/reserved-usernames.txt` as typed config.
- Tailwind theme generated from `design/tokens.json`.
- Load the fonts (Bricolage Grotesque, IBM Plex Sans, IBM Plex Sans Arabic, Marhey) with `next/font`.
- An `<Icon name>` component that loads `design/icons/*.svg`, with RTL mirroring for directional icons.
- Base UI kit matching `BRAND.md` §6 and `screens/product/Shapes.dc.html`:
  - Button (primary ink / lime / outline / ghost / icon);
  - Input, Select, Toggle, Checkbox, Radio, Segmented, Slider;
  - Badge, Pill, Card, Tile, Modal, Popover, Toast, Empty state.
- A `/kitchen-sink` page showing every component in EN and AR.
- Host-based routing skeleton for the three surfaces (CLAUDE.md), with placeholder pages.
- next-intl set up with `en` and `ar` message files.
- Firebase project wiring (emulators for local dev).
- Cloud Run deploy with GitHub Actions: staging and production.
- `docs/PROGRESS.md`.

**Done when:** Ahmed can open the staging URL, see the kitchen sink in English and Arabic, and every component matches the design files.

**Needs from Ahmed:** GitHub repo access, Google Cloud project + Firebase project, billing budget alert set (see AHMED-TODO).

---

## Phase 1 — Sign-up flow, accounts, dashboard shell

**Build**
- The 6-step sign-up flow exactly as in `docs/ONBOARDING.md` and `design/screens/product/Onboarding.dc.html`:
  - anonymous auth first, linked to the email (magic link) or Google account at the end;
  - live site preview;
  - discipline autocomplete (EN + AR);
  - 4 starter layouts generated from the answers;
  - username claim with live check against `config/reserved-usernames.txt`.
- The homepage claim box hands its username into step 1.
- Log in with a magic link or Google. Email verification comes with the magic link.
- First-run editor tips (3 max) and the "Get hired checklist" card on the dashboard.
- Dashboard shell matching `screens/product/Dashboard.dc.html`:
  - sidebar with icons, active lime tile, plan card, عربي switch;
  - "Your site" header, link card, Available-for-work toggle (saved), empty states for stats, messages and projects.
- Dashboard language switch EN/AR (RTL), remembered per user.

**Done when:** a new person goes from the homepage to their own starter site in about a minute without typing an email until the last step, can log back in on another device, toggle Available, and do it all in Arabic too.

---

## Phase 2 — Projects and media

**Build**
- Project editor matching `screens/product/Project.dc.html`:
  - **Uploads:** drag-and-drop with progress, multiple files, clear errors for wrong type or size. Size limits come from the plan config.
  - **Image pipeline:** a Cloud Function makes WebP/AVIF variants (400/800/1600/2560) and strips EXIF location data.
  - **GIFs and loops:** GIFs keep their animation; loops are MP4 ≤ 30s, muted, autoplay.
  - **Embeds:** YouTube/Vimeo links become embeds, with poster images fetched.
  - **PDFs:** stored, shown with a cover thumbnail and a download link.
  - **Items:** reorder, crop, set cover, caption, alt text, replace, delete.
  - **Credits:** all the credit fields.
  - **Visibility:** Public / Password / Hidden.
  - **Per project:** SEO title and description, and the slug.
  - **Arabic version:** an optional toggle for the AR fields.
- Projects grid on the dashboard with Live / Password / Draft / Hidden badges, plus "New project".
- Storage meter in the dashboard (calm wording; warn only at 80%+). Never shows the limit in marketing.
- Optional "mature work" flag per project (see `docs/CONTENT-POLICY.md`).

**Done when:** Ahmed can make a full project from his own work, including a GIF, a Vimeo reel and a PDF, on desktop and phone.

---

## Phase 3 — Site editor

**Build**
- The editor matching `screens/product/Editor.dc.html`:
  - **Top bar:** page selector, desktop/tablet/phone preview, undo/redo, saved state, Preview, Publish.
  - **Blocks tab:** search; groups (Layout / Galleries / Media / Get hired) with icons; drag in or click to add; reorder; duplicate; delete. Each block's settings open in the right panel.
  - **Style tab:** 6 presets (Gallery, Studio, Paper, Lime, Night, Sand), heading/body/Arabic fonts, background/text/accent colours, corner radius, 5 nav layouts, logo and favicon upload.
  - **Pages tab:** add, rename, reorder and delete pages. Types: Gallery, Custom, About/CV, External link. Password per page.
- The canvas shows the real site rendering (the same components as the public site), editable in place.
- Autosave the draft. Publish writes a snapshot and purges the cache. "Unpublished changes" indicator.
- Sensible starter site generated on sign-up (cover + grid + about + contact) so nobody starts on a blank page.

**Done when:** Ahmed can build his full portfolio in the editor, preview it on phone size, publish, and edit again without the live site changing until he publishes.

---

## Phase 4 — Public artist sites

**Build**
- **Routing:** the renderer for `username.fannan.net` (and later custom domains) reads the published snapshot only.
- **Blocks:** all launch blocks, rendered responsive, plus a lightbox with keyboard and swipe, and hover-play for loops.
- **Available badge:** when it's on, the site shows the badge and a "Hire me" button that opens the contact form.
- **Contact form:** saves to `messages`, emails the artist (transactional email provider), and has spam protection (honeypot + rate limit + Cloudflare Turnstile).
- **Language:** EN, AR (full RTL) or both, with a language switch. Untranslated projects fall back to English.
- **Password protection:** password pages and sites behind a server-side gate with a signed cookie, and signed media URLs.
- **SEO:** per-page meta, Open Graph image (auto-generated from the cover if none is set), `sitemap.xml`, `robots.txt` that respects "don't index", and structured data (Person / CreativeWork).
- **Free-plan footer credit:** "Made with Fannan" linking to fannan.net.
- **Image protection:** the option from Settings.
- **Infrastructure:** wildcard `*.fannan.net` working with SSL (see "Hosting notes" below).

**Done when:**
- `ahmed.fannan.net` (or whatever he claims) loads fast on a phone.
- Lighthouse scores 90+ for performance, accessibility and SEO.
- The contact form reaches his email.
- Password projects can't be opened without the password, even by guessing image URLs.

---

## Phase 5 — Inbox, stats, settings

**Build**
- **Messages inbox:** list, read/unread, reply by email (mailto), and delete.
- **Stats** matching `screens/product/Stats.dc.html`:
  - privacy-friendly server-side counting (no cookies), with bots filtered;
  - visitors, views, average time, messages;
  - top projects, referrers and countries;
  - 7/30/90 day ranges.
- **Settings** matching `screens/product/Settings.dc.html`:
  - username change (with a redirect from the old one for 30 days);
  - privacy toggles, site password, contact routing and form fields, social links, CV upload;
  - site language, site title and description, share image, favicon;
  - Google Analytics ID and Meta Pixel ID;
  - export my site (zip of originals + JSON).
- **Account:** change email/password, delete account (with grace period).

**Done when:** every control on the Settings screen works and the stats move when Ahmed visits his own site from another device.

---

## Phase 6 — Pro (prepaid), payments, custom domains

**Build** (rules in `docs/PRICING.md`, numbers in `config/plans.json`)
- **Plans:** Free + Pro. Pro is bought for 3, 6 or 12 months in one payment, with no auto-renew. There's no Studio plan.
- **Currency by country:** `CF-IPCountry` = `EG` → EGP, everyone else → USD. It's shown on the pricing page, in Settings → Plan & billing (matching the screen) and at checkout.
- **Paymob:**
  - one-time card payments (plus the wallets and Fawry options Paymob offers in Egypt, if Ahmed's account has them);
  - webhooks with verified signatures; the order records the currency, amount, exchange rate (for USD) and months bought;
  - receipt email.
- **Pro period:**
  - `proUntil` date on the user; buying again stacks after the current end;
  - reminder emails and a dashboard banner at 14 days, 3 days and 0 days;
  - 7-day grace, then the move to Free as described in PRICING.md: hide, never delete.
- **Limit-reached prompts:** "You've used 8 of 8 projects. Go Pro from 112 EGP a month" (in the right currency).
- **Custom domains (Pro):**
  - the artist enters a domain, sees the exact DNS records, and status updates live (Waiting → Active);
  - SSL is automatic via Cloudflare for SaaS;
  - the subdomain redirects to the custom domain once it's active.
- **Admin page for Ahmed only:**
  - users, payments and revenue (EGP and USD shown separately);
  - give someone Pro for N months (beta artists, launch offer);
  - refunds; suspend a site; the reports queue.

**Done when:** Ahmed can buy 3 months of Pro in Paymob test mode from an Egyptian IP (EGP) and from a VPN abroad (USD), see the end date, get the reminder emails (time can be faked in staging), connect a test domain with SSL, and watch the site return to Free cleanly when the period ends.

---

## Phase 7 — Marketing site, legal, launch hardening

**Build**
- **Homepage** in EN and AR matching `screens/homepage/Home-EN.dc.html` and `Home-AR.dc.html`, with the claim box wired to sign-up.
- **Other pages:** Pricing, Examples (real sites from beta artists, with their permission), Help/FAQ, Terms, Privacy, Content policy, Contact.
- **"Report this site" link** on every artist site, going to the admin queue.
- **Production readiness:**
  - daily Firestore and Storage backups;
  - uptime monitoring and error tracking (e.g. Sentry);
  - budget alerts;
  - load test of the public renderer.
- **Accessibility pass:** keyboard, focus ring (2px ink + 4px lime), contrast, alt-text prompts.
- **Onboarding emails:** welcome, "your site is live", "you got your first message".

**Done when:** Ahmed signs off on the beta checklist and invites the first artists.

---

## Phase 8 — Editor 2.0 and every kind of artist (asked by Ahmed after phase 7)

Goal: Carbonmade's ease by default, Squarespace's freedom when you want it. Built and shipped in four steps, each one usable on its own:

- **8A · Every artist welcome:** disciplines for photography, design (graphic, brand, UI/UX, product, interior, fashion), architecture, fine art (painting, sculpture, calligraphy, ceramics), 3D and games, film and video, music and sound, writing, crafts, makeup, tattoo… in EN/AR with synonyms; suggestion chips across fields; starter sites and wording per field; project categories grouped by field; marketing copy that speaks to all of them.
- **8B · Drag, click, type:** pages panel with drag-to-reorder (and a gear for page settings); sections reordered by dragging on the page or in a zoomed-out "Reorder" view; click a section → a small toolbar on its edge (settings, add above/below, duplicate, delete); type directly on the page (floating text bar: style, bold, italic, link, colour, size, alignment; no letter-spacing for Arabic); blocks dragged in from a visual library with a "Drop here" line.
- **8C · Free-form sections:** a section where blocks (text, heading, image, button, video, loop, shape, line, quote, social, spacer) sit anywhere on a grid (24 columns on desktop, 8 on phones), with snapping and guides; 8 resize handles, rotate, opacity, bring to front / send back, fit to content; a separate phone layout (auto-stacked, then editable); section style (height, background colour/image, width, padding); an "Add section" gallery of ready layouts (intro, about, contact, portfolio, text + image…). Rendered as plain CSS grid, no JavaScript, logical start/end for RTL.
- **8D · Site styles:** font packs pairing Arabic and Latin faces, a 5-colour palette with light/dark section themes, button styles, spacing, gentle on-scroll animations, header editing in place (logo size, nav order by drag, social links).

**Done when:** an artist from any field gets a fitting starter; Ahmed can rearrange pages and sections only by dragging, edit every text on the page itself, and build a free-form section with rotated, overlapping images that looks right on desktop and phone, in English and Arabic.

---

## Phase 9+ — After launch (in rough order)

1. **WhatsApp alerts** for new messages (WhatsApp Business Cloud API; needs Meta business verification and an approved message template).
2. **ArtStation / Behance import.** Neither offers an open public API for this as far as we know. Research what's allowed first. Fallback: a fast bulk-upload flow.
3. **Fannan search:** an opt-in directory where studios search artists by discipline, city and availability. Mature-flagged work is excluded by default.
4. **Bulk "culling" flow:** drop a whole folder, quickly sort it into projects, press Finished.
5. **Remaining blocks:** Video background (YouTube/Vimeo or a short loop), Audio, Fullscreen grid, Video gallery, generic Embed.
6. **Recurring billing,** if Paymob launches subscriptions.

Decided **not** to do: video hosting, and a Studio plan (for now).

---

## Hosting notes for the wildcard and custom domains

Recommended setup; confirm against current docs before building:
- fannan.net DNS on **Cloudflare**, proxied. A proxied wildcard record `*.fannan.net` sends all artist subdomains to the app. Cloudflare's edge certificate covers one level of subdomain.
- The origin is a **Google Cloud external Application Load Balancer** (static IP) with a serverless NEG pointing to the Cloud Run service. Use this because Cloud Run's own domain mapping doesn't handle wildcards or thousands of domains well, and the load balancer accepts any `Host` header. Use Certificate Manager (DNS-authorised wildcard cert) or a Cloudflare Origin CA cert for the origin.
- **Custom domains:** Cloudflare for SaaS custom hostnames, with the fallback origin set to the load balancer. On current Cloudflare plans, the first 100 custom hostnames are included and each extra one is $0.10/month.
- If there's a simpler setup that meets these requirements, propose it to Ahmed with the trade-offs before switching.

## Decisions (made by Ahmed, Oct 2026)

- **Sign-up:** Carbonmade-style flow (`docs/ONBOARDING.md`).
- **Reserved usernames:** `config/reserved-usernames.txt`.
- **Content:** artistic nudity is allowed, pornography is not, and the standard rules apply (`docs/CONTENT-POLICY.md`).
- **Payments:** prepaid Pro for 3, 6 or 12 months (no recurring), EGP in Egypt and USD elsewhere (`docs/PRICING.md`).
- **Storage:** never advertised; shown only as a meter in the dashboard.
- **Video:** YouTube/Vimeo links plus short loops only.
- **Studio plan:** skipped for now.

Still open:
- Whether Paymob can charge USD directly on Ahmed's account.
- The launch offer.
- The final vector logo.
