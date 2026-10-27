// Round 13: per-word formatting (bold, italic, underline, links, colour, font) inside text fields.
// A field holds plain text, or a small piece of HTML built only from this allowlist:
//   <b> <i> <u> <br> <a href> <span style="color:#hex; font-family:fn-id">
// Everything is rebuilt from scratch by a tiny tokenizer: nothing from the input is passed through,
// so scripts, event handlers, other tags and odd links can't survive. It runs when a draft is saved
// and again when a page is drawn. Pure: safe on the server and in the browser.

import { FONTS } from "@/components/site/fonts";

/** Does this field hold formatting (as opposed to plain text)? */
export const isRich = (v: unknown): boolean => typeof v === "string" && /<(b|i|u|a|span)[\s>]/i.test(v);

const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "noscript",
  "textarea",
  "select",
  "svg",
  "math",
  "title",
  "head",
  "video",
  "audio",
  "canvas",
]);
const BLOCKS = new Set(["div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "tr"]);
const SIMPLE: Record<string, "b" | "i" | "u"> = { b: "b", strong: "b", i: "i", em: "i", u: "u" };
const MAX_DEPTH = 12;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6}|#39);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (ENTITIES[k] !== undefined) return ENTITIES[k];
    if (k.startsWith("#x")) return safeChar(parseInt(k.slice(2), 16), m);
    if (k.startsWith("#")) return safeChar(parseInt(k.slice(1), 10), m);
    return m;
  });
}
/** Plain text with any HTML entities read back ("&amp;" → "&"), for text that was escaped once too often. */
export const decodeEntities = (s: string): string => (s.includes("&") ? decode(s) : s);
const safeChar = (n: number, fallback: string) =>
  n > 0 && n < 0x110000 && !(n >= 0xd800 && n < 0xe000) ? String.fromCodePoint(n) : fallback;
const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

/** One attribute's value from a tag's attribute text. */
function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, "i").exec(attrs);
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? "") : null;
}

/** Links: web, email, phone, or this site's own pages. Never javascript:, data: and the like. */
export function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 500 || /[\s<>"'`\\]/.test(v)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  if (/^\/(?!\/)/.test(v) || v.startsWith("#")) return v;
  // "example.com" → https://example.com
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  return null;
}

function cssColor(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${[...s.slice(1)].map((c) => c + c).join("")}`;
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(s);
  if (m)
    return `#${m
      .slice(1, 4)
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0"))
      .join("")}`;
  return null;
}

/** A font from the registry, given as "fn-id", "'fn-id', sans-serif" or the bare id. */
function cssFont(v: string | null): string | null {
  if (!v) return null;
  const first = v
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");
  const id = first.startsWith("fn-") ? first.slice(3) : first;
  return FONTS[id] ? `fn-${id}` : null;
}

function styleOf(attrs: string, tag: string): string | null {
  const style = attr(attrs, "style") ?? "";
  const prop = (name: string) => {
    const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(style);
    return m ? m[1] : null;
  };
  const color = cssColor(prop("color") ?? (tag === "font" ? attr(attrs, "color") : null));
  const font = cssFont(prop("font-family") ?? (tag === "font" ? attr(attrs, "face") : null));
  const parts = [color && `color:${color}`, font && `font-family:${font}`].filter(Boolean);
  return parts.length ? parts.join(";") : null;
}

type Open = { out: string; close: string; src: string };

/**
 * Clean a field. Formatting comes back as allowlisted HTML; a field without formatting comes back
 * as plain text (line breaks as "\n"), so plain fields stay exactly as they were.
 */
export function sanitizeRich(input: string, max = 20000): string {
  if (typeof input !== "string") return "";
  // No tags: plain words, with entities read back (a browser reports "&" as "&amp;"; it must not be saved that way).
  if (!input.includes("<")) return decode(input);
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:[^<>"']|"[^"]*"|'[^']*')*)\/?>/g;
  let out = "";
  const stack: Open[] = [];
  let drop: string | null = null;
  let last = 0;
  const text = (s: string) => {
    if (!drop && s) out += escapeText(decode(s));
  };
  const lineBreak = () => {
    if (out && !out.endsWith("<br>")) out += "<br>";
  };
  for (let m = re.exec(input); m; m = re.exec(input)) {
    text(input.slice(last, m.index));
    last = re.lastIndex;
    if (!m[1]) continue; // a comment
    const name = m[1].toLowerCase();
    const closing = m[0][1] === "/";
    const attrs = m[2] ?? "";
    if (drop) {
      if (closing && name === drop) drop = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      if (!closing && !/\/>$/.test(m[0])) drop = name;
      continue;
    }
    if (name === "br") {
      out += "<br>";
      continue;
    }
    if (BLOCKS.has(name)) {
      if (!closing) lineBreak();
      continue;
    }
    if (closing) {
      const at = stack.map((s) => s.src).lastIndexOf(name === "strong" ? "b" : name === "em" ? "i" : name);
      if (at < 0) continue;
      while (stack.length > at) out += stack.pop()!.close;
      continue;
    }
    if (stack.length >= MAX_DEPTH) continue;
    const simple = SIMPLE[name];
    if (simple) {
      out += `<${simple}>`;
      stack.push({ out: simple, close: `</${simple}>`, src: simple });
    } else if (name === "a") {
      const href = safeHref(attr(attrs, "href") ?? "");
      if (href) {
        out += `<a href="${escapeAttr(href)}">`;
        stack.push({ out: "a", close: "</a>", src: "a" });
      } else stack.push({ out: "", close: "", src: "a" });
    } else if (name === "span" || name === "font") {
      const st = styleOf(attrs, name);
      if (st) {
        out += `<span style="${st}">`;
        stack.push({ out: "span", close: "</span>", src: name });
      } else stack.push({ out: "", close: "", src: name });
    }
    // Anything else: the tag goes, its words stay.
  }
  text(input.slice(last));
  while (stack.length) out += stack.pop()!.close;

  // Tidy: empty formatting, line breaks at the very end.
  for (let i = 0; i < 4; i++)
    out = out.replace(/<(b|i|u)><\/\1>|<span style="[^"]*"><\/span>|<a href="[^"]*"><\/a>/g, "");
  out = out.replace(/(<br>)+$/, "");
  // Too long: cut (leaving room for the closing tags) and clean once more, which closes what's open.
  if (out.length > max) out = sanitizeRich(out.slice(0, Math.max(Math.floor(max / 2), max - 32)), Infinity);
  return isRich(out) ? out : decode(out.replace(/<br>/g, "\n"));
}

/** The words only (for page titles, alt text, search results). */
export function plainText(v: string): string {
  return isRich(v)
    ? decode(
        sanitizeRich(v)
          .replace(/<br>/g, "\n")
          .replace(/<[^>]+>/g, ""),
      )
    : decodeEntities(v);
}

/** HTML for a page: cleaned, links that open safely, and the *accent* / ==highlight== marks. */
export function richHtml(v: string): string {
  const clean = sanitizeRich(v);
  return clean
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<a "))
        return /href="https?:/i.test(part) ? part.replace(/>$/, ' rel="noopener noreferrer" target="_blank">') : part;
      if (part.startsWith("<")) return part;
      return part
        .replace(
          /==([^=\n]+)==/g,
          '<mark style="background:linear-gradient(transparent 40%,color-mix(in srgb,var(--site-accent) 55%,transparent) 40%);color:inherit;padding:0 .1em">$1</mark>',
        )
        .replace(/\*([^*\n]+)\*/g, '<span style="color:var(--site-accent)">$1</span>');
    })
    .join("");
}

/** What goes into an editable field: the cleaned HTML, or plain text made safe with its line breaks. */
export function editableHtml(v: string): string {
  return isRich(v) ? sanitizeRich(v) : escapeText(v).replace(/\n/g, "<br>");
}
