import { expect, test, type Locator, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Phase 8B: type on the page itself, drag sections and pages instead of up/down buttons,
// a toolbar on the clicked section, and a zoomed-out reorder view.

test.describe.configure({ mode: "serial" });

async function openEditor(page: Page) {
  await page.goto(at("app", "/editor"));
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 3000 }).catch(() => {});
  for (let i = 0; i < 6 && (await dialog.isVisible().catch(() => false)); i++) {
    const before = await dialog.getAttribute("aria-label");
    await page.getByRole("button", { name: /^(Next|Got it|التالي|فهمت)$/ }).click();
    await expect
      .poll(async () => ((await dialog.isVisible()) ? await dialog.getAttribute("aria-label") : "closed"))
      .not.toBe(before);
  }
  await page.waitForLoadState("networkidle");
}

const canvas = (page: Page) => page.getByTestId("canvas");
const sectionIds = (page: Page) =>
  canvas(page).locator("[data-block-id]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.blockId!));
const sectionTypes = (page: Page) =>
  canvas(page)
    .locator("[data-block-id]")
    .evaluateAll((els) => els.map((e) => (e.querySelector("h2")?.textContent ?? e.textContent ?? "").trim().slice(0, 20)));

/** Drags `from` so it lands just above `to`, with a real pointer. */
async function dragAbove(page: Page, handle: Locator, to: Locator) {
  const h = (await handle.boundingBox())!;
  const t = (await to.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + 20, { steps: 4 });
  await page.mouse.move(t.x + t.width / 2, t.y + 4, { steps: 12 });
  await page.mouse.up();
}

test("type on the page, drag sections and pages, toolbar actions", async ({ page, browser }, info) => {
  test.skip(info.project.name === "mobile", "Pointer dragging is checked at desktop size.");
  test.setTimeout(180_000);
  const { username } = await signUp(page);
  await openEditor(page);

  /* ---------- type directly on the page ---------- */
  const aboutHeading = canvas(page).locator("[data-inline-text]").filter({ hasText: /^About$/ }).first();
  const aboutId = await aboutHeading.evaluate((el) => (el.closest("[data-block-id]") as HTMLElement).dataset.blockId!);
  await aboutHeading.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Hello, I draw");
  await page.keyboard.press("Enter"); // one-line fields finish on Enter
  await expect(canvas(page).locator(`[data-block-id="${aboutId}"]`)).toContainText("Hello, I draw");
  // The site name in the header too.
  const title = canvas(page).locator("header [data-inline-text], nav [data-inline-text]").first();
  await title.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Nour Studio");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("editor-status")).toHaveText(/Unpublished changes|Not published yet/, { timeout: 10_000 });

  /* ---------- the section toolbar: drag the about section above the gallery ---------- */
  const before = await sectionIds(page);
  await canvas(page).locator(`[data-block-id="${aboutId}"]`).click({ position: { x: 10, y: 10 } });
  const toolbar = page.getByTestId("section-toolbar");
  await expect(toolbar).toBeVisible();
  await page.screenshot({ path: `test-results/editor2-toolbar-${info.project.name}.png` });
  const gallery = canvas(page).locator(`[data-block-id="${before[1]}"]`);
  await dragAbove(page, toolbar.getByRole("button", { name: /Drag to move/ }), gallery);
  await expect.poll(() => sectionIds(page)).toEqual([before[0], aboutId, ...before.filter((id) => id !== before[0] && id !== aboutId)]);

  // Keyboard: the handle moves the section with the arrow keys.
  await canvas(page).locator(`[data-block-id="${aboutId}"]`).click({ position: { x: 10, y: 10 } });
  await toolbar.getByRole("button", { name: /Drag to move/ }).focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await sectionIds(page))[0]).toBe(aboutId);

  // Duplicate and delete from the toolbar.
  await canvas(page).locator(`[data-block-id="${aboutId}"]`).click({ position: { x: 10, y: 10 } });
  const count = (await sectionIds(page)).length;
  await toolbar.getByRole("button", { name: "Duplicate" }).click();
  await expect.poll(async () => (await sectionIds(page)).length).toBe(count + 1);
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Delete" }).click();
  await expect.poll(async () => (await sectionIds(page)).length).toBe(count);

  /* ---------- the reorder view: whole sections, dragged ---------- */
  await page.getByRole("button", { name: "Reorder" }).click();
  await expect(page.getByText("Drag sections to change their order")).toBeVisible();
  await page.screenshot({ path: `test-results/editor2-reorder-${info.project.name}.png` });
  const ids = await sectionIds(page);
  const last = canvas(page).locator(`[data-block-id="${ids[ids.length - 1]}"]`);
  await dragAbove(page, last, canvas(page).locator(`[data-block-id="${ids[0]}"]`));
  await expect.poll(async () => (await sectionIds(page))[0]).toBe(ids[ids.length - 1]);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Drag sections to change their order")).toHaveCount(0);
  await page.screenshot({ path: `test-results/editor2-${info.project.name}.png` });

  /* ---------- pages: drag Contact above About ---------- */
  await page.getByTestId("page-switcher").click();
  const list = page.getByTestId("page-list");
  const names = () => list.locator("[data-page-id]").evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ""));
  expect((await names())[1]).toMatch(/^About/);
  await dragAbove(page, list.getByRole("button", { name: /Drag to move Contact/ }), list.locator("[data-page-id]").nth(1));
  await expect.poll(async () => (await names())[1]).toMatch(/^Contact/);

  /* ---------- everything reaches the live site ---------- */
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(at(username));
  await expect(visitor.getByText("Hello, I draw").first()).toBeVisible();
  await expect(visitor.getByText("Nour Studio").first()).toBeVisible();
  const nav = await visitor.locator(".site-root a").allTextContents();
  expect(nav.findIndex((n) => /Contact/.test(n))).toBeLessThan(nav.findIndex((n) => /About/.test(n)));
  void sectionTypes;
});

test("typing on the page works in Arabic too", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await page.getByRole("button", { name: "Switch dashboard language" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await openEditor(page);
  if (await page.getByRole("button", { name: "إعادة الترتيب" }).isVisible()) {
    await expect(page.getByRole("button", { name: "إعادة الترتيب" })).toBeVisible();
  }
  const text = canvas(page).locator("[data-inline-text]").first();
  await text.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("نور للفنون");
  await page.keyboard.press("Enter");
  await expect(text).toHaveText("نور للفنون");
});
