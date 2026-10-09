# Sign-up and first-run flow (Carbonmade-style)

Reference screen: `design/screens/product/Onboarding.dc.html`. It's interactive in the design file: click the dots or the Next buttons.

The goal is to get a new visitor to **"that's my site"** in about a minute, asking for as little as possible, and to ask for their email **last**, once they have something to lose. This follows Carbonmade's flow (name → what you do → a short "building" moment → pick a layout → save with email and a magic link → guided editor). Fannan adds one step: claiming the subdomain.

## Before an account exists

- Start with **Firebase anonymous auth** the moment someone begins. Everything they choose is saved against that anonymous user.
- In step 6, **link** the anonymous user to their email or Google account. Never lose the progress.
- If they leave and come back on the same browser, resume where they stopped.
- Anonymous drafts with no email are deleted after 7 days.

## The steps

| # | Screen | What happens | Notes |
|---|---|---|---|
| 1 | **"Let's build your portfolio. What's your name?"** | One field. If they came from the homepage claim box, the username they typed is already reserved for 30 minutes. | Under the button: "No email, no password, no card yet." |
| 2 | **"Nice to meet you, {first name}. What do you do?"** | Autocomplete over ~60 disciplines (EN + AR synonyms, e.g. "انيميتور" → 2D Animator), plus quick-pick chips. Free text allowed. | The discipline decides the layouts, the sample blocks and the wording in step 4. |
| 3 | **"Setting up a portfolio for a {discipline}…"** | A 2.5–3 second loader with three checklist lines that tick off, e.g. "Putting your name on it", "Giving your reel the top spot" (animators), "Making room for your credits". | The pause is deliberate (it makes the result feel made for them), but the work is real: the starter sites are generated here. |
| 4 | **"Pick a starting point, {first name}."** | 4 layout cards with live mini-previews **using their name as the logo**, and discipline-specific sample art and blocks. Each card has a casual "I choose you" pick. Main button: "Customize this one". | Reassure: "Nothing here is final." Layouts: **The Reel** (animators/motion; reel block first), **The Grid**, **The Storyteller** (case studies; directors/leads), **The Minimalist**. For non-animators, The Reel becomes **The Showcase**. |
| 5 | **"Where should studios find you?"** | Username input shown as `[ name ].fannan.net`, pre-filled from their name. Live availability check (debounced). 3 suggestions. | Rules from CLAUDE.md, plus `config/reserved-usernames.txt`. Friendly error text, never "invalid". |
| 6 | **"Don't lose your progress."** | Email field → magic link (Firebase email-link sign-in), or "Continue with Google". One quote from a beta artist (placeholder until beta). Small print: Terms + Content policy, "Free forever plan: no card needed." | After sending the link, show "Check your email" and let them **keep editing** meanwhile. |

**Right side of every step:** a live preview of their site that updates with each answer (name → logo, discipline → subtitle, layout → look, username → address bar). Use the real renderer at small scale, not a picture. On phones the preview collapses to a small card above the question.

## Then: the guided setup, or straight to the editor (round 8)

Right after step 6, one screen asks how to start:
- **"Guide me" (about 10 minutes):** questions one at a time, each with a visual example, beside a live preview of the site being built. What you do → your name (font or logo) → the look → pages (drag, rename, dropdowns) → projects (cover, card size, card text, in the menu) → pictures and parts inside each project → page by page (starting section, pictures, project cards, extra sections as checkboxes) → review and build. Calm steps: a progress bar, Back / Next / Skip, no points or celebrations (Ahmed's choice). Answers are saved after each step.
- **"I'll design it myself":** the editor with the starter site, as before.

The guide can be run again from Home. It backs up the current pages first, and Home offers to bring them back for 30 days.

## First time in the editor (guided tips)

Dim the rest of the interface and show **at most 3 tips**, one at a time, each pointing at the real control:
1. "Everything on your site is a **block**. Add one from here." (Blocks panel)
2. "**Drag** blocks to reorder. Click one to change it." (canvas)
3. "When you're happy, **Publish**. Until then, only you can see it." (Publish button)

Then a dismissible **"Get hired checklist"** card on the dashboard: Add your first project · Write your About · Turn on Available for work · Publish your site · Share your link. Each ticks off automatically.

## Differences from Carbonmade (on purpose)

- **Publishing is free.** Carbonmade is free only until you launch; Fannan's Free plan publishes. This is our hook, so say it often.
- The **username step** exists because Fannan sites live on subdomains.
- Everything works in **Arabic** (RTL) from step 1. Detect the browser language, with a switch in the header.

## Measure it

Log each step's view and completion (anonymous, no personal data) so Ahmed can see where people drop off: step reached, time per step, layout chosen, discipline chosen, email vs Google.
