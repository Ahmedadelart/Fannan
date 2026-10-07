import { expect, test, type Page } from "@playwright/test";
import { readdirSync } from "node:fs";

const iconCount = readdirSync("design/icons").filter((f) => f.endsWith(".svg")).length;

/** Every colour on the page, checked for blue (hue 180–260 with real saturation). */
async function bluePaint(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const props = [
      "color",
      "backgroundColor",
      "borderTopColor",
      "borderBottomColor",
      "outlineColor",
      "fill",
      "stroke",
    ] as const;
    const isBlue = (value: string) => {
      const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return false;
      const [r, g, b] = [m[1], m[2], m[3]].map((n) => Number(n) / 255);
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        d = max - min;
      if (d < 0.12) return false; // grey
      let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      return h >= 180 && h <= 260;
    };
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const s = getComputedStyle(el);
      for (const p of props) if (isBlue(s[p])) found.push(`${el.tagName.toLowerCase()} ${p}=${s[p]}`);
    }
    return found;
  });
}

for (const locale of ["en", "ar"] as const) {
  const path = locale === "ar" ? "/ar/kitchen-sink" : "/kitchen-sink";

  test.describe(`kitchen sink (${locale})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test("loads in the right language and direction", async ({ page }) => {
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        locale === "ar" ? "مكوّنات الواجهة" : "Interface kit",
      );
    });

    test("shows every icon from design/icons", async ({ page }) => {
      const tiles = page.locator("div.h-24 > span[dir=ltr]");
      await expect(tiles).toHaveCount(iconCount);
    });

    test("directional icons mirror in Arabic only", async ({ page }) => {
      const publish = page
        .getByRole("button", { name: locale === "ar" ? "نشر" : "Publish" })
        .first()
        .locator("svg");
      const transform = await publish.evaluate((el) => getComputedStyle(el).transform);
      if (locale === "ar") expect(transform).toBe("matrix(-1, 0, 0, 1, 0, 0)");
      else expect(transform).toBe("none");
    });

    test("no blue anywhere", async ({ page }) => {
      expect(await bluePaint(page)).toEqual([]);
    });

    test("fits the screen without sideways scrolling", async ({ page }) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("toggle, modal, menu and toast work", async ({ page }) => {
      const toggle = page.getByRole("switch").nth(1);
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");

      await page.getByRole("button", { name: locale === "ar" ? "افتح النافذة" : "Open modal" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      await page.getByRole("button", { name: locale === "ar" ? "افتح القائمة" : "Open menu" }).click();
      await expect(page.getByRole("button", { name: locale === "ar" ? "تكرار" : "Duplicate" })).toBeVisible();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: locale === "ar" ? "اعرض إشعارًا" : "Show toast" }).click();
      await expect(page.getByRole("status")).toContainText(locale === "ar" ? "تم نسخ الرابط" : "Link copied");
    });

    test("snapshot for review", async ({ page }, info) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `test-results/kitchen-sink-${locale}-${info.project.name}.png`, fullPage: true });
    });
  });
}
