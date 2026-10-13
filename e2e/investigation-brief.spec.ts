import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openStoryDetails } from "./story-details";

test("the story card leads with what changed and why, and keeps the full brief one Details toggle away", async ({
  page,
}, info) => {
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") posts++;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Follow the device theme so this test can check both.
  await page.addInitScript(() =>
    localStorage.setItem("second-look-appearance", "system"),
  );
  await page.goto("/");
  const story = page.locator(".director-story");
  for (const name of ["What changed", "Why it matters"])
    await expect(
      story.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    story.getByRole("group", { name: "Story evidence" }).getByRole("button", {
      name: /^Replay supporting/,
    }),
  ).toHaveCount(3);
  await expect(
    story.getByRole("heading", { name: "What challenges it", exact: true }),
  ).not.toBeVisible();
  await openStoryDetails(page);
  await expect(story.locator(".investigation-source-label")).toHaveText(
    "Verified event analysis",
  );
  await expect(story).toContainText("No model investigation");
  for (const name of [
    "What changed",
    "Why it matters",
    "Evidence that supports it",
    "What challenges it",
    "What to watch next",
  ])
    await expect(
      story.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(story.locator(".story-significance > p")).toContainText(
    "63:24 to 72:36",
  );
  await expect(story.locator(".story-evidence-body")).not.toBeVisible();
  await expect(
    story.getByRole("region", { name: "Counter-evidence and limits" }),
  ).toContainText("No counter-evidence identified in this sample");

  const citation = story
    .getByRole("button", { name: /^Replay supporting/ })
    .first();
  await citation.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".pitch-panel").getByLabel("Recorded event", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("clock")).toContainText("63:24");

  await page.getByRole("slider", { name: "Match timeline" }).fill("4200");
  const challenges = story.getByRole("region", {
    name: "Counter-evidence and limits",
  });
  await expect(challenges).toContainText("1 shot in the later half");
  await expect(challenges).not.toContainText("No counter-evidence identified");
  await challenges
    .getByRole("button", { name: /Replay counter-evidence/ })
    .click();
  await expect(page.getByTestId("clock")).toContainText("70:00");
  await expect(
    page.locator(".pitch-panel").getByLabel("Recorded event", { exact: true }),
  ).toHaveValue("pressure-202632-506");

  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".director-story")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await story.screenshot({
      path: `artifacts/investigation-brief/${info.project.name}-${theme}.png`,
    });
  }
  await page.getByRole("slider", { name: "Match timeline" }).fill("3804");
  await expect(challenges).not.toContainText("1 shot in the later half");
  await expect(story.locator(".story-significance > p")).toContainText(
    "63:24 to 72:36",
  );
  expect(posts).toBe(0);
});
