import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const shell = (page: Page) =>
  page.locator(".app-shell").filter({ visible: true });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  test.skip(
    !(await page
      .getByRole("button", { name: "Recorded", exact: true })
      .count()),
    "Cross-source review requires RECORDED_MATCHES_VISIBLE=true.",
  );
});
async function selectSource(page: Page, source: "Synthetic" | "Recorded") {
  await page.getByRole("button", { name: source, exact: true }).click();
  await expect(
    shell(page).getByRole("slider", { name: "Match timeline" }),
  ).toBeVisible();
  await shell(page)
    .getByRole("slider", { name: "Match timeline" })
    .fill(source === "Synthetic" ? "3804" : "1800");
}

test("both sources share the layout and evidence flow at the same viewport", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  const inference: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/"))
      inference.push(r.url());
  });
  await page.goto("/");
  // The welcome is specific to the demo; compare the shared match layout
  // after dismissing it, as a returning viewer would see it.
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  const geometry: Record<string, number[]> = {};
  for (const source of ["Synthetic", "Recorded"] as const) {
    await selectSource(page, source);
    await page
      .getByRole("button", { name: "Pattern evidence", exact: true })
      .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    geometry[source] = await shell(page)
      .locator(".fixture-selector,.scoreboard,.playback,.pitch-panel")
      .evaluateAll((els) => {
        // The synthetic badge can add a row on phones; scorer credits and the
        // primary explanation's height also vary with the verified story.
        // Compare spacing from each preceding block, without forcing source content
        // to have identical heights or hiding a gap/overlap regression.
        const fixture = els
          .find((el) => el.classList.contains("fixture-selector"))!
          .getBoundingClientRect();
        const scoreboard = els
          .find((el) => el.classList.contains("scoreboard"))!
          .getBoundingClientRect();
        return els.flatMap((el) => {
          const b = el.getBoundingClientRect();
          const y = el.matches(".pitch-panel")
            ? b.y -
              (innerWidth > 820
                ? el.closest(".match-grid")!.getBoundingClientRect().top
                : el
                    .closest(".match-grid")!
                    .querySelector(".main-story")!
                    .getBoundingClientRect().bottom)
            : el.matches(".scoreboard")
              ? b.y - fixture.bottom
              : el.matches(".playback")
                ? // Pinned controls sit at a fixed place; otherwise they follow the scoreboard.
                  getComputedStyle(el.closest(".match-controls")!).position ===
                    "fixed" ||
                  getComputedStyle(el.closest(".match-header")!).position ===
                    "fixed"
                  ? b.y
                  : b.y - scoreboard.bottom
                : b.y;
          return [b.x, y, b.width];
        });
      });
    await expect(
      shell(page).locator(
        ".page-heading,.engine-badge,.match-source-bar,.historical-picker",
      ),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const [state, nav] of [
      ["match", "Match centre"],
      ["insights", source === "Synthetic" ? "Moments" : "Insights"],
      ["statistics", "Match stats"],
    ]) {
      await page
        .getByRole("navigation")
        .getByRole("button", { name: nav, exact: true })
        .click();
      if (state === "insights" && source === "Synthetic") {
        await expect(
          shell(page).locator(".moment-timeline button").first(),
        ).toBeVisible();
        await expect(
          shell(page).getByRole("heading", { name: "Moments so far" }),
        ).toBeVisible();
      }
      if (state === "insights" && source === "Recorded") {
        await expect(
          shell(page).locator(".lead-observation .window-row"),
        ).toHaveCount(2);
        await expect(shell(page).locator(".lead-observation")).toContainText(
          "supporting actions",
        );
      }
      if (state === "statistics" && source === "Recorded")
        await expect(
          shell(page).getByText("Unavailable", { exact: true }).first(),
        ).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `artifacts/ui-review/after-${info.project.name}-${source.toLowerCase()}-${state}.png`,
        scale: "css",
      });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await page
      .getByRole("navigation")
      .getByRole("button", {
        name: source === "Synthetic" ? "Match centre" : "Insights",
        exact: true,
      })
      .click();
    if (source === "Recorded") {
      await shell(page).locator(".lead-observation").click();
    } else {
      const details = shell(page).locator(".secondary-observations");
      if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open)))
        await details.locator(":scope > summary").click();
    }
    await expect(
      page.getByRole("button", { name: "Pattern evidence", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Explore evidence \(/ }).click();
    await shell(page)
      .locator(".detail-panel")
      .evaluate((el) =>
        innerWidth > 820
          ? window.scrollTo(0, 0)
          : el.scrollIntoView({ block: "start" }),
      );
    await page.screenshot({
      path: `artifacts/ui-review/after-${info.project.name}-${source.toLowerCase()}-evidence.png`,
      scale: "css",
    });
    const matchClock = await shell(page).getByTestId("clock").textContent();
    await shell(page).locator(".evidence-list button").first().click();
    await expect(page.getByLabel("Sequence playback")).toBeVisible();
    await page
      .getByRole("button", { name: "Pause replay", exact: true })
      .click();
    await shell(page)
      .locator(".pitch-panel")
      .evaluate((el) =>
        innerWidth > 820
          ? window.scrollTo(0, 0)
          : el.scrollIntoView({ block: "start" }),
      );
    await page.screenshot({
      path: `artifacts/ui-review/after-${info.project.name}-${source.toLowerCase()}-replay.png`,
      scale: "css",
    });
    await expect(shell(page).getByTestId("clock")).toHaveText(matchClock!);
    const cutoff = source === "Synthetic" ? 3804 : 1800;
    const times = await shell(page)
      .locator(".pitch-panel [data-event-time]")
      .evaluateAll((nodes) =>
        nodes.map((n) => Number(n.getAttribute("data-event-time"))),
      );
    expect(times.every((t) => t <= cutoff)).toBe(true);
    await page
      .getByRole("button", { name: "Catch me up", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveAccessibleName("Catch me up");
    await expect(
      page.getByRole("dialog").locator(".recap-cutoff"),
    ).toContainText(source === "Synthetic" ? "63:24" : "30:00");
    await page.screenshot({
      path: `artifacts/ui-review/after-${info.project.name}-${source.toLowerCase()}-recap.png`,
      scale: "css",
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
  }
  expect(geometry.Synthetic.length).toBe(geometry.Recorded.length);
  geometry.Synthetic.forEach((value, index) =>
    expect(Math.abs(value - geometry.Recorded[index])).toBeLessThanOrEqual(2),
  );
  expect(errors).toEqual([]);
  expect(inference).toEqual([]);
});

test("detailed analysis persists between sources without resetting playback or leaking spoilers", async ({
  page,
}) => {
  await page.goto("/");
  await selectSource(page, "Recorded");
  await selectSource(page, "Synthetic");
  await expect(
    page.getByRole("button", { name: /^(Fan|Analyst) mode$/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Recorded", exact: true }).click();
  await expect(shell(page).getByTestId("clock")).toContainText("30:00");
  await expect(
    page.getByRole("button", { name: /^(Fan|Analyst) mode$/ }),
  ).toHaveCount(0);
  await expect(shell(page).getByTestId("final-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reveal final score" }).check();
  await expect(
    page.getByRole("dialog").getByTestId("final-score"),
  ).toContainText("4–3");
  await page.keyboard.press("Escape");
  await shell(page).getByLabel("Fixture").selectOption("2499943");
  await expect(shell(page).getByTestId("score")).toHaveText("0:0");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Reveal final score" }),
  ).not.toBeChecked();
});
