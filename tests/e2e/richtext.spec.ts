import { expect, test } from "@playwright/test";
import { editableHtml, isRich, plainText, richHtml, sanitizeRich } from "../../src/lib/site/richtext";

// Round 13 (C): the per-word formatting cleaner. Only the allowlist survives; plain text stays plain.

test.describe("rich text cleaner", () => {
  test.skip(({ isMobile }) => isMobile, "pure checks run once");

  test("plain text is untouched", () => {
    expect(sanitizeRich("Hello *world*")).toBe("Hello *world*");
    expect(sanitizeRich("a < b and c > d")).toBe("a < b and c > d");
    expect(isRich("Hello")).toBe(false);
  });

  // Round 19 follow-up: a browser reports "&" as "&amp;"; the words are saved and shown as typed.
  test("entities in plain words read back as the characters", () => {
    expect(sanitizeRich("Character designer &amp; art director")).toBe("Character designer & art director");
    expect(sanitizeRich("Tom &amp; Jerry &lt;3")).toBe("Tom & Jerry <3");
    expect(plainText("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(editableHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  test("allowed formatting is kept and normalised", () => {
    expect(sanitizeRich("Hi <strong>big</strong> <em>soft</em> <u>line</u>")).toBe(
      "Hi <b>big</b> <i>soft</i> <u>line</u>",
    );
    expect(sanitizeRich('<font color="#ff0000">red</font>')).toBe('<span style="color:#ff0000">red</span>');
    expect(sanitizeRich('<span style="color: rgb(0, 128, 255)">x</span>')).toBe('<span style="color:#0080ff">x</span>');
    expect(sanitizeRich('<a href="https://example.com/a?b=1&amp;c=2">link</a>')).toBe(
      '<a href="https://example.com/a?b=1&amp;c=2">link</a>',
    );
    expect(sanitizeRich("<b>one</b><div>two</div>")).toBe("<b>one</b><br>two");
  });

  test("scripts, handlers and bad links never survive", () => {
    const evil = [
      "<script>alert(1)</script><b>ok</b>",
      '<img src=x onerror="alert(1)"><b>ok</b>',
      '<b onclick="alert(1)">ok</b>',
      '<a href="javascript:alert(1)">ok</a><b>x</b>',
      '<a href="JaVaScRiPt:alert(1)">ok</a><i>x</i>',
      '<a href=" javascript:alert(1)">ok</a><i>x</i>',
      '<a href="data:text/html;base64,PHNjcmlwdD4=">ok</a><i>x</i>',
      '<span style="background:url(javascript:alert(1));color:red">ok</span><b>x</b>',
      "<svg><script>alert(1)</script></svg><b>x</b>",
      '<iframe src="https://evil.example"></iframe><b>x</b>',
      "<b>x</b><style>body{display:none}</style>",
      "<b>x</b><<script>script>alert(1)<</script>/script>",
      '<a href="https://ok.example" onmouseover="alert(1)">ok</a>',
      '<span style="font-family: expression(alert(1))">ok</span><b>x</b>',
      "<b>x</b>&lt;script&gt;alert(1)&lt;/script&gt;",
    ];
    for (const e of evil) {
      const out = sanitizeRich(e);
      expect(out, e).not.toMatch(
        /<script|onerror|onclick|onmouseover|javascript:|data:|<iframe|<style|<svg|<img|expression\(|url\(/i,
      );
      // Whatever is left is only allowlisted tags.
      for (const tag of out.match(/<[^>]+>/g) ?? [])
        expect(tag, e).toMatch(/^<\/?(b|i|u|br|a|span)( href="[^"]*"| style="[^"]*")?>$/);
    }
  });

  test("unknown fonts are dropped, registry fonts kept", () => {
    expect(sanitizeRich('<font face="fn-not-a-font">x</font><b>y</b>')).toBe("x<b>y</b>");
    expect(sanitizeRich('<span style="font-family: fn-marhey">x</span>')).toBe(
      '<span style="font-family:fn-marhey">x</span>',
    );
  });

  test("unclosed and broken tags are closed; too long is cut cleanly", () => {
    expect(sanitizeRich("<b>open <i>both")).toBe("<b>open <i>both</i></b>");
    const long = sanitizeRich("<b>" + "a".repeat(100) + "</b>", 40);
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long).toMatch(/^<b>a+<\/b>$/);
  });

  test("render: links open safely, accents still work, plain words for titles", () => {
    expect(richHtml('<a href="https://x.example">x</a> <b>*hi*</b>')).toBe(
      '<a href="https://x.example" rel="noopener noreferrer" target="_blank">x</a> <b><span style="color:var(--site-accent)">hi</span></b>',
    );
    expect(plainText("<b>Bold</b> and <i>soft</i>")).toBe("Bold and soft");
    expect(editableHtml("a < b\nline")).toBe("a &lt; b<br>line");
    expect(sanitizeRich("<b>مرحبا</b> بالعالم")).toBe("<b>مرحبا</b> بالعالم");
  });
});
