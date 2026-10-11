import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Round 11: doodles. A drawing board with pressure, brushes, an eraser, undo and boiling lines;
// the drawing is vector and shows on the live site.

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

/** One stroke across the board, as a pen with growing pressure. */
async function scribble(page: Page, from: [number, number], to: [number, number]) {
  const board = (await page.getByTestId("doodle-board").boundingBox())!;
  const x = (f: number) => board.x + board.width * f;
  const y = (f: number) => board.y + board.height * f;
  await page.mouse.move(x(from[0]), y(from[1]));
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const k = i / 12;
    await page.mouse.move(x(from[0] + (to[0] - from[0]) * k), y(from[1] + (to[1] - from[1]) * k + Math.sin(k * 6) * 0.05));
  }
  await page.mouse.up();
}

test("draw a doodle with brushes, erase, undo, boil, and see it on the live site", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop", "Drawn with the mouse at desktop size.");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);
  await page.getByTestId("add-free-blank").click();
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("menuitem", { name: "Draw", exact: true }).click();

  // The board opens straight away.
  const studio = page.getByTestId("doodle-studio");
  await expect(studio).toBeVisible();
  await scribble(page, [0.1, 0.3], [0.9, 0.3]);
  await studio.getByTestId("brush-marker").click();
  await scribble(page, [0.1, 0.6], [0.9, 0.7]);
  await studio.getByTestId("brush-neon").click();
  await scribble(page, [0.2, 0.85], [0.8, 0.5]);
  const paths = studio.locator('[data-testid="drawing"]').last().locator("path");
  await expect(paths).toHaveCount(3);

  // Undo, redo, then the eraser takes the first line away.
  await page.keyboard.press("Control+z");
  await expect(paths).toHaveCount(2);
  await page.keyboard.press("Control+Shift+z");
  await expect(paths).toHaveCount(3);
  await studio.getByTestId("doodle-eraser").click();
  await scribble(page, [0.5, 0.25], [0.5, 0.35]);
  await expect(paths).toHaveCount(2);

  // Boiling lines: three frames.
  await studio.getByTestId("doodle-boil").getByRole("switch").click();
  await expect(studio.locator('[data-testid="drawing"]').last().locator(".dw-frame")).toHaveCount(3);
  await page.screenshot({ path: "test-results/r11-doodle-studio.png" });
  await studio.getByTestId("doodle-done").click();
  await expect(studio).toBeHidden();
  await expect(page.getByTestId("canvas").locator('[data-testid="drawing"]')).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  const live = visitor.locator('[data-testid="drawing"]');
  await expect(live).toBeVisible();
  await expect(live.locator(".dw-frame")).toHaveCount(3);
  // Free site: the Pro neon brush draws as a pen (no glow filter).
  await expect(live.locator("filter[id$='-neon']")).toHaveCount(0);
  await visitor.screenshot({ path: "test-results/r11-doodle-live.png" });
});
