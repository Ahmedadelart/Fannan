import { expect, test, type Page } from "@playwright/test";
import { at, signUp, uniq } from "./helpers";
import { editSection, openEditor } from "./editor-helpers";

// Round 9: a link page (like Linktree) on the artist's own site, with a QR code and short links.

const DB = "http://127.0.0.1:8080/v1/projects/demo-fannan/databases/(default)/documents";
const admin = { Authorization: "Bearer owner", "Content-Type": "application/json" };

async function publish(page: Page) {
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
}

async function makePro(username: string) {
  const name = (await (await fetch(`${DB}/usernames/${username}`, { headers: admin })).json()) as { fields: { uid: { stringValue: string } } };
  const uid = name.fields.uid.stringValue;
  await fetch(`${DB}/users/${uid}?updateMask.fieldPaths=plan`, {
    method: "PATCH",
    headers: admin,
    body: JSON.stringify({ fields: { plan: { stringValue: "pro" } } }),
  });
}

test("a link page with buttons, a QR code and short links; Pro extras", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop", "Made in the editor at desktop size; the page itself is checked on a phone below.");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);

  // Pages → Link page, at /links.
  await page.getByTestId("page-switcher").click();
  await page.getByRole("button", { name: "Link page", exact: true }).click();
  await page.getByTestId("page-settings-button").click();
  await page.getByRole("textbox", { name: "Address" }).fill("links");
  const canvas = page.getByTestId("canvas");
  await expect(canvas.getByTestId("link-page")).toBeVisible();
  // No menu on a link page.
  await expect(canvas.locator('[data-site-part="header"]')).toHaveCount(0);

  // Its settings: add a link that pulses.
  await canvas.locator("[data-block-id]").first().click({ position: { x: 20, y: 300 } });
  await editSection(page);
  const settings = page.getByTestId("links-settings");
  await expect(settings).toBeVisible();
  await settings.getByTestId("links-add").click();
  await settings.getByRole("textbox", { name: "Words on the button" }).fill("My shop");
  await settings.getByRole("textbox", { name: "Address", exact: true }).fill("https://example.com/shop");
  await settings.getByRole("radio", { name: "Pulse" }).click();
  await expect(canvas.getByText("My shop")).toBeVisible();

  // Sharing: a QR code, and a random short link on Free (choosing the words is Pro).
  await expect(settings.getByTestId("links-qr")).toBeVisible();
  await expect(settings.getByTestId("short-custom")).toBeDisabled();
  await settings.getByTestId("short-make").click();
  const short = settings.getByTestId("short-link").first();
  await expect(short).toHaveText(/\/l\/[a-z2-9]{6}$/);
  const shortUrl = `http://${(await short.innerText()).trim()}`;
  await page.screenshot({ path: "test-results/r9-links-editor.png" });

  await publish(page);
  const visitor = await (await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })).newPage();
  await visitor.goto(at(username, "/links"));
  await expect(visitor.getByTestId("link-page")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "My shop" })).toHaveAttribute("href", "https://example.com/shop");
  // Free: the animation is kept for Pro, so the button doesn't pulse.
  await expect(visitor.locator(".site-link-pulse")).toHaveCount(0);
  const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await visitor.screenshot({ path: "test-results/r9-links-phone.png", fullPage: true });

  // The short link opens the link page.
  await visitor.goto(shortUrl);
  await expect(visitor).toHaveURL(new RegExp(`${username}\\.fannan\\.localhost:\\d+/links$`));

  // Pro: the button pulses, words of your own for a short link, and clicks per link.
  await makePro(username);
  await openEditor(page);
  await page.getByTestId("page-switcher").click();
  await page.getByRole("button", { name: "Links Link page" }).click();
  await canvas.locator("[data-block-id]").first().click({ position: { x: 20, y: 300 } });
  await editSection(page);
  const word = `n${uniq()}`.slice(0, 20);
  await settings.getByTestId("short-custom").fill(word);
  await settings.getByRole("button", { name: "Create" }).click();
  await expect(settings.getByTestId("short-link").first()).toHaveText(new RegExp(`/l/${word}$`));
  // Nothing to publish: the live site follows the plan by itself (within half a minute).
  await expect
    .poll(
      async () => {
        await visitor.goto(at(username, "/links"));
        return visitor.locator(".site-link-pulse").count();
      },
      { timeout: 60_000, intervals: [5_000] },
    )
    .toBe(1);
  await visitor.getByRole("link", { name: "My shop" }).click({ force: true });
  await openEditor(page);
  await page.getByTestId("page-switcher").click();
  await page.getByRole("button", { name: "Links Link page" }).click();
  await canvas.locator("[data-block-id]").first().click({ position: { x: 20, y: 300 } });
  await editSection(page);
  await expect(settings.getByText("1 click")).toBeVisible({ timeout: 15_000 });

  // The Stats page shows the clicks per button and the short links' visits.
  await page.goto(at("app", "/stats"));
  await expect(page.getByTestId("link-clicks")).toContainText("My shop");
  await expect(page.getByTestId("link-clicks")).toContainText("1 click");
  await expect(page.getByTestId("short-link-visits")).toContainText(word);
  await page.screenshot({ path: "test-results/r9-stats.png", fullPage: true });
});
