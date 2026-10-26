import { expect, test } from "@playwright/test";
import { at, signUp } from "./helpers";
import { addSection, contentMore, editSection, openEditor } from "./editor-helpers";

// Round 13 (E): "Create your new project" with a thumbnail, clone and delete on the card, project grid looks.

test("new project with a thumbnail, clone it, delete the original: the copy keeps its picture", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await signUp(page);
  await page.goto(at("app", "/projects"));
  await page.getByTestId("new-project").click();
  await expect(page.getByTestId("new-project-dialog")).toBeVisible();
  await page.getByTestId("new-project-file").setInputFiles("tests/fixtures/photo.jpg");
  await expect(page.getByTestId("new-project-thumb").locator("img")).toBeVisible();
  await page.getByTestId("new-project-name").fill("Night Market");
  await page.getByTestId("new-project-save").click();
  await expect(page).toHaveURL(/\/projects\/[\w-]+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Night Market");

  await page.goto(at("app", "/projects"));
  const cards = page.getByTestId("project-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator("img")).toBeVisible();

  // Clone from the card.
  await cards.first().hover();
  await page.getByTestId("project-clone").click();
  await expect(cards).toHaveCount(2, { timeout: 20_000 });
  await expect(cards.getByText("Night Market (copy)")).toBeVisible();

  // Delete the original: the copy still shows the shared picture.
  const original = page.locator("div.group\\/card").filter({ has: page.getByText("Night Market", { exact: true }) });
  await original.hover();
  await original.getByTestId("project-delete").click();
  await page.getByTestId("project-delete-confirm").click();
  await expect(cards).toHaveCount(1, { timeout: 20_000 });
  await page.reload();
  const img = cards.first().locator("img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
});

test("project grid looks: alternate and rows, titles on hover, featured is Pro", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  await addSection(page, "grid");
  const gallery = page.getByTestId("canvas").locator(".site-grid").last();
  await gallery.scrollIntoViewIfNeeded();
  const section = page.getByTestId("canvas").locator("[data-block-id]").filter({ has: page.locator(".site-grid") }).last();
  await section.click({ position: { x: 10, y: 10 } });
  await editSection(page);
  await expect(page.getByTestId("gallery-look-featured")).toContainText("PRO");
  await page.getByTestId("gallery-look-alternate").click();
  await expect(page.getByTestId("canvas").locator('[data-layout="alternate"]')).toBeVisible();
  await contentMore(page);
  await page.getByTestId("gallery-hover").selectOption("title");
  await expect(page.getByTestId("canvas").locator(".site-hover-title").first()).toBeVisible();
  await page.getByTestId("gallery-look-rows").click();
  await expect(page.getByTestId("canvas").locator('[data-layout="rows"]')).toBeVisible();
  await page.screenshot({ path: "test-results/r13-gallery.png" });
  await page.getByTestId("gallery-look-square").click();
  await expect(page.getByTestId("gallery-look-square")).toHaveAttribute("aria-checked", "true");
});
