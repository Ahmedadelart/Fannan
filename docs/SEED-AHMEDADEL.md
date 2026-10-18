# Task: rebuild ahmedadel.art as an editable Fannan site

**When:** after Phase 4 (the public artist sites work). It's a good first real test of the whole product. Connecting the custom domain waits for Phase 6.

**Goal:** Ahmed's full portfolio (every page of his current Squarespace site) lives on Fannan under his account **adel4art@gmail.com**, looks like the round-two designs, and **every word, image, section and colour can be changed by Ahmed in the Fannan editor**.

## Inputs

| What | Where |
|---|---|
| All images, GIFs, videos and logos | Ahmed's folder `C:\Users\PC\Downloads\ahmedadel.art-assets` (= `ASSETS_ROOT`). Ask Ahmed to copy it next to the repo if the path differs. |
| What goes on which page, his own words, roles, credits | `seed/ahmedadel/site-content.json` |
| How it should look | `design/screens/ahmed-site/` (Home, Project page, About). Images there are `/_blob/<id>` links; `blob-map.json` maps them to the real files. |
| How his old site was organised (for checking) | the `screencapture-ahmedadel-art-*.pdf` files in `ASSETS_ROOT` |
| His CVs | the PDFs in `ASSETS_ROOT`. Use them only for facts like dates. **Never use CV wording on the site**; use his own words from `site-content.json`. |

## The one rule that matters

**No special code for Ahmed's site.** It must be built only from things every Fannan user has: the same blocks, the same theme settings, the same project records, the same upload pipeline. Write a **seed script** that uses the same functions the editor uses (create site → upload media → create projects → create pages → add blocks → publish). If you can't express something with existing blocks, **add or extend a block in the block library**, with its settings panel and icon, so any artist can use it. Then use it.

Blocks and options this site needs that may not exist yet (build them properly):
1. **Gallery → "Justified rows" layout.** Every image keeps its real shape and each row shares one height. Used for commercial work. Also add a **"Keep real shape / crop to …" option** on every gallery and project grid.
2. **Project grid** that pulls projects by group/tag, with captions: title · network or client · role · studio, and an "accent the role" option.
3. **Split project grid: posters row + landscape row** (or make the project grid smart enough to group by shape).
4. **Section header** with an optional number ("01"), subtitle, logo and badge ("Directed by me").
5. **Logo wall** with colour band, logo tint (white/original) and one-row mode.
6. **Project feature** (one project shown inline with video, logos, role, words, laurels and tools), used on the 2D Animation page.
7. **Category tiles** (image tiles linking to pages).
8. **Contact form with an illustration** beside it.
9. **Laurels row** (festival laurel images) and **Credits / Special thanks / Tools** lists on project pages.
10. **Theme preset "Studio Orange"**, saved as a preset other users can pick.

## Steps

1. **Account.** Find or create the user `adel4art@gmail.com` (Firebase Auth; he signs in with a magic link, so no password is needed). Claim username `ahmedadel`. Give him Pro for 12 months via the admin tool. Don't send him emails yet.
2. **Media.**
   - Upload every file `site-content.json` references through the normal pipeline (resized variants, alt text = project title).
   - **GIFs become muted looping MP4s.**
   - Keep the originals' real aspect ratios and record them on the media item.
   - Name logos by their real brand. Two network logo files are misnamed: `004_MBC-ACADEMY…png` is OSN+ and `006_Layer 023.png` is MBC Academy.
3. **Videos.** Fannan doesn't host long videos.
   - Ahmed uploads the 10 MP4s in `_videos/` to his Vimeo or YouTube (see AHMED-TODO) and gives you the links. Use those as embeds.
   - Until then, show the poster image with a "Video coming soon" note **only in draft**.
   - The old `video-links.txt` points to Squarespace's video CDN. Don't use it; it will stop working when Squarespace is cancelled.
4. **Projects.** Create every project in `site-content.json` with all its fields.
   - Projects in group `needs-role` → **hidden drafts** in a "Needs role" list on his dashboard, so he can sort them himself.
   - **Never write "Director" on work he didn't direct.** Big Cat projects = Director. Commercial at other studios = his actual role + studio.
5. **Pages.** Build Home, Character Design, Illustration, 2D Animation, Storyboard, About and Contact, block by block as listed, plus a project page for each project with words or a gallery (template in `project_page_template`). Navigation is Broadcast · Directing · Big Cat · Commercial · Portfolio ▾ (Character Design, Illustration, 2D Animation, Storyboard) · About · Contact.
6. **Theme.** Apply "Studio Orange" (values in `site-content.json`). Fonts: Rubik. Logo image: `_site/logo.png`. Share image: `_site/social-share-image.jpeg`.
7. **Check against the designs.** Compare Home, a project page and About with `design/screens/ahmed-site/` at desktop and phone width.
   - Posters must stay posters and landscape images must stay landscape. Nothing important cropped.
   - Fix differences by improving blocks, not by hard-coding.
8. **Publish to `ahmedadel.fannan.net`** and send Ahmed the link with a short list of:
   - anything still in [brackets];
   - the "Needs role" projects;
   - missing video links.
9. **Custom domain: only when Ahmed says the new site is ready.** Connect `ahmedadel.art` via Settings → Domain (Pro). Give him the exact DNS records to change at his domain registrar, and remind him to cancel Squarespace *after* the domain works on Fannan.

## Done when

- Ahmed logs in with adel4art@gmail.com, opens the editor, and can change any text, image, order, colour or font on every page without help.
- All seven pages and every project page are live at `ahmedadel.fannan.net`, matching the reference designs on desktop and phone.
- Nothing is hard-coded for this one site. The new blocks and the "Studio Orange" preset are available to every user.
- Lighthouse on the home page: Performance, Accessibility and SEO are all 90 or above.
