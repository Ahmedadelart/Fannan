# Fannan — project rules for Claude Code

Fannan (fannan.net, Arabic فنان) is a portfolio builder for Arab artists: animators, character designers, storyboard artists, illustrators and comic artists. It competes with Carbonmade and Squarespace on ease of use and price. The promise is **"Your next job is looking for you."** Every feature should help an artist get hired.

The full build plan is in `docs/PLAN.md`. Work through it **one phase at a time**.

Other docs:
- `docs/ONBOARDING.md`: the sign-up flow
- `docs/PRICING.md` and `config/plans.json`: plans, prices and limits
- `docs/CONTENT-POLICY.md`: the content rules
- `config/reserved-usernames.txt`: names nobody can claim

## Who you're working with

Ahmed is the founder. He's an animation director, **not a developer**.
- Explain what you did and what he needs to do in plain language. Skip jargon, or explain it in one short sentence.
- When you need something from him (an account, a key, a decision), say exactly where to click and what to paste back. Never ask him to edit code.
- At the end of every phase, stop and give him:
  1. what now works,
  2. how to test it himself, with a link and steps,
  3. what you need from him before the next phase.
- Keep `docs/PROGRESS.md` up to date: done, in progress, blocked on Ahmed, known issues.

## Stack (decided; don't swap without asking)

- **Next.js** (App Router, TypeScript), deployed to **Google Cloud Run**. Ahmed's Google Cloud and billing are under contact@bigcatanimation.com.
- **Firebase**: Auth (email + Google sign-in), Firestore (data), Cloud Storage (media), Cloud Functions (image processing, webhooks).
- **Cloudflare** in front: DNS for fannan.net, wildcard `*.fannan.net`, edge caching, and Cloudflare for SaaS for artists' own domains.
- **Paymob** for payments: **one-time payments** for prepaid Pro (3, 6 or 12 months). Paymob has no recurring subscriptions, so nothing auto-renews. See `docs/PRICING.md`.
- **Tailwind CSS**, configured from `design/tokens.json`. No component library that brings its own look.
- **next-intl** for English/Arabic, with full RTL support.

## Three surfaces, one app

| Host | What it is |
|---|---|
| `fannan.net` | Marketing site (English default, Arabic at `/ar`) |
| `app.fannan.net` | Dashboard, site editor, project editor, stats, settings, billing |
| `{username}.fannan.net` and custom domains | Public artist sites |

Route by the `Host` header in middleware. Artist sites must never share cookies with `app.fannan.net`.

## Design rules

The source of truth is the `design/` folder:
- `tokens.json`: colours, fonts, radii, spacing
- `BRAND.md`: the brand book, including the logo, the lime stroke and interface shapes
- `ICONS.md` and `icons/*.svg`: the icon set
- `screens/`: reference screens

The screens are `.dc.html` files from Ahmed's design tool:
- Inline styles give exact sizes and colours.
- `{{holes}}` are template slots; their data is in the `<script>` at the bottom of each file.
- Treat them as the visual spec. Don't copy their markup structure.

Non-negotiables:
- **System:** Material 3 (Google), seeded from Fannan lime. Decided by Ahmed on 9 Oct 2026 ("full Google look"). Colour roles, shapes and type are in `design/tokens.json`.
- **Colours:**
  - lime `#C6F432` is the primary container and only sits **behind** dark text (`on-lime` `#141F00`), never as text or thin lines;
  - primary `#4C6700` (olive) for filled buttons, links and selected controls;
  - ink `#1A1C16` (on-surface) for text and icons;
  - surfaces are soft tinted tones: surface `#FAFAF2`, mist `#F0F1E7`, white cards;
  - the editor's panels use the M3 dark scheme from the same seed.
  - **No blue anywhere.**
- **Type:** Google Sans Flex (OFL) for UI and headings (600). IBM Plex Sans Arabic for Arabic text and headings. The logo keeps Bricolage Grotesque 800 and Marhey 700.
- **Icons:** use only the SVGs in `design/icons/` (style "C · Swiss": 1.5 stroke, square ends, `currentColor`). An active item gets a lime tile behind its icon. Any new icon must follow `ICONS.md`.
- **Corners (M3 shape scale):** 8px for chips and badges, 12–16px for inputs and menus, 28px for cards and dialogs, fully round for buttons, toggles and navigation pills.
- **Shadows:** M3 elevation. Floating things (menus, popovers, dialogs) get level 3; filled buttons lift slightly on hover. Cards are flat or outlined.
- **The logo stroke:** `skewX(-14deg) rotate(-1.5deg)`, from 44% down to 6% above the bottom of the word box, overhanging -0.18em left and -0.09em right. In Arabic it's mirrored.
- **RTL:** use CSS logical properties (`margin-inline-start` and so on). Mirror directional icons (undo/redo, arrows, the publish plane), not object icons.
- Artist sites use the artist's chosen theme, not Fannan's brand. Fannan branding only appears as a small footer credit on the Free plan.

## Engineering rules

- **Draft vs published.** Editing never changes the live site. "Publish" writes an immutable snapshot that the public renderer reads in one document read, then purges the edge cache.
- **Public pages are server-rendered and fast:**
  - real `<title>` and description tags, Open Graph images, `sitemap.xml` and `robots.txt` per artist site;
  - Lighthouse 90+ on mobile.
- **Images:** never serve originals. On upload, generate WebP/AVIF in several widths (400, 800, 1600, 2560) and serve the right size with `srcset`.
- **Password-protected projects and sites** are checked on the server. Their media is served through short-lived signed URLs, never public URLs.
- **Usernames:**
  - lowercase a–z, 0–9 and hyphens, 3–30 characters;
  - must start with a letter;
  - checked against `config/reserved-usernames.txt` and an offensive-words list.
- **Security:**
  - Firestore and Storage security rules from day one;
  - rate-limit sign-up, contact forms and uploads;
  - sanitise all user text.
  - No custom code injection on Free.
- **Secrets** live in Google Secret Manager or environment variables, never in the repo.
- **Testing:** Playwright end-to-end tests for each phase's main flow, in English and Arabic, on desktop and mobile widths.
- **Prices and limits** come from `config/plans.json`, never hard-coded across the app. Never show the Free storage number in marketing; it only appears as a usage meter in the dashboard.
- Keep it simple. Pick the boring, well-documented option. If a service's docs have changed since this plan was written, follow the current docs and tell Ahmed.

## Working notes (for Claude Code)

@AGENTS.md

- Commands: `npm run dev` (local: http://localhost:3000 with a surface switcher, or `fannan.localhost:3000`, `app.fannan.localhost:3000`, `{name}.fannan.localhost:3000`), `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run emulators`.
- Never edit `*.generated.*` files; change `design/` or `config/` and run `npm run generate`.
- Surface routing lives in `src/proxy.ts`; pages live under `src/app/[locale]/{marketing,app,site/[username]}`.
- UI strings go in `messages/en.json` and `messages/ar.json`, never inline.
- Status, decisions and known issues: `docs/PROGRESS.md`.
