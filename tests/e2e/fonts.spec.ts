import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";
import { openEditor } from "./editor-helpers";

// Round 12: 60 fonts and a picker with pairs, live preview on hover, search and keyboard.

const headingVar = (page: Page) =>
  page.getByTestId("canvas").locator(".site-root").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--site-heading"));

test("fonts: preview on hover, pick a pair, search, keyboard, and the live site loads only its fonts", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop", "The picker at desktop size.");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);
  await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name: "Design", exact: true }).click();
  await page.getByRole("button", { name: "Fonts", exact: true }).click();
  const picker = page.getByTestId("font-picker");
  await expect(picker).toBeVisible();
  // The picker opened under the mouse: move away first so nothing is being previewed.
  await page.mouse.move(900, 450);
  const before = await headingVar(page);

  // Pointing at a pair shows it on the page; moving away puts the saved fonts back.
  await picker.getByTestId("pair-poster").hover();
  await expect.poll(() => headingVar(page)).toContain("fn-anton");
  await page.mouse.move(900, 450);
  await expect.poll(() => headingVar(page)).toBe(before);

  // A click keeps it.
  await picker.getByTestId("pair-editorial").click();
  await expect.poll(() => headingVar(page)).toContain("fn-fraunces");
  await page.screenshot({ path: "test-results/r12-fonts-pairs.png" });

  // Search, and the keyboard: arrows preview, Enter picks.
  await picker.getByTestId("fonts-tab-arabic").click();
  await picker.getByTestId("font-search").fill("cairo");
  await expect(picker.getByTestId("font-cairo")).toBeVisible();
  await picker.getByTestId("font-search").fill("");
  await picker.getByTestId("fonts-tab-heading").click();
  await picker.getByTestId("font-list").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect.poll(() => headingVar(page)).not.toContain("fn-fraunces");
  await picker.getByTestId("font-search").fill("syne");
  await picker.getByTestId("font-syne").click();
  await expect.poll(() => headingVar(page)).toContain("fn-syne");
  await picker.getByRole("radio", { name: "Bigger" }).click();
  await page.screenshot({ path: "test-results/r12-fonts-list.png" });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const fontFiles: string[] = [];
  visitor.on("request", (r) => {
    if (r.url().includes("/fonts/")) fontFiles.push(r.url());
  });
  await visitor.goto(at(username));
  await visitor.waitForLoadState("networkidle");
  const live = await visitor.locator(".site-root").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--site-heading"));
  expect(live).toContain("fn-syne");
  // Only the fonts the site uses are downloaded (Syne for headings, Lora for text).
  expect(fontFiles.some((u) => u.includes("syne"))).toBe(true);
  expect(fontFiles.some((u) => u.includes("anton"))).toBe(false);
  expect(fontFiles.length).toBeLessThan(8);
});
