import { readFileSync, existsSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { at, signUp, uniq } from "./helpers";

// Phase 6 main flow, with the practice checkout standing in for Paymob:
// buy Pro in EGP (a declined card first), buy more in USD (charged in EGP, stacked), own domain,
// admin refund, reminders at 14 and 0 days, the grace period, the move to Free (hidden, never
// deleted) and Pro coming back.

test.describe.configure({ mode: "serial" });

const DB = "http://127.0.0.1:8080/v1/projects/demo-fannan/databases/(default)/documents";
const admin = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const DAY = 86_400_000;

async function uidOf(username: string) {
  const d = (await (await fetch(`${DB}/usernames/${username}`, { headers: admin })).json()) as {
    fields: Record<string, { stringValue?: string }>;
  };
  return d.fields.uid.stringValue!;
}

async function proUntil(uid: string): Promise<number | null> {
  const d = (await (await fetch(`${DB}/users/${uid}`, { headers: admin })).json()) as {
    fields: { proUntil?: { timestampValue?: string } };
  };
  const v = d.fields.proUntil?.timestampValue;
  return v ? Date.parse(v) : null;
}

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

async function buy(page: Page, months: number, pay: boolean) {
  await page.goto(at("app", "/upgrade"));
  await page.getByTestId(`plan-${months}`).getByRole("button", { name: `Get ${months} months` }).click();
  await expect(page).toHaveURL(/\/checkout\/\w+/);
  await page.getByRole("button", { name: pay ? "Pay (practice)" : "Decline the card (practice)" }).click();
  await expect(page.getByTestId("payment-result")).toHaveAttribute("data-status", pay ? "paid" : "failed");
}

async function adminUser(adminPage: Page, username: string) {
  await adminPage.goto(at("app", `/admin?tab=users&q=${username}`));
  const row = adminPage.getByTestId("admin-user").filter({ hasText: username });
  await row.getByRole("button", { name: "Manage" }).click();
  return row;
}

async function adminSetEnd(adminPage: Page, username: string, daysFromNow: number) {
  const row = await adminUser(adminPage, username);
  const day = new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);
  await row.getByLabel("Pro end date").fill(day);
  await row.getByRole("button", { name: "Set date" }).click();
  await expect(adminPage.getByText("Saved")).toBeVisible();
}

async function runDaily(adminPage: Page) {
  await adminPage.goto(at("app", "/admin"));
  await adminPage.getByRole("button", { name: "Run daily jobs now" }).click();
  await expect(adminPage.getByText("Daily jobs done")).toBeVisible();
}

async function newVisitor(browser: Browser) {
  return (await browser.newContext()).newPage();
}

test("buying Pro, an own domain, reminders, the move to Free and back", async ({ page, browser }, info) => {
  test.skip(info.project.name === "mobile", "Covered at desktop size; phones get the Arabic check.");
  test.setTimeout(420_000);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signUp(adminPage, uniq(), "admin.test");
  const { username, email } = await signUp(page);
  const uid = await uidOf(username);

  // Free: the admin link isn't there for artists, and the admin page doesn't exist for them.
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  expect((await page.goto(at("app", "/admin")))?.status()).toBe(404);

  /* ---------- Egypt: EGP prices, a declined card, then Pro ---------- */
  await page.setExtraHTTPHeaders({ "cf-ipcountry": "EG" });
  await page.goto(at("app", "/upgrade"));
  await expect(page.getByText("Practice checkout.")).toBeVisible();
  await expect(page.getByTestId("plan-3")).toContainText("450 EGP");
  await expect(page.getByTestId("plan-12")).toContainText("1,350 EGP");
  await buy(page, 3, false);
  await expect(page.getByText("The payment didn’t go through")).toBeVisible();
  expect(await proUntil(uid)).toBeNull();
  await buy(page, 3, true);
  await expect(page.getByText("You’re on Pro")).toBeVisible();
  const afterFirst = (await proUntil(uid))!;
  expect(afterFirst - Date.now()).toBeGreaterThan(88 * DAY);
  expect(afterFirst - Date.now()).toBeLessThan(93 * DAY);
  await expect.poll(mailTo(email, "Your Fannan Pro receipt")).toBe(true);
  await page.goto(at("app"));
  await expect(page.getByText("Pro plan")).toBeVisible();

  /* ---------- abroad: USD price, charged in EGP at the day's rate, stacked after the end date ---------- */
  await page.setExtraHTTPHeaders({ "cf-ipcountry": "US" });
  await page.goto(at("app", "/upgrade"));
  await expect(page.getByText(/You’re on Pro until/)).toBeVisible();
  await expect(page.getByTestId("plan-6")).toContainText("$42");
  await expect(page.getByTestId("plan-6")).toContainText("about 2,100 EGP");
  await page.getByTestId("plan-6").getByRole("button", { name: "Get 6 months" }).click();
  await expect(page.getByTestId("checkout-price")).toHaveText("$42");
  await expect(page.getByText("2,100 EGP")).toBeVisible();
  await page.getByRole("button", { name: "Pay (practice)" }).click();
  await expect(page.getByTestId("payment-result")).toHaveAttribute("data-status", "paid");
  const afterSecond = (await proUntil(uid))!;
  expect(afterSecond - afterFirst).toBeGreaterThan(180 * DAY);
  expect(afterSecond - afterFirst).toBeLessThan(185 * DAY);
  await page.goto(at("app", "/settings"));
  await expect(page.getByTestId("payments").getByRole("listitem")).toHaveCount(3);

  /* ---------- Pro: more than 8 projects, own domain, no credit ---------- */
  for (let i = 0; i < 9; i++) {
    await page.goto(at("app", "/projects"));
    await page.getByRole("button", { name: "New project" }).first().click();
    await expect(page).toHaveURL(/\/projects\/[\w-]+$/);
  }
  await publish(page);

  const domain = `n${uniq()}.localhost`;
  await page.goto(at("app", "/settings"));
  await page.getByRole("radio", { name: /Your own domain/ }).click();
  await page.getByRole("textbox", { name: "Your domain" }).fill(domain);
  await page.getByRole("button", { name: "Connect domain" }).click();
  await expect(page.getByTestId("own-domain")).toContainText("sites.fannan.net");
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByTestId("domain-status")).toHaveAttribute("data-status", "active");

  const visitor = await newVisitor(browser);
  const own = `http://${domain}:3100`;
  await visitor.goto(`${own}/`);
  await expect(visitor).toHaveTitle(/Nour Adel/);
  await expect(visitor.getByRole("link", { name: "Made with Fannan" })).toHaveCount(0);
  await expect(visitor.locator('a[href^="/untitled-project"]')).toHaveCount(9);
  await visitor.goto(at(username, "/contact"));
  await expect(visitor).toHaveURL(`${own}/contact`);

  /* ---------- admin: payments, refund the USD purchase ---------- */
  await adminPage.goto(at("app"));
  await expect(adminPage.getByRole("link", { name: "Admin" })).toBeVisible();
  await adminPage.goto(at("app", "/admin?tab=payments"));
  const usd = adminPage.getByTestId("admin-payment").filter({ hasText: username }).filter({ hasText: "$42" });
  await expect(usd).toContainText("2,100 EGP @ 50.00");
  adminPage.once("dialog", (d) => d.accept());
  await usd.getByRole("button", { name: "Refund" }).click();
  await expect(adminPage.getByText("Refunded").first()).toBeVisible();
  await expect.poll(() => proUntil(uid)).toBe(afterFirst);

  /* ---------- 14 days left: email + banner ---------- */
  await adminSetEnd(adminPage, username, 10);
  await runDaily(adminPage);
  await expect.poll(mailTo(email, "Your Fannan Pro ends on")).toBe(true);
  await page.goto(at("app"));
  await expect(page.getByTestId("pro-banner")).toContainText("Your Pro ends on");

  /* ---------- ended: 7 days of grace, nothing changes yet ---------- */
  await adminSetEnd(adminPage, username, -3);
  await runDaily(adminPage);
  await expect.poll(mailTo(email, "Your Pro ended today")).toBe(true);
  await page.goto(at("app"));
  await expect(page.getByTestId("pro-banner")).toContainText("Your Pro has ended.");
  await visitor.goto(`${own}/`);
  await expect(visitor).toHaveURL(`${own}/`);
  await expect(visitor.getByRole("link", { name: "Made with Fannan" })).toHaveCount(0);

  /* ---------- after the grace period: Free, hidden not deleted ---------- */
  await adminSetEnd(adminPage, username, -10);
  await runDaily(adminPage);
  await expect.poll(mailTo(email, "Your site is on Free now")).toBe(true);
  await visitor.goto(`${own}/`);
  await expect(visitor).toHaveURL(at(username, "/"));
  await expect(visitor.getByRole("link", { name: "Made with Fannan" })).toBeVisible();
  await expect(visitor.locator('a[href^="/untitled-project"]')).toHaveCount(8);
  await page.goto(at("app", "/projects"));
  await expect(page.getByTestId("project-card")).toHaveCount(9);
  await expect(page.getByTestId("over-limit")).toBeVisible();
  await page.goto(at("app"));
  await expect(page.getByTestId("pro-banner")).toContainText("Your site is on Free now.");

  /* ---------- Pro again (a gift from the admin): everything comes back ---------- */
  const row = await adminUser(adminPage, username);
  await row.getByLabel("Months").selectOption("1");
  await row.getByRole("button", { name: "Give", exact: true }).click();
  await expect(adminPage.getByText("Pro given")).toBeVisible();
  await visitor.goto(`${own}/`);
  await expect(visitor).toHaveURL(`${own}/`);
  await expect(visitor.locator('a[href^="/untitled-project"]')).toHaveCount(9);
  await expect(visitor.getByRole("link", { name: "Made with Fannan" })).toHaveCount(0);

  /* ---------- suspend from admin ---------- */
  const row2 = await adminUser(adminPage, username);
  adminPage.once("dialog", (d) => d.accept());
  await row2.getByRole("button", { name: "Suspend site" }).click();
  await expect(adminPage.getByText("Site suspended")).toBeVisible();
  await visitor.goto(at(username));
  await expect(visitor.getByText("This portfolio isn’t published yet.")).toBeVisible();
});

test("Go Pro page in Arabic fits a phone", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await page.getByRole("button", { name: "Switch dashboard language" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.setExtraHTTPHeaders({ "cf-ipcountry": "EG" });
  await page.goto(at("app", "/upgrade"));
  await expect(page.getByRole("heading", { level: 1, name: "اشترك في Pro" })).toBeVisible();
  await expect(page.getByTestId("plan-3")).toContainText("جنيه");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByTestId("plan-3").getByRole("button").click();
  await expect(page.getByRole("button", { name: "ادفع (تجريبي)" })).toBeVisible();
});
