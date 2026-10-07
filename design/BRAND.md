# Fannan

**Fannan (فنان) is the portfolio builder for Arab artists — the place where work finds you.**
One accent on white: a lime highlighter stroke that says *you're the one who got picked*.

- English line: **Your next job is looking for you.** · secondary: **Let the work find you.**
- Arabic line: **خلّي الفرص تلاقيك.** · secondary: **شغلانتك الجاية بتدوّر عليك.**
- Domain: **fannan.net** — every artist lives at their own subdomain, `name.fannan.net` (always lowercase; letters, numbers and hyphens).

---

## 1. The logo

The logo is the word **fannan.net** set in **Bricolage Grotesque ExtraBold (800)**, ink `ink` on `paper`, with a **lime chisel stroke** (`lime`) behind **"fannan"** only. ".net" stays plain ink.

The Arabic logo is **فنان** in **Marhey Bold (700)** with the same stroke, mirrored (it leans the other way, following the reading direction).

| Version | Use |
| --- | --- |
| **Primary — fannan.net** | Website header, decks, anything where the URL matters. |
| **Short — fannan** | Tight spaces (social bios, merch). Same stroke, no ".net". |
| **Arabic — فنان** | Arabic pages, posts and print. Used on its own, never squeezed next to the English in one line. |
| **Bilingual stack** | فنان above, fannan.net below, centred. For covers and launch posts. |
| **On lime** | When the ground must be lime: ink text, **white** stroke. |

### The stroke (keep it identical everywhere)

- Shape: a flat bar, **skewed `hl-skew` (-14°)** and **tilted `hl-rotate` (-1.5°)** — the cut of a real chisel-tip marker.
- Position: from **`hl-top` (44%)** to **`hl-bottom` (6% above the bottom)** of the word box — it covers the lower half of the letters.
- Length: starts **`hl-overhang`** before the first letter, ends just after the last.
- Arabic: mirror the skew and tilt (+14°, +1.5°).

### Clear space and minimum size

- **Clear space:** keep empty space around the logo equal to the **height of the stroke** on every side.
- **Minimum size:** wordmark **96px wide** on screen, **25mm** in print. Below that, use the app icon.

### Don't

- Don't put the stroke behind ".net", or behind the whole URL.
- Don't recolour the stroke (no blue — it reads as Facebook), don't use gradients or shadows.
- Don't set the logo on `ink` or on photos: the lower half of the letters sits on the stroke and the top half disappears. Use the **on-lime** version or a white panel.
- Don't use lime for text on white — use `lime-ink` if green text is unavoidable.
- Don't stretch, outline or re-space the letters.

---

## 2. App icons

| Icon | Ground | Mark |
| --- | --- | --- |
| **f** | `paper` with a `line` outline | Bricolage "f" in `ink`, lime stroke **centred vertically behind the letter** |
| **ف** | `lime` | Marhey "ف" in `ink`, no stroke |

Corner radius ≈ 24% of the icon size (`radius-lg` at 84–92px). Use **ف** for the Arabic app and the favicon in Arabic; **f** for English surfaces.

---

## 3. Colour

One accent, used sparingly. The page is white; lime appears as the stroke, the icon and big brand moments.

| Token | Value | Role |
| --- | --- | --- |
| `lime` | #C6F432 | The brand. Behind ink only. |
| `ink` | #141414 | Text and the wordmark. |
| `paper` | #FFFFFF | Default ground. |
| `mist` | #F4F4F2 | Quiet surfaces. |
| `line` | #E2E2DE | Hairlines. |
| `muted` | #6A6A70 | Secondary text. |
| `lime-ink` | #4A6400 | Green as text, only when needed. |

Rough balance on any page: **80% paper/mist, 15% ink, 5% lime.**

---

## 4. Type

- **Bricolage Grotesque** (`display`) — logo, headlines, titles. Heavy (800), tight (-0.02em).
- **Marhey** (`arabic`) — the Arabic logo and Arabic headlines.
- **IBM Plex Sans / IBM Plex Sans Arabic** (`body`) — all body text, UI, labels, in both languages.

All three are free on Google Fonts. Arabic and English are never mixed in the same line of a headline.

---

## 5. Voice

Short, warm, direct — like a colleague who has been in the industry a few years longer than you. We talk about **getting work**, not about websites.

- Say: *Your next job is looking for you.* · *Claim your name before someone else does.* · *Clear credits studios trust.*
- Don't say: *Powerful website builder.* · *Unleash your creativity.* · *Next-generation platform.*
- Egyptian-friendly Arabic in marketing (خلّي، بتدوّر، شغلانتك); clean Modern Standard Arabic in the product UI.

---

## 6. Interface: icons and shapes

- **Icons:** direction C · Swiss: 24px grid, 1.5 stroke, square ends, ink only. See the Icons component. Lime appears **behind** an icon only when it's active.
- **Corners:** `radius-sm` 6px for badges, tags and checkboxes · 12px for buttons, inputs, tiles and thumbnails · `radius-lg` 22px for cards, panels and modals · 999px for pills, chips and toggles.
- **Buttons:** ink = the main action (one per view) · lime = upload, upgrade and hire actions · outline = secondary · ghost = inside panels. Heights 32 / 40 / 44.
- **Status:** Live (white + green dot) · Password (ink) · Draft (lime) · Hidden (mist). The **Available for work** pill is always lime.
- **Surfaces:** the app chrome is flat `mist`; cards are white with a 1px `line`. Only floating things (popovers, menus) get a shadow. Nothing sits on top of artwork thumbnails.
- **Focus:** a 2px ink outline plus a 4px lime ring.

---

## Status

This is the **first brand sheet** for direction C2 (lime chisel). The logo is still built from live fonts: before launch, have the final mark **drawn as vector** (stroke shape, the "f", the فنان spacing) so Fannan owns it outright.
