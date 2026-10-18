import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Showcase blocks (for portfolios like ahmedadel.art, available to everyone): project fields for rich
// project pages, a section header, project grids by tag with role captions, and the project feature.

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

test("project fields, section header, grid by tag and project feature reach the live site", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);

  // A project with the new fields.
  await page.goto(at("app", "/projects"));
  await page.getByTestId("new-project").click();
  await page.getByTestId("new-project-file").setInputFiles("tests/fixtures/photo.jpg");
  await page.getByTestId("new-project-name").fill("Zakia Al Zakia");
  await page.getByTestId("new-project-save").click();
  await expect(page).toHaveURL(/\/projects\/[\w-]+$/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Your role").fill("Animation Supervisor");
  await page.getByLabel("Tags").fill("broadcast");
  await page.getByTestId("project-network").fill("Majid TV");
  await page.getByTestId("project-details").fill("Episodes: 26\nDates: 2020 – 2022");
  await page.getByTestId("project-credits").fill("Directed by: Ahmed Gamal");
  await page.getByTestId("project-tools").fill("Blender, Quill VR");
  await page.getByLabel("Description", { exact: true }).first().fill("The first Arabic superhero-girl series.\n\nI led the animation team for 2.5 years.");
  await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);

  // The tags filter on the projects page.
  await page.goto(at("app", "/projects"));
  await expect(page.getByTestId("project-tags")).toContainText("#broadcast");

  // A page with a section header, a grid of #broadcast projects and the project feature.
  await openEditor(page);
  // The first click can land while the editor is still waking up: try again until the header is there.
  await expect(async () => {
    if (!(await page.getByTestId("canvas").getByTestId("section-header").count())) await page.getByTestId("add-header").click();
    await expect(page.getByTestId("canvas").getByTestId("section-header").last()).toContainText("01", { timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await page.getByTestId("add-grid").click();
  const grid = page.getByTestId("canvas").locator("[data-block-id]").filter({ has: page.locator(".site-grid") }).last();
  await grid.scrollIntoViewIfNeeded();
  await grid.click({ position: { x: 10, y: 10 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Shows projects from").selectOption("tag:broadcast");
  const lines = page.getByTestId("gallery-lines");
  await lines.getByRole("button", { name: "Network or client" }).click();
  await lines.getByRole("button", { name: "Role" }).click();
  await page.getByRole("switch", { name: "Role in the accent colour" }).or(page.getByLabel("Role in the accent colour")).first().click();
  await page.keyboard.press("Escape");
  await page.getByTestId("add-feature").click();
  const feature = page.getByTestId("canvas").locator("[data-block-id]").last();
  await feature.scrollIntoViewIfNeeded();
  await feature.click({ position: { x: 10, y: 10 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("feature-project").selectOption({ label: "Zakia Al Zakia" });
  await expect(page.getByTestId("canvas").getByTestId("project-feature")).toContainText("Animation Supervisor");
  await expect(page.getByTestId("canvas").getByTestId("video-soon")).toBeVisible();
  await page.screenshot({ path: "test-results/showcase-editor.png" });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });

  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  await expect(visitor.getByTestId("section-header").last()).toContainText("Selected work");
  // The new grid (the starter page has an older one higher up).
  const caption = visitor.locator(".site-tile figcaption").filter({ hasText: "Majid TV" }).first();
  await expect(caption).toContainText("Zakia Al Zakia");
  // The role is in the (readable) accent colour, not the muted grey of the network line.
  const colorOf = (text: string) => caption.getByText(text, { exact: true }).evaluate((el) => getComputedStyle(el).color);
  expect(await colorOf("Animation Supervisor")).not.toBe(await colorOf("Majid TV"));
  const feat = visitor.getByTestId("project-feature");
  await expect(feat).toContainText("Blender");
  await expect(feat.getByTestId("video-soon")).toHaveCount(0);
  await visitor.screenshot({ path: "test-results/showcase-live.png", fullPage: true });

  // The project page: lead line, role pill, meta row, words, credits, tools.
  await feat.getByRole("link", { name: /View project/ }).click();
  const pg = visitor.getByTestId("project-page");
  await expect(pg.getByRole("heading", { level: 1 })).toHaveText("Zakia Al Zakia");
  await expect(pg).toContainText("The first Arabic superhero-girl series.");
  await expect(visitor.getByTestId("project-role")).toHaveText("Animation Supervisor");
  await expect(visitor.getByTestId("project-meta")).toContainText("Majid TV");
  await expect(visitor.getByTestId("project-meta")).toContainText("26");
  await expect(visitor.getByTestId("project-words")).toContainText("2.5 years");
  await expect(pg).toContainText("Directed by");
  await expect(pg).toContainText("Quill VR");
  await visitor.screenshot({ path: "test-results/showcase-project.png", fullPage: true });
});
