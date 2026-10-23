import { expect, test } from "@playwright/test";

test("keeper metrics follow playback and switch back for outfield players", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: "Player focus", exact: true }).click();
  await page.getByLabel("Focus player").selectOption("riverside-1");
  const metrics = page.locator(".goalkeeper-metrics");
  const stat = (label: string) =>
    metrics
      .locator("div")
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator("strong");
  await expect(stat("Saves")).not.toHaveText("0");
  await expect(stat("Goals conceded")).toHaveText("1");
  await expect(metrics).toContainText("Pass completion");
  await expect(metrics).not.toContainText("Assists");
  const timeline = page.getByRole("slider", { name: "Match timeline" });
  await timeline.fill("59");
  await expect(stat("Goals conceded")).toHaveText("0");
  await expect(stat("Saves")).toHaveText("0");
  await timeline.fill("2468");
  await expect(stat("Goals conceded")).toHaveText("1");
  await page.getByLabel("Focus player").selectOption("harbor-13");
  await expect(stat("Saves")).toHaveText("0");
  await expect(page.locator(".player-status-line")).not.toContainText(
    "Clean sheet",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.getByLabel("Focus player").selectOption("harbor-11");
  await expect(metrics).toHaveCount(0);
  await expect(page.locator(".player-metrics")).toContainText("Goals");
});
