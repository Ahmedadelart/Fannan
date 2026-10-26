import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";
import { addSection, editSection, openEditor, settingsTab } from "./editor-helpers";

// Round 14 (matching ahmedadel.art): the header's height, grids that follow the section's alignment
// (a short last row sits in the middle), and masonry that keeps the pictures in reading order.

test("header height, centred grid rows and masonry in reading order", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  const canvas = page.getByTestId("canvas");

  // The header gets shorter with a smaller height, even without a background: the first section moves up.
  const header = canvas.locator('[data-site-part="header"]');
  const firstTop = async () => {
    const root = (await canvas.locator(".site-root").first().boundingBox())!;
    return (await canvas.locator("[data-block-id]").first().boundingBox())!.y - root.y;
  };
  const tall = await firstTop();
  await header.click({ position: { x: 4, y: 4 } });
  await editSection(page);
  await page.getByTestId("header-settings").getByRole("slider", { name: /^Height/ }).fill("4");
  await expect.poll(firstTop).toBeLessThan(tall - 60);
  await page.keyboard.press("Escape");

  // Six pictures in four columns, centred: the two left over sit in the middle of the last row.
  await addSection(page, "img-grid");
  const section = canvas.getByTestId("images-section").last();
  await section.scrollIntoViewIfNeeded();
  await section.click({ position: { x: 10, y: 10 } });
  // A new section may open its settings by itself; the button toggles them.
  const columns = page.getByRole("slider", { name: /^Columns/ });
  await expect(async () => {
    if (!(await columns.isVisible())) await editSection(page);
    await expect(columns).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await columns.fill("4");
  await settingsTab(page, "Style");
  await page.getByTestId("align-center").click();
  await settingsTab(page, "Content");
  const tiles = section.locator("figure");
  await expect(tiles).toHaveCount(6);
  await expect(section.locator('[data-layout="flow"]')).toBeVisible();
  const box = (await section.locator('[data-layout="flow"]').boundingBox())!;
  const a = (await tiles.nth(4).boundingBox())!;
  const b = (await tiles.nth(5).boundingBox())!;
  const leftGap = a.x - box.x;
  const rightGap = box.x + box.width - (b.x + b.width);
  expect(leftGap).toBeGreaterThan(40);
  expect(Math.abs(leftGap - rightGap)).toBeLessThan(4);
  await page.screenshot({ path: "test-results/r14-centred-row.png" });

  // Masonry: the first three pictures are the first row, one in each column.
  await page.getByTestId("images-layout-masonry").click();
  await columns.fill("3");
  await expect(section.locator('[data-layout="masonry"]')).toBeVisible();
  const xs = await Promise.all([0, 1, 2].map(async (n) => (await section.locator(`figure[style*="order: ${n};"]`).boundingBox())!.x));
  expect(xs[0]).toBeLessThan(xs[1]);
  expect(xs[1]).toBeLessThan(xs[2]);
});

test("logos can glide in an endless row", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  const canvas = page.getByTestId("canvas");
  await addSection(page, "logos");
  const wall = canvas.getByTestId("logo-wall").last();
  await wall.scrollIntoViewIfNeeded();
  await wall.click();
  const moving = page.getByRole("switch", { name: /^Moving/ });
  await expect(async () => {
    if (!(await moving.isVisible())) await editSection(page);
    await expect(moving).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await moving.click();
  const track = canvas.getByTestId("logo-marquee").locator(".site-marquee-track");
  await expect(track).toBeVisible();
  expect(await track.evaluate((el) => getComputedStyle(el).animationName)).toBe("site-marquee");
  // Two identical halves, so the loop never jumps.
  const n = await track.locator(":scope > span").count();
  expect(n % 2).toBe(0);
  expect(n).toBeGreaterThanOrEqual(2);

  // Scrolling the side panel to its end never scrolls the editor itself away (Ahmed's report, 25 Oct).
  const panel = (await page.getByTestId("left-panel").boundingBox())!;
  await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  expect(await page.getByTestId("left-panel").evaluate((el) => el.parentElement!.getBoundingClientRect().top)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
});
