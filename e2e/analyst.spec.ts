import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ready = async (page: Page) => {
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
};
const panel = (page: Page) =>
  page
    .getByRole("region", { name: "Ask the analyst" })
    .filter({ visible: true })
    .first();

const steps = [
  { kind: "plan", label: "Reading the match at 63:24" },
  {
    kind: "tool",
    tool: "compare_time_windows",
    label: "Compared Harbor 45:00–54:12 with 54:12–63:24",
    events: 31,
  },
  {
    kind: "tool",
    tool: "get_shot_locations",
    label: "Mapped Harbor's shots, 54:12–63:24",
    events: 4,
  },
  {
    kind: "verify",
    passed: true,
    issues: [],
    label: "Verified 5 facts and 2 cited events against the evidence",
  },
];

async function mockAnalyst(page: Page, status: "answered" | "declined") {
  await page.route("**/api/insights", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({
          json: {
            mode: "foundry",
            proactive: false,
            directorContext: "analyst",
          },
        })
      : r.continue(),
  );
  const asked: unknown[] = [];
  await page.route("**/api/ask", async (r) => {
    const body = r.request().postDataJSON();
    asked.push(body);
    const result = {
      version: "analyst-1.0.0",
      status,
      matchId: "pressure",
      cutoff: body.time,
      question: body.question,
      answer:
        status === "answered"
          ? "Harbor took 4 shots between 54:12 and 63:24, after 0 in the spell before. Theo March had the best of them at 62:50."
          : "Recorded events can't show how anyone feels. They can show where Harbor's shots came from.",
      citedEventIds:
        status === "answered"
          ? ["pressure-202632-451", "pressure-202632-463"]
          : [],
      steps,
      source: "foundry",
      model: "between-the-lines-gpt54-mini",
      cached: false,
      metrics: {
        requests: 2,
        toolCalls: 2,
        latencyMs: 2100,
        estimatedCostUsd: 0.003,
      },
      notice: "",
    };
    await r.fulfill({
      headers: { "Content-Type": "application/x-ndjson" },
      body:
        steps.map((step) => JSON.stringify({ type: "step", step })).join("\n") +
        "\n" +
        JSON.stringify({ type: "result", result }) +
        "\n",
    });
  });
  return asked;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("offline builds explain that the live analyst is off", async ({
  page,
}) => {
  await ready(page);
  await expect(panel(page)).toContainText("live analyst is off");
  await expect(panel(page).getByRole("textbox")).toHaveCount(0);
});

test("a question shows the agent's steps and a verified answer with replayable evidence", async ({
  page,
}) => {
  const asked = await mockAnalyst(page, "answered");
  await ready(page);
  const ask = panel(page);
  await ask.getByRole("textbox").fill("What changed in the last ten minutes?");
  await ask.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(ask.getByText("Verified · 2 lookups")).toBeVisible();
  await expect(ask).toContainText(
    "Compared Harbor 45:00–54:12 with 54:12–63:24",
  );
  await expect(ask).toContainText("Harbor took 4 shots");
  expect(asked[0]).toMatchObject({
    scenario: "pressure",
    time: 3804,
    question: "What changed in the last ten minutes?",
  });
  await ask.getByRole("button", { name: "62:50 · shot" }).click();
  const results = await new AxeBuilder({ page })
    .include(".analyst-panel")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("suggested questions ask immediately, and declines are labelled", async ({
  page,
}) => {
  await mockAnalyst(page, "declined");
  await ready(page);
  const ask = panel(page);
  await ask
    .getByRole("button", { name: "Is the other team doing anything about it?" })
    .click();
  await expect(ask.getByText("The events can't tell us that")).toBeVisible();
  await expect(ask.getByRole("button", { name: /· shot/ })).toHaveCount(0);
});
