import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Generate through the actual offline command, outside application routes.
// Each worker gets exclusive output. No server credentials or provider calls.
let output: string;
function artifacts() {
  if (!output) {
    output = join(
      mkdtempSync(join(tmpdir(), "editorial-browser-")),
      "review-run",
    );
    execFileSync(process.execPath, [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/evaluate-investigator-editorial.ts",
      output,
    ]);
  }
  return JSON.parse(readFileSync(join(output, "private/key.json"), "utf8"))
    .assignments as {
    pairId: string;
    caseId: string;
    style: string;
    length: string;
  }[];
}

test("blinded comparisons retain complete visible explanations across styles, lengths and viewports", async ({
  page,
}, info) => {
  const pairs = artifacts().filter(
    (p) => p.caseId === "generic-counter-evidence",
  );
  let requests = 0;
  page.on("request", () => requests++);
  for (const pair of pairs) {
    await page.setContent(
      readFileSync(join(output, `review/pair-${pair.pairId}.html`), "utf8"),
    );
    await expect(page.getByRole("article")).toHaveCount(2);
    for (const label of ["Explanation A", "Explanation B"]) {
      const arm = page.getByRole("article", { name: label });
      await expect(arm).toContainText("0–0");
      await expect(arm).toContainText("limited:");
      await expect(arm).toContainText("supported:");
      await expect(arm).toContainText(/one-sided control is not established/i);
      await expect(arm).toContainText("xG");
      await expect(arm).toContainText(
        "1800 word limit".replace(
          "1800",
          pair.length === "brief" ? "1800" : "2600",
        ),
      );
    }
    await expect(page.locator("body")).not.toContainText(
      /B2|investigator|generic-counter-evidence|mock/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const columns = await page.locator("article").evaluateAll((a) =>
      a.map((e) => ({
        x: e.getBoundingClientRect().x,
        y: e.getBoundingClientRect().y,
      })),
    );
    if (info.project.name === "desktop")
      expect(columns[0].y).toBe(columns[1].y);
    else expect(columns[1].y).toBeGreaterThan(columns[0].y);
  }
  expect(requests).toBe(0);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("blinded-comparison.png"),
    fullPage: true,
  });
});

test("invalid factual prose cannot appear in either blinded arm", async ({
  page,
}) => {
  const pair = artifacts().find((p) => p.caseId === "invalid-factual-prose")!;
  await page.setContent(
    readFileSync(join(output, `review/pair-${pair.pairId}.html`), "utf8"),
  );
  await expect(page.locator("body")).not.toContainText("99 shots");
  const text = await page.locator("article").allTextContents();
  expect(text[0].replace("Explanation A", "Explanation")).toBe(
    text[1].replace("Explanation B", "Explanation"),
  );
});
