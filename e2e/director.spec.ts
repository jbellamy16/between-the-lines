import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { createInvestigation } from "../src/lib/ai/director/tools";
import { packageStory } from "../src/lib/ai/director/story";

test("story evidence presents the comparison and keeps technical details secondary", async ({
  page,
}, testInfo) => {
  // UI fixture computed from the same recorded events as the live walkthrough;
  // no provider calls are made or claimed by this test.
  const match = new SyntheticMatchSource().read("pressure");
  const session = createInvestigation(match, 3804, "analyst");
  const evidence = session.execute("compare_time_windows", {
    matchId: match.id,
    start: 3252,
    end: 3804,
    team: "harbor",
    playerId: null,
    eventId: null,
  });
  const claim = evidence.claims.find(
    (claim) =>
      claim.category === "window-comparison" && claim.id.endsWith(":shot"),
  )!;
  const story = packageStory(
    claim,
    match,
    3804,
    "analyst",
    "offline",
    "detail",
    "comparison",
  );
  await page.route("**/api/insights", (route) =>
    route.fulfill({ json: { mode: "offline", proactive: false } }),
  );
  await page.route("**/api/director", (route) =>
    route.fulfill({
      json: {
        source: "offline",
        stories: [story],
        provenance: { cutoff: 3804 },
        trace: [],
        metrics: { requests: 0, toolInvocations: 0, cached: false },
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Investigate this passage", exact: true })
    .click();
  const panel = page.locator(".story-evidence");
  await panel.getByText("How we know this story", { exact: true }).click();
  await expect(
    panel.getByRole("region", { name: "Supporting comparison" }),
  ).toBeVisible();
  await expect(panel).toContainText("9m 12s window");
  await expect(panel.locator(".story-current strong")).toHaveText("4");
  await expect(panel.locator(".story-previous strong")).toHaveText("0");
  await expect(panel.locator(".story-event-list li")).toHaveCount(4);
  await expect(panel.locator(".story-technical-body")).not.toBeVisible();
  await expect(
    panel.getByText(story.evidenceEventIds[0], { exact: true }),
  ).not.toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include(".director-story")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: `artifacts/evidence-redesign-${testInfo.project.name}.png`,
  });
  await panel.getByText("Source & technical details", { exact: true }).click();
  await expect(
    panel.getByText(story.evidenceEventIds[0], { exact: true }),
  ).toBeVisible();
  await expect(panel).toContainText("No AI tool calls");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".director-actions button").first()).toHaveCSS(
    "color",
    "rgb(248, 250, 252)",
  );
  const darkAudit = await new AxeBuilder({ page })
    .include(".director-story")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(darkAudit.violations).toEqual([]);
  await panel.getByText("Source & technical details", { exact: true }).click();
  await panel.screenshot({
    path: `artifacts/evidence-redesign-${testInfo.project.name}-dark.png`,
  });
});
test("computed story connects evidence, broadcast JSON, and rewind-safe visibility", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const story = page.locator(".director-story");
  await expect(story).toBeVisible();
  await expect(story).toContainText("Deterministic offline");
  await story
    .getByRole("button", { name: "Replay story evidence", exact: true })
    .click();
  await expect(story.locator("svg").first()).toBeVisible();
  await story.getByText("Broadcast story", { exact: true }).click();
  await expect(story.locator(".broadcast-frame")).toBeVisible();
  const download = page.waitForEvent("download");
  await story
    .getByRole("button", { name: "Download verified story JSON" })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "between-the-lines-story.json",
  );
  const audit = await new AxeBuilder({ page })
    .include(".director-story")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await story.screenshot({
    path: `artifacts/director-${testInfo.project.name}.png`,
  });
  await page.getByRole("slider").first().fill("0");
  await expect(story).not.toBeVisible();
});
test("Catch Me Up calls the director and remains explicitly offline", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/director") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Review verified recap", exact: true })
    .click();
  const result = await (await response).json();
  expect(result.source).toBe("offline");
  expect(result.metrics.requests).toBe(0);
  await expect(page.getByRole("dialog")).toContainText(
    "Verified from recorded events",
  );
  await expect(
    page.getByRole("dialog").locator(".recap-summary"),
  ).not.toContainText("statistical significance");
});
test("an investigation response cannot survive a rewind", async ({ page }) => {
  const response = await page.request.post("/api/director", {
    data: { scenario: "pressure", time: 3804, mode: "fan" },
  });
  const result = await response.json();
  // Delayed UI transport fixture only; this test does not simulate successful live inference.
  result.stories[0].headline = "LATE INVESTIGATION RESULT";
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/director", async (route) => {
    await held;
    await route.fulfill({ json: result }).catch(() => {});
  });
  await page.goto("/");
  const request = page.waitForRequest((r) => r.url().endsWith("/api/director"));
  await page
    .getByRole("button", { name: "Investigate this passage", exact: true })
    .click();
  await request;
  await page.getByRole("slider", { name: "Match timeline" }).fill("0");
  release();
  await expect(page.locator(".director-story")).not.toBeVisible();
  await expect(page.getByText("LATE INVESTIGATION RESULT")).toHaveCount(0);
});

test("measured storylines emerge, weaken, resolve, and reconstruct after seeking", async ({
  page,
}) => {
  await page.goto("/");
  const story = page.locator(".director-story");
  await expect(
    story.getByRole("heading", { name: "Why it matters", exact: true }),
  ).toBeVisible();
  await expect(
    story.getByRole("heading", { name: "Watch next", exact: true }),
  ).toBeVisible();
  const slider = page.getByRole("slider", { name: "Match timeline" });
  await slider.fill("3900");
  const history = page.locator(".storyline-history");
  await history
    .getByText("How the match story is changing", { exact: true })
    .click();
  const harbor = history.getByRole("region", {
    name: "Harbor recoveries in the attacking third storyline",
  });
  await expect(harbor.locator(".storyline-state")).toHaveText("emerging");
  await expect(harbor.locator(".storyline-timeline li")).toHaveCount(1);
  await slider.fill("4200");
  await expect(harbor.locator(".storyline-state")).toHaveText("weakening");
  await slider.fill("4500");
  await expect(harbor.locator(".storyline-state")).toHaveText("resolved");
  await expect(harbor.locator(".storyline-timeline li")).toHaveCount(3);
  await slider.fill("3900");
  await expect(harbor.locator(".storyline-state")).toHaveText("emerging");
  await expect(harbor.locator(".storyline-timeline li")).toHaveCount(1);
  await expect(harbor.getByText("70:00", { exact: true })).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .include(".storyline-history")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await slider.fill("0");
  await expect(history).toHaveCount(0);
  await slider.fill("4500");
  await history
    .getByText("How the match story is changing", { exact: true })
    .click();
  await expect(harbor.locator(".storyline-state")).toHaveText("resolved");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Fixture").selectOption("quiet");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(harbor).toHaveCount(0);
});
