import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { normalizeHistorical } from "../src/lib/sources/historical";
import { matchContext } from "../src/lib/sources/context";
import { buildBriefing } from "../src/lib/recap-briefing";
import { matchInsights } from "../src/lib/sources/intelligence";

const fixtures = [
  { source: "Synthetic", match: new SyntheticMatchSource().read("pressure") },
  {
    source: "Recorded",
    match: normalizeHistorical(
      JSON.parse(readFileSync("data/historical/2499719.json", "utf8")),
    ),
  },
] as const;
for (const { source, match } of fixtures) {
  test(`${source}: intelligence and recap remain useful and spoiler-safe throughout the match`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    const paidRequests: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/"))
        paidRequests.push(r.url());
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const sourceButton = page.getByRole("button", {
      name: source,
      exact: true,
    });
    test.skip(
      source === "Recorded" && !(await sourceButton.count()),
      "Recorded matches are hidden.",
    );
    if (await sourceButton.count()) await sourceButton.click();
    const shell = page.locator(".app-shell").filter({ visible: true });
    const timeline = shell.getByRole("slider", { name: "Match timeline" });
    await expect(timeline).toBeVisible();
    const checkpoints = [
      0,
      600,
      1200,
      1800,
      Math.floor(match.periods[0].end),
      Math.floor(match.secondHalfStart + 900),
      Math.ceil(match.duration),
    ];
    for (const requested of checkpoints) {
      // Range controls use whole seconds and clamp at the actual source duration.
      const time = Math.min(requested, match.duration);
      await timeline.fill(String(time));
      const context = matchContext(match, time);
      const insights = matchInsights(match, time);
      for (const section of ["Match centre", "Insights"]) {
        await page
          .getByRole("navigation")
          .getByRole("button", { name: section, exact: true })
          .click();
        const area =
          section === "Match centre"
            ? shell.getByRole("complementary", { name: "Match intelligence" })
            : shell.getByRole("region", { name: "Insights", exact: true });
        await expect(area).not.toContainText(
          /No clear change|Play ahead to compare/,
        );
        if (insights.length) {
          await expect(area).toContainText("Analytical insight");
          await expect(area.getByTestId("match-context")).toHaveCount(0);
        } else if (context.items.length) {
          await expect(
            area.getByRole("heading", { name: "Match context", exact: true }),
          ).toBeVisible();
          for (const item of context.items)
            await expect(area).toContainText(item.text);
          await expect(area).not.toContainText("Analytical insight");
        } else {
          await expect(area).toContainText(
            "No match developments to highlight yet.",
          );
        }
      }
      await page
        .getByRole("button", { name: "Catch me up", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const recap = buildBriefing(match, time);
      await expect(dialog.locator(".recap-summary")).toHaveText(
        recap.narrative,
      );
      await expect(dialog.locator(".recap-timeline button")).toHaveCount(
        Math.min(3, recap.moments.length),
      );
      await expect(dialog).not.toContainText(
        /No clear change|No major moments|Play ahead to compare/,
      );
      await page.getByRole("button", { name: "Close dialog" }).click();
      if (time === 600) {
        await page.screenshot({
          path: `artifacts/ui-review/context-${source}-${info.project.name}.png`,
          fullPage: true,
        });
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        const first = shell
          .locator(".observations-page .context-evidence")
          .first();
        await first.locator("summary").click();
        const id = context.items[0].evidenceIds[0];
        await first.getByRole("button").first().click();
        await expect(
          shell.getByRole("slider", { name: "Match timeline" }),
        ).toHaveValue(String(time));
        await expect(
          shell.getByRole("complementary", { name: "Match intelligence" }),
        ).toBeVisible();
        expect(match.events.find((e) => e.id === id)!.time).toBeLessThanOrEqual(
          time,
        );
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    // Rewind must clear every later goal, player and statistic from all three views.
    await timeline.fill("0");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Insights", exact: true })
      .click();
    await expect(shell.locator(".observations-page")).toContainText(
      "No match developments to highlight yet.",
    );
    await expect(shell.getByTestId("score")).toHaveText("0:0");
    expect(paidRequests).toEqual([]);
  });
}
