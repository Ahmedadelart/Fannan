import { readFileSync, existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { at, logInWithEmail, signUp } from "./helpers";

// Phase 5 main flow: messages inbox, stats that move when someone visits, every Settings control
// (address change with a forward, privacy, contact fields, social links, search & sharing,
// integrations, export, site password on Pro) and account deletion with a grace period.

test.describe.configure({ mode: "serial" });

const DB = "http://127.0.0.1:8080/v1/projects/demo-fannan/databases/(default)/documents";
const admin = { Authorization: "Bearer owner", "Content-Type": "application/json" };
// Headless browsers are filtered out of stats like any bot, so visitors look like a normal phone.
const REAL_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

async function owner(username: string) {
  const res = await fetch(`${DB}/usernames/${username}`, { headers: admin });
  const d = (await res.json()) as { fields: Record<string, { stringValue?: string }> };
  return { uid: d.fields.uid.stringValue!, siteId: d.fields.siteId.stringValue! };
}

async function makePro(uid: string) {
  await fetch(`${DB}/users/${uid}?updateMask.fieldPaths=plan`, {
    method: "PATCH",
    headers: admin,
    body: JSON.stringify({ fields: { plan: { stringValue: "pro" } } }),
  });
}

const get = (page: Page, path: string) =>
  page.evaluate(async (p) => {
    const r = await fetch(p);
    const buf = new Uint8Array(await r.arrayBuffer());
    return {
      status: r.status,
      type: r.headers.get("content-type") ?? "",
      size: buf.length,
      text: new TextDecoder("latin1").decode(buf.slice(0, 200_000)),
    };
  }, path);

async function openEditorAndPublish(page: Page) {
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

async function saveSettings(page: Page) {
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/^Saved\./)).toBeVisible({ timeout: 10_000 });
}

test("stats, inbox and every settings control", async ({ page, browser }, info) => {
  test.skip(info.project.name === "mobile", "Covered at desktop size; phones get the Arabic check.");
  test.setTimeout(300_000);
  const { username, email } = await signUp(page);
  await openEditorAndPublish(page);

  /* ---------- stats move when someone visits ---------- */
  await page.goto(at("app", "/stats"));
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await expect(page.getByTestId("kpi-visitors")).toHaveText("0");
  await expect(page.getByRole("link", { name: /90 days/ })).toHaveAttribute("href", "/upgrade");

  // Cloudflare tells us the visitor's address in production; locally the browser can switch between
  // IPv4 and IPv6, so pin it the way Cloudflare would.
  const visitorCtx = await browser.newContext({
    userAgent: REAL_UA,
    extraHTTPHeaders: { "cf-connecting-ip": "203.0.113.7" },
  });
  const visitor = await visitorCtx.newPage();
  await visitor.goto(at(username));
  await visitor.waitForLoadState("networkidle");
  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByTestId("kpi-visitors").textContent();
      },
      { timeout: 20_000 },
    )
    .toBe("1");
  // A second page by the same visitor is a view, not a new visitor; bots don't count at all.
  await visitor.goto(at(username, "/contact"));
  await visitor.waitForLoadState("networkidle");
  const bot = await (
    await browser.newContext({
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      extraHTTPHeaders: { "cf-connecting-ip": "66.249.66.1" },
    })
  ).newPage();
  await bot.goto(at(username));
  await bot.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("kpi-visitors")).toHaveText("1");
  await expect(page.getByRole("table")).toBeAttached();
  await page.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7/);
  await expect(page.getByTestId("kpi-visitors")).toHaveText("1");

  /* ---------- contact settings: extra questions, no email copy ---------- */
  await page.goto(at("app", "/settings"));
  await expect(page.getByRole("heading", { level: 1, name: "Site settings" })).toBeVisible();
  await page.getByRole("button", { name: "Budget" }).click();
  await page.getByRole("button", { name: "+ Custom question" }).click();
  await page.getByRole("textbox", { name: "Your question" }).fill("Which studio are you with?");
  await page.getByRole("switch", { name: "Email" }).click();
  await page.getByRole("textbox", { name: "Social link 1" }).fill("instagram.com/nouradel");
  await page.getByRole("textbox", { name: "Site title" }).fill("Nour Adel · Character designer");
  await page.getByRole("textbox", { name: "Google Analytics ID" }).fill("UA-123");
  await expect(page.getByText("It looks like G-XXXXXXXXXX", { exact: false })).toBeVisible();
  await page.getByRole("textbox", { name: "Google Analytics ID" }).fill("G-ABC123XYZ");
  await page.getByRole("switch", { name: "Let Google index my site" }).click();
  await saveSettings(page);

  // All of it is live straight away, without publishing again.
  await visitor.goto(at(username));
  await expect(visitor).toHaveTitle("Nour Adel · Character designer");
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(visitor.getByTestId("footer-links").getByRole("link", { name: "Instagram" })).toHaveAttribute(
    "href",
    "https://instagram.com/nouradel",
  );
  expect(await visitor.locator('script[src*="googletagmanager.com/gtag/js?id=G-ABC123XYZ"]').count()).toBe(1);
  expect((await get(visitor, "/robots.txt")).text).toContain("Disallow: /");

  const outboxBefore = existsSync(".local-storage/outbox.log") ? readFileSync(".local-storage/outbox.log", "utf8") : "";
  await visitor.goto(at(username, "/contact"));
  await visitor.getByRole("textbox", { name: "Your name" }).fill("Studio Producer");
  await visitor.getByRole("textbox", { name: "Your email" }).fill("producer@studio.example");
  await visitor.getByRole("textbox", { name: "Budget" }).fill("$4,000");
  await visitor.getByRole("textbox", { name: "Which studio are you with?" }).fill("Big Cat");
  await visitor.getByRole("textbox", { name: "Message" }).fill("Are you free for a short film in May?");
  await visitor.getByRole("button", { name: "Send a message" }).click();
  await expect(visitor.getByTestId("contact-sent")).toBeVisible();
  await page.waitForTimeout(1000);
  const outboxAfter = existsSync(".local-storage/outbox.log") ? readFileSync(".local-storage/outbox.log", "utf8") : "";
  expect(outboxAfter.slice(outboxBefore.length)).not.toContain("short film");

  /* ---------- the inbox ---------- */
  await page.goto(at("app", "/home"));
  await expect(page.getByTestId("unread-count")).toContainText("1");
  await expect(page.getByTestId("latest-messages")).toContainText("Studio Producer");
  await page.getByRole("link", { name: /^Messages/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  const msg = page.getByTestId("message").first();
  await expect(msg).toHaveAttribute("data-read", "false");
  await page.waitForLoadState("networkidle");
  // Click again if the page wasn't interactive yet the first time.
  await expect(async () => {
    if ((await msg.getAttribute("data-read")) === "false") await msg.getByRole("button", { name: /Studio Producer/ }).click();
    await expect(msg).toHaveAttribute("data-read", "true", { timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await expect(msg).toContainText("$4,000");
  await expect(msg).toContainText("Which studio are you with?");
  await expect(msg.getByRole("link", { name: "Reply by email" })).toHaveAttribute(
    "href",
    /^mailto:producer%40studio\.example\?subject=/,
  );
  await page.reload();
  await expect(page.getByTestId("unread-count")).toHaveCount(0);
  await msg.getByRole("button", { name: /Studio Producer/ }).click();
  await msg.getByRole("button", { name: "Mark as unread" }).click();
  await expect(msg).toHaveAttribute("data-read", "false");
  page.once("dialog", (d) => d.accept());
  await msg.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Message deleted")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No messages yet")).toBeVisible();

  /* ---------- export ---------- */
  await page.goto(at("app", "/settings"));
  const zip = await get(page, "/api/export");
  expect(zip.status).toBe(200);
  expect(zip.type).toBe("application/zip");
  expect(zip.text.startsWith("PK")).toBe(true);
  expect(zip.text).toContain("site.json");

  /* ---------- the address changes and the old one forwards ---------- */
  const next = `${username}-art`;
  await page.getByRole("textbox", { name: "Your Fannan address" }).fill(next);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Change address" }).click();
  await expect
    .poll(async () => {
      const r = await fetch(`${DB}/usernames/${username}`, { headers: admin });
      return ((await r.json()) as { fields?: { status?: { stringValue?: string } } }).fields?.status?.stringValue;
    })
    .toBe("redirect");
  await page.waitForLoadState("load");
  await expect(page.getByRole("textbox", { name: "Your Fannan address" })).toHaveValue(next, { timeout: 15_000 });
  await visitor.goto(at(username, "/contact"));
  await expect(visitor).toHaveURL(at(next, "/contact"));
  await expect(visitor).toHaveTitle(/Nour Adel/);

  /* ---------- deleting the account, then changing your mind ---------- */
  await page.getByRole("textbox", { name: `Type ${next} to confirm` }).fill(next);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1/, { timeout: 15_000 });
  await expect(page.getByText("Your account will be deleted in 14 days.", { exact: false })).toBeVisible();
  await visitor.goto(at(next));
  await expect(visitor.getByText("This portfolio isn’t published yet.")).toBeVisible();

  await logInWithEmail(page, email);
  await expect(page.getByText("Your account is set to be deleted.", { exact: false })).toBeVisible({ timeout: 20_000 });
  await page.goto(at("app", "/settings"));
  await page.getByRole("button", { name: "Keep my account" }).click();
  await expect(page.getByText("Your account is set to be deleted")).toHaveCount(0, { timeout: 15_000 });
  await visitor.goto(at(next));
  await expect(visitor).toHaveTitle("Nour Adel · Character designer");
});

test("a whole-site password on Pro, and email change sends a confirmation", async ({ page, browser }, info) => {
  test.skip(info.project.name === "mobile", "Covered at desktop size.");
  test.setTimeout(240_000);
  const { username, email } = await signUp(page);
  await openEditorAndPublish(page);

  // Free: the switch is there but locked.
  await page.goto(at("app", "/settings"));
  await expect(page.getByRole("switch", { name: "Password-protect the whole site" })).toBeDisabled();

  await makePro((await owner(username)).uid);
  await page.reload();
  await page.getByRole("switch", { name: "Password-protect the whole site" }).click();
  await page.getByRole("textbox", { name: "Site password" }).fill("showreel2026");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByText("Your site now needs a password")).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(at(username));
  await expect(visitor.getByRole("heading", { name: "This page is private" })).toBeVisible();
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await visitor.getByLabel("Password").fill("showreel2026");
  await visitor.getByRole("button", { name: "Open" }).click();
  await expect(visitor.getByRole("heading", { name: "This page is private" })).toHaveCount(0);
  await expect(visitor.getByText("Nour Adel").first()).toBeVisible();

  // Removing it opens the site again.
  await page.getByRole("switch", { name: "Password-protect the whole site" }).click();
  await expect(page.getByText("Password removed")).toBeVisible();
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto(at(username));
  await expect(fresh.getByRole("heading", { name: "This page is private" })).toHaveCount(0);

  // Email change: a confirmation link goes to the new address; nothing changes until it's clicked.
  const newEmail = `new-${username}@example.com`;
  await page.getByRole("textbox", { name: "New email" }).fill(newEmail);
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByText(`We sent a link to ${newEmail}`)).toBeVisible();
  await expect(page.getByTestId("account-email")).toHaveText(email);
  await expect
    .poll(() => {
      const log = existsSync(".local-storage/outbox.log") ? readFileSync(".local-storage/outbox.log", "utf8") : "";
      return log.split("\n").some((l) => l.includes(newEmail));
    })
    .toBe(true);
});

test("messages, stats and settings work in Arabic and fit a phone", async ({ page }) => {
  test.setTimeout(180_000);
  await signUp(page);
  await page.getByRole("button", { name: "Switch dashboard language" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  for (const [path, title] of [
    ["/settings", "إعدادات الموقع"],
    ["/stats", "الإحصاءات"],
    ["/messages", "الرسائل"],
  ] as const) {
    await page.goto(at("app", path));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }

  // A setting saves in Arabic too.
  await page.goto(at("app", "/settings"));
  await page.getByRole("switch", { name: "احمِ الصور" }).click();
  await page.getByRole("button", { name: "احفظ التغييرات" }).click();
  await expect(page.getByText(/^حُفظ/)).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("switch", { name: "احمِ الصور" })).toHaveAttribute("aria-checked", "true");
});
