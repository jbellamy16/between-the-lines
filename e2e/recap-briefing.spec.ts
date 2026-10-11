import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const open = async (page: Page) => {
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Catch me up" })).toBeVisible();
  return page.getByRole("dialog", { name: "Catch me up" });
};
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("quick/full, accurate windows, event exploration and evidence disclosure", async ({
  page,
}) => {
  const posts: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  const dialog = await open(page);
  await expect(
    dialog.getByRole("tab", { name: "Quick recap" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(dialog).toContainText("Everything you missed through 63:24");
  await expect(
    dialog.getByRole("heading", {
      name: "Harbor are getting more shots away.",
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("region", { name: "The numbers behind the story" }),
  ).toContainText("9m 12s");
  await expect(dialog.locator(".recap-timeline button")).toHaveCount(3);
  await dialog.getByRole("tab", { name: "Quick recap" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: "Full recap" })).toBeFocused();
  await expect(dialog.getByRole("tab", { name: "Full recap" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await dialog.locator(".recap-timeline button").count(),
  ).toBeGreaterThan(3);
  await dialog
    .getByText("How we reached this conclusion", { exact: true })
    .click();
  await expect(dialog).toContainText("start excluded, end included");
  await expect(dialog).toContainText("Evidence through 63:24");
  await dialog
    .getByRole("button", { name: "Explore complete timeline" })
    .click();
  await expect(
    dialog.getByText("All recorded events through 63:24.", { exact: false }),
  ).toBeVisible();
  expect(posts).toEqual([]);
  const first = dialog.locator(".recap-timeline button").first();
  await expect(first).toContainText("Arlo Hayes scores");
  await first.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId("clock")).toContainText("63:24");
  await expect(page.locator(".event-inspector")).toContainText("01:00");
  expect(errors).toEqual([]);
});

test("modal traps focus, restores it, closes with Escape and fits each viewport", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Close dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Back to the match" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  for (const mode of ["Quick recap", "Full recap"]) {
    await dialog.getByRole("tab", { name: mode }).click();
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    const bounds = await dialog.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(
      (
        await new AxeBuilder({ page })
          .include("dialog[open]")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Catch me up", exact: true }),
  ).toBeFocused();
});

test("viewed checkpoint is scoped, returning recap is bounded, rewind restores kickoff scope", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
  const slider = page.getByRole("slider", { name: "Match timeline" });
  await slider.fill("1200");
  await expect(page.getByTestId("clock")).toContainText("20:00");
  // This is an actual visible dwell, not a fabricated stored visit.
  await expect
    .poll(async () =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith("btl-viewed-v1:"))
          .some((k) => JSON.parse(localStorage.getItem(k)!).position === 1200),
      ),
    )
    .toBe(true);
  await page.reload();
  const dialog = await open(page);
  await expect(dialog).toContainText("Welcome back. Here’s what you missed.");
  await expect(dialog).toContainText("from 20:00 to 63:24");
  await expect(dialog.locator(".recap-timeline")).not.toContainText(
    "Arlo Hayes scores",
  );
  await dialog.getByRole("button", { name: "From kickoff instead" }).click();
  await expect(dialog.locator(".recap-timeline")).toContainText(
    "Arlo Hayes scores",
  );
  await page.keyboard.press("Escape");
  await slider.fill("600");
  await open(page);
  await expect(dialog).toContainText("Everything you missed through 10:00");
  await expect(dialog).not.toContainText("Welcome back");
  await expect(dialog.locator(".recap-summary")).not.toContainText("63:24");
});

test("review reuses one Director response across modes and reopen; late results cannot survive rewind", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await open(page);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/director") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Review verified recap" }).click();
  const result = await (await response).json();
  expect(result.metrics.requests).toBe(0);
  await expect(
    dialog.getByRole("button", { name: "Evidence reviewed" }),
  ).toBeDisabled();
  let further = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/director") && r.method() === "POST") further++;
  });
  await dialog.getByRole("tab", { name: "Full recap" }).click();
  await page.keyboard.press("Escape");
  await open(page);
  const review = dialog.getByRole("button", { name: "Review verified recap" });
  if (await review.count()) await review.click();
  await expect(
    dialog.getByRole("button", { name: "Evidence reviewed" }),
  ).toBeDisabled();
  expect(further).toBe(0);
  await page.keyboard.press("Escape");
  await page.getByRole("slider", { name: "Match timeline" }).fill("0");
  await open(page);
  await expect(dialog.locator(".recap-summary")).toContainText("0–0");
  await expect(dialog.locator(".recap-timeline button")).toHaveCount(0);
});

test("recorded match uses the same briefing and truthful event navigation", async ({
  page,
}) => {
  await page.goto("/");
  const recorded = page.getByRole("button", { name: "Recorded", exact: true });
  test.skip(!(await recorded.count()), "Recorded matches not enabled");
  await recorded.click();
  await page.getByRole("slider", { name: "Match timeline" }).fill("1800");
  const dialog = await open(page);
  await expect(dialog).toContainText("1–2");
  await expect(dialog).not.toContainText("4–3");
  expect(await dialog.locator('img[src^="/teams/"]').count()).toBe(0);
  await dialog.getByRole("tab", { name: "Full recap" }).click();
  await dialog.locator(".recap-timeline button").first().click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".historical-shell .event-inspector"),
  ).toContainText("Source ID:");
});

test("background playback and an open briefing never move the viewed checkpoint", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
  const slider = page.getByRole("slider", { name: "Match timeline" });
  await slider.fill("1200");
  await page.clock.runFor(3100);
  const stored = () =>
    page.evaluate(() =>
      Object.entries(localStorage).filter(([k]) =>
        k.startsWith("btl-viewed-v1:"),
      ),
    );
  const checkpoint = await stored();
  expect(
    checkpoint.some(([, value]) => JSON.parse(value).position === 1200),
  ).toBe(true);
  // Simulate the browser visibility event while advancing the playback cursor.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await slider.fill("3804");
  await page.clock.runFor(8000);
  expect(await stored()).toEqual(checkpoint);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const dialog = await open(page);
  await expect(dialog).toContainText("from 20:00 to 63:24");
  await page.clock.runFor(8000);
  expect(await stored()).toEqual(checkpoint);
});

test("an in-flight review cannot overwrite a later recap after rewinding", async ({
  page,
}) => {
  const result = await (
    await page.request.post("/api/director", {
      data: { scenario: "pressure", time: 3804, mode: "analyst" },
    })
  ).json();
  expect(result.metrics.requests).toBe(0);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/director", async (route) => {
    await gate;
    await route.fulfill({ json: result });
  });
  await page.goto("/");
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Review verified recap" }).click();
  await expect(
    dialog.getByRole("button", { name: "Checking evidence…" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("slider", { name: "Match timeline" }).fill("0");
  await open(page);
  const returned = page.waitForResponse((r) =>
    r.url().endsWith("/api/director"),
  );
  release();
  await returned;
  await expect(dialog.locator(".recap-summary")).toHaveText(
    "The sides are level at 0–0. No match developments to highlight yet.",
  );
  await expect(dialog.locator(".recap-timeline button")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Review verified recap" }),
  ).toBeEnabled();
});
