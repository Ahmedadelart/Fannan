import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";
import { openEditor } from "./editor-helpers";

// Round 11: doodles. A drawing board with pressure, brushes, an eraser, undo and boiling lines;
// the drawing is vector and shows on the live site.

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
  await page.getByRole("menuitem", { name: "Doodle", exact: true }).click();

  // The board lies over the section, and the tools open in the Doodle panel.
  const board = page.getByTestId("draw-board-wrap");
  const panel = page.getByTestId("doodle-panel");
  await expect(board).toBeVisible();
  await expect(panel).toBeVisible();
  await scribble(page, [0.1, 0.3], [0.9, 0.3]);
  await panel.getByTestId("brush-marker").click();
  await scribble(page, [0.1, 0.6], [0.9, 0.7]);
  await panel.getByTestId("brush-neon").click();
  await scribble(page, [0.2, 0.85], [0.8, 0.5]);
  const paths = board.locator('[data-testid="drawing"]').locator("path");
  await expect(paths).toHaveCount(3);

  // Undo, redo, then the eraser takes the first line away.
  await page.keyboard.press("Control+z");
  await expect(paths).toHaveCount(2);
  await page.keyboard.press("Control+Shift+z");
  await expect(paths).toHaveCount(3);
  await panel.getByTestId("doodle-eraser").click();
  await scribble(page, [0.5, 0.25], [0.5, 0.35]);
  await expect(paths).toHaveCount(2);

  // Boiling lines: three frames, each a whole line (no breaks).
  await panel.getByTestId("doodle-boil").getByRole("switch").click();
  await expect(board.locator(".dw-frame")).toHaveCount(3);
  await page.screenshot({ path: "test-results/r11-doodle-board.png" });
  await page.getByTestId("board-done").click();
  await expect(board).toBeHidden();
  const item = page.getByTestId("canvas").locator('[data-kind="drawing"]');
  await expect(item).toBeVisible();
  await expect(item.locator(".dw-frame")).toHaveCount(3);

  // The panel stays open, ready for another drawing; the Doodle button in the rail closes and opens it.
  await expect(panel.getByTestId("doodle-start")).toBeVisible();
  await page.getByRole("button", { name: "Doodle" }).click();
  await expect(panel).toBeHidden();
  await page.getByRole("button", { name: "Doodle" }).click();
  await expect(panel.getByTestId("doodle-start")).toBeVisible();

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

test("Layers and Add item sit side by side under any free-form section, and a doodle is called Doodle", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  // A designed section with its own padding and background.
  await page.getByTestId("add-d-statement").click();
  const layers = page.getByTestId("layers-button");
  const add = page.getByRole("button", { name: "Add item" });
  await expect(layers).toBeVisible();
  const a = (await layers.boundingBox())!;
  const b = (await add.boundingBox())!;
  expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(4);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);

  // Draw something; in the layers list it's a "Doodle".
  await add.click();
  await page.getByRole("menuitem", { name: "Doodle", exact: true }).click();
  await scribble(page, [0.2, 0.5], [0.8, 0.5]);
  await page.getByTestId("board-done").click();
  await layers.click();
  await expect(page.getByTestId("layers-panel")).toContainText("Doodle");
});
