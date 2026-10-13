import { test, expect } from "@playwright/test";

// All provider states are browser fixtures. The actual application stays AI-off.
async function fixtures(
  page: import("@playwright/test").Page,
  proactive = false,
) {
  const baseline = await (
    await page.request.post("/api/director", {
      data: { scenario: "pressure", time: 3804, mode: "analyst" },
    })
  ).json();
  expect(baseline.source).toBe("offline");
  await page.route("**/api/insights", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            mode: "foundry",
            proactive,
            directorContext: "browser-fixture",
          },
        })
      : route.continue(),
  );
  const fallback = {
    ...baseline,
    cacheContext: "browser-fixture",
    failure: { category: "rate_limit", retryAfterMs: 60000 },
    notice:
      "The AI service is temporarily rate-limited. Try again later. Showing the explanation checked from recorded events.",
  };
  const success = {
    ...baseline,
    cacheContext: "browser-fixture",
    source: "foundry",
    notice: undefined,
    stories: baseline.stories.map((story: Record<string, unknown>) => ({
      ...story,
      provider: "foundry",
    })),
    provenance: {
      ...baseline.provenance,
      provider: "foundry",
      model: "mocked-browser-fixture",
    },
  };
  return { fallback, success };
}

test("a temporary investigation fallback keeps the story visible and allows a same-context retry", async ({
  page,
}, info) => {
  const { fallback, success } = await fixtures(page);
  let release!: () => void,
    attempts = 0;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/director", async (route) => {
    attempts++;
    if (attempts === 1) await held;
    await route.fulfill({ json: attempts === 1 ? fallback : success });
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const story = page.locator(".director-story");
  const heading = await story.getByRole("heading", { level: 2 }).innerText();
  const action = story.getByRole("button", {
    name: "Review story with Microsoft Foundry",
    exact: true,
  });
  await action.click();
  await expect(story.getByRole("status")).toContainText("Checking the passage");
  await expect(story.getByRole("heading", { level: 2 })).toHaveText(heading);
  await page.screenshot({
    path: `artifacts/foundry-reliability/${info.project.name}-loading.png`,
  });
  release();
  await expect(story.getByRole("status")).toContainText(
    "temporarily rate-limited",
  );
  await expect(action).toBeEnabled();
  await expect(page.locator(".pitch-story-label")).toContainText(heading);
  await page.screenshot({
    path: `artifacts/foundry-reliability/${info.project.name}-fallback.png`,
  });
  await action.click();
  await expect(story.getByRole("status")).toContainText(
    "Investigation complete",
  );
  expect(attempts).toBe(2);
  await expect(story).toContainText("Investigated with Microsoft Foundry");
  await page.screenshot({
    path: `artifacts/foundry-reliability/${info.project.name}-recovered.png`,
  });
});

test("recap fallbacks remain retryable and only a verified success is reused after reopening", async ({
  page,
}, info) => {
  const { fallback, success } = await fixtures(page);
  let attempts = 0;
  await page.route("**/api/director", (route) =>
    route.fulfill({ json: ++attempts === 1 ? fallback : success }),
  );
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  let dialog = page.getByRole("dialog");
  const review = () =>
    dialog.getByRole("button", {
      name: "Review with Microsoft Foundry",
      exact: true,
    });
  await review().click();
  await expect(dialog.getByRole("status")).toContainText(
    "temporarily rate-limited",
  );
  await expect(review()).toBeEnabled();
  await page.screenshot({
    path: `artifacts/foundry-reliability/${info.project.name}-recap-fallback.png`,
  });
  await review().click();
  await expect(
    dialog.getByRole("button", { name: "Evidence reviewed", exact: true }),
  ).toBeDisabled();
  expect(attempts).toBe(2);
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  dialog = page.getByRole("dialog");
  await review().click();
  await expect(
    dialog.getByRole("button", { name: "Evidence reviewed", exact: true }),
  ).toBeDisabled();
  expect(attempts).toBe(2);
});

test("a failed episode is eligible again after the existing proactive cooldown", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-11T12:00:00Z") });
  const { fallback, success } = await fixtures(page, true);
  const requests: { time: number; preferences: unknown }[] = [];
  await page.route("**/api/director", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: requests.length === 1 ? fallback : success });
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const story = page.locator(".director-story");
  await story
    .getByRole("button", {
      name: "Review story with Microsoft Foundry",
      exact: true,
    })
    .click();
  await expect(story.getByRole("status")).toContainText(
    "temporarily rate-limited",
  );
  await page.clock.setSystemTime(new Date("2026-10-11T12:01:01Z"));
  await page.getByRole("button", { name: "Play match", exact: true }).click();
  await expect(story.getByRole("status")).toContainText(
    "Investigation complete",
  );
  expect(requests).toHaveLength(2);
  expect(requests[1].time).toBe(requests[0].time);
  expect(requests[1].preferences).toEqual(requests[0].preferences);
});
