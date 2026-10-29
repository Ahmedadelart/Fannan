# fannan.net — the marketing site's design language (round 20, 29 Oct 2026)

Ahmed asked for a full makeover of fannan.net, heavily inspired by Talabat's corporate site
(corporate.talabat.com, 29 Oct 2026 captures), keeping Fannan's own colours. This file is the
mapping: what Talabat does, and what Fannan does in its place. The app (app.fannan.net) and the
artists' sites are untouched; only the marketing surface uses this.

## 1. What Talabat does (measured on the live site)

| Element         | Talabat                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type            | TT Commons Pro (commercial): 400 body, 700 titles, 900 display. No letter-spacing tricks.                                                                                                                                                                                                                                                                                                                                                                     |
| Sizes           | h1 56/48 (900), display h2 60/48 uppercase (900), section h2 32/35 (700), h3 22/33 (700), lead p 28/34, body 18/28, small 14/20                                                                                                                                                                                                                                                                                                                               |
| Page            | cream `#F4EDE3` page, orange `#F55905` bands and tiles, deep plum `#411517` for text and dark buttons, lime `#CFFF00` for highlights and the main button, sand `#E8DED2` footer                                                                                                                                                                                                                                                                               |
| Width           | 1280 px content column, 24 px gutters, 80 px section padding (40 on phones)                                                                                                                                                                                                                                                                                                                                                                                   |
| Buttons         | pills, 18/700, 10×24 padding, 56 px tall (48 small). Lime = the one action; plum = secondary; white = on a band                                                                                                                                                                                                                                                                                                                                               |
| Corners         | 40 px on photos and tiles (24 on phones), pills everywhere else, 24 px on small cards                                                                                                                                                                                                                                                                                                                                                                         |
| Devices         | the **marker**: a dark skewed box with lime words inside the headline · the **squiggle**: a 16 px orange ribbon running behind an uppercase display heading · **sticker photos**: a photo cut in a soft irregular shape with a thick dark outline, tilted · **wavy edges** on bands and on the dark half of cards · a **hand-drawn circle** around one word in the CTA card · **sticker badges** ("Press Release") in lime pills · a dashed **timeline** line |
| Sections (home) | header on the band → hero (words left, sticker photo right, lime button) → 4 icons row → squiggle display heading → photo + numbers → timeline → two-column intro → photo pair → news band (cards carousel) → text + sticker photo → about two-column → CTA card → footer                                                                                                                                                                                     |
| Footer          | logo sticker, round social buttons, "Inquiries" with arrows to emails, two link columns, app badges, language pill, hairline, copyright                                                                                                                                                                                                                                                                                                                       |

## 2. What Fannan does instead (same language, our colours)

| Role                                | Talabat                         | Fannan                                                                                                         |
| ----------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Band / dominant colour              | orange                          | **ink** `#1A1C16`                                                                                              |
| Dark text and secondary buttons     | plum                            | **ink**                                                                                                        |
| Page                                | cream                           | **surface** `#FAFAF2`                                                                                          |
| Footer / tinted blocks              | sand                            | **mist** `#F0F1E7`, **surface-high** `#E8E9DF`                                                                 |
| Highlight, main button, badges      | lime `#CFFF00`                  | **lime** `#C6F432`, always behind dark text (`on-lime`)                                                        |
| Tinted tiles (the lilac "Pro" tile) | lilac                           | **secondary-container** `#DEE6C8` (sage) and **tertiary-container** `#FFDBD0` (peach)                          |
| Marker                              | dark box, lime words            | **lime box, ink words** (lime never as text): the chisel cut of the brand stroke, `skewX(-6deg) rotate(-1deg)` |
| Squiggle                            | orange ribbon behind dark words | **lime ribbon** (16 px) behind ink words                                                                       |
| Hand-drawn circle                   | plum stroke                     | **paper** stroke on ink, **ink** stroke on cream                                                               |
| Sticker photo outline               | plum                            | **ink** on cream, **paper** on ink                                                                             |
| Logo on the band                    | white wordmark                  | the logo on a **paper sticker** (BRAND.md: never set the logo on ink)                                          |
| Display font                        | TT Commons Pro                  | **Outfit** (OFL, already shipped: `fn-outfit`) at 400 / 500 / 700 / 900                                        |
| Arabic                              | Talabat's Arabic cut            | **Cairo** (OFL, shipped: `fn-cairo`) at 400 / 700 / 900                                                        |
| Photos                              | lifestyle photography           | **real Fannan sites**, drawn by the site renderer, inside the same frames                                      |

Type scale (desktop → phone): display 72→44 (900, line 0.95, uppercase for the squiggle headings), h1 60→40 (900, 0.95), h2 36→28 (700, 1.1), h3 22 (700), lead 24→20 (400, 1.3), body 18 (400, 1.55), small 14.

Rules that stay: no blue; lime only behind dark text; icons from `design/icons`; RTL through logical properties (the marker and the squiggle mirror); strings in `messages/*.json`.

## 3. Pieces (`src/components/marketing/ui.tsx`)

`Band` (ink | surface | mist | lime, optional wavy top/bottom), `Wrap` (1280 column), `Pill` (lime | ink | paper | outline; md | sm), `Marker` (the lime box), `Squiggle` (the ribbon behind a display heading), `Sticker` (tilted frame with a thick outline), `Badge` (lime sticker pill), `Circled` (hand-drawn ring around a word), `Wave` (the uneven edge), `SectionHead` (h2 + lead in Talabat's two-column intro), `Social` (round buttons).

## 4. Pages

- **Home**: ink hero (headline with marker, claim box, a tilted sticker of a real site) → four facts with icons → squiggle display heading → "how it works" timeline (three steps, dashed line, site pictures) → features (pill tabs) → examples band (ink, wavy edges, cards with a wavy dark foot) → pricing tiles (cream / ink / sage) → CTA card (circled word, lime pill) → footer.
- **Inner pages** share the hero band (title + marker + lead) and the footer: pricing (tiles + comparison in a paper card + FAQ accordion), examples (card grid with lime badges), help (accordion in groups), contact (form in a paper card), legal (narrow column).
