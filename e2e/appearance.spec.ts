import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("dark is the default, overrides persist, and System follows the device", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "dark",
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "light",
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.locator('meta[name="theme-color"]').first(),
  ).toHaveAttribute("content", "#0b0f14");
  expect(errors).toEqual([]);
});

test("appearance remains usable when browser storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage disabled");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage disabled");
    };
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("dark screens retain accessible contrast and a single visible brand", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  for (const label of [
    "Match centre",
    "Insights",
    "Match stats",
    "Lineups",
    "Player focus",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: label, exact: true })
      .click();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
  }
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Match centre", exact: true })
    .click();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-dark-theme.png`,
    fullPage: true,
  });
  await expect(page.locator(".theme-dark-logo:visible")).toHaveCount(1);
  await expect(page.locator(".theme-light-logo:visible")).toHaveCount(0);
});

test("Catch me up uses the same surface as the app in light and dark", async ({
  page,
}) => {
  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript(
      (t) => localStorage.setItem("second-look-appearance", t),
      theme,
    );
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const panel = await page
      .locator(".app-shell:not([hidden]) .panel")
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    await page
      .getByRole("button", { name: "Catch me up", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Catch me up" });
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe(panel);
    await page.keyboard.press("Escape");
  }
});
