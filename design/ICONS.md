# Icons

Fannan's interface icons, **direction C · Swiss**. They're quiet and tool-like, so the artist's work stays the loudest thing on screen.

## Drawing rules
- 24 × 24 grid with ~2px of padding. Draw on whole and half pixels.
- Stroke **1.5**, **square ends**, **mitred joins**. Corners are sharp, except shapes that are round by nature (pills, circles).
- No fills, except small solid dots (drag handle, slider dot). Knock-out circles over lines are filled `paper`.
- One colour: `ink` (#141414) by default, `muted` (#6A6A70) for inactive or secondary, white on ink buttons. Never lime as a stroke colour.

## States
- **Active / selected:** a `lime` tile behind the icon (4px padding, `radius-sm` 6px). The icon stays ink.
- **Hover:** a `mist` tile behind the icon.
- **Inside buttons:** the icon follows the text colour and sits 8px before the label.

## Sizes
16 (inline, chips) · 18 (buttons) · 20 (sidebar, toolbar) · 24 (block tiles) · 40 (empty states, on a lime tile).

## Arabic (RTL)
Mirror icons that show direction: undo/redo, arrows, chevrons, the "publish" plane. Don't mirror objects (image, reel, lock, globe).

## The set
60 icons in `icons/*.svg` (they use `currentColor`):
- **Layout:** fullscreen cover, text, columns, hero headline, shape, line, button
- **Galleries:** grid, masonry, slider, lightbox, video gallery, fullscreen grid
- **Media:** image, video 4K, video background, loop/GIF, before/after, audio, PDF, embed
- **Get hired:** reel, credits, logo wall, about/CV, contact form, hire-me badge, social links, quote
- **App:** dashboard, site editor, projects, stats, settings, messages, notifications, upload, publish, preview, hidden, password, desktop, tablet, mobile, undo, redo, search, add, drag, duplicate, reorder, bring front, send back, delete, crop, cover, link, language, email, chat alert

Every new editor block needs an icon from this set, or a new one drawn to these rules, before it ships.
