import { presentStory } from "../src/lib/explanation";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { observe } from "../src/lib/ai/director/observer";
import { selectLeadCandidate } from "../src/lib/ai/director/editorial";
import { packageStory } from "../src/lib/ai/director/story";

const match = new SyntheticMatchSource().read("pressure");
const lead = selectLeadCandidate(observe(match, 3804, "analyst"))!;
const expected = packageStory(
  lead,
  match,
  3804,
  "analyst",
  "offline",
  "brief",
  "comparison",
);
const shell = (page: import("@playwright/test").Page) =>
  page.locator(".app-shell").filter({ visible: true });

test("one story controls the initial pitch, secondary selection and replay; offline exploration makes no request", async ({
  page,
}, info) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const story = page.locator(".director-story");
  await expect(story.getByRole("heading", { level: 2 })).toHaveText(
    presentStory(expected, match, "plain").headline,
  );
  await expect(page.locator(".pitch-story-label")).toContainText(
    presentStory(expected, match, "plain").headline,
  );
  const ids = await page
    .locator(".pitch-panel .action-picker option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  expect(ids).toEqual(expected.evidenceEventIds);
  expect(
    ids.every(
      (id) => match.events.find((event) => event.id === id)?.type === "shot",
    ),
  ).toBe(true);
  await expect(
    story.getByRole("region", { name: "Ask the analyst", exact: true }),
  ).toHaveCount(1);
  const explanation = await story.locator(":scope > p").first().innerText();
  await story
    .getByRole("button", { name: "Explore evidence", exact: true })
    .click();
  await expect(story.locator(".story-evidence-body")).toBeVisible();
  await expect(story.locator(":scope > p").first()).toHaveText(explanation);
  await expect(story.locator(".story-technical-body")).not.toBeVisible();
  await story.getByText("More from this match", { exact: true }).click();
  await story
    .getByRole("button", {
      name: "Harbor: more ball wins in the attacking third",
      exact: true,
    })
    .click();
  await expect(story.getByRole("heading", { level: 2 })).toHaveText(
    "Harbor are winning the ball near the opponent’s goal more often.",
  );
  await expect(page.locator(".pitch-story-label")).toContainText(
    "winning the ball",
  );
  const winIds = await page
    .locator(".pitch-panel .action-picker option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  expect(winIds).toHaveLength(4);
  expect(
    winIds.every((id) =>
      ["recovery", "interception", "tackle"].includes(
        match.events.find((event) => event.id === id)!.type,
      ),
    ),
  ).toBe(true);
  await story.getByText("Broadcast story", { exact: true }).click();
  await expect(
    story.locator(".broadcast-frame circle[role='img']"),
  ).toHaveCount(4);
  await story
    .getByRole("button", { name: "Replay story evidence", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Story evidence replay" }),
  ).toBeVisible();
  const replayIds = await page
    .locator(".pitch-panel select[aria-label='Recorded event'] option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  expect(replayIds).toEqual(winIds);
  expect(posts).toEqual([]);
  await page.screenshot({
    path: `artifacts/editorial-milestone/${info.project.name}-replay.png`,
    fullPage: true,
  });
});

test("the main explanation fits the first mobile screen and stays accessible at desktop and tablet sizes", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const story = page.locator(".director-story");
  await expect(story).toBeVisible();
  if (info.project.name === "mobile") {
    const explanation = await story.locator(":scope > p").first().boundingBox();
    expect(explanation!.y + explanation!.height).toBeLessThan(760);
  }
  await page.screenshot({
    path: `artifacts/editorial-milestone/${info.project.name}-first-screen.png`,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "desktop") {
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.screenshot({
      path: "artifacts/editorial-milestone/tablet-first-screen.png",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("quiet spells keep observations secondary without creating a headline", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByLabel("Fixture").selectOption("quiet");
  await expect(page.locator(".quiet-story")).toContainText("No new headline");
  await expect(page.locator(".director-story")).toHaveCount(0);
  await page
    .locator(".quiet-story")
    .getByText("More from this match", { exact: true })
    .click();
  await expect(
    page.locator(".quiet-story .director-observations button").first(),
  ).toBeVisible();
});

test("investigation reports loading and failure while keeping the selected evidence visible", async ({
  page,
}) => {
  await page.route("**/api/insights", (route) =>
    route.fulfill({ json: { mode: "openai", proactive: false } }),
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/director", async (route) => {
    await held;
    await route.fulfill({ status: 503, json: { error: "Unavailable" } });
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const story = page.locator(".director-story");
  const heading = await story.getByRole("heading", { level: 2 }).innerText();
  await story
    .getByRole("button", { name: "Investigate with OpenAI", exact: true })
    .click();
  await expect(story.getByRole("status")).toContainText("Checking the passage");
  release();
  await expect(story.getByRole("status")).toContainText("could not finish");
  await expect(story.getByRole("heading", { level: 2 })).toHaveText(heading);
  await expect(page.locator(".pitch-story-label")).toContainText(heading);
});

test("recorded full time leads with the result, while substitution evidence retains approximate minutes", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  test.skip(
    !(await page
      .getByRole("button", { name: "Recorded", exact: true })
      .count()),
    "Recorded matches are hidden in this build.",
  );
  await page.getByRole("button", { name: "Recorded", exact: true }).click();
  const timeline = shell(page).getByRole("slider", { name: "Match timeline" });
  await timeline.fill((await timeline.getAttribute("max")) as string);
  const story = shell(page).locator(".director-story");
  await expect(story.getByRole("heading", { level: 2 })).toContainText(
    "Full time: Arsenal 4–3 Leicester",
  );
  await story.getByText("More from this match", { exact: true }).click();
  await story
    .getByRole("button", {
      name: "D. Gray: involvement after coming on",
      exact: true,
    })
    .click();
  await expect(story.locator(":scope > p").first()).toContainText("~88′");
  await expect(story.locator(":scope > p").first()).not.toContainText("89:00");
  await story
    .getByRole("button", { name: "Explore evidence", exact: true })
    .click();
  await expect(story.locator(".story-event-list time").first()).toHaveText(
    "~88′",
  );
  await story
    .getByRole("button", { name: "Replay story evidence", exact: true })
    .click();
  await expect(
    shell(page)
      .locator(".pitch-panel select[aria-label='Recorded event'] option")
      .first(),
  ).toContainText("~88′");
  await story
    .getByRole("button", { name: "Back to main story", exact: true })
    .click();
  await expect(story.getByRole("heading", { level: 2 })).toContainText(
    "Full time: Arsenal 4–3 Leicester",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/editorial-milestone/${info.project.name}-full-time.png`,
  });
  await timeline.fill("0");
  await expect(shell(page).locator(".director-story")).toHaveCount(0);
});
