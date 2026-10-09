import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Round 8: the guided setup. Questions one at a time, then the site is built from the answers.

const fixture = (name: string) => `tests/fixtures/${name}`;

async function next(page: Page, step: number) {
  await page.getByTestId("guide-next").click();
  await expect(page.getByTestId("guide-step")).toContainText(`Step ${step} of 8`);
}

test("the guided setup builds the site from the answers", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop", "Dragging and the full flow at desktop size; phones below.");
  test.setTimeout(240_000);
  const { username } = await signUp(page, undefined, undefined, { guide: true });

  // 1. What you do: already known from sign-up.
  await expect(page.getByTestId("guide-step")).toContainText("Step 1 of 8");
  await expect(page.getByRole("button", { name: "Character designer" })).toHaveAttribute("aria-pressed", "true");
  await next(page, 2);

  // 2. The name, in one of our fonts.
  await expect(page.getByTestId("guide-name")).toHaveValue("Nour Adel");
  await page.getByRole("radio", { name: "Syne" }).click();
  await page.screenshot({ path: "test-results/r8-guide-name.png" });
  await next(page, 3);

  // 3. The look.
  await page.getByRole("radio", { name: "Night" }).click();
  await next(page, 4);

  // 4. Pages: add, rename by clicking, make a dropdown, put pages in it, drag it up.
  const pages = page.getByTestId("guide-pages");
  await page.getByTestId("guide-suggestions").getByRole("button", { name: "Sketchbook" }).click();
  await page.getByTestId("guide-add-folder").click();
  await pages.getByRole("button", { name: "Sketchbook", exact: true }).click();
  await page.getByTestId("guide-page-rename").fill("Sketches");
  await page.keyboard.press("Enter");
  for (const name of ["Sketches", "About"]) {
    await pages.locator("li", { hasText: name }).getByTestId("guide-page-menu").click();
    await page.getByRole("menuitem", { name: "Move into “More”" }).click();
  }
  const names = () => pages.getByTestId("guide-page-name").allInnerTexts();
  await expect.poll(names).toEqual(["Home", "Contact", "More", "About", "Sketches"]);
  const handle = (await page.getByRole("button", { name: "Drag More to move it" }).boundingBox())!;
  const contact = (await pages.locator("li", { hasText: "Contact" }).boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 10, contact.y + 30, { steps: 6 });
  await page.mouse.move(handle.x + 10, contact.y + 4, { steps: 6 });
  await page.mouse.up();
  await expect.poll(names).toEqual(["Home", "More", "About", "Sketches", "Contact"]);
  await page.screenshot({ path: "test-results/r8-guide-pages.png" });
  await next(page, 5);

  // 5. Projects: real projects, each with a card size, card text and a place in the menu.
  for (const [title, size] of [
    ["Sandstorm", "Big"],
    ["Moonlight", "Wide"],
  ] as const) {
    await page.getByTestId("guide-project-name").fill(title);
    await page.getByTestId("guide-project-add").click();
    const card = page.getByTestId("guide-projects").locator("li").first();
    await expect(card.getByRole("textbox", { name: "Project name" })).toHaveValue(title);
    await card.getByRole("radio", { name: size }).click();
    await card.getByRole("radio", { name: "Title + details" }).click();
    await card.getByRole("switch", { name: "Show in the menu" }).click();
  }
  await page.screenshot({ path: "test-results/r8-guide-projects.png" });
  await next(page, 6);

  // 6. Inside a project: pictures, and a part with a headline.
  await page.getByRole("tab", { name: "Sandstorm" }).click();
  await page.getByTestId("guide-files").setInputFiles([fixture("photo.jpg")]);
  await expect(page.getByTestId("guide-items").locator("li")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("guide-add-part").click();
  await page.getByTestId("guide-part-title").fill("Final frames");
  await page.screenshot({ path: "test-results/r8-guide-inside.png" });
  await next(page, 7);

  // 7. Page by page: Contact gets testimonials.
  await expect(page.getByTestId("guide-templates")).toBeVisible();
  await page.getByRole("tab", { name: "Contact" }).click();
  await page.getByTestId("guide-extra-testimonials").check();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Studio Nile");
  await page.getByRole("textbox", { name: "What they said" }).fill("A joy to work with.");
  await page.screenshot({ path: "test-results/r8-guide-page.png" });

  // 8. Build.
  await page.getByTestId("guide-build-now").click();
  await expect(page.getByTestId("guide-summary")).toContainText("Sketches");
  await page.getByTestId("guide-build").click();
  await expect(page).toHaveURL(/\/editor/, { timeout: 30_000 });
  await expect(page.getByText("Your site is ready. Change anything you like.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("canvas").getByText("Nour Adel").first()).toBeVisible();

  // The editor's first-time tips still show after the guide.
  const tips = page.getByRole("dialog");
  for (let i = 0; i < 6 && (await tips.isVisible().catch(() => false)); i++) {
    await page.getByRole("button", { name: /^(Next|Got it)$/ }).click();
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  // The menu: a "More" dropdown with two pages, Contact, and the projects in their own dropdown.
  const menus = visitor.getByTestId("nav-dropdown");
  await expect(menus.filter({ hasText: "More" }).getByTestId("nav-dropdown-menu")).toContainText("Sketches");
  await expect(menus.filter({ hasText: "More" }).getByTestId("nav-dropdown-menu")).toContainText("About");
  await expect(menus.filter({ hasText: "Projects" }).getByTestId("nav-dropdown-menu")).toContainText("Sandstorm");
  await expect(visitor.getByRole("link", { name: "Contact" }).first()).toBeVisible();
  // Project cards use each project's own size.
  await expect(visitor.locator('[data-card-size="l"]')).toHaveCount(1);
  await expect(visitor.locator('[data-card-size="wide"]')).toHaveCount(1);
  await visitor.screenshot({ path: "test-results/r8-guide-live.png", fullPage: true });
  // The project's page shows its part.
  await visitor.goto(at(username, "/sandstorm"));
  await expect(visitor.getByTestId("project-part")).toContainText("Final frames");

  // Home: run it again (with a warning), and bring back the site from before.
  await page.goto(at("app", "/home"));
  await expect(page.getByTestId("guide-card")).toContainText("Backup from");
  await page.goto(at("app", "/guide"));
  // Running it again starts from the same answers, at the first step.
  await expect(page.getByTestId("guide-step")).toContainText("Step 1 of 8");
  for (const n of [2, 3, 4]) await next(page, n);
  await page.getByTestId("guide-build-now").click();
  await expect(page.getByTestId("guide-rerun")).toBeVisible();
  await page.goto(at("app", "/home"));
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("guide-restore").click();
  await expect(page).toHaveURL(/\/editor/, { timeout: 20_000 });
});

test("guided setup on a phone: resumes after a reload, skips, builds; no sideways scroll", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Phone layout.");
  test.setTimeout(180_000);
  await signUp(page, undefined, undefined, { guide: true });
  await next(page, 2);
  await page.getByTestId("guide-name").fill("Nour A.");
  await next(page, 3);
  await page.screenshot({ path: "test-results/r8-guide-phone-look.png", fullPage: true });
  // Answers are saved: a reload comes back to the same step with the same name.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId("guide-step")).toContainText("Step 3 of 8");
  await page.getByTestId("guide-skip").click();
  await expect(page.getByTestId("guide-step")).toContainText("Step 4 of 8");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/r8-guide-phone-pages.png", fullPage: true });
  await page.getByTestId("guide-build-now").click();
  await expect(page.getByTestId("guide-summary")).toContainText("Nour A.");
  await page.getByTestId("guide-build").click();
  await expect(page).toHaveURL(/\/editor/, { timeout: 30_000 });
});

test("Arabic: the choice screen and the guide, right to left", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUp(page, undefined, undefined, { guide: true });
  // The account was made in English; switch the app to Arabic for the guide.
  await page.goto(at("app", "/__locale?to=ar&back=/guide"));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("guide-step")).toContainText("الخطوة 1 من 8");
  await page.getByTestId("guide-next").click();
  await page.getByTestId("guide-next").click();
  await page.getByTestId("guide-next").click();
  await expect(page.getByTestId("guide-pages")).toBeVisible();
  await page.screenshot({ path: "test-results/r8-guide-ar.png" });
  await context.close();
});
