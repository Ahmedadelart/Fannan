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
  if (await tips.isVisible().catch(() => false)) {
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^(Next|Got it|التالي|فهمت)$/ }).click();
  }
}

const canvas = (page: Page) => page.getByTestId("canvas");

test("build, preview on phone size, publish, then edit without changing the live site", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "The full editor flow runs at desktop size; phones get their own test.");
  test.setTimeout(180_000);
  const { username } = await signUp(page);

  // Open the editor from the dashboard; the first-run tips show once.
  await page.getByRole("link", { name: "Edit site" }).click();
  await expect(page).toHaveURL(at("app", "/editor"));
  await expect(page.getByRole("dialog")).toContainText("Everything on your site is a block");
  await closeTips(page);
  await expect(page.getByTestId("editor-status")).toHaveText("Not published yet");

  // The starter site is on the canvas.
  await expect(canvas(page)).toContainText("Nour Adel");

  // Add a hero headline and write in it.
  await page.getByTestId("add-hero").click();
  const text = page.getByTestId("right-panel").getByRole("textbox", { name: "Text" });
  await text.fill("Characters people remember.");
  await expect(canvas(page)).toContainText("Characters people remember.");
  await expect(page.getByTestId("editor-status")).toHaveText("Not published yet", { timeout: 10_000 });

  // Undo and redo.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(canvas(page)).not.toContainText("Characters people remember.");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(canvas(page)).toContainText("Characters people remember.");

  // Style: the Paper preset changes the page colour.
  await page.getByRole("tab", { name: "Style" }).click();
  await page.getByRole("radio", { name: "Paper" }).click();
  await expect(canvas(page).locator(".site-root")).toHaveCSS("background-color", "rgb(245, 241, 232)");

  // Image block with an upload through the media picker.
  await page.getByRole("tab", { name: "Blocks" }).click();
  await page.getByTestId("add-image").click();
  await page.getByTestId("right-panel").getByRole("button", { name: "Choose" }).click();
  await page.getByTestId("picker-file").setInputFiles("tests/fixtures/photo.jpg");
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60_000 });
  await expect(canvas(page).locator("img[src*='/api/media/variants/']").first()).toBeVisible();

  // Pages: add a custom page and name it.
  await page.getByRole("tab", { name: "Pages" }).click();
  await page.getByRole("button", { name: "Custom page", exact: true }).click();
  await page.getByRole("textbox", { name: "Page name" }).fill("Process");
  await expect(page.getByRole("combobox", { name: "Page" })).toContainText("Process");

  // Phone size: the canvas becomes 390 px wide and the grid collapses.
  await page.getByRole("radio", { name: "Phone" }).click();
  await expect.poll(() => canvas(page).evaluate((el) => (el as HTMLElement).style.width)).toBe("390px");
  await page.getByRole("radio", { name: "Desktop" }).click();

  // Preview shows the site as visitors will see it.
  await page.getByRole("combobox", { name: "Page" }).selectOption({ label: "Work" });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
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
  await page.getByTestId("right-panel").getByRole("textbox", { name: "Text" }).fill("Stories, frame by frame.");
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
  await page.goto(at("app"));
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
  // Panels open as drawers on a phone.
  await expect(page.getByTestId("left-panel")).toBeHidden();
  await page.getByRole("button", { name: "الأقسام" }).click();
  await page.getByTestId("add-quote").click();
  await expect(page.getByTestId("right-panel")).toBeVisible();
  await expect(page.getByTestId("right-panel")).toContainText("اقتباس");
  await page.getByRole("button", { name: "نشر" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("الموقع المنشور محدّث", { timeout: 20_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
