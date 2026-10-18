# Rebuilding ahmedadel.art on Fannan: build plan

Source task: `docs/SEED-AHMEDADEL.md`. Content: `seed/ahmedadel/site-content.json`. Look: `design/screens/ahmed-site/`.

**Rule:** nothing special for one site. Everything below is a normal feature every artist gets, and Ahmed's site is built only by a seed script that calls the same functions the editor uses.

**Content rule:** the reference designs show some numbers that aren't Ahmed's own words (for example "0 missed deadlines" and "150+ students"). We follow the designs for the look and `site-content.json` for the words, and invent nothing.

## Phase A: blocks and options for every artist
1. **Project grid upgrades** (the gallery block):
   - source by **tag** (e.g. broadcast, bigcat) as well as category;
   - caption lines chosen per grid: title, network/client, role, studio, plus **"accent the role"**;
   - **"Group by shape"**: posters in one row, landscape in the next, each with its own column count, so nothing is cropped into the wrong shape;
   - the justified "Rows" layout uses each cover's real shape, for pictures and loops alike;
   - "Keep real shape / crop to…" on every grid (the existing shape setting, with "Real shape" first).
2. **Section header** block: number ("01"), title, subtitle, logo, badge ("Directed by me"), an anchor name for menu links (`/#broadcast`), and a divider line.
3. **Logo wall** upgrades: colour band, logo tint (white / original), one-row mode.
4. **Project feature** block: one project shown inline with its video, logos, role, words, laurels and tools, all read from the project record.
5. **Category tiles**: a cards variant with image tiles, a title over each, linking to a page.
6. **Contact with an illustration**: an optional picture beside the contact form.
7. **Project pages**: new project fields everyone can fill in the project editor: network, details (label/value rows such as Episodes, Dates), credits, special thanks, tools, festival laurels, header logos. The project page shows them: back link, title and line, role pill, meta row, video or hero, words, gallery, credits/thanks/tools/laurels, next project.
8. **Theme preset "Studio Orange"** (white, ink #111111, orange #FF5A1F, Rubik). Plus, for every theme, an automatic **"accent for text"** shade that is dark enough to read on the background (#C93F0E for this orange).
9. **GIFs become muted looping MP4s** in the media pipeline (smaller and smoother than animated WebP), with their real aspect ratio recorded.
10. **"Needs role" list** on the dashboard: hidden projects tagged needs-role, to sort by hand.
11. **Video coming soon**: a project whose video link is empty shows its poster with that note **in the editor only**.

## Phase B: the seed script
`scripts/seed-site.ts`, reading `site-content.json` and the assets folder. It calls the server functions: create account and site, upload media (normal pipeline), create projects, build pages and blocks, apply the theme, publish. It's run first against the local emulators and checked against the designs at desktop and phone widths, with screenshots.

## Phase C: production
Ahmed's account (adel4art@gmail.com, username ahmedadel), 12 months of Pro through the admin tool, no emails, then the seed and publish to ahmedadel.fannan.net. Then a list goes to Ahmed covering:
- anything still in [brackets];
- the "Needs role" projects;
- missing video links.

The domain waits for his go-ahead.

## Waiting on Ahmed
- Vimeo/YouTube links for the 10 videos in `_videos/`, plus the Big Cat 2025 showreel link.
- Social profile links for the footer.
- Which CV PDF to put behind "View resume".
- The short lines for the three community cards on About.
- Roles for the six "Needs role" projects.
