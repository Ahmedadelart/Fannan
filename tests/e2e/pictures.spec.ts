import { readFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";
import { at, signUp } from "./helpers";
import { addSection, editSection, openEditor } from "./editor-helpers";

// Round 13 (B + D): pictures straight on the canvas: drop files, replace and crop on hover, the Images section.

const photo = readFileSync("tests/fixtures/photo.jpg").toString("base64");

/** Drop files from "the computer" onto an element, the way a browser does. */
async function dropFiles(target: Locator, count: number) {
  await target.evaluate(
    (el, { b64, count }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      for (let i = 0; i < count; i++) dt.items.add(new File([bytes], `photo-${i}.jpg`, { type: "image/jpeg" }));
      const r = el.getBoundingClientRect();
      const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, dataTransfer: dt };
      el.dispatchEvent(new DragEvent("dragover", at));
      el.dispatchEvent(new DragEvent("drop", at));
    },
    { b64: photo, count },
  );
}

test("drop pictures on an Images section, crop one, replace one, and publish", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);

  await addSection(page, "img-grid");
  const section = page.getByTestId("canvas").getByTestId("images-section").last();
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator("[data-pic]")).toHaveCount(6);
  await expect(section.locator("img")).toHaveCount(0);

  // Three files dropped on the section fill the first three sample tiles.
  await dropFiles(section, 3);
  await expect(section.locator("img")).toHaveCount(3, { timeout: 60_000 });

  // Hover a picture: Replace and Crop appear. Crop: zoom in, Done.
  const first = section.locator("picture[data-pic]").first();
  await first.hover();
  await expect(page.getByTestId("pic-tools")).toBeVisible();
  await page.getByTestId("pic-crop").click();
  await expect(page.getByTestId("crop-dialog")).toBeVisible();
  await page.getByTestId("crop-zoom").fill("2");
  await page.getByTestId("crop-done").click();
  await expect.poll(() => first.locator("img").evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");

  // Replace an empty tile through the hover button.
  const empty = section.locator("div[data-pic]").first();
  await empty.hover();
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("pic-replace").click();
  await (await chooser).setFiles("tests/fixtures/photo.jpg");
  await expect(section.locator("img")).toHaveCount(4, { timeout: 60_000 });

  // Settings: layout tiles and the image list.
  await section.click({ position: { x: 10, y: 10 } });
  await editSection(page);
  await expect(page.getByTestId("images-row")).toHaveCount(6);
  await page.getByTestId("images-layout-masonry").click();
  await expect(page.getByTestId("quick-bg")).toBeVisible();
  await page.screenshot({ path: "test-results/r13-images.png" });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  const live = visitor.getByTestId("images-section");
  await expect(live.locator("img")).toHaveCount(4);
  await expect(live.locator("[data-lightbox]")).toHaveCount(4);
  await expect(live.locator("[data-pic]")).toHaveCount(0);
  expect(await live.locator("img").first().evaluate((el) => getComputedStyle(el).transform)).not.toBe("none");
});

test("a picture dropped on an image item replaces it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  await addSection(page, "d-split-left");
  const item = page.getByTestId("canvas").locator('[data-kind="image"]').last();
  await item.scrollIntoViewIfNeeded();
  await expect(item.locator("img")).toHaveCount(0);
  await dropFiles(item, 1);
  await expect(item.locator("img")).toHaveCount(1, { timeout: 60_000 });
});
