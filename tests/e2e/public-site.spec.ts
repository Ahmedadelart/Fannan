import { readFileSync, existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { at, signUp } from "./helpers";

// Phase 4 main flow: the published site at {username}.fannan.net — pages, project pages, lightbox,
// contact form to inbox + email, password protection that holds even for guessed image addresses,
// Arabic sites, sitemap/robots, and drafts never leaking.

test.describe.configure({ mode: "serial" });

const DB = "http://127.0.0.1:8080/v1/projects/demo-fannan/databases/(default)/documents";
const admin = { Authorization: "Bearer owner", "Content-Type": "application/json" };

async function doc(path: string) {
  const res = await fetch(`${DB}/${path}`, { headers: admin });
  return res.ok ? ((await res.json()) as { fields: Record<string, { stringValue?: string }> }) : null;
}

async function owner(username: string) {
  const d = await doc(`usernames/${username}`);
  return { uid: d!.fields.uid.stringValue!, siteId: d!.fields.siteId.stringValue! };
}

async function makePro(uid: string) {
  await fetch(`${DB}/users/${uid}?updateMask.fieldPaths=plan`, {
    method: "PATCH",
    headers: admin,
    body: JSON.stringify({ fields: { plan: { stringValue: "pro" } } }),
  });
}

/** Fetch from inside the page (the browser can resolve *.localhost; Node can't). */
const get = (page: Page, path: string) =>
  page.evaluate(async (p) => {
    const r = await fetch(p);
    return { status: r.status, text: await r.text() };
  }, path);

async function openEditor(page: Page) {
  await page.goto(at("app", "/editor"));
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^(Next|Got it)$/ }).click();
  }
}

async function publish(page: Page) {
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("editor-status")).toHaveText("Live site is up to date", { timeout: 20_000 });
}

async function newProjectWithPhoto(page: Page, title: string) {
  await page.goto(at("app", "/projects"));
  await page.getByRole("button", { name: "New project" }).click();
  await expect(page).toHaveURL(/\/projects\/[\w-]+$/);
  await page.getByTestId("file-input").setInputFiles("tests/fixtures/photo.jpg");
  await expect(page.getByText(/Uploading|Making web versions/)).toHaveCount(0, { timeout: 60_000 });
  await page.getByRole("textbox", { name: "Project title" }).fill(title);
  await page.getByRole("textbox", { name: "Your role" }).fill("Character designer");
  await page.getByRole("textbox", { name: /Alt text/ }).fill(`${title} artwork`);
  await expect(page.getByTestId("save-state")).toContainText("Saved", { timeout: 10_000 });
  await page.waitForTimeout(800);
}

test("the published site: pages, projects, lightbox, contact form, sitemap, drafts stay private", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name === "mobile", "Covered at desktop size; phones get a separate check.");
  test.setTimeout(240_000);
  const { username, email } = await signUp(page);
  const { siteId } = await owner(username);

  // Before publishing there is nothing public.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(at(username));
  await expect(visitor.getByText("This portfolio isn’t published yet.")).toBeVisible();

  // A project, then publish.
  await newProjectWithPhoto(page, "Fever Dreams");
  await openEditor(page);
  await publish(page);

  // Home page: the artist's name, the gallery links to the project, footer credit on Free.
  await visitor.goto(at(username));
  await expect(visitor.locator("html")).toHaveAttribute("lang", "en");
  await expect(visitor).toHaveTitle(/Nour Adel/);
  await expect(visitor.getByRole("link", { name: /Fever Dreams/ })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Made with Fannan" })).toHaveAttribute("href", "https://fannan.net");
  const ogImage = await visitor.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImage).toContain("/m/variants/");

  // Project page with credits and a lightbox.
  await visitor.getByRole("link", { name: /Fever Dreams/ }).click();
  await expect(visitor.getByRole("heading", { level: 1, name: "Fever Dreams" })).toBeVisible();
  await expect(visitor.getByText("Character designer").first()).toBeVisible();
  const art = visitor.locator("figure[data-lightbox] img").first();
  await expect.poll(() => art.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(await art.getAttribute("src")).toMatch(/^\/m\/variants\//);
  await visitor.locator("figure[data-lightbox]").first().click();
  await expect(visitor.locator("dialog.site-lightbox")).toBeVisible();
  await visitor.keyboard.press("Escape");
  await expect(visitor.locator("dialog.site-lightbox")).toHaveCount(0);

  // Contact form → Fannan inbox + email to the artist.
  await visitor.goto(at(username, "/contact"));
  await visitor.getByRole("textbox", { name: "Your name" }).fill("Studio Producer");
  await visitor.getByRole("textbox", { name: "Your email" }).fill("producer@studio.example");
  await visitor.getByRole("textbox", { name: "Message" }).fill("Are you free for a series pitch next month?");
  await visitor.getByRole("button", { name: "Send a message" }).click();
  await expect(visitor.getByTestId("contact-sent")).toBeVisible();
  await expect
    .poll(() => {
      const log = existsSync(".local-storage/outbox.log") ? readFileSync(".local-storage/outbox.log", "utf8") : "";
      return log.split("\n").some((l) => l.includes(email) && l.includes("series pitch"));
    })
    .toBe(true);
  const q = await fetch(`${DB}:runQuery`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "messages" }],
        where: { fieldFilter: { field: { fieldPath: "siteId" }, op: "EQUAL", value: { stringValue: siteId } } },
      },
    }),
  });
  expect(JSON.stringify(await q.json())).toContain("series pitch");

  // Available for work: the badge and "Hire me" show without publishing again.
  await page.goto(at("app"));
  await page.getByRole("switch", { name: "Available for work" }).click();
  await expect(page.getByText("Open to projects")).toBeVisible();
  await page.waitForTimeout(500);
  await visitor.goto(at(username));
  await expect(visitor.getByRole("link", { name: "Hire me" })).toHaveAttribute("href", "#contact");

  // Drafts never leak: an unpublished change and its media stay off the live site.
  await openEditor(page);
  await page.getByTestId("add-quote").click();
  await page.getByTestId("right-panel").getByRole("textbox", { name: "Text" }).fill("Draft-only words");
  await page.getByTestId("add-image").click();
  await page.getByTestId("right-panel").getByRole("button", { name: "Choose" }).click();
  await page.getByTestId("picker-file").setInputFiles("tests/fixtures/anim.gif");
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60_000 });
  const draftImg = await page
    .getByTestId("canvas")
    .locator("img[src*='/api/media/variants/']")
    .last()
    .getAttribute("src");
  await expect(page.getByTestId("editor-status")).toHaveText("Unpublished changes", { timeout: 10_000 });
  await visitor.goto(at(username));
  await expect(visitor.getByText("Draft-only words")).toHaveCount(0);
  const leaked = await get(visitor, draftImg!.replace("/api/media/", "/m/"));
  expect(leaked.status).toBe(404);

  // Sitemap and robots.
  const sitemap = (await get(visitor, "/sitemap.xml")).text;
  expect(sitemap).toContain(`/fever-dreams</loc>`);
  const robots = (await get(visitor, "/robots.txt")).text;
  expect(robots).toContain(`Sitemap: http://${username}.fannan.localhost:3100/sitemap.xml`);

  // Unknown addresses are a proper 404.
  expect((await get(visitor, "/no-such-page")).status).toBe(404);
});

test("password projects can't be opened without the password, even by guessing image addresses", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name === "mobile", "Covered at desktop size.");
  test.setTimeout(240_000);
  const { username } = await signUp(page);
  const { uid } = await owner(username);
  await makePro(uid);

  await newProjectWithPhoto(page, "Secret Series");
  await page.getByRole("radio", { name: /Password/ }).click();
  await page.getByLabel("Password for this project").fill("studio-preview");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("A password is set.", { exact: false })).toBeVisible();
  const ownerImg = await page.getByTestId("media-grid").locator("img").first().getAttribute("src");
  await openEditor(page);
  await publish(page);

  const visitor = await (await browser.newContext()).newPage();
  // The cover isn't shown in galleries, and the project page asks for the password.
  await visitor.goto(at(username));
  await expect(visitor.getByRole("link", { name: /Secret Series/ }).locator("img")).toHaveCount(0);
  await visitor.goto(at(username, "/secret-series"));
  await expect(visitor.getByRole("heading", { name: "This page is private" })).toBeVisible();
  await expect(visitor.locator("img[src*='variants']")).toHaveCount(0);

  // Guessing the image address doesn't work.
  const guess = await get(visitor, ownerImg!.replace("/api/media/", "/m/"));
  expect(guess.status).toBe(403);

  // Wrong password, then the right one.
  await visitor.getByLabel("Password").fill("nope");
  await visitor.getByRole("button", { name: "Open" }).click();
  await expect(visitor.getByText("That password isn’t right.")).toBeVisible();
  await visitor.getByLabel("Password").fill("studio-preview");
  await visitor.getByRole("button", { name: "Open" }).click();
  await expect(visitor.getByRole("heading", { level: 1, name: "Secret Series" })).toBeVisible();
  const src = await visitor.locator("figure[data-lightbox] img").first().getAttribute("src");
  expect(src).toMatch(/^\/m\/t\/[^/]+\/variants\//);
  await expect
    .poll(() =>
      visitor
        .locator("figure[data-lightbox] img")
        .first()
        .evaluate((el: HTMLImageElement) => el.naturalWidth > 0),
    )
    .toBe(true);

  // The project page isn't indexed.
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("an Arabic site is served right to left, and it fits a phone", async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  const { username } = await signUp(page);
  await openEditor(page);
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Style" }).click();
  else await page.getByRole("tab", { name: "Style" }).click();
  await page.getByRole("radio", { name: "Arabic" }).click();
  await page.getByRole("textbox", { name: "Site name" }).fill("نور عادل");
  await publish(page);

  const visitor = await (await browser.newContext({ ...info.project.use })).newPage();
  await visitor.goto(at(username));
  await expect(visitor.locator("html")).toHaveAttribute("lang", "ar");
  await expect(visitor.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(visitor.getByText("نور عادل").first()).toBeVisible();
  await expect(visitor.getByRole("link", { name: "صُنع بواسطة فنان" })).toBeVisible();
  const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
