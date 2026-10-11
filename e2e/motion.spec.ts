import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function startReplay(page: Page) {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Show me the sequence" }).click();
  await expect(page.getByLabel("Replay timeline")).toBeVisible();
}

test("replay pause, speed, rewind and cancellation share one clock", async ({
  page,
}) => {
  await startReplay(page);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const range = page.getByLabel("Replay timeline");
  const start = Number(await range.getAttribute("min"));
  await range.fill(String(start));
  await page.getByLabel("Replay speed").selectOption("1");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.clock.runFor(1200);
  expect(Number(await range.inputValue()) - start).toBeCloseTo(1.2, 0);
  await page.getByLabel("Replay speed").selectOption("4");
  const beforeSpeed = Number(await range.inputValue());
  await page.clock.runFor(1000);
  expect(Number(await range.inputValue()) - beforeSpeed).toBeCloseTo(4, 0);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const paused = await range.inputValue();
  const ball = await page.locator(".recorded-ball").getAttribute("transform");
  await page.clock.runFor(5000);
  expect(await range.inputValue()).toBe(paused);
  expect(await page.locator(".recorded-ball").getAttribute("transform")).toBe(
    ball,
  );
  await range.fill((await range.getAttribute("max")) as string);
  await expect(
    page.getByText("REPLAY COMPLETE", { exact: true }),
  ).toBeVisible();
  await range.fill(String(start));
  const markers = page.locator(".replay-pitch [data-event-time]");
  expect(
    await markers.evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute("data-event-time"))),
    ),
  ).toEqual([start]);
  await page.getByRole("button", { name: "Restart match" }).click();
  await page.clock.runFor(10000);
  await expect(page.locator(".recorded-ball")).toHaveCount(0);
  await expect(page.getByTestId("clock")).toContainText("00:00");
  await expect(page.getByTestId("score")).toHaveText("0:0");
});

test("dialogs and section changes pause replay, preserve focus and allow manual resume without jumps", async ({
  page,
}) => {
  await startReplay(page);
  await page.getByLabel("Replay speed").selectOption("1");
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  const time = await page.getByLabel("Replay timeline").inputValue();
  await page.clock.runFor(5000);
  expect(await page.getByLabel("Replay timeline").inputValue()).toBe(time);
  await expect(page.getByRole("dialog")).toContainText(
    "Everything you missed through 63:24",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Catch me up", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Play replay", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.clock.runFor(500);
  const advanced = Number(
    await page.getByLabel("Replay timeline").inputValue(),
  );
  expect(advanced - Number(time)).toBeCloseTo(0.5, 0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Match stats" })
    .click();
  const away = await page.getByLabel("Replay timeline").inputValue();
  await page.clock.runFor(5000);
  expect(await page.getByLabel("Replay timeline").inputValue()).toBe(away);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Match centre" })
    .click();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.clock.runFor(500);
  expect(
    Number(await page.getByLabel("Replay timeline").inputValue()) -
      Number(away),
  ).toBeCloseTo(0.5, 0);
});

test("rapid changes cancel stale motion and leave immediate truthful state", async ({
  page,
}) => {
  await startReplay(page);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const range = page.getByLabel("Replay timeline");
  const start = Number(await range.getAttribute("min"));
  const end = Number(await range.getAttribute("max"));
  for (const time of [end, start, end - 1, start + 1, start])
    await range.fill(String(time));
  await page.clock.runFor(1000);
  expect(await range.inputValue()).toBe(String(start));
  expect(await page.locator(".replay-pitch [data-event-time]").count()).toBe(1);
  await expect(page.getByText("Measurement notes")).not.toBeVisible();
  await page.locator(".detail-panel .provenance summary").click();
  await expect(page.getByText("Measurement notes")).toBeVisible();
  await expect(page.getByTestId("score")).toHaveText("1:0");
  for (const name of ["Evidence (4)", "Explanation", "Visual"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.clock.runFor(1000);
  await expect
    .poll(() =>
      page
        .locator(".app-shell")
        .evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
    )
    .toBe(0);
});

test("reduced motion removes decoration while replay and keyboard selection work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startReplay(page);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const range = page.getByLabel("Replay timeline");
  await range.fill((await range.getAttribute("max")) as string);
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        document.querySelector(".app-shell")!.getAnimations({ subtree: true })
          .length,
    ),
  ).toBe(0);
  await page.keyboard.press("Escape");
  await page.locator(".replay-pitch .event-marker").first().focus();
  await page.keyboard.press("Enter");
  const choices = page.locator(".pitch-event-choices");
  if (await choices.isVisible())
    await choices
      .locator("button")
      .filter({ hasText: /Recovery/ })
      .first()
      .click();
  await expect(page.getByText("REPLAY PAUSED", { exact: true })).toBeVisible();
  expect(await range.inputValue()).toBe(await range.getAttribute("min"));
});

test("320px touch controls, dialog focus trap and motion remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "Show me the sequence" }).click();
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const name of ["Play replay", "Restart replay"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest("dialog")),
    ).toBe(true);
  }
  // Contrast is assessed after the dialog entrance, not at a transient opacity frame.
  await page.getByRole("dialog").evaluate(async (dialog) => {
    await Promise.all(
      dialog
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Settings",
  );
  await page.getByRole("button", { name: "Save my experience" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("mid-pass motion freezes on pause and cancels when reduced motion changes", async ({
  page,
}) => {
  await startReplay(page);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const range = page.getByLabel("Replay timeline");
  const start = Number(await range.getAttribute("min"));
  await range.fill(String(start + 12));
  await page.getByLabel("Replay speed").selectOption("1");
  const ball = page.locator(".recorded-ball");
  const initial = await ball.getAttribute("transform");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.clock.runFor(1000);
  expect(await ball.getAttribute("transform")).not.toBe(initial);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const stopped = await ball.getAttribute("transform");
  await page.clock.runFor(1000);
  expect(await ball.getAttribute("transform")).toBe(stopped);
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(100);
  const reduced = await ball.getAttribute("transform");
  await page.clock.runFor(500);
  expect(await ball.getAttribute("transform")).toBe(reduced);
  await page.getByRole("button", { name: "Clear selection" }).click();
  await page.clock.runFor(5000);
  await expect(ball).toHaveCount(0);
  await expect(page.getByTestId("clock")).toContainText("63:24");
});

test("an existing insight keeps keyboard focus across match-minute updates", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Play match", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Insights", exact: true })
    .click();
  const card = page.locator(".observations-page .insight-card").first();
  await card.focus();
  await page.clock.runFor(6000);
  await expect(page.getByTestId("clock")).toContainText("64:12");
  await expect(card).toBeFocused();
});
