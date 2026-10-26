import { expect, test } from "@playwright/test";
import { at, signUp } from "./helpers";
import { openEditor } from "./editor-helpers";

// Round 18: Settings owns the site language. A change made there while the editor is open shows in
// the editor at once and is never undone by the editor's autosave.

test("a language set in Settings survives the editor's autosave", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The wide panel is checked at desktop size.");
  test.setTimeout(150_000);
  await signUp(page);
  await openEditor(page);
  const nav = page.getByRole("navigation", { name: "Editor" });
  const frame = page.frameLocator('[data-testid="panel-frame"]');

  await nav.getByRole("button", { name: "Settings", exact: true }).click();
  // Clicked again until the page has woken up (under load the first click can land before it has).
  const arabic = frame.getByRole("radio", { name: /^Arabic only/ });
  await expect(async () => {
    await arabic.click();
    await expect(arabic).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await frame.getByRole("button", { name: "Save changes" }).click();
  await expect(frame.getByText(/^Saved\./)).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "test-results/wide-panel-desktop.png" });

  // "Change in Design" (favicon) opens the editor's Design panel, which already shows Arabic.
  await frame.getByTestId("favicon-in-design").click();
  await expect(page.getByTestId("site-language")).toContainText("Arabic");

  // A change in the editor saves the whole draft: the language must stay Arabic.
  const radius = page.getByRole("slider", { name: "Corner radius" });
  await radius.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("editor-status")).toHaveText("Saving…");
  await expect(page.getByTestId("editor-status")).not.toHaveText("Saving…", { timeout: 15_000 });

  await page.goto(at("app", "/settings"));
  await expect(page.getByRole("radio", { name: /^Arabic only/ })).toHaveAttribute("aria-checked", "true");
  await openEditor(page);
  await nav.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.getByTestId("site-language")).toContainText("Arabic");
  // The row opens Settings, where the language is chosen.
  await page.getByTestId("site-language").click();
  await expect(frame.getByRole("heading", { level: 1, name: "Site settings" })).toBeVisible({ timeout: 15_000 });
});
