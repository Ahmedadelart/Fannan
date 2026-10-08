import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Phase 8C: free-form sections — blocks anywhere on a grid, moved, resized, turned and layered,
// text typed in place, stacked on phones, mirrored in Arabic.

test.describe.configure({ mode: "serial" });

async function openEditor(page: Page) {
  await page.goto(at("app", "/editor"));
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 3000 }).catch(() => {});
  for (let i = 0; i < 6 && (await dialog.isVisible().catch(() => false)); i++) {
    const before = await dialog.getAttribute("aria-label");
    await page.getByRole("button", { name: /^(Next|Got it)$/ }).click();
    await expect
      .poll(async () => ((await dialog.isVisible()) ? await dialog.getAttribute("aria-label") : "closed"))
      .not.toBe(before);
  }
  await page.waitForLoadState("networkidle");
}

const vars = (page: Page, nth: number) =>
  page
    .getByTestId("free-item")
    .nth(nth)
    .evaluate((el) => {
      const s = (el as HTMLElement).style;
      return {
        x: Number(s.getPropertyValue("--x")),
        y: Number(s.getPropertyValue("--y")),
        w: Number(s.getPropertyValue("--w")),
        h: Number(s.getPropertyValue("--h")),
        z: Number(s.zIndex),
        rotate: s.transform,
      };
    });

test("a free-form section: place, resize, turn, layer, type, publish", async ({ page, browser }, info) => {
  test.skip(info.project.name === "mobile", "Pointer editing is checked at desktop size; phones are checked on the live site.");
  test.setTimeout(240_000);
  const { username } = await signUp(page);
  await openEditor(page);

  // Add a ready-made collage from the library.
  await page.getByRole("button", { name: "Collage" }).click();
  const grid = page.getByTestId("free-grid");
  await expect(grid).toBeVisible();
  await grid.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("free-item")).toHaveCount(4);

  // Select the first picture: handles and its toolbar appear.
  const first = page.getByTestId("free-item").first();
  const box = (await first.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("free-toolbar")).toBeVisible();
  await expect(page.getByText("Turn")).toBeVisible(); // the side panel shows the block's settings

  // Move it: one cell is 1/24 of the grid's width.
  const before = await vars(page, 0);
  const cell = (await grid.boundingBox())!.width / 24;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + cell * 3, box.y + box.height / 2 + cell * 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await vars(page, 0)).x).toBe(before.x + 3);
  expect((await vars(page, 0)).y).toBe(before.y + 2);

  // Resize from the bottom-end corner.
  const se = page.getByTestId("free-selection").locator('[data-handle="se"]');
  const h = (await se.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + cell * 2, h.y + h.height / 2 + cell, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await vars(page, 0)).w).toBe(before.w + 2);

  // Turn it with the round handle (snaps to 15° steps), and from the panel.
  await page.getByRole("slider", { name: "Turn" }).fill("30");
  await expect.poll(async () => (await vars(page, 0)).rotate).toBe("rotate(30deg)");

  // Bring to front.
  await page.getByTestId("free-toolbar").getByRole("button", { name: "Bring to front" }).click();
  await expect.poll(async () => (await vars(page, 0)).z).toBe(4);

  // Add a text block and type in it.
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("menuitem", { name: "Text" }).click();
  await expect(page.getByTestId("free-item")).toHaveCount(5);
  const text = page.getByTestId("free-item").last();
  await text.dblclick();
  const editable = text.locator("[data-inline-text]");
  await expect(editable).toBeVisible();
  await editable.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Free-form works");
  await expect(page.getByTestId("right-panel").getByRole("textbox").first()).toHaveValue("Free-form works");
  await page.screenshot({ path: `test-results/free-${info.project.name}.png` });

  // Publish, then look at the live site.
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  await expect(visitor.getByText("Free-form works")).toBeVisible();
  const items = visitor.locator(".site-free-item");
  await expect(items).toHaveCount(5);
  expect(await items.first().evaluate((el) => (el as HTMLElement).style.transform)).toBe("rotate(30deg)");
  expect(await visitor.locator(".site-free-grid").first().evaluate((el) => getComputedStyle(el).display)).toBe("grid");
  await visitor.screenshot({ path: `test-results/free-live-${info.project.name}.png`, fullPage: true });

  // On a phone the blocks stack, nothing spills sideways.
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await phone.goto(at(username));
  expect(await phone.locator(".site-free-grid").first().evaluate((el) => getComputedStyle(el).display)).toBe("flex");
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // In Arabic the grid mirrors: the reading start is on the right.
  await openEditor(page);
  await page.getByRole("tab", { name: "Style" }).click();
  await page.getByRole("radio", { name: "Arabic" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  await visitor.goto(at(username));
  await expect(visitor.locator("html")).toHaveAttribute("dir", "rtl");
  const g = (await visitor.locator(".site-free-grid").first().boundingBox())!;
  const heading = (await visitor.locator(".site-free-heading").first().boundingBox())!;
  // The collage heading sits at the reading start's far side in English (x 14–24): on the left in Arabic.
  expect(heading.x + heading.width / 2).toBeLessThan(g.x + g.width / 2);
});
