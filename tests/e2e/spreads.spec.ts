import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";
import { addSection, openEditor, publishAndWait } from "./editor-helpers";

// Round 19 (Eslam Aboshady's site): a project spread (one project per screen, pictures at true
// proportions), a brand section, the page index rail, and project pages as a reader.

async function projectWithThreePhotos(page: Page, title: string) {
  await page.goto(at("app", "/projects"));
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByTestId("new-project-save").click();
  await expect(page).toHaveURL(/\/projects\/[\w-]+$/);
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    if (!(await page.getByTestId("media-item").count()))
      await page
        .getByTestId("file-input")
        .setInputFiles(["tests/fixtures/photo.jpg", "tests/fixtures/photo.jpg", "tests/fixtures/photo.jpg"]);
    await expect(page.getByTestId("media-item")).toHaveCount(3, { timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText(/Uploading|Making web versions/)).toHaveCount(0, { timeout: 60_000 });
  await page.getByRole("textbox", { name: "Project title" }).fill(title);
  await page.getByRole("textbox", { name: "Your role" }).fill("Character designer");
  await page.getByRole("textbox", { name: "Client" }).fill("Studio One");
  await expect(page.getByTestId("save-state")).toContainText("Saved", { timeout: 10_000 });
  await page.waitForTimeout(800);
}

test("a project spread, a brand section, the page index and the reader reach the live site", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "mobile";
  const { username } = await signUp(page);
  await projectWithThreePhotos(page, "Night Market");
  await openEditor(page);
  const canvas = page.getByTestId("canvas");

  // A spread of that project: the lead and two sheets, at true proportions.
  await addSection(page, "spread");
  const settings = page.getByTestId("block-settings");
  await expect(settings).toBeVisible();
  await settings.getByTestId("spread-project").selectOption({ label: "Night Market" });
  await expect(canvas.getByTestId("spread-art").first().locator("img")).toHaveCount(3);
  await expect(settings.getByTestId("spread-pictures").getByRole("button")).toHaveCount(3);

  // A brand section with its own colours.
  await addSection(page, "brand");
  await expect(canvas.getByTestId("brand-section")).toBeVisible();

  if (!phone) {
    // Design: the page index at the side, and project pages as a reader.
    const nav = page.getByRole("navigation", { name: "Editor" });
    await nav.getByRole("button", { name: "Design", exact: true }).click();
    await page.getByTestId("design-card-nav").click();
    await page.getByTestId("header-settings").getByRole("tab", { name: "Items" }).click();
    await page.getByRole("switch", { name: "Page index at the side (wide screens)" }).click();
    await page.getByTestId("design-back").click();
    await page.getByTestId("design-card-styles").click();
    await page.getByRole("radio", { name: "Reader: every sheet a screen" }).click();
    await nav.getByRole("button", { name: "Pages", exact: true }).click();
  }
  await publishAndWait(page);

  const visitor = await (await browser.newContext({ ...info.project.use })).newPage();
  await visitor.goto(at(username));
  const spread = visitor.locator("[data-spread]").first();
  await expect(spread).toBeVisible();
  await expect(spread.locator("img")).toHaveCount(3);
  await expect(visitor.getByTestId("brand-section")).toBeVisible();
  if (phone) {
    // Under 900px the pieces stack: no side layout.
    await expect(spread.locator(".site-spread-wrap")).not.toHaveAttribute("data-side");
    const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    return;
  }
  // Desktop: the words sit beside the art; the rail lists the spread.
  await expect(spread.locator(".site-spread-wrap")).toHaveAttribute("data-side", "");
  await expect(visitor.getByTestId("site-rail").getByRole("link", { name: "Night Market" })).toBeVisible();
  await visitor.screenshot({ path: `test-results/r19-spread-${info.project.name}.png` });

  // The reader: every sheet a screen, arrow keys step, Close goes back to the spread.
  await spread.locator(".site-spread-lead").click();
  await expect(visitor).toHaveURL(/\/night-market#sheet-0$/);
  await expect(visitor.getByTestId("project-reader")).toBeVisible();
  await expect(visitor.locator("[data-sheet]")).toHaveCount(3);
  await expect(visitor.getByTestId("reader-meta")).toContainText("Studio One");
  const y0 = await visitor.evaluate(() => window.scrollY);
  await visitor.keyboard.press("ArrowDown");
  await expect.poll(() => visitor.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
  await visitor.screenshot({ path: `test-results/r19-reader-${info.project.name}.png` });
  await visitor.getByTestId("reader-close").click();
  await expect(visitor).toHaveURL(/\/#s-[\w-]+$/);
  await expect(visitor.locator("[data-spread]").first()).toBeVisible();
});
