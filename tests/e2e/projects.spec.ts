import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Phase 2 main flow: make a full project with an image, a GIF, a loop, a PDF and a video link,
// edit credits, reorder, crop, set the cover; files are checked and too-long loops refused.

test.describe.configure({ mode: "serial" });

const fixture = (name: string) => `tests/fixtures/${name}`;

async function waitForProcessing(page: Page) {
  await expect(page.getByText(/Uploading|Making web versions/)).toHaveCount(0, { timeout: 60_000 });
}

test("a full project: uploads, embeds, credits, order, crop and cover", async ({ page }) => {
  test.setTimeout(180_000);
  await signUp(page);

  await page.getByRole("button", { name: "New project" }).first().click();
  await expect(page).toHaveURL(/\/projects\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Untitled project");

  // Several files at once, with progress, then web versions.
  await page
    .getByTestId("file-input")
    .setInputFiles([fixture("photo.jpg"), fixture("anim.gif"), fixture("loop.mp4"), fixture("doc.pdf")]);
  await expect(page.getByTestId("media-item")).toHaveCount(4);
  await waitForProcessing(page);
  await expect(page.getByText("Didn’t work")).toHaveCount(0);

  // Thumbnails really load (served from the owner-only media route, never the original).
  const thumbs = page.getByTestId("media-grid").locator("img");
  await expect(thumbs).toHaveCount(4);
  for (const img of await thumbs.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    expect(await img.getAttribute("src")).toMatch(/^\/api\/media\/variants\//);
  }

  // A video link becomes an embed.
  await page.getByRole("button", { name: "Add YouTube / Vimeo link" }).click();
  await page.getByRole("textbox", { name: "YouTube or Vimeo link" }).fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("media-item")).toHaveCount(5);

  // Wrong files get a clear message.
  await page.getByTestId("file-input").setInputFiles([fixture("fake.png")]);
  await expect(page.getByText("That file type isn’t supported", { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("file-input").setInputFiles([fixture("long.mp4")]);
  await expect(page.getByText("Loops can be up to 30 seconds", { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });
  // Refused files show as failed; remove them.
  for (const name of ["long.mp4", "fake.png"]) {
    const item = page.getByTestId("media-item").filter({ hasText: name });
    if (await item.count()) {
      await item.click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(item).toHaveCount(0);
    }
  }
  await expect(page.getByTestId("media-item")).toHaveCount(5);

  // Credits save as you type.
  await page.getByRole("textbox", { name: "Project title" }).fill("Fever Dreams");
  await page.getByRole("combobox", { name: "Category" }).selectOption("character-design");
  await page.getByRole("textbox", { name: "Your role" }).fill("Lead character designer");
  await page.getByRole("textbox", { name: "Studio" }).fill("Big Cat Animation");
  await page.getByRole("textbox", { name: "Description" }).first().fill("A boy who walks into other people’s dreams.");

  // Caption, alt text and crop on the photo.
  await page.getByTestId("media-item").filter({ hasText: "photo.jpg" }).click();
  await page.getByRole("textbox", { name: "Caption" }).fill("Main cast lineup");
  await page.getByRole("textbox", { name: /Alt text/ }).fill("Characters in a row");
  await page.getByRole("button", { name: "Crop" }).click();
  await page.getByRole("radio", { name: "1:1" }).click();
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 30_000 });
  const preview = page.getByTestId("selected-preview").locator("img");
  await expect
    .poll(() =>
      preview.evaluate(
        (el: HTMLImageElement) => el.naturalWidth > 0 && Math.abs(el.naturalWidth - el.naturalHeight) <= 2,
      ),
    )
    .toBe(true);

  // Make the GIF the cover and move it first.
  await page.getByTestId("media-item").filter({ hasText: "anim.gif" }).click();
  await page.getByRole("button", { name: "Set as cover" }).click();
  await expect(page.getByRole("button", { name: "This is the cover" })).toBeVisible();
  await page.getByRole("button", { name: "Move earlier" }).click();
  await expect(page.getByTestId("media-item").first()).toContainText("anim.gif");

  // Everything is still there after a reload.
  await expect(page.getByTestId("save-state")).toContainText("Saved", { timeout: 10_000 });
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fever Dreams");
  await expect(page.getByRole("textbox", { name: "Your role" })).toHaveValue("Lead character designer");
  await expect(page.getByRole("textbox", { name: "Project link" })).toHaveValue("fever-dreams");
  await expect(page.getByTestId("media-item")).toHaveCount(5);
  await expect(page.getByTestId("media-item").first()).toContainText("anim.gif");
  await expect(page.getByTestId("media-item").first()).toContainText("Cover");
  await page.getByTestId("media-item").filter({ hasText: "photo.jpg" }).click();
  await expect(page.getByRole("textbox", { name: "Caption" })).toHaveValue("Main cast lineup");

  // Password is Pro-only on Free; hide the project instead.
  await expect(page.getByRole("radio", { name: /Password/ })).toBeDisabled();
  await page.getByRole("radio", { name: /Hidden/ }).click();
  await expect(page.getByTestId("save-state")).toContainText("Saved");
  await page.waitForTimeout(800);

  // It shows on the projects list and dashboard, with the right badge and cover.
  await page.goto(at("app", "/projects"));
  const card = page.getByTestId("project-card").filter({ hasText: "Fever Dreams" });
  await expect(card).toContainText("Hidden");
  await expect(card).toContainText("Character design · Lead character designer");
  await expect(card.locator("img")).toHaveAttribute("src", /\/api\/media\/variants\//);
  await page.goto(at("app"));
  await expect(page.getByTestId("project-card")).toHaveCount(1);
  await expect(page.getByTestId("storage-meter")).toContainText("of your space");
});

test("the Free plan stops at 8 projects with a calm prompt", async ({ page }) => {
  test.setTimeout(180_000);
  await signUp(page);
  for (let i = 0; i < 8; i++) {
    await page.goto(at("app", "/projects"));
    await page.getByRole("button", { name: "New project" }).click();
    await expect(page).toHaveURL(/\/projects\/[\w-]+$/);
  }
  await page.goto(at("app", "/projects"));
  await expect(page.getByTestId("project-card")).toHaveCount(8);
  await expect(page.getByText("You’ve used 8 of 8 projects")).toBeVisible();
  await expect(page.getByText(/Go Pro from \$6 a month/)).toBeVisible();
  await expect(page.getByRole("button", { name: "New project" })).toHaveCount(0);
});

test("the project editor works in Arabic", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await page.getByRole("button", { name: "Switch dashboard language" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "مشروع جديد" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مشروع بلا اسم");
  await expect(page.getByText("اسحب أعمالك إلى هنا")).toBeVisible();
  await page.getByTestId("file-input").setInputFiles([fixture("photo.jpg")]);
  await expect(page.getByTestId("media-item")).toHaveCount(1);
  await expect(page.getByText(/جارٍ الرفع|نجهّز النسخ/)).toHaveCount(0, { timeout: 60_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
