import { expect, test, type Locator, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Round 13 (C): select words on the canvas, format them with the toolbar, and see it on the live site.

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

/** Select the first `n` letters of an editable text. */
async function selectStart(field: Locator, n: number) {
  await field.evaluate((el, n) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode()!;
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, n);
    (el as HTMLElement).focus();
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
  }, n);
}

test("bold, link and colour on selected words reach the live site; pasted code is stripped", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);
  await page.getByTestId("add-d-split-left").click();
  const heading = page.getByTestId("canvas").locator('[data-kind="text"]').last();
  await heading.scrollIntoViewIfNeeded();
  await heading.click();
  await heading.dblclick();
  const field = heading.locator("[data-inline-text][data-rich]");
  await expect(field).toBeVisible();

  // The first letters → bold, then a link.
  await selectStart(field, 4);
  await expect(page.getByTestId("text-toolbar")).toBeVisible();
  await expect(page.getByTestId("tt-sliders")).toBeVisible();
  await page.getByTestId("tt-bold").click();
  await expect(field.locator("b")).toHaveText("A st");
  await selectStart(field, 4);
  await page.getByTestId("tt-link").click();
  await page.getByTestId("tt-href").fill("example.com/work");
  await page.getByTestId("tt-href-ok").click();
  await expect(field.locator("a")).toHaveAttribute("href", "https://example.com/work");

  // Something nasty typed into the field is cleaned before it's saved.
  await field.evaluate((el) => {
    el.insertAdjacentHTML("beforeend", ' <img src=x onerror="window.__hacked=1"><script>window.__hacked=2</script><i>soft</i>');
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/r13-textbar.png" });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  const live = visitor.locator(".site-free-text").filter({ has: visitor.locator("b") }).last();
  await expect(live.locator("b")).toContainText("A st");
  await expect(live.locator("a")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(live.locator("a")).toHaveAttribute("href", "https://example.com/work");
  await expect(live.locator("i")).toHaveText("soft");
  await expect(live.locator("img, script")).toHaveCount(0);
  expect(await visitor.evaluate(() => (window as unknown as { __hacked?: number }).__hacked)).toBeUndefined();
});
