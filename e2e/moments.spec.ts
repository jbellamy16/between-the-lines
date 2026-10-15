import { test, expect, type Page } from "@playwright/test";

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
};
const slider = (page: Page) =>
  page.getByRole("slider", { name: "Match timeline" });
const card = (page: Page) => page.locator(".moment-card");
const analyst = (page: Page) =>
  page
    .getByRole("region", { name: "Ask the analyst" })
    .filter({ visible: true })
    .first();

async function playTo6040(page: Page) {
  await slider(page).fill("3620");
  await page.getByRole("button", { name: "Play match" }).click();
  await expect(card(page)).toContainText("Moment · 60:40");
}

async function mockAnalyst(page: Page) {
  await page.route("**/api/insights", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ json: { mode: "foundry", proactive: false } })
      : r.continue(),
  );
  const asked: { time: number; question: string }[] = [];
  await page.route("**/api/ask", async (r) => {
    const body = r.request().postDataJSON();
    asked.push(body);
    const step = {
      kind: "verify",
      passed: true,
      issues: [],
      label: "Verified 2 facts against the evidence",
    };
    const result = {
      version: "analyst-1.0.0",
      status: "answered",
      matchId: body.scenario,
      cutoff: body.time,
      question: body.question,
      answer: "Riverside had 1 ball win near Harbor's goal before this spell.",
      citedEventIds: [],
      steps: [step],
      source: "foundry",
      model: "between-the-lines-gpt54-mini",
      cached: false,
      metrics: { requests: 1, toolCalls: 1, latencyMs: 900 },
      notice: "",
    };
    await r.fulfill({
      headers: { "Content-Type": "application/x-ndjson" },
      body:
        JSON.stringify({ type: "step", step }) +
        "\n" +
        JSON.stringify({ type: "result", result }) +
        "\n",
    });
  });
  return asked;
}

test.describe("moments", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("a moment card arrives during playback and never outlives a rewind", async ({
    page,
  }) => {
    await ready(page);
    await playTo6040(page);
    await expect(card(page)).toContainText(
      "Harbor are winning the ball near the opponent’s goal more often.",
    );
    await expect(card(page)).toContainText("up from 0 in the previous");
    await page.getByRole("button", { name: "Pause match" }).click();
    await slider(page).fill("3600");
    await expect(card(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Moments", exact: true }).click();
    const times = page.locator(".moment-timeline time");
    await expect(times.first()).toHaveText("59:10");
    await expect(times).not.toContainText(["60:40"]);
  });

  test("tapping a moment pauses, jumps to it, replays its evidence and opens the analyst", async ({
    page,
  }) => {
    const asked = await mockAnalyst(page);
    await ready(page);
    await playTo6040(page);
    await card(page)
      .getByRole("button", { name: /Replay and ask/ })
      .click();
    await expect(slider(page)).toHaveValue("3640");
    await expect(
      page.getByRole("button", { name: "Play match" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Passage replay" }),
    ).toBeVisible();
    await expect(page.locator(".pitch-story-label")).toContainText(
      "Evidence for:",
    );
    const panel = analyst(page);
    await expect(panel.locator(".analyst-question")).toContainText(
      "Is the other team improving too?",
    );
    await expect(panel.getByLabel("Checked answer")).toContainText(
      "Checked from recorded events",
    );
    await expect(panel.getByText(/The analyst adds · Verified/)).toBeVisible();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      time: 3640,
      question: "Is the other team improving too?",
    });
  });

  test("a goal opens the analyst on the story's own checked line", async ({
    page,
  }) => {
    await ready(page);
    await slider(page).fill("4700");
    await page.getByRole("button", { name: "Moments", exact: true }).click();
    await page.locator(".moment-timeline button", { hasText: "77:40" }).click();
    await expect(slider(page)).toHaveValue("4660");
    const panel = analyst(page);
    await expect(panel.locator(".analyst-question")).toContainText(
      "How did this goal come about?",
    );
    await expect(panel.getByLabel("Checked answer")).toContainText(
      "Theo March scored at 77:33.",
    );
  });

  test("a goal moment plays the build-up to the goal tapped", async ({
    page,
  }) => {
    await ready(page);
    await slider(page).fill("4700");
    await page.getByRole("button", { name: "Moments", exact: true }).click();
    await page.locator(".moment-timeline button", { hasText: "77:40" }).click();
    await expect(
      page
        .getByRole("heading", { name: "Passage replay" })
        .filter({ visible: true }),
    ).toBeVisible();
    const pitch = page.locator(".pitch-panel").filter({ visible: true });
    // The passage ends on the 77:33 goal, not the 01:00 one.
    await expect(
      pitch.locator(".event-inspector select option").last(),
    ).toContainText("77:33");
    await expect(pitch.locator(".event-inspector p")).toContainText(
      "77:33 Theo March: Goal",
      { timeout: 15000 },
    );
    await expect(pitch.getByText("REPLAY COMPLETE")).toBeVisible();
  });

  test("a story moment steps through its evidence and ends on the action that made it", async ({
    page,
  }) => {
    await ready(page);
    await slider(page).fill("4130");
    await page.getByRole("button", { name: "Moments", exact: true }).click();
    await page.locator(".moment-timeline button", { hasText: "61:20" }).click();
    const pitch = page.locator(".pitch-panel").filter({ visible: true });
    await expect(pitch.locator(".replay-caption")).toContainText(
      "Event 1 of 3",
    );
    await expect(pitch.locator(".event-inspector p")).toContainText("55:42");
    // One action at a time, about 1.4 s each: done within a few seconds,
    // not after the minutes between the shots.
    await expect(pitch.locator(".replay-caption")).toContainText(
      "Event 3 of 3",
      { timeout: 6000 },
    );
    await expect(pitch.locator(".event-inspector p")).toContainText(
      "61:19 Theo March",
    );
    await expect(pitch.getByText("REPLAY COMPLETE")).toBeVisible();
    await expect(slider(page)).toHaveValue("3680");
  });

  test("an eased story's replay says when its actions stopped", async ({
    page,
  }) => {
    await ready(page);
    await slider(page).fill("2400");
    await page.getByRole("button", { name: "Moments", exact: true }).click();
    await page.locator(".moment-timeline button", { hasText: "36:20" }).click();
    const pitch = page.locator(".pitch-panel").filter({ visible: true });
    await expect(pitch.locator(".replay-note")).toHaveText(
      "No more Harbor shots since 30:43.",
      { timeout: 8000 },
    );
  });

  test("the Moments tab lists only what has happened", async ({ page }) => {
    await ready(page);
    await slider(page).fill("0");
    await page.getByRole("button", { name: "Moments", exact: true }).click();
    await expect(page.locator(".moments-empty")).toBeVisible();
    await page
      .getByRole("button", { name: "Match centre", exact: true })
      .click();
    await slider(page).fill("1900");
    await page.getByRole("button", { name: "Moments", exact: true }).click();
    await expect(page.locator(".moment-timeline time")).toHaveText([
      "31:00",
      "01:00",
    ]);
  });
});

test("the card slides in, and appears without motion when reduced", async ({
  page,
}) => {
  await ready(page);
  await playTo6040(page);
  expect(
    await card(page).evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("moment-in");
  await page.getByRole("button", { name: "Pause match" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await slider(page).fill("3600");
  await playTo6040(page);
  expect(
    await card(page).evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
});
