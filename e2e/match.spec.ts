import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("playback, evidence, recap, and rewind stay synchronized", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.getByTestId("clock")).toContainText("63:24");
  await expect(
    page.getByRole("heading", { name: "Harbor are winning it higher" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Show me the sequence" }).click();
  await expect(
    page.getByRole("heading", { name: "Passage replay" }),
  ).toBeVisible();
  await expect(page.getByText("Measurement notes")).not.toBeVisible();
  await page.locator(".detail-panel .provenance summary").click();
  await expect(page.getByText("Measurement notes")).toBeVisible();
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".recap-cutoff")).toContainText("63:24");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Restart match" }).click();
  await expect(page.getByTestId("score")).toHaveText("0:0");
  await expect(page.getByTestId("clock")).toContainText("00:00");
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".recap-summary")).toHaveText(
    "The sides are level at 0–0. No match developments to highlight yet.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Play match", exact: true }).click();
  await expect(page.getByTestId("clock")).not.toContainText("00:00");
  await page.getByRole("button", { name: "Pause match", exact: true }).click();
  expect(errors).toEqual([]);
});
test("scenarios, navigation, player preferences and mobile layout work", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("Fixture")).toBeVisible();
  await page.getByLabel("Fixture").selectOption("quiet");
  await expect(
    page.getByRole("heading", { name: "Match context", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Fixture").selectOption("substitution");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Match stats" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Match statistics", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Lineups", exact: true })
    .click();
  await page.getByRole("button", { name: /17 Nico Wells/ }).click();
  await expect(page.getByRole("heading", { name: "Nico Wells" })).toBeVisible();
  await page
    .getByRole("button", { name: "Favorite Nico Wells", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Favorite Nico Wells", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Player focus" })
    .click();
  await page.getByLabel("Focus player").selectOption("harbor-12");
  await expect(
    page.getByRole("button", { name: "Favorite Nico Wells", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Match centre" })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("explanation provenance, category preferences, and arbitrary seeking are truthful", async ({
  page,
}) => {
  await page.route("**/api/insights", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { mode: "offline" } })
      : route.fulfill({ json: { source: "offline" } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the explanation" }).click();
  await expect(page.locator(".explanation-text")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Offline demo");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const name of ["Pressure", "Chances", "Rhythm"])
    await page.getByRole("checkbox", { name }).uncheck();
  await page.getByRole("button", { name: "Save my experience" }).click();
  await expect(
    page.getByRole("heading", { name: "Match context", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Match context", exact: true }),
  ).toBeVisible();
  const timeline = page.getByRole("slider", { name: "Match timeline" });
  await timeline.focus();
  await timeline.press("End");
  await expect(page.getByTestId("clock")).toContainText("90:00");
  await timeline.press("Home");
  await expect(page.getByTestId("clock")).toContainText("00:00");
  await expect(page.getByTestId("score")).toHaveText("0:0");
});

test("selected evidence drives replay, which retains its final frame", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /^Evidence \(/ }).click();
  const first = page.locator(".evidence-list button").first();
  const selectedTime = await first.locator("time").innerText();
  await first.click();
  await expect(page.locator(".event-inspector p")).toContainText(selectedTime);
  await page.getByRole("button", { name: "Show me the sequence" }).click();
  await expect(page.locator(".event-inspector p")).toContainText(selectedTime);
  await page.clock.runFor(15000);
  await expect(
    page.getByText("REPLAY COMPLETE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Passage replay" }),
  ).toBeVisible();
  await expect(page.getByTestId("clock")).toContainText("63:24");
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(
    page.getByRole("button", { name: "Pattern evidence", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Recorded event", { exact: true })
    .selectOption({ index: 0 });
  await expect(page.locator(".event-inspector p")).toContainText(selectedTime);
});

test("the demo shows a pattern emerging and reset clears custom filters", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await expect(
    page
      .locator(".fixture-selector")
      .getByText("Synthetic demo", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".demo-controls")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Generator profile").selectOption("balanced");
  await page.getByLabel("Generator profile").selectOption("demo");
  await page.getByRole("button", { name: "Watch the build-up" }).click();
  await expect(
    page.getByRole("heading", { name: "Match context", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(6000);
  await expect(
    page.getByRole("heading", { name: "Harbor are winning it higher" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Pause match", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const name of ["Pressure", "Chances", "Rhythm"])
    await page.getByRole("checkbox", { name }).uncheck();
  await page.getByRole("button", { name: "Save my experience" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByTestId("clock")).toContainText("63:24");
  await expect(
    page.getByRole("heading", { name: "Harbor are winning it higher" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /^(Fan|Analyst) mode$/ }),
  ).toHaveCount(0);
});

test("every major screen fits the viewport and captures review evidence", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (const [label, file] of [
    ["Match centre", "match"],
    ["Insights", "insights"],
    ["Match stats", "stats"],
    ["Lineups", "lineups"],
    ["Player focus", "player"],
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.mouse.move(0, 0);
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: `artifacts/${testInfo.project.name}-${file}.png`,
      fullPage: true,
    });
  }
  for (const [label, file] of [
    ["Settings", "preferences"],
    ["Catch me up", "recap"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/${testInfo.project.name}-${file}.png`,
    });
    // Audit the presented dialog once its entrance/backdrop transition finishes.
    await page.getByRole("dialog").evaluate(async (el) => {
      await Promise.all(
        el
          .getAnimations({ subtree: true })
          .map((a) => a.finished.catch(() => {})),
      );
    });
    const dialogAudit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(dialogAudit.violations).toEqual([]);
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("metadata, home-screen icons and social previews reference real files", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Between the Lines | More than the score.");
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(
    page.locator('meta[property="og:image:height"]'),
  ).toHaveAttribute("content", "630");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  for (const selector of [
    'link[rel="apple-touch-icon"]',
    'link[rel="manifest"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]) {
    const el = page.locator(selector).first();
    const url = await el.getAttribute(
      selector.startsWith("meta") ? "content" : "href",
    );
    expect(url).toBeTruthy();
    const asset = await request.get(new URL(url!, "http://localhost").pathname);
    expect(asset.ok()).toBe(true);
  }
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok()).toBe(true);
  expect(
    await page
      .locator("img:visible")
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
});

test("pitch markers support touch-sized selection and keyboard inspection", async ({
  page,
}) => {
  await page.goto("/");
  const markers = page.locator(".pitch-panel .event-marker");
  await markers.last().click();
  await expect(page.locator(".event-inspector p")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Passage replay" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear selection" }).click();
  const label = await markers.first().getAttribute("aria-label");
  await markers.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".event-inspector p")).toContainText(
    label!.split(" ")[0],
  );
});

test("detailed explainability captures the evidence drawer", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const details = page.locator(".detail-panel .provenance");
  await details.locator("summary").click();
  await expect(details).toContainText("Deterministic offline");
  await expect(details).toContainText("Ball wins in attacking third: 4 vs 0");
  await expect(details).toContainText("No completed AI tool activity");
  await expect(details).toContainText("Known limitations");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-explainability.png`,
    fullPage: true,
  });
  await expect(details).toContainText("descriptive threshold");
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByText("How we reached this conclusion", { exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Evidence through 63:24",
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-recap-evidence.png`,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("OpenAI UI requests narration only on demand and clears stale results on rewind", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "second-look-preferences",
      JSON.stringify({
        mode: "fan",
        team: "harbor",
        player: "harbor-9",
        categories: ["pressure", "chances", "rhythm"],
      }),
    ),
  );
  let calls = 0;
  await page.route("**/api/insights", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { mode: "openai" } });
    expect(route.request().postDataJSON().mode).toBe("analyst");
    calls++;
    await route.fulfill({
      json: {
        source: "openai",
        narrative: {
          insightId: "harbor-pressure-63",
          explanation:
            "Harbor are winning it higher. This is a mocked narration for a browser test.",
          why: "The evidence shows recorded high ball wins.",
          watch: "Watch the next recorded attack.",
          evidenceIds: [],
        },
        provenance: {
          provider: "openai",
          model: "gpt-5.4-mini",
          cached: false,
          cutoff: 3804,
          facts: [],
          activity: ["get_verified_evidence completed"],
          validation: ["Selection schema passed"],
          limitations: ["Synthetic events"],
        },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /^(Fan|Analyst) mode$/ }),
  ).toHaveCount(0);
  await expect(page.locator(".selected-observation")).toContainText(
    "descriptive threshold",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Follow a team")).toHaveValue("harbor");
  await expect(page.getByLabel("Follow a player")).toHaveValue("harbor-9");
  await expect(
    page.getByRole("button", { name: /^(Fan|Analyst) mode$/ }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Explain with OpenAI", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explain with OpenAI", exact: true })
    .click();
  await expect(
    page.getByText(/This is a mocked narration for a browser test/),
  ).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Play match", exact: true }).click();
  await expect(page.getByTestId("clock")).not.toContainText("63:24");
  expect(calls).toBe(1);
  await expect(
    page.getByText(/This is a mocked narration for a browser test/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Restart match" }).click();
  await expect(page.getByTestId("clock")).toContainText("00:00");
  expect(calls).toBe(1);
});
