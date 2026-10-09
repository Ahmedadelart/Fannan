import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Phase 3 main flow: build the site in the editor, preview on phone size, publish, then keep
// editing without the live (published) copy changing until the next publish.

test.describe.configure({ mode: "serial" });

/** Reads Firestore through the emulator's admin door (tests only). */
async function firestore(path: string) {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/demo-fannan/databases/(default)/documents/${path}`, {
    headers: { Authorization: "Bearer owner" },
  });
  return res.ok ? ((await res.json()) as { fields: Record<string, unknown> }) : null;
}

async function siteIdFor(username: string) {
  const doc = await firestore(`usernames/${username}`);
  return (doc!.fields.siteId as { stringValue: string }).stringValue;
}

async function closeTips(page: Page) {
  const tips = page.getByRole("dialog");
  // Click through the tips one at a time, waiting for each to change before the next click.
  for (let i = 0; i < 6 && (await tips.isVisible().catch(() => false)); i++) {
    const before = await tips.getAttribute("aria-label");
    await page.getByRole("button", { name: /^(Next|Got it|التالي|فهمت)$/ }).click();
    await expect
      .poll(async () => ((await tips.isVisible()) ? await tips.getAttribute("aria-label") : "closed"))
      .not.toBe(before);
  }
}

const canvas = (page: Page) => page.getByTestId("canvas");
const settings = (page: Page) => page.getByTestId("block-settings");
/** The gear on the selected section opens its settings next to it. */
async function openSettings(page: Page) {
  if (!(await settings(page).isVisible())) await page.getByTestId("section-toolbar").getByRole("button", { name: "Settings" }).click();
  await expect(settings(page)).toBeVisible();
}
async function switchPage(page: Page, name: string) {
  await page.getByTestId("page-switcher").click();
  await page.getByTestId("page-list").getByRole("button", { name: new RegExp(`^${name}`) }).click();
}

test("build, preview on phone size, publish, then edit without changing the live site", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "The full editor flow runs at desktop size; phones get their own test.");
  test.setTimeout(180_000);
  const { username } = await signUp(page);

  // Open the editor from the dashboard; the first-run tips show once.
  await page.getByRole("link", { name: "Edit site" }).click();
  await expect(page).toHaveURL(at("app", "/editor"));
  await expect(page.getByRole("dialog")).toContainText("Your site is made of sections");
  await closeTips(page);
  await expect(page.getByTestId("editor-status")).toHaveText("Not published yet");

  // The starter site is on the canvas.
  await expect(canvas(page)).toContainText("Nour Adel");

  // Add a quote from the library and write in it (settings open from the gear).
  await page.getByTestId("add-quote").click();
  await openSettings(page);
  const text = settings(page).getByRole("textbox", { name: "Text" });
  await text.fill("Characters people remember.");
  await expect(canvas(page)).toContainText("Characters people remember.");
  await expect(page.getByTestId("editor-status")).toHaveText("Not published yet", { timeout: 10_000 });

  // Undo and redo.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(canvas(page)).not.toContainText("Characters people remember.");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(canvas(page)).toContainText("Characters people remember.");

  // Design → Global styles: the Paper preset changes the page colour.
  await page.getByRole("button", { name: "Design" }).click();
  await page.getByRole("radio", { name: "Paper" }).click();
  await expect(canvas(page).locator(".site-root")).toHaveCSS("background-color", "rgb(245, 241, 232)");

  // A design block with a picture: click the picture, upload through the media picker.
  await page.getByRole("button", { name: "Pages & sections" }).click();
  await page.getByTestId("add-d-image-caption").click();
  const picture = canvas(page).locator('[data-testid="free-item"][data-kind="image"]').last();
  await picture.scrollIntoViewIfNeeded();
  await picture.click();
  // Selecting shows the quick toolbar; the pencil opens the settings.
  await page.getByTestId("item-edit").click();
  await settings(page).getByRole("button", { name: "Choose" }).click();
  await page.getByTestId("picker-file").setInputFiles("tests/fixtures/photo.jpg");
  await expect(page.getByRole("dialog", { name: "Choose media" })).toBeHidden({ timeout: 60_000 });
  await expect(canvas(page).locator("img[src*='/api/media/variants/']").first()).toBeVisible();

  // Pages: add a custom page from the page switcher and name it in Page settings.
  await page.getByTestId("page-switcher").click();
  await page.getByRole("button", { name: "Custom page", exact: true }).click();
  await page.getByRole("tab", { name: "Page settings" }).click();
  await page.getByRole("textbox", { name: "Page name" }).fill("Process");
  await expect(page.getByTestId("page-switcher")).toContainText("Process");

  // Phone size: the canvas becomes 390 px wide and the grid collapses.
  await page.getByRole("radio", { name: "Phone" }).click();
  await expect.poll(() => canvas(page).evaluate((el) => (el as HTMLElement).style.width)).toBe("390px");
  await page.getByRole("radio", { name: "Desktop" }).click();

  // Preview shows the site as visitors will see it.
  await switchPage(page, "Work");
  await page.getByTestId("preview-button").click();
  await expect(page.getByTestId("preview")).toContainText("Characters people remember.");
  await page.getByRole("button", { name: "Close preview" }).click();

  // Publish.
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });

  const siteId = await siteIdFor(username);
  const v1 = await firestore(`sites/${siteId}/published/1`);
  expect(JSON.stringify(v1)).toContain("Characters people remember.");

  // Keep editing: the draft changes, the live copy doesn't.
  await canvas(page).getByText("Characters people remember.").click();
  await openSettings(page);
  await settings(page).getByRole("textbox", { name: "Text" }).fill("Stories, frame by frame.");
  await expect(page.getByTestId("editor-status")).toHaveText("Unpublished changes", { timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.reload();
  await closeTips(page);
  await expect(canvas(page)).toContainText("Stories, frame by frame.");
  await expect(page.getByTestId("editor-status")).toHaveText("Unpublished changes");
  const stillV1 = await firestore(`sites/${siteId}/published/1`);
  expect(JSON.stringify(stillV1)).toContain("Characters people remember.");
  expect(JSON.stringify(stillV1)).not.toContain("Stories, frame by frame.");
  expect(await firestore(`sites/${siteId}/published/2`)).toBeNull();

  // The dashboard knows it's published, and the checklist ticked "Publish your site".
  await page.goto(at("app", "/home"));
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Publish your site" })).toHaveClass(/line-through/);
});

test("the editor works on a phone in Arabic", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Phone-only check.");
  test.setTimeout(120_000);
  await signUp(page);
  await page.getByRole("button", { name: "Switch dashboard language" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto(at("app", "/editor"));
  await expect(page.getByRole("dialog")).toBeVisible();
  await closeTips(page);
  // On a phone the panel opens from the rail.
  await expect(page.getByTestId("left-panel")).toBeHidden();
  await page.getByRole("button", { name: "الصفحات والأقسام" }).click();
  await page.getByTestId("add-quote").click();
  await page.getByTestId("section-toolbar").getByRole("button", { name: "الإعدادات" }).click();
  await expect(settings(page)).toBeVisible();
  await expect(settings(page)).toContainText("اقتباس");
  await page.getByRole("button", { name: "نشر" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("الموقع المنشور محدّث", { timeout: 20_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
