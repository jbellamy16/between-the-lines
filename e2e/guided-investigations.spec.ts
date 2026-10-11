import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const panel = (page: Page) =>
  page.getByRole("region", { name: "Questions about this story" });
const ready = async (page: Page) => {
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
};
async function mockAI(
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
  let posts = 0,
    release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/director", async (r) => {
    const data = r.request().postDataJSON();
    if (!data.question) return r.continue();
    const n = ++posts;
    const baseline = await (
      await page.request.post("/api/director", { data })
    ).json();
    if (behavior === "held" && n === 1) await held;
    await r.fulfill({
      json: {
        ...baseline,
        source: behavior === "failure" && n === 1 ? "offline" : "foundry",
        cacheContext: "guided-browser",
        notice:
          behavior === "failure" && n === 1
            ? "The investigation could not finish. You can retry."
            : "Investigation complete.",
        ...(behavior === "failure" && n === 1
          ? { failure: { category: "rate_limit" } }
          : {}),
      },
    });
  });
  return { posts: () => posts, release: () => release() };
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test("offline question is keyboard accessible, preserves story and replay, and renders at each viewport", async ({
  page,
}, info) => {
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  await ready(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByLabel("Follow a team")
    .selectOption("harbor");
  await page.keyboard.press("Escape");
  const preferences = await page.evaluate(() =>
    localStorage.getItem("second-look-preferences"),
  );
  const heading = await page.locator(".director-story h2").innerText();
  const q = panel(page).getByRole("button", {
    name: "Is the other team improving too?",
    exact: true,
  });
  await q.focus();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toContainText("No model investigation");
  await expect(page.locator(".director-story h2")).toHaveText(heading);
  await expect(page.getByTestId("clock")).toContainText("63:24");
  await expect(panel(page)).toContainText(
    "average chance quality cannot be compared",
  );
  const before = await panel(page)
    .locator(".question-direct-answer")
    .innerText();
  await page
    .locator(".director-story")
    .getByLabel("Explanation style", { exact: true })
    .selectOption("analysis");
  await expect(panel(page).locator(".question-direct-answer")).toHaveText(
    before,
  );
  await panel(page)
    .getByText("Explore answer evidence", { exact: true })
    .click();
  const replay = panel(page)
    .getByRole("button", { name: /Replay$/ })
    .first();
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(
    page.locator(".pitch-panel").getByLabel("Recorded event", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("clock")).toContainText("63:24");
  await page
    .locator(".director-story")
    .getByLabel("Explanation style", { exact: true })
    .selectOption("plain");
  await expect(panel(page)).toContainText("No model investigation");
  expect(posts).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("second-look-preferences")),
  ).toBe(preferences);
  await panel(page)
    .getByText("Explore answer evidence", { exact: true })
    .click();
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/guided/${info.project.name}.png`,
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page })
    .include(".guided-investigation")
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
    await panel(page).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "artifacts/guided/tablet.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("a failed request recovers and successful reuse separates question intents", async ({
  page,
}) => {
  const transport = await mockAI(page, "failure");
  await ready(page);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await expect(
    panel(page).getByRole("button", { name: "Retry this question" }),
  ).toBeVisible();
  await panel(page)
    .getByRole("button", { name: "Retry this question" })
    .click();
  await expect(panel(page)).toContainText("Independently verified");
  expect(transport.posts()).toBe(2);
  await panel(page)
    .getByRole("button", { name: "Has this increase already faded?" })
    .click();
  await expect(panel(page)).toContainText("No recent weakening");
  await expect(panel(page)).toContainText("Independently verified");
  expect(transport.posts()).toBe(3);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await expect(panel(page)).toContainText("Reused answer");
  await page
    .locator(".director-story")
    .getByLabel("Explanation style", { exact: true })
    .selectOption("analysis");
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await page.getByRole("tab", { name: "Full recap" }).click();
  await page.getByRole("tab", { name: "Quick recap" }).click();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toContainText("Reused answer");
  expect(transport.posts()).toBe(3);
});
test("cancellation and question changes cannot publish a late answer", async ({
  page,
}) => {
  const transport = await mockAI(page, "held");
  await ready(page);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await expect(panel(page).getByRole("status")).toContainText(
    "Investigating this question",
  );
  await panel(page)
    .getByRole("button", { name: "Cancel investigation" })
    .click();
  await expect(panel(page)).toContainText("Investigation cancelled");
  await panel(page)
    .getByRole("button", { name: "Has this increase already faded?" })
    .click();
  await expect(panel(page)).toContainText("Independently verified");
  transport.release();
  await expect(panel(page).locator(".question-answer h4")).toHaveText(
    "Has this increase already faded?",
  );
  await page.getByRole("slider", { name: "Match timeline" }).fill("4200");
  await expect(page.locator(".question-answer")).toHaveCount(0);
});
test("rewind and source changes invalidate an in-flight answer", async ({
  page,
}) => {
  const transport = await mockAI(page, "held");
  await ready(page);
  await panel(page)
    .getByRole("button", { name: "Is the other team improving too?" })
    .click();
  await expect.poll(transport.posts).toBe(1);
  await page.getByRole("slider", { name: "Match timeline" }).fill("3600");
  transport.release();
  await expect(page.locator(".question-answer")).toHaveCount(0);
  await page.getByRole("slider", { name: "Match timeline" }).fill("3804");
  await expect(page.locator(".question-answer")).toHaveCount(0);
});

test("an available quality question uses its own answer and a new fixture discards pending work", async ({
  page,
}) => {
  const transport = await mockAI(page, "held");
  await ready(page);
  await page.getByRole("slider", { name: "Match timeline" }).fill("4200");
  await panel(page)
    .getByRole("button", {
      name: "Are these chances actually better?",
      exact: true,
    })
    .click();
  await expect(panel(page)).toContainText("xG per shot");
  await expect.poll(transport.posts).toBe(1);
  await page.getByLabel("Fixture", { exact: true }).selectOption("quiet");
  transport.release();
  await expect(page.locator(".question-answer")).toHaveCount(0);
});
