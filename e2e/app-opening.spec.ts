import { expect, test } from "@playwright/test";

test("the ball draws the route while initial artwork loads, then reveals a usable app", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/teams/harbor.webp", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const opening = page.getByRole("status", { name: "Getting the match ready" });
  await expect(opening).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  const ball = opening.locator("svg circle").last();
  await expect(ball).toHaveAttribute("cx", "72");
  await expect(ball).toHaveAttribute("cy", "24");
  // Finishing the animation alone does not reveal an unsettled app.
  await expect(opening).toBeVisible();
  release();
  await expect(opening).toHaveCount(0);
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(opening).toHaveCount(0);
});

test("an unresponsive image cannot leave the app behind the opening indefinitely", async ({
  page,
}) => {
  await page.route("**/teams/harbor.webp", () => {});
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const opening = page.getByRole("status", { name: "Getting the match ready" });
  await expect(opening).toBeVisible();
  await expect(opening).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});

test("reduced motion skips the animation and a failed crest cannot block entry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/teams/harbor.webp", (route) => route.abort());
  // Hold a font long enough to inspect the static opening.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*.woff2", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const opening = page.getByRole("status", { name: "Getting the match ready" });
  await expect(opening).toBeVisible();
  await expect(opening.locator("svg circle").last()).toHaveAttribute(
    "cx",
    "72",
  );
  expect(
    await opening.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  release();
  await expect(opening).toHaveCount(0);
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});
