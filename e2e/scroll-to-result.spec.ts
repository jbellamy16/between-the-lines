import { test, expect, type Page, type TestInfo } from "@playwright/test";

// Scroll-to-result: a tap whose result is off-screen brings it into view,
// smoothly (instantly with reduced motion), clear of the phone tab bar, and
// not at all when the result is already fully visible.

type Scroll = { top: number; behavior: string };

async function ready(page: Page) {
  // Record every programmatic window scroll the app makes.
  await page.addInitScript(() => {
    const calls: Scroll[] = [];
    (window as unknown as { __scrolls: Scroll[] }).__scrolls = calls;
    const original = window.scrollTo.bind(window);
    window.scrollTo = ((options: ScrollToOptions | number, y?: number) => {
      if (typeof options === "object")
        calls.push({
          top: Math.round(options.top ?? 0),
          behavior: String(options.behavior ?? "auto"),
        });
      return typeof options === "object"
        ? original(options)
        : original(options, y ?? 0);
    }) as typeof window.scrollTo;
  });
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
}
const shell = ".app-shell:not([hidden])";
const scrolls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __scrolls: Scroll[] }).__scrolls);
const clearScrolls = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __scrolls: Scroll[] }).__scrolls.length = 0;
  });
/** Viewport box of an element, and the top of the phone tab bar (or the viewport bottom). */
const box = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const r = document.querySelector(selector)!.getBoundingClientRect();
    const bar = document.querySelector(".app-shell:not([hidden]) .sidebar");
    const fixedBar =
      bar &&
      getComputedStyle(bar).position === "fixed" &&
      bar.getBoundingClientRect().top > innerHeight / 2;
    return {
      top: r.top,
      bottom: r.bottom,
      floor: fixedBar ? bar.getBoundingClientRect().top : innerHeight,
    };
  }, selector);
const phoneOnly = (info: TestInfo) =>
  test.skip(info.project.name === "desktop", "phone-width behaviour");

async function mockAnalyst(page: Page) {
  await page.route("**/api/insights", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ json: { mode: "foundry", proactive: false } })
      : r.continue(),
  );
  await page.route("**/api/ask", async (r) => {
    const body = r.request().postDataJSON();
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
      answer:
        "Harbor took 4 shots from 54:12 to 63:24, after 0 in the equal spell before. Theo March had 2 of them.",
      citedEventIds: [],
      steps: [step],
      source: "foundry",
      model: "between-the-lines-gpt54-mini",
      cached: false,
      metrics: { requests: 2, toolCalls: 1, latencyMs: 900 },
      notice: "",
    };
    // Long enough that the answer lands after the response is in view.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await r.fulfill({
      headers: { "Content-Type": "application/x-ndjson" },
      body:
        JSON.stringify({ type: "step", step }) +
        "\n" +
        JSON.stringify({ type: "result", result }) +
        "\n",
    });
  });
}

test("a story evidence chip slides the pitch replay into view on a phone", async ({
  page,
}, info) => {
  phoneOnly(info);
  await ready(page);
  const chip = page
    .locator(
      `${shell} .director-story .story-chips .story-chip:not(.story-chip-replay)`,
    )
    .first();
  await chip.scrollIntoViewIfNeeded();
  await clearScrolls(page);
  await chip.click();
  await expect(page.locator(`${shell} .pitch-panel`)).toContainText(
    "Passage replay",
  );
  await expect
    .poll(async () => (await box(page, `${shell} .pitch-panel`)).top)
    .toBeLessThan(40);
  const pitch = await box(page, `${shell} .pitch-panel`);
  expect(pitch.top).toBeGreaterThanOrEqual(0);
  expect((await scrolls(page))[0]?.behavior).toBe("smooth");
});

test("with reduced motion the jump is instant", async ({ page }, info) => {
  phoneOnly(info);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  const row = page.locator(`${shell} .match-event-feed`);
  await row.locator("summary").click();
  const event = row.locator(".event-feed-list button").nth(6);
  await event.scrollIntoViewIfNeeded();
  await clearScrolls(page);
  await event.click();
  await expect
    .poll(async () => {
      const { top } = await box(page, `${shell} .pitch-panel`);
      // A negative top is still off-screen, before revealSoon's two frames.
      return top >= 0 && top < 40;
    })
    .toBe(true);
  const calls = await scrolls(page);
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((c) => c.behavior === "instant")).toBe(true);
});

test("an analyst question slides to the response, then keeps the answer clear of the tab bar", async ({
  page,
}, info) => {
  phoneOnly(info);
  await mockAnalyst(page);
  await ready(page);
  const chip = page.locator(`${shell} .analyst-chip`).first();
  await chip.scrollIntoViewIfNeeded();
  // Leave the chip at the bottom of the screen so the response starts below it.
  await page.evaluate((selector) => {
    const r = document.querySelector(selector)!.getBoundingClientRect();
    window.scrollBy(0, r.bottom - innerHeight + 120);
  }, `${shell} .analyst-chip`);
  await chip.click();
  const response = `${shell} .analyst-response`;
  await expect
    .poll(async () => (await box(page, response)).top)
    .toBeLessThan(40);
  await expect(page.locator(`${shell} .analyst-answer`)).toBeVisible();
  await expect
    .poll(async () => {
      const answer = await box(page, `${shell} .analyst-answer`);
      return answer.top >= 0 && answer.bottom <= answer.floor;
    })
    .toBe(true);
});

test("a moment tap lands on the pitch on a phone", async ({ page }, info) => {
  phoneOnly(info);
  await mockAnalyst(page);
  await ready(page);
  await page.getByRole("slider", { name: "Match timeline" }).fill("4700");
  await page.getByRole("button", { name: "Moments", exact: true }).click();
  await page.locator(".moment-timeline button", { hasText: "77:40" }).click();
  // A goal moment replays the goal's build-up.
  await expect(
    page
      .getByRole("heading", { name: "Passage replay" })
      .filter({ visible: true }),
  ).toBeVisible();
  // The story card sits above the pitch on a phone; the pitch is the result.
  await expect
    .poll(async () => (await box(page, `${shell} .pitch-panel`)).top, {
      timeout: 6000,
    })
    .toBeLessThan(40);
  // ...and stays put when the analyst's answer arrives above it.
  await expect(page.locator(`${shell} .analyst-answer`)).toBeVisible();
  const pitch = await box(page, `${shell} .pitch-panel`);
  expect(pitch.top).toBeGreaterThanOrEqual(0);
  expect(pitch.top).toBeLessThan(40);
});

test("no scroll when the result is already fully visible", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "needs the side-by-side layout");
  await ready(page);
  const chips = page.locator(
    `${shell} .director-story .story-chips .story-chip:not(.story-chip-replay)`,
  );
  // A first replay sizes the pitch panel; bring all of it on screen.
  await chips.first().click();
  await expect(page.locator(`${shell} .pitch-panel`)).toContainText(
    "Passage replay",
  );
  await page.waitForTimeout(1500);
  const pitch = await box(page, `${shell} .pitch-panel`);
  await page.evaluate((y) => window.scrollBy(0, y), pitch.top - 20);
  const fitted = await box(page, `${shell} .pitch-panel`);
  expect(fitted.top).toBeGreaterThanOrEqual(0);
  expect(fitted.bottom).toBeLessThanOrEqual(fitted.floor);
  // A second chip beside it replays on the visible pitch: nothing moves.
  await expect(chips.nth(1)).toBeInViewport();
  await clearScrolls(page);
  const before = await page.evaluate(() => scrollY);
  await chips.nth(1).click();
  await page.waitForTimeout(500);
  expect(await scrolls(page)).toEqual([]);
  expect(await page.evaluate(() => scrollY)).toBe(before);
});
