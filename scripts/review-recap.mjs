import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.RECAP_REVIEW_URL ?? "http://127.0.0.1:3101";
await mkdir("docs/recap/screenshots", { recursive: true });
await mkdir("artifacts/catch-up-redesign", { recursive: true });
const browser = await chromium.launch();
const audit = [];
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1100],
    ["tablet", 820, 1180],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "POST") requests.push(request.url());
    });
    await page.addInitScript(() =>
      localStorage.setItem("second-look-appearance", "dark"),
    );
    await page.goto(base);
    await page
      .getByRole("button", { name: "Catch me up", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Catch me up" });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    for (const mode of ["quick", "full"]) {
      await dialog
        .getByRole("tab", {
          name: mode === "quick" ? "Quick recap" : "Full recap",
        })
        .click();
      await dialog.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({
        path: `docs/recap/screenshots/${name}-${mode}.png`,
      });
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
    if (name === "mobile") {
      await dialog.getByRole("tab", { name: "Quick recap" }).click();
      await dialog.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.screenshot({
        path: "docs/recap/screenshots/mobile-details.png",
      });
    }
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
    audit.push({
      name,
      width,
      height,
      errors,
      requests,
      dialog: await dialog.boundingBox(),
    });
    await page.close();
  }
  await writeFile(
    "artifacts/catch-up-redesign/visual-audit.json",
    JSON.stringify(audit, null, 2),
  );
  console.log(
    "Reviewed quick/full at desktop, tablet and mobile sizes; no overflow, page errors or inference requests.",
  );
} finally {
  await browser.close();
}
