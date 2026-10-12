import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let output: string;
test("candidate mock workflow produces blinded complete editorial comparisons", async ({
  page,
}, info) => {
  output = join(
    mkdtempSync(join(tmpdir(), "frozen-editorial-browser-")),
    "run",
  );
  execFileSync(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    "scripts/mock-frozen-editorial.ts",
    output,
  ]);
  const report = JSON.parse(
    readFileSync(join(output, "private/result.json"), "utf8"),
  );
  expect(report.paidCalls).toBe(0);
  expect(report.noCall.receipt.attempts).toBe(0);
  expect(report.accountingReconciled).toBe(true);
  const assignments = JSON.parse(
    readFileSync(join(output, "private/key.json"), "utf8"),
  ).assignments;
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  for (const pair of assignments) {
    await page.setContent(
      readFileSync(join(output, `review/pair-${pair.pairId}.html`), "utf8"),
    );
    await expect(page.getByRole("article")).toHaveCount(2);
    for (const label of ["Explanation A", "Explanation B"]) {
      const arm = page.getByRole("article", { name: label });
      await expect(arm).toContainText("Harbor");
      await expect(arm).toContainText("supported:");
      await expect(arm).toContainText("limited:");
      await expect(arm).toContainText("Both teams");
      await expect(arm).toContainText("multiple possessions");
      await expect(arm).toContainText("synthetic");
      await expect(arm).toContainText("xG");
    }
    await expect(page.locator("body")).not.toContainText(
      /B2|investigator|mock|focalId|indexId/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const boxes = await page.locator("article").evaluateAll((arms) =>
      arms.map((a) => ({
        x: a.getBoundingClientRect().x,
        y: a.getBoundingClientRect().y,
      })),
    );
    if (info.project.name === "desktop") expect(boxes[0].y).toBe(boxes[1].y);
    else expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
  }
  expect(requests).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("candidate-review.png"),
    fullPage: true,
  });
});
