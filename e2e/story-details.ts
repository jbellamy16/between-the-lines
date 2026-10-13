import type { Page } from "@playwright/test";

/** The story card keeps its secondary content behind "Details". Idempotent. */
export async function openStoryDetails(page: Page) {
  const details = page
    .locator(".app-shell:not([hidden]) .director-story .story-details")
    .first();
  await details.waitFor({ state: "attached" });
  if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
    await details.locator(":scope > summary").click();
  await page.waitForFunction(
    () =>
      (
        document.querySelector(
          ".app-shell:not([hidden]) .director-story .story-details",
        ) as HTMLDetailsElement | null
      )?.open !== false,
  );
}
