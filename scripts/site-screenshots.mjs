// Full-page screenshots of a site at desktop and phone width: node scripts/site-screenshots.mjs <base-url> <out-dir> /path ...
// (In Git Bash on Windows, run with MSYS_NO_PATHCONV=1 so "/" paths stay as they are.)
import { chromium } from "@playwright/test";
const [,, base, out, ...paths] = process.argv;
const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, "d"], [390, 844, "m"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    // Scroll through so lazy pictures load.
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const name = (p.replace(/\W+/g, "_") || "home").replace(/^_|_$/g, "") || "home";
    await page.screenshot({ path: `${out}/${tag}-${name}.jpg`, fullPage: true, quality: 60, type: "jpeg" });
    console.log("shot", tag, name);
  }
  await page.close();
}
await browser.close();
