import { expect, test } from "@playwright/test";
import { ROOT } from "../../playwright.config";

const at = (sub: string, path = "/") => `http://${sub ? `${sub}.` : ""}${ROOT}${path}`;
// Node (unlike the browser) can't look up *.localhost, so raw requests go to localhost with a Host header.
const raw = (sub: string, path = "/") => ({
  url: `http://localhost:${ROOT.split(":")[1]}${path}`,
  opts: { headers: { host: `${sub ? `${sub}.` : ""}${ROOT}` }, maxRedirects: 0 },
});

test.describe("three surfaces, one app", () => {
  test("fannan.net is the marketing site, English by default", async ({ page }) => {
    await page.goto(at(""));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your next job is looking for you.");
  });

  test("fannan.net/ar is the Arabic marketing site, right to left", async ({ page }) => {
    await page.goto(at("", "/ar"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("خلّي الفرص تلاقيك.");
  });

  test("/en/... redirects to the address without /en", async ({ page }) => {
    await page.goto(at("", "/en/kitchen-sink"));
    await expect(page).toHaveURL(at("", "/kitchen-sink"));
  });

  test("www redirects to the bare domain", async ({ request }) => {
    const r = raw("www", "/kitchen-sink");
    const res = await request.get(r.url, r.opts);
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toContain(`//${ROOT}/kitchen-sink`);
  });

  test("app.fannan.net is the dashboard and remembers the language", async ({ page }) => {
    await page.goto(at("app"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
    await page.getByRole("link", { name: "Dashboard language" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("لوحة التحكم");
    // Still Arabic on the next visit.
    await page.goto(at("app"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    // The language cookie lives on app.fannan.net only, never shared with artist sites.
    const cookies = await page.context().cookies();
    const locale = cookies.find((c) => c.name === "NEXT_LOCALE");
    expect(locale?.domain).toBe("app.fannan.localhost");
  });

  test("username.fannan.net is an artist site", async ({ page }) => {
    await page.goto(at("ahmed"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ahmed");
    await expect(page.getByRole("link", { name: "Made with Fannan" })).toBeVisible();
  });

  test("artist sites can't see the dashboard's cookies", async ({ page }) => {
    await page.goto(at("app", "/__locale?to=ar&back=/"));
    await page.goto(at("ahmed"));
    // The artist site stays English: the app's language cookie wasn't sent to it.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("addresses that aren't a valid username are not found", async ({ request }) => {
    const r = raw("a.b");
    const res = await request.get(r.url, r.opts);
    expect(res.status()).toBe(404);
  });

  test("internal paths can't be reached directly", async ({ request }) => {
    for (const path of ["/ar/app", "/ar/site/ahmed", "/ar/marketing"]) {
      const r = raw("", path);
      const res = await request.get(r.url, r.opts);
      expect(res.status(), path).toBe(404);
    }
  });

  test("on staging/local hosts a switcher picks the surface", async ({ page }) => {
    await page.goto("http://localhost:3100/");
    await page.getByRole("link", { name: "app.fannan.net" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
    await page.getByRole("link", { name: "ahmed.fannan.net" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ahmed");
    await page.getByRole("link", { name: "fannan.net", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your next job is looking for you.");
  });
});
