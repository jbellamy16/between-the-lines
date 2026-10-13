import { expect, test } from "@playwright/test";

test("timeline events preview on hover and focus without seeking", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const goal = page.getByRole("button", {
    name: "Replay the 01:00 goal",
    exact: true,
  });
  const clock = page.getByTestId("clock");
  const initial = (await clock.textContent())!;
  await goal.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Goal by Arlo Hayes");
  await expect(tooltip).toContainText("Assist: Milo Serrano");
  await expect(tooltip).toContainText("Select to replay the build-up");
  await expect(clock).toHaveText(initial);
  const bounds = (await tooltip.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  const sub = page.locator(".timeline-events .sub-tick").first();
  await sub.focus();
  await expect(tooltip).toContainText("Nico Wells on for Arlo Hayes");
  await expect(clock).toHaveText(initial);
  await goal.click();
  await expect(clock).toContainText("01:00");
  await expect(tooltip).toHaveCount(0);
  // A goal marker replays the passage that led to the goal.
  await expect(
    page
      .getByRole("heading", { name: "Passage replay" })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".event-inspector select")
      .filter({ visible: true })
      .locator("option")
      .last(),
  ).toContainText("01:00");
});

test("goal markers minutes apart can each be tapped on a narrow timeline", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".app-shell").filter({ visible: true }),
  ).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("slider", { name: "Match timeline" })
    .filter({ visible: true })
    .fill("5400");
  for (const clock of ["74:35", "77:33"]) {
    const marker = page
      .getByRole("button", { name: `Replay the ${clock} goal` })
      .filter({ visible: true });
    // The marker is the top element at its own centre, so a tap reaches it.
    expect(
      await marker.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        return el.contains(hit);
      }),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Replay the 74:35 goal" })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByTestId("clock").filter({ visible: true }),
  ).toContainText("74:35");
});
