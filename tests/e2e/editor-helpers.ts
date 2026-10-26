import { expect, type Page } from "@playwright/test";
import { at } from "./helpers";

// Round 18: one copy of the editor steps every spec uses, so later editor changes only touch this file.

/** Clicks through the first-visit tips, waiting for each to change before the next click. */
export async function closeTips(page: Page) {
  const tips = page.getByRole("dialog");
  for (let i = 0; i < 6 && (await tips.isVisible().catch(() => false)); i++) {
    const before = await tips.getAttribute("aria-label");
    await page.getByRole("button", { name: /^(Next|Got it|التالي|فهمت)$/ }).click();
    await expect
      .poll(async () => ((await tips.isVisible()) ? await tips.getAttribute("aria-label") : "closed"))
      .not.toBe(before);
  }
}

/** Opens the editor with the tips out of the way. */
export async function openEditor(page: Page) {
  await page.goto(at("app", "/editor"));
  await page.getByRole("dialog").waitFor({ timeout: 3000 }).catch(() => {});
  await closeTips(page);
  await page.waitForLoadState("networkidle");
}

/** Opens a panel from the editor's left bar ("Design", "Projects", "Settings"…). */
export async function openRail(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name }).first().click();
}

/** The site language lives in Settings (round 18). Leaves the browser on the Settings page. */
export async function setSiteLanguage(page: Page, language: "en" | "ar") {
  await page.goto(at("app", "/settings"));
  const radio = page.getByRole("radio", { name: language === "ar" ? /^Arabic only/ : /^English only/ });
  await expect(async () => {
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/^Saved\./)).toBeVisible({ timeout: 10_000 });
}

/** Publishes from the editor and waits until the live site has the changes. */
export async function publishAndWait(page: Page) {
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
}

/** Opens the selected (or hovered) section's settings from its action card ("Edit section"). */
export async function editSection(page: Page) {
  const settings = page.getByTestId("block-settings");
  if (!(await settings.isVisible())) await page.getByTestId("section-toolbar").getByTestId("section-edit").click();
  await expect(settings).toBeVisible();
}

/** Adds a section from the library. A new section opens in Edit section (round 18), so this goes
 *  back to the library first when settings fill the side panel. */
export async function addSection(page: Page, key: string) {
  const back = page.getByTestId("settings-back");
  if (await back.isVisible()) await back.click();
  // Round 18: the library lists kinds of sections first; open the one that holds this section.
  const pagesBack = page.getByTestId("pages-back");
  if (await pagesBack.isVisible()) await pagesBack.click();
  const tile = page.getByTestId(`add-${key}`);
  if (!(await tile.isVisible())) {
    const libraryBack = page.getByTestId("library-back");
    if (await libraryBack.isVisible()) await libraryBack.click();
    await page.locator(`[data-library-keys~="${key}"]`).click();
  }
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
}

/** Switches the open settings to a tab: "Content" or "Style" (round 18). */
export async function settingsTab(page: Page, name: "Content" | "Style") {
  await page.getByTestId("block-settings").getByRole("tab", { name, exact: true }).click();
}

/** Opens "More options" in a section's Content tab (round 18), if it isn't open already. */
export async function contentMore(page: Page) {
  const more = page.getByTestId("block-settings").getByTestId("content-more");
  if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
}
