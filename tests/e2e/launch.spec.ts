import { readFileSync, existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { at, signUp, uniq } from "./helpers";

// Phase 7: the marketing site (EN/AR, prices by country), every public page, contact form,
// "Report this site" → admin queue → moderation (with the email to the artist), Examples
// curated from the admin page, onboarding emails, and an accessibility check on key pages.

test.describe.configure({ mode: "serial" });

const outbox = () => (existsSync(".local-storage/outbox.log") ? readFileSync(".local-storage/outbox.log", "utf8") : "");
const mailTo = (email: string, text: string) => () =>
  outbox()
    .split("\n")
    .some((l) => l.includes(`"to":"${email}"`) && l.includes(text));

async function publish(page: Page) {
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
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
}

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
}

test("the marketing site in English and Arabic, with prices by country", async ({ page }) => {
  await page.goto(at("", "/"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your next job is looking for you.");
  await expect(page.getByRole("textbox", { name: "Claim your name before someone else does" })).toBeVisible();
  await expect(page.locator("#pricing")).toContainText("$6");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await axe(page, "home");

  await page.setExtraHTTPHeaders({ "cf-ipcountry": "EG" });
  await page.goto(at("", "/pricing"));
  await expect(page.getByText("1,350 EGP").first()).toBeVisible();
  await page.setExtraHTTPHeaders({ "cf-ipcountry": "US" });
  await page.goto(at("", "/pricing"));
  await expect(page.getByText("$72").first()).toBeVisible();

  for (const path of ["/pricing", "/examples", "/help", "/contact", "/terms", "/privacy", "/content-policy", "/copyright", "/report"]) {
    const res = await page.goto(at("", path));
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    const res2 = await page.goto(at("", `/ar${path}`));
    expect(res2?.status(), `/ar${path}`).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  }

  await page.goto(at("", "/ar"));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("خلّي الفرص تلاقيك.");
  const overflowAr = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflowAr).toBeLessThanOrEqual(0);
  await axe(page, "home-ar");

  // Contact form reaches the support inbox.
  await page.goto(at("", "/contact"));
  const id = uniq();
  await page.getByRole("textbox", { name: "Your name" }).fill("Mona");
  await page.getByRole("textbox", { name: "Your email" }).fill(`mona-${id}@example.com`);
  await page.getByRole("textbox", { name: "Message" }).fill(`Question ${id}`);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("form-sent")).toBeVisible();
  await expect.poll(mailTo("support@fannan.net", `Question ${id}`)).toBe(true);
});

test("onboarding emails, Report this site, moderation and Examples", async ({ page, browser }, info) => {
  test.skip(info.project.name === "mobile", "Covered at desktop size.");
  test.setTimeout(300_000);
  const { username, email } = await signUp(page);
  await expect.poll(mailTo(email, "Welcome to Fannan")).toBe(true);
  await axe(page, "dashboard");
  await page.goto(at("app", "/settings"));
  await axe(page, "settings");

  // A project, published: "your site is live".
  await page.goto(at("app", "/projects"));
  await page.getByRole("button", { name: "New project" }).first().click();
  await expect(page).toHaveURL(/\/projects\/[\w-]+$/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Project title" }).fill("Night Market");
  await expect(page.getByTestId("save-state")).toContainText("Saved", { timeout: 10_000 });
  await page.waitForTimeout(800);
  await publish(page);
  await expect.poll(mailTo(email, "Your site is live")).toBe(true);

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(at(username));
  await axe(visitor, "artist site");

  // First message.
  await visitor.goto(at(username, "/contact"));
  await visitor.getByRole("textbox", { name: "Your name" }).fill("Studio");
  await visitor.getByRole("textbox", { name: "Your email" }).fill("studio@example.com");
  await visitor.getByRole("textbox", { name: "Message" }).fill("Hello!");
  await visitor.getByRole("button", { name: "Send a message" }).click();
  await expect(visitor.getByTestId("contact-sent")).toBeVisible();
  await expect.poll(mailTo(email, "Your first message on Fannan")).toBe(true);

  // Report the project page from its footer link.
  await visitor.goto(at(username, "/night-market"));
  await visitor.getByRole("link", { name: "Report this site" }).click();
  await expect(visitor.getByText(`${username}.fannan`)).toBeVisible();
  await visitor.getByRole("radio", { name: "Spam, scam or phishing" }).check();
  await visitor.getByRole("textbox", { name: /What did you see/ }).fill("Looks like a scam page");
  await visitor.getByRole("button", { name: "Send report" }).click();
  await expect(visitor.getByTestId("form-sent")).toBeVisible();

  // Admin: hide the project, then feature the site.
  const admin = await (await browser.newContext()).newPage();
  await signUp(admin, uniq(), "admin.test");
  await admin.goto(at("app", "/admin?tab=reports"));
  const report = admin.getByTestId("admin-report").filter({ hasText: username });
  await expect(report).toContainText("Looks like a scam page");
  admin.once("dialog", (d) => d.accept());
  await report.getByRole("button", { name: "Hide project" }).click();
  await expect(admin.getByText("Done", { exact: true })).toBeVisible();
  await expect.poll(mailTo(email, "About your Fannan site")).toBe(true);
  const gone = await visitor.goto(at(username, "/night-market"));
  expect(gone?.status()).toBe(404);

  await admin.goto(at("app", `/admin?tab=users&q=${username}`));
  const row = admin.getByTestId("admin-user").filter({ hasText: username });
  await row.getByRole("button", { name: "Manage" }).click();
  await row.getByRole("button", { name: "Show on Examples" }).click();
  await expect(admin.getByText("Shown on the Examples page")).toBeVisible();
  await visitor.goto(at("", "/examples"));
  await expect(visitor.getByTestId("examples")).toContainText(`${username}.fannan`);
});
