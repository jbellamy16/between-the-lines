import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function historical(page: Page) {
  await page.goto("/");
  test.skip(
    !(await page
      .getByRole("button", { name: "Recorded", exact: true })
      .count()),
    "Recorded matches are hidden; enable RECORDED_MATCHES_VISIBLE to review them.",
  );
  await page.getByRole("button", { name: "Recorded", exact: true }).click();
  await expect(page.locator(".historical-shell .scoreboard")).toBeVisible();
}
async function seek(page: Page, time: number) {
  await page.getByRole("slider", { name: "Match timeline" }).fill(String(time));
}
test("source selection, spoiler-safe replay, event exploration and match switching", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const paidRoutes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") paidRoutes.push(r.url());
  });
  await historical(page);
  await expect(page.getByTestId("score").filter({ visible: true })).toHaveText(
    "0:0",
  );
  await expect(page.getByTestId("final-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reveal final score" }).check();
  await expect(page.getByTestId("final-score")).toContainText(
    "Arsenal 4–3 Leicester City",
  );
  await page.getByRole("checkbox", { name: "Reveal final score" }).uncheck();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Play match", exact: true }).click();
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).not.toContainText("00:00");
  await page
    .getByLabel("Playback speed")
    .filter({ visible: true })
    .selectOption("32");
  await page.getByRole("button", { name: "Pause match", exact: true }).click();
  await seek(page, 1800);
  await expect(page.getByTestId("score").filter({ visible: true })).toHaveText(
    "1:2",
  );
  await expect(
    page
      .getByRole("heading", { name: "Arsenal are picking up the rhythm" })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".historical-shell .selected-observation")
      .getByText(/153 pass attempts in the current/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pattern evidence", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pattern evidence", exact: true }),
  ).toBeVisible();
  await page.locator(".historical-shell .match-event-feed summary").click();
  await page
    .locator(".historical-shell .match-event-feed .event-feed-list button")
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Passage replay" }),
  ).toBeVisible();
  await expect(
    page.locator(".historical-shell .event-inspector"),
  ).toContainText("Source ID:");
  const markers = await page
    .locator(".historical-shell .pitch [data-event-time]")
    .evaluateAll((nodes) =>
      nodes.map((n) => Number(n.getAttribute("data-event-time"))),
    );
  expect(markers.every((t) => t <= 1800)).toBe(true);
  await page.getByRole("button", { name: "Catch me up" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    /Arsenal\s*1–2\s*Leicester City/,
  );
  await expect(page.getByRole("dialog")).not.toContainText("4–3");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Restart match" }).click();
  await expect(page.getByTestId("score").filter({ visible: true })).toHaveText(
    "0:0",
  );
  expect(paidRoutes).toEqual([]);
  for (const [id, score] of [
    ["2499719", "4:3"],
    ["2499943", "4:3"],
    ["2499841", "1:2"],
  ]) {
    await page.getByLabel("Fixture").filter({ visible: true }).selectOption(id);
    await expect(page.locator(".historical-shell .scoreboard")).toHaveAttribute(
      "data-match-id",
      id,
    );
    await expect(page.locator(".historical-shell .scoreboard")).toBeVisible();
    await page.getByRole("slider", { name: "Match timeline" }).focus();
    await page.keyboard.press("End");
    await expect(
      page.getByTestId("score").filter({ visible: true }),
    ).toHaveText(score);
    await page.getByRole("slider", { name: "Match timeline" }).focus();
    await page.keyboard.press("Home");
    await expect(
      page.getByTestId("score").filter({ visible: true }),
    ).toHaveText("0:0");
  }
  await page
    .getByLabel("Fixture")
    .filter({ visible: true })
    .selectOption("2499719");
  await expect(page.locator(".historical-shell .scoreboard")).toBeVisible();
  await expect(page.locator(".historical-shell .scoreboard")).toContainText(
    "Arsenal",
  );
  await seek(page, 1800);
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).toContainText("30:00");
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Recorded", exact: true }).focus();
  await page.screenshot({
    scale: "css",
    path: `artifacts/historical-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Synthetic", exact: true }).click();
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).toContainText("63:24");
  await page.screenshot({
    path: `artifacts/source-synthetic-${info.project.name}.png`,
    scale: "css",
    fullPage: false,
  });
});
test("historical accessibility, offline explanation and cutoff validation", async ({
  page,
}) => {
  await historical(page);
  await seek(page, 1800);
  await page
    .getByRole("button", { name: "Explore the explanation", exact: true })
    .click();
  await page
    .locator(".historical-shell .detail-panel .provenance summary")
    .click();
  await expect(
    page.locator(".detail-panel .historical-provider").last(),
  ).toContainText("Deterministic offline");
  await page.getByRole("button", { name: "Catch me up" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Review verified recap", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("How we reached this conclusion", { exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Evidence through 30:00",
  );
  await page.keyboard.press("Escape");
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);
});
test("replays stoppage time before the second half without revealing future goals", async ({
  page,
}) => {
  await historical(page);
  await seek(page, 2820);
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).toContainText("45+02:00");
  await expect(page.getByTestId("score").filter({ visible: true })).toHaveText(
    "2:2",
  );
  await seek(page, 2854);
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).toContainText("45:00");
  await expect(page.getByTestId("score").filter({ visible: true })).toHaveText(
    "2:2",
  );
  await page.getByRole("button", { name: "Catch me up" }).click();
  await expect(page.getByRole("dialog")).not.toContainText("4–3");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("region", { name: "The numbers behind the story" }),
  ).toContainText("Shots");
});
test("an emerging insight notifies once, without autonomous inference", async ({
  page,
}) => {
  await page.clock.install();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") requests.push(r.url());
  });
  await historical(page);
  await seek(page, 1790);
  await page
    .getByLabel("Playback speed")
    .filter({ visible: true })
    .selectOption("16");
  await page.getByRole("button", { name: "Play match", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.locator(".historical-shell .insight-notice")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss observation" }).click();
  await page.clock.runFor(15000);
  await expect(page.locator(".historical-shell .insight-notice")).toHaveCount(
    0,
  );
  expect(requests).toEqual([]);
});
test("late AI answers cannot survive a rewind or a match switch", async ({
  page,
}) => {
  await page.route("**/api/insights", (route) =>
    route.fulfill({ json: { mode: "openai" } }),
  );
  let release: () => void = () => {};
  let started: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/historical/narrate", async (route) => {
    started();
    await gate;
    await route
      .fulfill({
        json: {
          source: "openai",
          narrative: {
            explanation: "Stale historical answer",
            why: "old",
            watch: "old",
            evidenceIds: [],
            insightId: "old",
          },
          provenance: {
            provider: "openai",
            cached: false,
            cutoff: 1800,
            activity: [],
            validation: [],
            limitations: [],
            facts: [],
          },
        },
      })
      .catch(() => {});
  });
  await historical(page);
  await seek(page, 1800);
  await page
    .getByRole("button", { name: "Explain with OpenAI", exact: true })
    .click();
  await pending;
  await page.getByRole("button", { name: "Restart match" }).click();
  release();
  await expect(page.getByTestId("score").filter({ visible: true })).toHaveText(
    "0:0",
  );
  await expect(page.getByText("Stale historical answer")).toHaveCount(0);
  await page.getByRole("button", { name: "Synthetic", exact: true }).click();
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).toContainText("63:24");
});
test("historical replay supports dark appearance, reduced motion and a 320px screen", async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 850 });
  await historical(page);
  await seek(page, 1800);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Recorded", exact: true }).focus();
  await page.screenshot({
    path: `artifacts/historical-dark-${info.project.name}.png`,
    scale: "css",
    fullPage: true,
  });
});

test("public historical records use the canonical contract and exclude restricted research fixtures", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/historical/2499719");
  expect(response.status()).toBe(200);
  const match = await response.json();
  expect(match.schemaVersion).toBe("1.0.0");
  expect(match.provenance.license).toBe("CC BY 4.0");
  expect(match.capabilities.tracking).toBe(false);
  expect(
    match.events.every(
      (event: { matchId: string; order: number }, index: number) =>
        event.matchId === match.id && event.order === index,
    ),
  ).toBe(true);
  expect((await request.get("/api/historical/statsbomb-8658")).status()).toBe(
    404,
  );
  expect(
    (
      await request.post("/api/historical/narrate", {
        data: { matchId: "statsbomb-8658", time: 0, mode: "fan" },
      })
    ).status(),
  ).toBe(404);
  await historical(page);
  await expect(
    page.getByLabel("Fixture").filter({ visible: true }).locator("option"),
  ).toHaveCount(3);
  await page.locator(".match-attribution summary").click();
  await expect(
    page
      .locator(".match-attribution a")
      .filter({ hasText: "CC BY 4.0" })
      .last(),
  ).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
});

test("shared navigation preserves section and replay time across sources", async ({
  page,
}) => {
  await historical(page);
  await seek(page, 1800);
  for (const label of [
    "Match centre",
    "Insights",
    "Match stats",
    "Lineups",
    "Player focus",
    "Settings",
  ])
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  await page.getByRole("button", { name: "Match stats", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Match statistics", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Synthetic", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Match statistics", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recorded", exact: true }).click();
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).toContainText("30:00");
  await page.getByRole("button", { name: "Lineups", exact: true }).click();
  await page.getByRole("button", { name: /R. Holding.*On the pitch/ }).click();
  await expect(
    page.getByRole("heading", { name: "R. Holding", exact: true }),
  ).toBeVisible();
});

test("dense evidence conserves records and opens a recorded passage", async ({
  page,
}) => {
  await historical(page);
  await seek(page, 1800);
  await page
    .getByRole("button", { name: "Pattern evidence", exact: true })
    .click();
  await expect(
    page.getByText("Counts per pitch area · 153 actions.", { exact: false }),
  ).toBeVisible();
  const pitch = page.locator(".historical-shell .pitch-panel .pitch");
  expect(await pitch.locator(".event-path").count()).toBe(0);
  await page
    .getByRole("button", { name: "Passage replay", exact: true })
    .click();
  await expect(page.getByLabel("Sequence playback")).toBeVisible();
  await expect(
    page.getByText("Recorded passage · no possession or motion inferred"),
  ).toBeVisible();
  expect(await pitch.locator(".recorded-ball").count()).toBe(0);
});
