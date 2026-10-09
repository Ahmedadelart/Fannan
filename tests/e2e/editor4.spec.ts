import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Phase 8, round 4: the header and footer are clicked and edited on the page, the contact form
// is shaped from its section, sample drawings replace dark tiles, the Arabic font always applies,
// the preview fills the screen, and lime always carries dark text.

test.describe.configure({ mode: "serial" });

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

const canvas = (page: Page) => page.getByTestId("canvas");

test("header, footer and contact form are edited on the page and reach the live site", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  const { username } = await signUp(page);
  await openEditor(page);

  // Placeholders are drawings now, not dark tiles.
  const bg = await canvas(page)
    .locator('[data-block-id] [aria-hidden="true"][style*="aspect-ratio"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain("/samples/");

  /* ---------- header ---------- */
  await canvas(page).locator('[data-site-part="header"]').click({ position: { x: 4, y: 4 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  const header = page.getByTestId("header-settings");
  await expect(header).toBeVisible();
  // Only settings for the header: it can't be dragged, copied or deleted.
  await expect(page.getByTestId("section-toolbar").getByRole("button")).toHaveCount(1);
  await header.getByRole("tab", { name: "Items" }).click();
  await header.getByRole("radio", { name: "Always" }).click();
  await header.getByRole("textbox", { name: "Button words" }).fill("Work with me");
  await expect(canvas(page).locator('[data-site-part="header"]')).toContainText("Work with me");
  // The tagline is typed in place.
  const tagline = canvas(page).locator('[data-site-part="header"] [data-inline-text]').nth(1);
  await tagline.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Characters with heart");

  /* ---------- footer ---------- */
  const footer = canvas(page).locator('[data-site-part="footer"]');
  await footer.scrollIntoViewIfNeeded();
  await footer.click({ position: { x: 4, y: 4 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("footer-settings")).toBeVisible();
  await footer.locator("[data-inline-text]").click();
  await page.keyboard.type("© Nour Adel. Cairo.");
  await expect(page.getByTestId("footer-settings").getByRole("textbox", { name: /Footer text/ })).toHaveValue(
    "© Nour Adel. Cairo.",
  );

  /* ---------- contact form ---------- */
  const contact = canvas(page).locator("[data-block-id]").filter({ has: page.getByTestId("contact-preview") });
  await contact.click({ position: { x: 10, y: 10 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  const card = page.getByTestId("block-settings");
  await card.getByRole("switch", { name: "Budget" }).click();
  await card.getByRole("textbox", { name: "Your own question" }).fill("How did you find me?");
  await card.getByRole("radio", { name: "Side by side" }).click();
  await expect(canvas(page).getByTestId("contact-preview")).toContainText("How did you find me?");
  await expect(canvas(page).getByTestId("contact-preview")).toContainText("Budget");

  /* ---------- full-screen preview ---------- */
  await page.getByTestId("preview-button").click();
  const box = await page.getByTestId("preview").boundingBox();
  expect(box!.width).toBeGreaterThan(1200);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("preview")).toBeHidden();

  /* ---------- publish, then the live site ---------- */
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  await expect(visitor.getByRole("link", { name: "Work with me" })).toBeVisible();
  await expect(visitor.getByText("Characters with heart", { exact: true }).first()).toBeVisible();
  await expect(visitor.getByText("© Nour Adel. Cairo.")).toBeVisible();
  await expect(visitor.getByRole("textbox", { name: "Budget" })).toBeVisible();
  await expect(visitor.getByRole("textbox", { name: "How did you find me?" })).toBeVisible();
});

test("the Arabic font applies on any site, and lime keeps dark text in the dark panels", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(120_000);
  await signUp(page);
  await openEditor(page);

  // A Pro badge in the dark section list: dark words on lime.
  const badge = page.getByTestId("left-panel").getByText("PRO", { exact: true }).first();
  await badge.scrollIntoViewIfNeeded();
  expect(await badge.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(20, 31, 0)");

  // English site: picking Marhey puts it in the font stack for Arabic words.
  await page.getByRole("button", { name: "Design" }).click();
  await page.getByRole("radio", { name: "Marhey" }).click();
  const stack = await canvas(page)
    .locator(".site-root")
    .first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--site-body"));
  expect(stack).toContain("marhey");
});

test("the editor is the app: home, projects, messages, stats and settings open inside it", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await signUp(page);
  // app.fannan.net opens the editor.
  await page.goto(at("app", "/"));
  await expect(page).toHaveURL(/\/editor/);
  await openEditor(page);

  const frame = page.frameLocator('[data-testid="panel-frame"]');
  await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name: "Home", exact: true }).last().click();
  await expect(frame.getByRole("heading", { level: 1, name: "Your site" })).toBeVisible({ timeout: 15_000 });
  // Inside the panel the page drops its own sidebar.
  await expect(frame.getByRole("navigation", { name: "App" })).toBeHidden();

  for (const [rail, heading] of [
    ["Messages", "Messages"],
    ["Stats", "Stats"],
    ["Settings", "Site settings"],
  ]) {
    await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name: rail, exact: true }).click();
    await expect(frame.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 15_000 });
  }

  // A new project opens right here; the site preview picks it up.
  await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("textbox", { name: "Project title" }).fill("Night market");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(frame.getByRole("heading", { level: 1, name: "Night market" })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/editor/);
});

test("full-width canvas and a settings card you can move", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);

  // Desktop: the site fills the canvas, no grey gaps beside it.
  const canvasBox = (await page.locator('[data-tip="canvas"]').boundingBox())!;
  const siteBox = (await canvas(page).boundingBox())!;
  expect(Math.abs(siteBox.width - canvasBox.width)).toBeLessThan(24);

  // No "Add section" under sections (it lives in the side panel).
  const first = canvas(page).locator("[data-block-id]").first();
  await first.click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole("button", { name: "Add section" })).toHaveCount(0);

  // The settings card moves by its top bar.
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  const card = page.getByTestId("block-settings");
  const a = (await card.boundingBox())!;
  const handle = (await page.getByTestId("settings-handle").boundingBox())!;
  await page.mouse.move(handle.x + 40, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 160, handle.y + 120, { steps: 6 });
  await page.mouse.up();
  const b = (await card.boundingBox())!;
  expect(a.x - b.x).toBeGreaterThan(150);
  expect(b.y - a.y).toBeGreaterThan(80);
  // A new selection puts the card back in its usual place.
  await canvas(page).locator("[data-block-id]").nth(1).click({ position: { x: 10, y: 10 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  const c = (await card.boundingBox())!;
  expect(Math.abs(c.x - a.x)).toBeLessThan(40);
  await page.screenshot({ path: `test-results/r4d-card-${info.project.name}.png` });
});

test("items: layers restack and hide, new kinds, quick toolbar first", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  await page.getByTestId("add-free-blank").click();
  const items = page.getByTestId("free-item");
  await expect(items).toHaveCount(2);

  // New kinds from the grouped menu.
  for (const name of ["Quote", "Social links", "List / FAQ"]) {
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  }
  await expect(items).toHaveCount(5);
  await expect(page.locator('[data-kind="quote"]')).toBeVisible();
  await expect(page.getByTestId("social-item")).toBeVisible();

  // Layers: newest on top; drag the bottom one to the top, then hide it.
  await page.getByTestId("layers-button").click();
  const rows = page.getByTestId("layers-panel").getByRole("listitem");
  await expect(rows).toHaveCount(5);
  const bottomName = await rows.last().textContent();
  const from = (await rows.last().boundingBox())!;
  const to = (await rows.first().boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 40, to.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect(rows.first()).toHaveText(bottomName!);
  await rows.first().hover();
  await rows.first().getByRole("button", { name: "Hide" }).click();
  await expect(page.locator("[data-hidden]")).toHaveCount(1);
  await page.screenshot({ path: `test-results/r5-layers-${info.project.name}.png` });

  // Selecting an item shows the quick toolbar; the pencil opens settings with Content and Design.
  await items.first().click({ force: true });
  await expect(page.getByTestId("free-toolbar")).toBeVisible();
  await page.getByTestId("item-edit").click();
  await expect(page.getByTestId("block-settings").getByRole("tab", { name: "Design" })).toBeVisible();
  // The item's card opens right beside the item.
  const itemBox = (await items.first().boundingBox())!;
  const cardBox = (await page.getByTestId("block-settings").boundingBox())!;
  const besideAfter = Math.abs(cardBox.x - (itemBox.x + itemBox.width)) < 40;
  const besideBefore = Math.abs(cardBox.x + cardBox.width - itemBox.x) < 40;
  expect(besideAfter || besideBefore).toBe(true);
  await page.screenshot({ path: `test-results/r5-item-${info.project.name}.png` });
});

test("header and footer: more settings in tabs", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  await canvas(page).locator('[data-site-part="header"]').click({ position: { x: 4, y: 4 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  const header = page.getByTestId("header-settings");
  await header.getByRole("tab", { name: "Items" }).click();
  await header.getByRole("switch", { name: "Social links in the header" }).click();
  await expect(page.getByTestId("header-social")).toBeVisible();
  await header.getByRole("tab", { name: "Style" }).click();
  await header.getByRole("switch", { name: "Drop shadow" }).click();
  await page.screenshot({ path: `test-results/r5-header-${info.project.name}.png` });

  const footer = canvas(page).locator('[data-site-part="footer"]');
  await footer.scrollIntoViewIfNeeded();
  await footer.click({ position: { x: 4, y: 4 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  const fs = page.getByTestId("footer-settings");
  await fs.getByRole("radio", { name: "Three columns" }).click();
  await fs.getByRole("tab", { name: "Items" }).click();
  await fs.getByRole("switch", { name: "Site name" }).click();
  await fs.getByRole("textbox", { name: "Email address" }).fill("nour@example.com");
  await expect(footer).toContainText("nour@example.com");
  await page.screenshot({ path: `test-results/r5-footer-${info.project.name}.png` });
});

test("the pencil opens and closes settings; a box picks several items to move together", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  await page.getByTestId("add-free-blank").click();
  const items = page.getByTestId("free-item");
  await expect(items).toHaveCount(2);
  const card = page.getByTestId("block-settings");

  // The pencil toggles the card.
  await items.first().click();
  await page.getByTestId("item-edit").click();
  await expect(card).toBeVisible();
  await page.getByTestId("item-edit").click();
  await expect(card).toBeHidden();

  // With the card open, picking another item closes it.
  await page.getByTestId("item-edit").click();
  await expect(card).toBeVisible();
  await items.nth(1).click();
  await expect(card).toBeHidden();

  // Drag a box over both items from an empty spot.
  const grid = page.getByTestId("free-grid");
  const g = (await grid.boundingBox())!;
  const a = (await items.first().boundingBox())!;
  const b = (await items.nth(1).boundingBox())!;
  const top = Math.min(a.y, b.y) - 6;
  const bottom = Math.max(a.y + a.height, b.y + b.height) + 6;
  const startX = g.x + g.width - 20;
  await page.mouse.move(startX, top);
  await page.mouse.down();
  await page.mouse.move(Math.min(a.x, b.x) - 4, bottom, { steps: 10 });
  await expect(page.getByTestId("free-marquee")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("group-toolbar")).toContainText("2 items picked");
  await page.screenshot({ path: `test-results/r6-group-${info.project.name}.png` });

  // Move them together with the arrow keys.
  const xs = await items.evaluateAll((els) => els.map((el) => Number((el as HTMLElement).style.getPropertyValue("--x"))));
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => items.evaluateAll((els) => els.map((el) => Number((el as HTMLElement).style.getPropertyValue("--x")))))
    .toEqual(xs.map((x) => x + 1));

  // Delete both.
  await page.getByTestId("group-toolbar").getByRole("button", { name: "Delete" }).click();
  await expect(items).toHaveCount(0);
});

test("keyboard shortcuts: undo, redo, copy, paste, duplicate, delete, select all, help", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  const sections = canvas(page).locator("[data-block-id]");
  const n = await sections.count();

  // Sections: copy and paste, undo, redo, duplicate, delete.
  await sections.first().click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(sections).toHaveCount(n + 1);
  await page.keyboard.press("Control+z");
  await expect(sections).toHaveCount(n);
  await page.keyboard.press("Control+y");
  await expect(sections).toHaveCount(n + 1);
  await page.keyboard.press("Control+d");
  await expect(sections).toHaveCount(n + 2);
  await page.keyboard.press("Delete");
  await expect(sections).toHaveCount(n + 1);
  await page.keyboard.press("Control+z");
  await expect(sections).toHaveCount(n + 2);
  await page.keyboard.press("Control+Shift+z");
  await expect(sections).toHaveCount(n + 1);

  // Items: copy, paste, select all.
  await page.getByTestId("add-free-blank").click();
  const items = page.getByTestId("free-item");
  await items.first().click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(items).toHaveCount(3);
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("group-toolbar")).toContainText("3 items picked");
  await page.keyboard.press("Escape");

  // ? shows the list of shortcuts.
  await page.keyboard.press("Shift+?");
  await expect(page.getByTestId("shortcuts")).toBeVisible();
});

test("dropdown menus: pages inside a menu item open from the header", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);

  // A dropdown called Artwork, and a Sketches page inside it.
  await page.getByTestId("page-switcher").click();
  await page.getByRole("button", { name: "Dropdown", exact: true }).click();
  await page.getByRole("tab", { name: "Page settings" }).click();
  await page.getByRole("textbox", { name: "Page name" }).fill("Artwork");
  await page.getByTestId("page-switcher").click();
  await page.getByRole("button", { name: "Gallery page", exact: true }).click();
  await page.getByRole("tab", { name: "Page settings" }).click();
  await page.getByRole("textbox", { name: "Page name" }).fill("Sketches");
  await page.getByTestId("page-parent").selectOption({ label: "Artwork" });

  const dd = canvas(page).getByTestId("nav-dropdown");
  await expect(dd).toContainText("Artwork");
  await dd.hover();
  await expect(canvas(page).getByTestId("nav-dropdown-menu")).toContainText("Sketches");

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await visitor.goto(at(username));
  await expect(visitor.getByRole("link", { name: "Sketches" })).toBeHidden();
  await visitor.getByRole("button", { name: /Artwork/ }).hover();
  await expect(visitor.getByRole("link", { name: "Sketches" })).toBeVisible();
  await visitor.getByRole("link", { name: "Sketches" }).click();
  // A new page keeps its first web address (work-N) after it is renamed.
  await expect(visitor).toHaveURL(/\/(work|sketches)[a-z0-9-]*$/);
  await visitor.screenshot({ path: `test-results/r7-dropdown-${info.project.name}.png` });
});

test("the preview is clickable: menu links switch pages, the contact form doesn't send", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  await page.getByTestId("preview-button").click();
  const preview = page.getByTestId("preview");
  await preview.getByRole("link", { name: "About", exact: true }).click();
  await expect(preview.getByRole("link", { name: "About", exact: true })).toHaveAttribute("aria-current", "page");
  await preview.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(preview.getByRole("link", { name: "Contact", exact: true })).toHaveAttribute("aria-current", "page");
  // Still in the editor, nothing navigated away.
  await expect(page).toHaveURL(/\/editor/);
});

test("section design: gradient, wave edge, pattern and card reach the live site", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "mobile";
  if (!phone) await page.setViewportSize({ width: 1440, height: 900 });
  const { username } = await signUp(page);
  await openEditor(page);
  const about = canvas(page).locator("[data-block-id]").nth(1);
  await about.click({ position: { x: 10, y: 10 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  const card = page.getByTestId("block-settings");
  await card.getByRole("tab", { name: "Design" }).click();
  const design = page.getByTestId("section-design");
  await design.getByRole("radio", { name: "Gradient" }).click();
  await design.getByRole("radiogroup", { name: "Top edge" }).getByRole("radio", { name: "Wave" }).click();
  await design.getByRole("radiogroup", { name: "Bottom edge" }).getByRole("radio", { name: "Torn paper" }).click();
  await expect(about).toHaveAttribute("data-band", "true");
  await expect(about.locator('[data-edge="top"]')).toBeVisible();
  await design.getByRole("switch", { name: "Content in a card" }).click();
  await expect(about.getByTestId("section-card")).toBeVisible();
  // A second section with a pattern.
  const contact = canvas(page).locator("[data-block-id]").last();
  await contact.click({ position: { x: 10, y: 10 } });
  await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  await card.getByRole("tab", { name: "Design" }).click();
  await design.getByRole("radio", { name: "Pattern" }).click();
  await design.getByRole("radio", { name: "Doodles" }).click();
  await expect(contact.getByTestId("section-pattern")).toBeVisible();
  await page.screenshot({ path: `test-results/r7-design-${info.project.name}.png` });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
  const visitor = await (await browser.newContext({ ...info.project.use })).newPage();
  await visitor.goto(at(username));
  const band = visitor.locator("section[data-band]").first();
  await expect(band).toBeVisible();
  expect(await band.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("gradient");
  await expect(band.locator('[data-edge="top"]')).toHaveCount(1);
  await expect(visitor.getByTestId("section-pattern")).toHaveCount(1);
  const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await visitor.screenshot({ path: `test-results/r7-live-${info.project.name}.png`, fullPage: true });
});

test("decorations: underline, arrow, doodle, badge, icon and their controls", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signUp(page);
  await openEditor(page);
  await page.getByTestId("add-free-blank").click();
  const add = async (name: string) => {
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  };
  for (const name of ["Underline", "Arrow", "Doodle", "Badge", "Icon", "Divider", "Highlight", "Panel"]) await add(name);
  await expect(page.locator('[data-deco="underline"]')).toBeVisible();
  await expect(page.locator('[data-deco="arrow"]')).toBeVisible();

  // The arrow's controls change its drawing.
  const arrow = page.locator('[data-kind="arrow"]');
  await arrow.click();
  await page.getByTestId("item-edit").click();
  const card = page.getByTestId("block-settings");
  await card.getByRole("tab", { name: "Design" }).click();
  const before = await arrow.locator("path").first().getAttribute("d");
  await card.getByRole("slider", { name: "Curve" }).fill("-80");
  await expect.poll(() => arrow.locator("path").first().getAttribute("d")).not.toBe(before);
  await card.getByRole("radio", { name: "Both ends" }).click();
  await expect(arrow.locator("path")).toHaveCount(3);

  // The underline's style and wave height.
  const underline = page.locator('[data-kind="underline"]');
  await underline.click({ force: true });
  await page.getByTestId("item-edit").click();
  await card.getByRole("tab", { name: "Design" }).click();
  const wave = await underline.locator("path").first().getAttribute("d");
  await card.getByRole("radio", { name: "Zigzag" }).click();
  await expect.poll(() => underline.locator("path").first().getAttribute("d")).not.toBe(wave);
  await page.screenshot({ path: `test-results/r7-deco-${info.project.name}.png` });
});
