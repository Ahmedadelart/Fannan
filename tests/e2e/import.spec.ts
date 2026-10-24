import { expect, test } from "@playwright/test";
import { at, signUp } from "./helpers";

// Round 16, "Bring your work in": a folder becomes projects (one per subfolder); a link from a site
// we don't read from is turned away before anything is fetched.

test("a portfolio folder becomes one project per subfolder", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(180_000);
  await signUp(page);
  await page.goto(at("app", "/projects"));
  await page.getByTestId("import-work").click();
  const dialog = page.getByTestId("import-dialog");
  await dialog.getByTestId("import-folder").setInputFiles("tests/fixtures/import/My portfolio");
  const groups = dialog.getByTestId("import-groups").locator("li");
  await expect(groups).toHaveCount(2);
  // Folder names become titles: numbers and dashes go, the text file is skipped.
  await expect(groups.nth(0).getByRole("textbox")).toHaveValue("First series");
  await expect(groups.nth(0)).toContainText("2 pictures");
  await expect(groups.nth(1).getByRole("textbox")).toHaveValue("Second");
  await expect(groups.nth(1)).toContainText("1 picture");
  // Nothing comes in until the artist confirms the work is theirs.
  await expect(dialog.getByTestId("import-go")).toBeDisabled();
  await dialog.getByTestId("import-mine").check();
  await page.screenshot({ path: "test-results/r16-import.png" });
  await dialog.getByTestId("import-go").click();
  await expect(page.getByText("First series", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Second", { exact: true })).toBeVisible();
});

test("a link from another site is turned away", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(120_000);
  await signUp(page);
  await page.goto(at("app", "/projects"));
  await page.getByTestId("import-work").click();
  const dialog = page.getByTestId("import-dialog");
  await dialog.getByTestId("import-tab-link").click();
  await dialog.getByTestId("import-link").fill("https://example.com/my-project");
  await dialog.getByTestId("import-read").click();
  await expect(dialog.getByTestId("import-notice")).toContainText("Behance, ArtStation or Dribbble");
  await expect(dialog.getByTestId("import-preview")).toHaveCount(0);
});
