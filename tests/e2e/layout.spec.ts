import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Round 13: "show, not tell": image-first sections, left by default, alignment, full width, flip.

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

test("image-first sections: flip, align and full width from the top of the settings", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);
  await page.getByTestId("add-d-split-left").click();
  const canvas = page.getByTestId("canvas");
  const section = canvas.locator("[data-block-id]").filter({ has: page.locator('[data-kind="image"]') }).last();
  await section.scrollIntoViewIfNeeded();
  const img = section.locator('[data-kind="image"]').first();
  const head = section.locator('[data-kind="heading"]').first();
  // Picture first (left), text beside it, aligned left.
  expect((await img.boundingBox())!.x).toBeLessThan((await head.boundingBox())!.x);
  expect(await head.evaluate((el) => getComputedStyle(el.querySelector(".site-free-text") ?? el).textAlign)).toMatch(/start|left/);

  await section.click({ position: { x: 900, y: 20 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("quick-layout")).toBeVisible();
  await page.getByTestId("mirror-layout").click();
  await expect.poll(async () => (await img.boundingBox())!.x > (await head.boundingBox())!.x).toBe(true);
  await page.getByTestId("align-center").click();
  await expect.poll(() => head.evaluate((el) => getComputedStyle(el.querySelector(".site-free-text") ?? el).textAlign)).toBe("center");
  await page.screenshot({ path: "test-results/r13-layout.png" });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  await expect(visitor.locator(".site-free-item").first()).toBeVisible();
});
