import { expect, test } from "@playwright/test";

test("club assets load and replay glyphs retain their small-screen proportions", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".secondary-observations > summary").click();
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const crests = page.locator(".scoreboard .crest");
  await expect(crests).toHaveCount(2);
  expect(
    await crests.evaluateAll((elements) =>
      elements.every(
        (el) =>
          (el as HTMLImageElement).complete &&
          (el as HTMLImageElement).naturalWidth > 0,
      ),
    ),
  ).toBe(true);
  for (const label of ["Play match", "Pause match"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    const glyph = button.locator("svg");
    const box = await glyph.boundingBox();
    expect(box?.width).toBe(20);
    expect(box?.height).toBe(20);
    await expect(glyph).toHaveAttribute("fill", "none");
    await button.click();
  }
  await page.locator(".match-event-feed summary").click();
  await expect(
    page.locator(".event-feed-list .event-glyph").first(),
  ).toBeVisible();
  await expect(page.locator(".event-feed-list button").first()).toContainText(
    /Harbor|Riverside/,
  );
});

test("Riverside keeps its identity when an event is selected", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".secondary-observations > summary").click();
  const clear = page.getByRole("button", {
    name: "Clear selection",
    exact: true,
  });
  await expect(clear).toHaveCount(0);
  await page.locator(".match-event-feed summary").click();
  const awayEvent = page
    .locator(".event-feed-list button")
    .filter({ has: page.locator(".event-glyph.riverside") })
    .first();
  await awayEvent.click();
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  // A clustered action remains explorable through its event selector.
  await page
    .getByLabel("Replay timeline")
    .fill((await page.getByLabel("Replay timeline").getAttribute("max"))!);
  await expect(
    page.locator(".pitch-panel .marker-square").first(),
  ).toHaveAttribute("fill", "#ff7a83");
  await page.locator(".pitch-notes summary").click();
  await expect(page.locator(".pitch-notes")).toContainText(
    "Markers show actions, not player positions",
  );
  await clear.click();
  await expect(clear).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pattern evidence", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Player focus", exact: true })
    .click();
  await page.getByLabel("Focus player").selectOption("riverside-9");
  await expect(page.locator(".player-identity-line img")).toHaveAttribute(
    "src",
    "/teams/riverside.png",
  );
  await expect(
    page.getByRole("heading", { name: "Hugo Silva", exact: true }),
  ).toBeVisible();
  const followBox = await page
    .getByRole("button", { name: "Favorite Hugo Silva", exact: true })
    .boundingBox();
  expect(followBox!.height).toBeLessThan(60);
  const metricTops = await page
    .locator(".player-metrics > div")
    .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().top));
  // Five metrics wrap into two rows on phones without squeezing the labels.
  expect(new Set(metricTops).size).toBeLessThanOrEqual(
    page.viewportSize()!.width <= 600 ? 2 : 1,
  );
});

test("shared match views retain SVG icons instead of text glyphs", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".secondary-observations > summary").click();
  const shell = page.locator(".app-shell").filter({ visible: true });
  await expect(
    shell.locator(".selected-observation h2 .sl-icon"),
  ).toBeVisible();
  for (const source of ["Synthetic", "Recorded"] as const) {
    const sourceButton = page.getByRole("button", {
      name: source,
      exact: true,
    });
    if (await sourceButton.count()) await sourceButton.click();
    else if (source === "Recorded") continue;
    await shell.getByRole("slider", { name: "Match timeline" }).fill("600");
    await expect(shell.locator(".pitch-topline .sl-icon")).toHaveCount(2);
    await expect(shell.locator(".pitch-topline")).not.toContainText(/[←→]/);
    const ticks = shell.locator(".timeline-events button");
    expect(await ticks.count()).toBeGreaterThan(0);
    await expect(ticks.locator("svg.sl-icon")).toHaveCount(await ticks.count());
    await expect(shell.locator(".timeline-events")).not.toContainText(/[•↔]/);
    const contexts = shell.locator(".context-item h3");
    await expect(contexts.first()).toBeVisible();
    await expect(contexts.locator("svg.sl-icon")).toHaveCount(
      await contexts.count(),
    );
    await page
      .getByRole("button", { name: "Catch me up", exact: true })
      .click();
    const moments = page.getByRole("dialog").locator(".recap-timeline button");
    expect(await moments.count()).toBeGreaterThan(0);
    await expect(moments.locator("svg.sl-icon")).toHaveCount(
      (await moments.count()) * 2,
    );
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
});
