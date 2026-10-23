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
    passed: false,
    issues: ["Harbor took 7 shots is not in the lookups."],
    label: "Verifier flagged 1 problem",
  },
  { kind: "revise", reason: "verification", label: "Revising answer…" },
  {
    kind: "verify",
    passed: true,
    issues: [],
    label:
      "Checked 5 figures, times and names and 2 cited events against the lookups",
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
      matchId: body.scenario,
      cutoff: body.time,
      question: body.question,
      answer:
        status === "answered"
          ? "Harbor took 4 shots between 54:12 and 63:24, after 0 in the spell before. Leon Costa had the last of them at 63:11."
          : "Recorded events can't show how anyone feels. They can show where Harbor's shots came from.",
      citedEventIds:
        status === "answered"
          ? ["pressure-163530-459", "pressure-163530-471"]
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

test("the panel says nothing about the analyst's mode until it is known", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/insights", async (r) => {
    if (r.request().method() !== "GET") return r.continue();
    await held;
    await r.fulfill({ json: { mode: "offline", configured: "offline" } });
  });
  await ready(page);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).not.toContainText("live analyst is off");
  release();
  await expect(panel(page)).toContainText("live analyst is off");
});

test("a question shows the agent's steps and a verified answer with replayable evidence", async ({
  page,
}) => {
  const asked = await mockAnalyst(page, "answered");
  await ready(page);
  const ask = panel(page);
  await ask.getByRole("textbox").fill("What changed in the last ten minutes?");
  await ask.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(ask.getByText("Answer revised, then checked")).toBeVisible();
  await expect(ask).toContainText("Harbor took 4 shots");
  // Finished: one status line, no live progress, the detail behind a disclosure.
  await expect(ask.getByText("Answer revised, then checked")).toBeVisible();
  await expect(ask.locator(".analyst-step-pending")).toHaveCount(0);
  const steps = ask.getByLabel("What the analyst did");
  await expect(steps).toBeHidden();
  await ask.getByText("How the analyst checked this").click();
  await expect(steps).toContainText(
    "Compared Harbor 45:00–54:12 with 54:12–63:24",
  );
  await expect(steps).toContainText("Answer revised.");
  await expect(steps).not.toContainText("Revising answer");
  expect(asked[0]).toMatchObject({
    scenario: "pressure",
    time: 3804,
    question: "What changed in the last ten minutes?",
  });
  await ask.getByRole("button", { name: "63:11 · shot" }).click();
  const results = await new AxeBuilder({ page })
    .include(".analyst-panel")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("free-text declines are labelled and cite nothing", async ({ page }) => {
  await mockAnalyst(page, "declined");
  await ready(page);
  const ask = panel(page);
  await ask.getByRole("textbox").fill("How nervous is the Riverside keeper?");
  await ask.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(ask.getByText("The events can't tell us that")).toBeVisible();
  await expect(ask.getByRole("button", { name: /· shot/ })).toHaveCount(0);
});

test("without a story, generic starter questions ask immediately", async ({
  page,
}) => {
  const asked = await mockAnalyst(page, "answered");
  await ready(page);
  await page.getByLabel("Fixture", { exact: true }).selectOption("quiet");
  const ask = panel(page);
  await expect(page.locator(".quiet-story")).toContainText("No new headline");
  await ask
    .getByRole("button", { name: "Is the other team doing anything about it?" })
    .click();
  await expect(ask.getByText("Answer revised, then checked")).toBeVisible();
  expect(asked.at(-1)).toMatchObject({
    question: "Is the other team doing anything about it?",
  });
});
