import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";
import { openEditor } from "./editor-helpers";

// Round 18: the Pages panel starts with the page card (page ▾ and ⚙), then kinds of sections as
// rows. A row opens its sections, one readable picture a row, with "All sections" to go back.

test("the library: page card, kinds of sections, one kind, search, blank section", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The side panel is checked at desktop size.");
  test.setTimeout(120_000);
  await signUp(page);
  await openEditor(page);
  const panel = page.getByTestId("left-panel");

  await expect(panel.getByTestId("page-switcher")).toBeVisible();
  await expect(panel.locator("[data-testid^=library-cat-]")).toHaveCount(6);
  await page.screenshot({ path: "test-results/library-desktop.png" });

  // One kind: its sections, then back.
  await panel.getByTestId("library-cat-work").click();
  await expect(panel.getByTestId("add-grid")).toBeVisible();
  await expect(panel.getByTestId("add-quote")).toHaveCount(0);
  await page.screenshot({ path: "test-results/library-kind-desktop.png" });
  await panel.getByTestId("library-back").click();
  await expect(panel.getByTestId("library-cat-work")).toBeVisible();

  // Search finds sections in every kind.
  await panel.getByRole("textbox", { name: "Search sections" }).fill("quote");
  await expect(panel.getByTestId("add-quote")).toBeVisible();
  await panel.getByRole("textbox", { name: "Search sections" }).fill("");

  // Page settings open as their own view, with Back.
  await panel.getByTestId("page-settings-button").click();
  await expect(panel.getByRole("textbox", { name: "Page name" })).toBeVisible();
  await panel.getByTestId("pages-back").click();
  await expect(panel.getByTestId("library-cat-intro")).toBeVisible();

  // Pages in the menu: the eye in the page list (one place).
  await panel.getByTestId("page-switcher").click();
  const eye = panel.getByTestId("page-in-menu").nth(1);
  const was = await eye.getAttribute("aria-pressed");
  await eye.click();
  await expect(eye).toHaveAttribute("aria-pressed", was === "true" ? "false" : "true");
  await page.screenshot({ path: "test-results/pages-list-desktop.png" });
  await panel.getByTestId("pages-back").click();

  // A blank section, straight from the panel.
  const before = await page.getByTestId("canvas").locator("[data-block-id]").count();
  await panel.getByTestId("add-free-blank").click();
  await expect(page.getByTestId("canvas").locator("[data-block-id]")).toHaveCount(before + 1);
});
