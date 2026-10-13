import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openStoryDetails } from "./story-details";

// The story's own questions are the analyst's starter chips: the checked
// answer shows instantly and the agent adds to it.
const panel = (page: Page) =>
  page
    .getByRole("region", { name: "Ask the analyst" })
    .filter({ visible: true })
    .first();
const checked = (page: Page) => panel(page).locator(".analyst-checked");
const ready = async (page: Page) => {
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
};
const level = async (page: Page, value: string) => {
  await openStoryDetails(page);
  await page
    .locator(".director-story")
    .getByLabel("Explanation level", { exact: true })
    .selectOption(value);
};

async function mockAgent(
  page: Page,
  behavior: "success" | "failure" | "held" = "success",
) {
  await page.route("**/api/insights", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({
          json: {
            mode: "foundry",
            proactive: false,
            directorContext: "guided-browser",
          },
        })
      : r.continue(),
  );
  const asked: { question: string; time: number }[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ask", async (r) => {
    const body = r.request().postDataJSON();
    const n = asked.push(body);
    if (behavior === "failure" && n === 1)
      return r.fulfill({ status: 503, json: { error: "Unavailable" } });
    if (behavior === "held" && n === 1) await held;
    const step = {
      kind: "tool",
      tool: "compare_time_windows",
      label: "Compared Riverside 45:00–54:12 with 54:12–63:24",
      events: 31,
    };
    const result = {
      version: "analyst-1.0.0",
      status: "answered",
      matchId: "pressure",
      cutoff: body.time,
      question: body.question,
      answer: `Agent answer ${n}: Riverside had 0 shots in 54:12–63:24.`,
      citedEventIds: [],
      steps: [step],
      source: "foundry",
      model: "between-the-lines-gpt54-mini",
      cached: false,
      metrics: {
        requests: 1,
        toolCalls: 1,
        latencyMs: 900,
        estimatedCostUsd: 0.002,
      },
      notice: "",
    };
    try {
      await r.fulfill({
        headers: { "Content-Type": "application/x-ndjson" },
        body:
          JSON.stringify({ type: "step", step }) +
          "\n" +
          JSON.stringify({ type: "result", result }) +
          "\n",
      });
    } catch {
      /* the page cancelled this request */
    }
  });
  return { asked, release: () => release() };
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("offline checked questions are keyboard accessible, preserve the story and replay, and fit each viewport", async ({
  page,
}, info) => {
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  await ready(page);
  await expect(panel(page)).toContainText("live analyst is off");
  const heading = await page.locator(".director-story h2").innerText();
  const q = panel(page).getByRole("button", {
    name: "Is the other team improving too?",
    exact: true,
  });
  await q.focus();
  await page.keyboard.press("Enter");
  await expect(q).toHaveAttribute("aria-pressed", "true");
  await expect(checked(page)).toContainText("No model investigation");
  await expect(page.locator(".director-story h2")).toHaveText(heading);
  await expect(page.getByTestId("clock")).toContainText("63:24");
  const before = await checked(page)
    .locator(".analyst-checked-answer")
    .innerText();
  await level(page, "fan");
  await expect(checked(page).locator(".analyst-checked-answer")).toHaveText(
    before,
  );
  await checked(page)
    .getByText("How this was checked", { exact: true })
    .click();
  const replay = checked(page)
    .getByRole("button", { name: /Replay$/ })
    .first();
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(
    page.locator(".pitch-panel").getByLabel("Recorded event", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("clock")).toContainText("63:24");
  await level(page, "plain");
  await panel(page)
    .getByRole("button", { name: "Are these chances actually better?" })
    .click();
  await expect(checked(page)).toContainText(
    "average chance quality cannot be compared",
  );
  expect(posts).toBe(0);
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/guided/${info.project.name}.png`,
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page })
    .include(".analyst-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "desktop") {
    await page.setViewportSize({ width: 820, height: 1180 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("the checked answer shows before the agent answers, and the agent adds to it", async ({
  page,
}) => {
  const agent = await mockAgent(page, "held");
  await ready(page);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await expect(checked(page)).toContainText("Checked from recorded events");
  await expect(panel(page)).toContainText("The analyst is looking for more");
  await expect.poll(() => agent.asked.length).toBe(1);
  expect(agent.asked[0]).toMatchObject({
    question: "Is the other team improving too?",
    time: 3804,
  });
  agent.release();
  await expect(
    panel(page).getByText("The analyst adds · Verified · 1 lookup"),
  ).toBeVisible();
  await expect(panel(page)).toContainText("Agent answer 1");
  await expect(checked(page)).toBeVisible();
});

test("an agent failure keeps the checked answer and the next question still works", async ({
  page,
}) => {
  const agent = await mockAgent(page, "failure");
  await ready(page);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await expect(panel(page)).toContainText(
    "The checked answer above still stands",
  );
  await expect(checked(page)).toContainText("Checked from recorded events");
  await panel(page)
    .getByRole("button", { name: "Has this increase already faded?" })
    .click();
  await expect(checked(page)).toContainText("Checked from recorded events");
  await expect(panel(page)).toContainText("Agent answer 2");
  expect(agent.asked.map((a) => a.question)).toEqual([
    "Is the other team improving too?",
    "Has this increase already faded?",
  ]);
});

test("cancellation and question changes cannot publish a late answer", async ({
  page,
}) => {
  const agent = await mockAgent(page, "held");
  await ready(page);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await panel(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(checked(page)).toContainText("Checked from recorded events");
  await panel(page)
    .getByRole("button", { name: "Has this increase already faded?" })
    .click();
  await expect(panel(page)).toContainText("Agent answer 2");
  agent.release();
  await expect(panel(page).locator(".analyst-question")).toContainText(
    "Has this increase already faded?",
  );
  await expect(panel(page)).not.toContainText("Agent answer 1");
  await page.getByRole("slider", { name: "Match timeline" }).fill("4200");
  await expect(page.locator(".analyst-checked")).toHaveCount(0);
});

test("rewind and fixture changes invalidate an in-flight answer", async ({
  page,
}) => {
  const agent = await mockAgent(page, "held");
  await ready(page);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await expect.poll(() => agent.asked.length).toBe(1);
  await page.getByRole("slider", { name: "Match timeline" }).fill("3600");
  agent.release();
  await expect(page.locator(".analyst-response")).toHaveCount(0);
  await page.getByRole("slider", { name: "Match timeline" }).fill("3804");
  await expect(page.locator(".analyst-response")).toHaveCount(0);
  await page.getByRole("slider", { name: "Match timeline" }).fill("4200");
  await panel(page)
    .getByRole("button", {
      name: "Are these chances actually better?",
      exact: true,
    })
    .click();
  await expect(checked(page)).toContainText("xG per shot");
  await page.getByLabel("Fixture", { exact: true }).selectOption("quiet");
  await expect(page.locator(".analyst-response")).toHaveCount(0);
});

test("asking a checked question cancels an older story review before it can replace the story", async ({
  page,
}) => {
  const { SyntheticMatchSource } = await import("../src/lib/sources/synthetic");
  const { observe, claimEmphasis } =
    await import("../src/lib/ai/director/observer");
  const { packageStory } = await import("../src/lib/ai/director/story");
  const match = new SyntheticMatchSource().read("pressure");
  const candidate = observe(match, 3804).find(
    (c) =>
      c.category === "activity-change" &&
      c.statistics[0].label === "ball wins in the attacking third",
  )!;
  const differentStory = packageStory(
    candidate,
    match,
    3804,
    "analyst",
    "foundry",
    "brief",
    claimEmphasis[candidate.category],
  );
  await mockAgent(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/director", async (route) => {
    const data = route.request().postDataJSON();
    const baseline = await (
      await page.request.post("/api/director", { data })
    ).json();
    await held;
    try {
      await route.fulfill({
        json: {
          ...baseline,
          source: "foundry",
          cacheContext: "guided-race",
          stories: [differentStory],
        },
      });
    } catch {
      /* cancelled */
    }
  });
  await ready(page);
  const heading = await page.locator(".director-story h2").innerText();
  await openStoryDetails(page);
  await page
    .getByRole("button", {
      name: "Review story with Microsoft Foundry",
      exact: true,
    })
    .click();
  await panel(page)
    .getByRole("button", {
      name: "Is the other team improving too?",
      exact: true,
    })
    .click();
  await expect(panel(page)).toContainText("Agent answer 1");
  release();
  await expect(
    page.getByRole("button", {
      name: "Review story with Microsoft Foundry",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(page.locator(".director-story h2")).toHaveText(heading);
  await expect(panel(page).locator(".analyst-question")).toContainText(
    "Is the other team improving too?",
  );
});

test("the shot surge comparison is deterministic in both styles", async ({
  page,
}) => {
  await ready(page);
  const heading = await page.locator(".director-story h2").innerText();
  const surge = panel(page).getByRole("button", {
    name: "What best describes this shot surge?",
    exact: true,
  });
  await surge.click();
  await checked(page)
    .getByText("How this was checked", { exact: true })
    .click();
  await expect(
    checked(page).getByRole("row", {
      name: "Separate spells leading to those shots",
    }),
  ).toContainText("0");
  await expect(checked(page)).toContainText("No model investigation");
  await expect(checked(page)).toContainText(
    "Several shots after one recovery count as one spell with the ball leading to a shot",
  );
  await expect(page.locator(".director-story h2")).toHaveText(heading);
  await level(page, "analysis");
  await expect(
    checked(page).getByRole("row", { name: "Distinct linked possessions" }),
  ).toBeVisible();
  await expect(checked(page)).toContainText("pressing, causation");
  await page.getByRole("slider", { name: "Match timeline" }).fill("4200");
  await expect(page.locator(".analyst-checked")).toHaveCount(0);
  await surge.click();
  await checked(page)
    .getByText("How this was checked", { exact: true })
    .click();
  await expect(
    checked(page)
      .getByRole("row", { name: "Distinct linked possessions" })
      .getByRole("cell")
      .last(),
  ).toHaveText("1");
  await checked(page)
    .getByRole("button", { name: /Replay$/ })
    .first()
    .click();
  await expect(page.getByTestId("clock")).toContainText("70:00");
});
