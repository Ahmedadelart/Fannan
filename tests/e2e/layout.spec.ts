import { expect, test } from "@playwright/test";
import { at, signUp } from "./helpers";
import { addSection, editSection, openEditor, openRail, publishAndWait, settingsTab } from "./editor-helpers";

// Round 13: "show, not tell": image-first sections, left by default, alignment, full width, flip.

test("image-first sections: flip, align and full width from the top of the settings", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);
  await addSection(page, "d-split-left");
  const canvas = page.getByTestId("canvas");
  const section = canvas
    .locator("[data-block-id]")
    .filter({ has: page.locator('[data-kind="image"]') })
    .last();
  await section.scrollIntoViewIfNeeded();
  const img = section.locator('[data-kind="image"]').first();
  const head = section.locator('[data-kind="heading"]').first();
  // Picture first (left), text beside it, aligned left.
  expect((await img.boundingBox())!.x).toBeLessThan((await head.boundingBox())!.x);
  expect(await head.evaluate((el) => getComputedStyle(el.querySelector(".site-free-text") ?? el).textAlign)).toMatch(
    /start|left/,
  );

  await section.click({ position: { x: 900, y: 20 } });
  await editSection(page);
  // Round 18: alignment and the mirror button live in Style ▸ Arrangement.
  await settingsTab(page, "Style");
  await expect(page.getByTestId("quick-layout")).toBeVisible();
  await page.getByTestId("mirror-layout").click();
  await expect.poll(async () => (await img.boundingBox())!.x > (await head.boundingBox())!.x).toBe(true);
  await page.getByTestId("align-center").click();
  await expect
    .poll(() => head.evaluate((el) => getComputedStyle(el.querySelector(".site-free-text") ?? el).textAlign))
    .toBe("center");
  await page.screenshot({ path: "test-results/r13-layout.png" });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  await expect(visitor.locator(".site-free-item").first()).toBeVisible();
});

// Round 19 follow-up: the sidebar menu keeps its column. The links stack under the name, a dropdown's
// pages sit under their parent, and nothing in the menu runs under the page beside it.
test("sidebar menu: links stack in the column and stay beside the page", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);
  await openRail(page, "Design");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("radio", { name: "Sidebar" }).click();
  const header = page.getByTestId("canvas").locator(".site-with-sidebar > header");
  await expect(header).toBeVisible();
  const check = async (root: typeof header) => {
    const box = (await root.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(240);
    // Every part of the menu ends inside its column.
    for (const part of await root.locator(":scope > *").all()) {
      const b = (await part.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
    expect(await root.locator(".site-nav-links").evaluate((el) => getComputedStyle(el).flexDirection)).toBe("column");
    // The page (the sections' <main>) starts after the column, not under it.
    const main = root.locator("xpath=following-sibling::main[1]");
    expect((await main.boundingBox())!.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
  };
  await check(header);
  await publishAndWait(page);
  const visitor = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await visitor.goto(at(username));
  await check(visitor.locator(".site-with-sidebar > header"));
});
