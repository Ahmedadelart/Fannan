import { expect, type Page } from "@playwright/test";
import { ROOT } from "../../playwright.config";

export const at = (sub: string, path = "/") => `http://${sub ? `${sub}.` : ""}${ROOT}${path}`;

export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The newest magic link the Auth emulator "sent" to this address, rewritten to land on our page. */
export async function magicLink(email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-fannan/oobCodes");
        const { oobCodes } = (await res.json()) as {
          oobCodes: Array<{ email: string; requestType: string; oobLink: string; oobCode: string }>;
        };
        const mine = oobCodes.filter((c) => c.email === email && c.requestType === "EMAIL_SIGNIN").at(-1);
        if (!mine) return false;
        const continueUrl = new URL(mine.oobLink).searchParams.get("continueUrl")!;
        const url = new URL(continueUrl);
        url.searchParams.set("mode", "signIn");
        url.searchParams.set("oobCode", mine.oobCode);
        url.searchParams.set("apiKey", "demo-key");
        link = url.toString();
        return true;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return link!;
}

/** Log in from a fresh browser with a magic link. */
export async function logInWithEmail(page: Page, email: string, locale: "en" | "ar" = "en") {
  await page.goto(at("app", "/login"));
  await page.getByRole("textbox", { name: locale === "ar" ? "البريد الإلكتروني" : "Email" }).fill(email);
  await page.getByRole("button", { name: locale === "ar" ? "أرسل لي الرابط" : "Send me a link" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.goto(await magicLink(email));
}

/** The quickest way through sign-up to a saved account with a site (English). */
export async function signUp(page: Page, id = uniq(), emailDomain = "example.com") {
  const username = `p${id}`;
  const email = `projects-${id}@${emailDomain}`;
  await page.goto(at("app", "/signup"));
  await page.getByRole("textbox", { name: "Your name" }).fill("Nour Adel");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Character designer" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Customize this one" }).click({ timeout: 10_000 });
  await page.getByRole("textbox", { name: "Your address" }).fill(username);
  await expect(page.getByText(`${username}.fannan.localhost is available`)).toBeVisible();
  await page.getByRole("button", { name: "Claim it" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Save and open my site" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await magicLink(email));
  await expect(page.getByRole("heading", { level: 1, name: "Your site" })).toBeVisible({ timeout: 20_000 });
  return { username, email };
}
