import { expect, test } from "@playwright/test";
import { at, logInWithEmail, magicLink, uniq } from "./helpers";

// Phase 1 main flow: homepage → sign-up (no email until the end) → dashboard,
// then log back in on "another device", toggle Available, switch language.

test.describe.configure({ mode: "serial" });

test("English: from the homepage claim box to a saved site, then back in on another device", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const id = uniq();
  const username = `t${id}`;
  const email = `artist-${id}@example.com`;

  // Homepage claim box hands the name to sign-up and holds it.
  await page.goto(at(""));
  await page.getByRole("textbox", { name: "Claim your name before someone else does" }).fill(username);
  await page.getByRole("button", { name: "Claim it" }).click();
  await expect(page).toHaveURL(at("app", `/signup?username=${username}`));
  await expect(page.getByText(`${username}.fannan.localhost is held for you`)).toBeVisible({ timeout: 15_000 });

  // 1. Name, and the preview's logo follows it.
  await page.getByRole("textbox", { name: "Your name" }).fill("Ahmed Hassan");
  await page.getByRole("button", { name: "Next" }).click();

  // 2. Discipline.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nice to meet you, Ahmed. What do you do?");
  await page.getByRole("textbox", { name: "What you do" }).fill("anim");
  await page.getByRole("button", { name: "2D Animator" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  // 3. The short "setting up" pause, then 4. layouts made for animators.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Setting up a portfolio for a 2d animator…");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick a starting point, Ahmed.", { timeout: 6000 });
  await expect(page.getByRole("radio", { name: /The Reel/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /The Grid/ }).click();
  await expect(page.getByRole("radio", { name: /The Grid/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Customize this one" }).click();

  // 5. The held name is pre-filled; reserved names get a friendly message.
  const address = page.getByRole("textbox", { name: "Your address" });
  await expect(address).toHaveValue(username);
  await address.fill("admin");
  await expect(page.getByText("That name is kept for Fannan. Try another one.")).toBeVisible();
  await address.fill(username);
  await expect(page.getByText(`${username}.fannan.localhost is available`)).toBeVisible();
  await expect(page.getByTestId("preview-address")).toHaveText(`${username}.fannan.localhost`);
  await page.getByRole("button", { name: "Claim it" }).click();

  // 6. Email last, with a magic link.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Don’t lose your progress.");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Save and open my site" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await magicLink(email));
  // The editor is the app: signing in lands there.
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 20_000 });
  // The old dashboard lives on as the editor's Home panel (also at /home).
  await page.goto(at("app", "/home"));
  await expect(page.getByTestId("site-address")).toHaveText(`${username}.fannan.localhost`);
  await expect(page.getByText("Save your site")).toHaveCount(0);

  // Available for work is saved.
  await page.getByRole("switch", { name: "Available for work" }).click();
  await expect(page.getByText("Open to projects")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Available for work" })).toHaveAttribute("aria-checked", "true");

  // Switch the dashboard to Arabic.
  await page.getByRole("button", { name: "Switch dashboard language" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("موقعك");

  // Another device: log in with a new link; same site, still available, still Arabic.
  const other = await browser.newContext();
  const phone = await other.newPage();
  await logInWithEmail(phone, email);
  // Signing in opens the editor (in Arabic); the Home page shows the same account.
  await expect(phone.getByTestId("canvas")).toBeVisible({ timeout: 20_000 });
  await expect(phone.locator("html")).toHaveAttribute("dir", "rtl");
  await phone.goto(at("app", "/home"));
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText("موقعك", { timeout: 20_000 });
  await expect(phone.getByTestId("site-address")).toHaveText(`${username}.fannan.localhost`);
  await expect(phone.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  await other.close();
});

test("Arabic: the whole sign-up in Arabic, right to left", async ({ browser }) => {
  test.setTimeout(120_000);
  const id = uniq();
  const username = `a${id}`;
  const email = `fannan-${id}@example.com`;
  const context = await browser.newContext({ locale: "ar-EG" });
  const page = await context.newPage();

  await page.goto(at("app", "/signup"));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("لنبدأ معرض أعمالك. ما اسمك؟");
  await page.getByRole("textbox", { name: "اسمك" }).fill("أحمد حسن");
  await page.getByRole("button", { name: "التالي" }).click();

  // Colloquial spelling finds the discipline.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تشرّفنا يا أحمد. ما مجال عملك؟");
  await page.getByRole("textbox", { name: "مجال عملك" }).fill("انيميتور");
  await page.getByRole("button", { name: "رسّام رسوم متحركة ثنائية الأبعاد" }).click();
  await page.getByRole("button", { name: "التالي" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("اختر نقطة البداية يا أحمد.", { timeout: 8000 });
  await expect(page.getByRole("radio", { name: /الريل/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "خصّص هذا التصميم" }).click();

  const address = page.getByRole("textbox", { name: "عنوانك" });
  await address.fill(username);
  await expect(page.getByText(`${username}.fannan.localhost متاح`)).toBeVisible();
  await page.getByRole("button", { name: "احجزه" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("لا تفقد ما أنجزته.");
  await page.getByRole("textbox", { name: "البريد الإلكتروني" }).fill(email);
  await page.getByRole("button", { name: "احفظ وافتح موقعي" }).click();
  await expect(page.getByRole("heading", { name: "افحص بريدك الإلكتروني" })).toBeVisible();

  await page.goto(await magicLink(email));
  await expect(page.getByTestId("canvas")).toBeVisible({ timeout: 20_000 });
  await page.goto(at("app", "/home"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("موقعك", { timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("site-address")).toHaveText(`${username}.fannan.localhost`);
  await context.close();
});

test("reserved names can't be claimed from the homepage", async ({ page }) => {
  await page.goto(at(""));
  await page.getByRole("textbox", { name: "Claim your name before someone else does" }).fill("app");
  await page.getByRole("button", { name: "Claim it" }).click();
  await expect(page.getByText("That name is kept for Fannan. Try another one.")).toBeVisible();
});

test("the dashboard needs a signed-in account", async ({ page }) => {
  await page.goto(at("app"));
  await expect(page).toHaveURL(at("app", "/login"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back.");
});

test("every kind of artist: field suggestions, Arabic search, and a starter that fits", async ({ page }) => {
  await page.goto(at("app", "/signup"));
  await page.getByRole("textbox", { name: "Your name" }).fill("Laila Mostafa");
  await page.getByRole("button", { name: "Next" }).click();
  // Suggestions cover more than animation.
  for (const chip of ["Photographer", "Architect", "Fashion designer", "Graphic designer"]) {
    await expect(page.getByRole("button", { name: chip, exact: true })).toBeVisible();
  }
  // Colloquial Arabic finds the right field too.
  await page.getByRole("textbox", { name: "What you do" }).fill("فوتوجرافر");
  await expect(page.getByRole("button", { name: /photographer/i }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "What you do" }).fill("photo");
  await page.getByRole("button", { name: "Photographer", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick a starting point, Laila.", { timeout: 8000 });
  // Stills-first fields lead with the grid.
  await expect(page.getByRole("radio", { name: /The Grid/ })).toHaveAttribute("aria-checked", "true");
});
