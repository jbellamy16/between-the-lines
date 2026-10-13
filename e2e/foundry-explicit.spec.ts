import { test, expect } from "@playwright/test";
test("explicit Foundry action shows honest offline receipt without automatic requests", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Microsoft Foundry investigation",
    exact: true,
  });
  await expect(
    panel.getByRole("button", {
      name: "Investigate with Microsoft Foundry",
      exact: true,
    }),
  ).toBeVisible();
  expect(posts).toEqual([]);
  await panel
    .getByRole("button", {
      name: "Investigate with Microsoft Foundry",
      exact: true,
    })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Deterministic fallback" }),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "Foundry investigation is disabled. No model request was made.",
    ),
  ).toBeVisible();
  await panel.getByText("Which evidence was investigated?").click();
  await expect(
    panel.getByText("No model-selected follow-up retrieval was completed."),
  ).toBeVisible();
  expect(posts.filter((u) => u.endsWith("/api/investigate"))).toHaveLength(1);
  const download = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download investigation receipt" })
    .click();
  expect((await download).suggestedFilename()).toMatch(
    /^foundry-investigation-.*\.json$/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
