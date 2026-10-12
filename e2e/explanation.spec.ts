import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const styleKey = "between-the-lines-explanation-style";
const ready = async (page: Page) => {
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
};
const story = (page: Page) =>
  page.locator(".director-story").filter({ visible: true });
const selector = (page: Page) =>
  story(page).getByLabel("Explanation style", { exact: true });
const recordedOptions = (page: Page) =>
  page
    .locator(".pitch-panel select[aria-label='Recorded event'] option")
    .filter({ hasText: /./ })
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );

test.beforeEach(async ({ page }) =>
  page.emulateMedia({ reducedMotion: "reduce" }),
);

test("style persists, Settings stays synchronized, and selected evidence/replay/favorites stay in place", async ({
  page,
}) => {
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  await ready(page);
  await expect(selector(page)).toHaveValue("plain");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByLabel("Follow a team").selectOption("harbor");
  await settings.getByLabel("Follow a player").selectOption("harbor-9");
  await settings.getByLabel("Explanation style").selectOption("analysis");
  await page.keyboard.press("Escape");
  await expect(selector(page)).toHaveValue("analysis");
  await story(page).getByText("More from this match", { exact: true }).click();
  await story(page)
    .getByRole("button", {
      name: "Harbor: more ball wins in the attacking third",
      exact: true,
    })
    .click();
  await story(page)
    .getByRole("button", { name: "Explore evidence", exact: true })
    .click();
  await story(page)
    .getByRole("button", { name: "Replay story evidence", exact: true })
    .click();
  const replay = page
    .locator(".pitch-panel")
    .getByLabel("Recorded event", { exact: true });
  const ids = await recordedOptions(page);
  await replay.selectOption(ids[1]);
  const preference = await page.evaluate(() =>
    localStorage.getItem("second-look-preferences"),
  );
  await selector(page).selectOption("plain");
  await expect(story(page)).toContainText("Selected observation");
  await expect(story(page).getByRole("heading", { level: 2 })).toContainText(
    "winning the ball near the opponent’s goal",
  );
  await expect(story(page).locator(".story-evidence-body")).toBeVisible();
  await expect(replay).toHaveValue(ids[1]);
  expect(await recordedOptions(page)).toEqual(ids);
  await expect(page.getByTestId("clock")).toContainText("63:24");
  expect(
    await page.evaluate(() => localStorage.getItem("second-look-preferences")),
  ).toBe(preference);
  await selector(page).selectOption("analysis");
  await expect(replay).toHaveValue(ids[1]);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(settings.getByLabel("Explanation style")).toHaveValue(
    "analysis",
  );
  await expect(settings.getByLabel("Follow a team")).toHaveValue("harbor");
  await expect(settings.getByLabel("Follow a player")).toHaveValue("harbor-9");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(selector(page)).toHaveValue("analysis");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), styleKey),
  ).toBe("analysis");
  expect(posts).toBe(0);
});

test("all four style/length combinations retain qualifications, score, evidence and one reusable recap investigation", async ({
  page,
}) => {
  let investigations = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/director"))
      investigations++;
  });
  await ready(page);
  await page.getByRole("slider", { name: "Match timeline" }).fill("4200");
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Catch me up" });
  await dialog.getByRole("button", { name: "Review verified recap" }).click();
  await expect(
    dialog.getByRole("button", { name: "Evidence reviewed" }),
  ).toBeDisabled();
  const score = (await dialog.getByLabel("Score through 70:00").textContent())!;
  for (const style of ["plain", "analysis"]) {
    await dialog.getByLabel("Explanation style").selectOption(style);
    for (const length of ["Quick recap", "Full recap"]) {
      await dialog.getByRole("tab", { name: length }).click();
      await expect(dialog).toContainText("has eased");
      await expect(dialog.getByLabel("Score through 70:00")).toHaveText(score);
      await expect(
        dialog.getByRole("button", { name: "Evidence reviewed" }),
      ).toBeDisabled();
      await expect(dialog.locator(".recap-summary")).toContainText(
        style === "plain" ? "previous equal spell" : "57:30–70:00",
      );
      const evidence = dialog.locator("details.provenance");
      if ((await evidence.getAttribute("open")) === null)
        await evidence.locator(":scope > summary").click();
      await expect(dialog).toContainText("start excluded, end included");
      await expect(
        dialog.getByRole("button", { name: /63:|62:|61:/ }).first(),
      ).toBeVisible();
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      if (length === "Quick recap")
        await expect(dialog.locator(".recap-timeline button")).toHaveCount(3);
      else
        expect(
          await dialog.locator(".recap-timeline button").count(),
        ).toBeGreaterThan(3);
    }
  }
  expect(investigations).toBe(1);
  await page.keyboard.press("Escape");
  await expect(selector(page)).toHaveValue("analysis");
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await dialog.getByRole("button", { name: "Review verified recap" }).click();
  await expect(
    dialog.getByRole("button", { name: "Evidence reviewed" }),
  ).toBeDisabled();
  expect(investigations).toBe(1);
});

test("an in-flight investigation survives a style change and its verified result remains reusable", async ({
  page,
}) => {
  const result = await (
    await page.request.post("/api/director", {
      data: { scenario: "pressure", time: 3804, mode: "analyst" },
    })
  ).json();
  expect(result.metrics.requests).toBe(0);
  await page.route("**/api/insights", (route) =>
    route.fulfill({
      json: {
        mode: "foundry",
        proactive: false,
        directorContext: "explanation-fixture",
      },
    }),
  );
  let release!: () => void,
    requests = 0;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/director", async (route) => {
    requests++;
    expect(route.request().postDataJSON()).not.toHaveProperty("style");
    expect(route.request().postDataJSON().preferences).not.toHaveProperty(
      "style",
    );
    await held;
    await route.fulfill({
      json: {
        ...result,
        source: "foundry",
        cacheContext: "explanation-fixture",
        stories: result.stories.map((s: object) => ({
          ...s,
          provider: "foundry",
        })),
      },
    });
  });
  await ready(page);
  await story(page)
    .getByRole("button", { name: "Investigate with Microsoft Foundry" })
    .click();
  await expect(story(page).getByRole("status")).toContainText(
    "Checking the passage",
  );
  await selector(page).selectOption("analysis");
  await expect(story(page).getByRole("status")).toContainText(
    "Checking the passage",
  );
  release();
  await expect(story(page)).toContainText(
    "Investigated with Microsoft Foundry",
  );
  const ids = await recordedOptions(page);
  await selector(page).selectOption("plain");
  await expect(story(page)).toContainText(
    "Investigated with Microsoft Foundry",
  );
  expect(await recordedOptions(page)).toEqual(ids);
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Catch me up" });
  await dialog
    .getByRole("button", { name: "Review with Microsoft Foundry" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Evidence reviewed" }),
  ).toBeDisabled();
  expect(requests).toBe(1);
});

test("native keyboard controls, Insights and cross-tab preference synchronization", async ({
  page,
  context,
}) => {
  await ready(page);
  await selector(page).focus();
  await page.keyboard.press("f");
  await page.keyboard.press("Tab");
  await expect(selector(page)).toHaveValue("analysis");
  const other = await context.newPage();
  await ready(other);
  await expect(selector(other)).toHaveValue("analysis");
  await selector(other).selectOption("plain");
  await expect(selector(page)).toHaveValue("plain");
  await other.close();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Insights", exact: true })
    .click();
  const insights = page.getByRole("region", { name: "Insights", exact: true });
  await expect(insights.getByLabel("Explanation style")).toHaveValue("plain");
  const first = insights.locator(".insight-card").first();
  const plain = await first.innerText();
  await insights.getByLabel("Explanation style").selectOption("analysis");
  await expect(first).not.toHaveText(plain);
  await expect(first).toContainText("54:12–63:24");
  await first.click();
  await expect(selector(page)).toHaveValue("analysis");
  await page.getByRole("button", { name: "Explanation", exact: true }).click();
  await expect(page.locator(".explanation-text")).toContainText("45:00–54:12");
});

test("invalid or unavailable browser storage keeps a usable synchronized preference", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("between-the-lines-explanation-style", "advanced");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "between-the-lines-explanation-style")
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await ready(page);
  await expect(selector(page)).toHaveValue("plain");
  await selector(page).selectOption("analysis");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Explanation style"),
  ).toHaveValue("analysis");
});

test("recorded approximate times, full-time score, and rewind stay consistent across styles", async ({
  page,
}) => {
  await ready(page);
  const recorded = page.getByRole("button", { name: "Recorded", exact: true });
  test.skip(
    !(await recorded.count()),
    "Recorded matches are hidden in this build",
  );
  await recorded.click();
  const shell = page.locator(".historical-shell");
  const timeline = shell.getByRole("slider", { name: "Match timeline" });
  await timeline.fill((await timeline.getAttribute("max"))!);
  await story(page).getByText("More from this match", { exact: true }).click();
  await story(page)
    .getByRole("button", {
      name: "D. Gray: involvement after coming on",
      exact: true,
    })
    .click();
  for (const style of ["analysis", "plain"]) {
    await selector(page).selectOption(style);
    await expect(story(page).locator(":scope > p").first()).toContainText(
      "~88′",
    );
    await expect(story(page).locator(":scope > p").first()).not.toContainText(
      "89:00",
    );
    await story(page)
      .getByRole("button", { name: "Explore evidence", exact: true })
      .click();
    await expect(
      story(page).locator(".story-event-list time").first(),
    ).toHaveText("~88′");
  }
  await story(page).getByRole("button", { name: "Back to main story" }).click();
  await expect(story(page).getByRole("heading", { level: 2 })).toHaveText(
    "Full time: Arsenal 4–3 Leicester City",
  );
  await timeline.fill("0");
  await expect(story(page)).toHaveCount(0);
  await expect(shell.locator(".quiet-story")).toContainText("No new headline");
});

test("both styles and quiet-spell evidence fit accessible desktop, tablet and mobile layouts", async ({
  page,
}, info) => {
  await ready(page);
  const sizes =
    info.project.name === "desktop"
      ? [
          { width: 1440, height: 1100 },
          { width: 834, height: 1112 },
        ]
      : [page.viewportSize()!];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const style of ["plain", "analysis"]) {
      await selector(page).selectOption(style);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/explanation/${size.width}-${style}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.screenshot({
    path: `artifacts/explanation/${info.project.name}-settings.png`,
  });
  await page.keyboard.press("Escape");
  await page.getByLabel("Fixture").selectOption("quiet");
  const quiet = page.locator(".quiet-story");
  for (const style of ["plain", "analysis"]) {
    await quiet.getByLabel("Explanation style").selectOption(style);
    await expect(quiet).toContainText("No new headline");
    const evidence = quiet.locator(".quiet-evidence");
    if ((await evidence.getAttribute("open")) === null)
      await evidence.locator("summary").click();
    await expect(evidence).toContainText("Recorded events through 63:24");
    await expect(evidence.getByRole("button").first()).toBeVisible();
  }
});
