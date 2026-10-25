import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";
import { addSection, openEditor } from "./editor-helpers";

// Round 18 (Ahmed): pointing at a section shows one action card on it (Edit section, Duplicate,
// Move up, Move down, Remove) and "Add section" on its edges. Phones get the actions from the bottom.

const canvas = (page: Page) => page.getByTestId("canvas");
const ids = (page: Page) =>
  canvas(page)
    .locator("[data-block-id]")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.blockId!));

test("the section card: move, remove with undo, add above and below, header gets Edit only", async ({ page }, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "mobile";
  await signUp(page);
  await openEditor(page);
  const card = page.getByTestId("section-toolbar");
  /** Desktop: point at it. Phones: tap it. */
  const focus = async (id: string) => {
    const el = canvas(page).locator(`[data-block-id="${id}"]`);
    if (phone) await el.click({ position: { x: 6, y: 6 } });
    else {
      // Halfway down its start edge: clear of the other section's card, tag and buttons.
      const box = (await el.boundingBox())!;
      await el.hover({ position: { x: 30, y: Math.min(box.height / 2, 300) } });
    }
    await expect(card).toHaveAttribute("data-section", id);
  };

  const start = await ids(page);
  expect(start.length).toBeGreaterThanOrEqual(3);

  // One card at a time; it follows the pointer.
  await focus(start[1]);
  await expect(card).toHaveCount(1);
  await focus(start[0]);
  await expect(page.getByTestId("section-up")).toBeDisabled();
  await page.screenshot({ path: `test-results/canvas-card-${info.project.name}.png` });

  // Move down, then back up.
  await page.getByTestId("section-down").click();
  await expect.poll(() => ids(page)).toEqual([start[1], start[0], ...start.slice(2)]);
  await focus(start[0]);
  await page.getByTestId("section-up").click();
  await expect.poll(() => ids(page)).toEqual(start);

  // Remove, then Undo from the message.
  await focus(start[2]);
  await page.getByTestId("section-remove").click();
  await expect.poll(() => ids(page)).toEqual(start.filter((id) => id !== start[2]));
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => ids(page)).toEqual(start);

  // Add section below the first one: a line shows the spot, the library opens, the new section
  // lands there and its settings open.
  await focus(start[0]);
  await page.getByTestId("add-section-below").click();
  await expect(page.getByTestId("insert-marker")).toBeVisible();
  await addSection(page, "quote");
  await expect.poll(async () => (await ids(page)).length).toBe(start.length + 1);
  const after = await ids(page);
  expect(after[0]).toBe(start[0]);
  expect(after.slice(2)).toEqual(start.slice(1));
  await expect(page.getByTestId("block-settings")).toBeVisible();
  await expect(page.getByTestId("insert-marker")).toBeHidden();

  // Add section above (desktop pills; phones have it on the page too).
  await focus(start[0]);
  await page.getByTestId("add-section-above").click();
  await addSection(page, "quote");
  await expect.poll(async () => (await ids(page))[1]).toBe(start[0]);

  // The header and footer only get Edit.
  if (!phone) {
    await canvas(page).locator('[data-site-part="header"]').hover({ position: { x: 8, y: 8 } });
    await expect(card).toHaveAttribute("data-section", "__header");
    await expect(card.getByRole("button")).toHaveCount(1);
    await card.getByTestId("section-edit").click();
    await expect(page.getByTestId("header-settings")).toBeVisible();
  }
});
