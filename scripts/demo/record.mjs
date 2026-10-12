// Local, unmocked application capture. Run against the offline production build.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const out = "artifacts/demo-2026-10-12";
const assets = "docs/demo-2026-10-12/assets";
const url = process.env.DEMO_URL ?? "http://127.0.0.1:3124";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "Capture requires a local preview",
);
const status = await (await fetch(url + "/api/insights")).json();
assert.equal(status.mode, "offline");
assert.equal(status.proactive, false);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 790 },
  recordVideo: { dir: out, size: { width: 1600, height: 790 } },
});
const page = await context.newPage();
const errors = [],
  posts = [],
  actions = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.method() === "POST") posts.push(r.url());
});
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('.app-shell[aria-busy="false"]').waitFor();
  assert.match(await page.getByTestId("clock").innerText(), /63:24/);
  const start = Date.now();
  const at = async (t, label, fn) => {
    const wait = start + t * 1000 - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await fn();
    const actual = (Date.now() - start) / 1000;
    assert.ok(actual < t + 2, `Missed cue: ${label} at ${actual}`);
    actions.push({ target: t, actual, label });
  };
  const top = async (locator) =>
    locator.evaluate((e) =>
      e.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  const shot = async (name) =>
    page.screenshot({ path: `${assets}/${name}.png` });
  const story = page.locator(".director-story");
  const dialog = page.getByRole("dialog");
  await at(1, "Score and source at 63:24", () => shot("01-join"));
  await at(7, "Main match development", () => top(story));
  await at(12, "Four shots after zero; quality limitation", async () => {
    assert.match(await story.innerText(), /4 shots/);
    await shot("02-development");
  });
  await at(22, "Open Catch me up", () =>
    page.getByRole("button", { name: "Catch me up", exact: true }).click(),
  );
  await at(25, "Football Fan explanation", async () => {
    await dialog
      .getByLabel("Explanation level", { exact: true })
      .selectOption("fan");
    await shot("03-football-fan");
  });
  await at(29, "Advanced Analysis explanation", async () => {
    await dialog
      .getByLabel("Explanation level", { exact: true })
      .selectOption("analysis");
    await shot("04-advanced-analysis");
  });
  await at(33, "Independent Full recap", () =>
    dialog.getByRole("tab", { name: "Full recap" }).click(),
  );
  await at(36, "Restore Casual Viewer and Quick", async () => {
    await dialog
      .getByLabel("Explanation level", { exact: true })
      .selectOption("plain");
    await dialog.getByRole("tab", { name: "Quick recap" }).click();
    await page.keyboard.press("Escape");
  });
  await at(38, "Ask what best describes the surge", async () => {
    await page
      .getByRole("button", {
        name: "What best describes this shot surge?",
        exact: true,
      })
      .click();
    await top(page.locator(".question-answer"));
  });
  await at(41, "Comparison and no established explanation", async () => {
    assert.match(
      await page.locator(".question-answer").innerText(),
      /No single explanation is established/,
    );
    await shot("05-guided-comparison");
  });
  await at(49, "Show the limits of the comparison", async () => {
    await page
      .locator(".question-answer")
      .getByText("What limits this reading", { exact: true })
      .evaluate((e) =>
        e.scrollIntoView({ block: "start", behavior: "instant" }),
      );
  });
  await at(53, "Explicit jump to 70:00", async () => {
    const s = page.getByRole("slider", { name: "Match timeline" });
    await s.fill("4200");
    await s.press("ArrowRight");
    await s.press("ArrowLeft");
    assert.match(await page.getByTestId("clock").innerText(), /70:00/);
  });
  await at(55, "Ask whether the increase faded", async () => {
    await page
      .getByRole("button", {
        name: "Has this increase already faded?",
        exact: true,
      })
      .click();
    await top(page.locator(".question-answer"));
  });
  await at(59, "Hold answer and both comparison windows", async () => {
    const text = await page.locator(".question-answer").innerText();
    assert.match(text, /Yes, the increase has eased/);
    assert.match(text, /3 in the first half and 1 in the second/);
    assert.match(text, /1 to 4 shots overall/);
    await shot("06-fading-answer");
  });
  await at(69, "Open supporting evidence", async () => {
    await page.getByText("Explore answer evidence", { exact: true }).click();
    await top(page.locator(".question-answer details"));
    await shot("07-evidence");
  });
  await at(73, "Replay the 59:09 shot", async () => {
    await page
      .getByRole("button", { name: "59:09 · shot · Replay", exact: true })
      .click();
    await top(page.locator(".pitch-panel"));
    await page
      .getByRole("button", { name: "Restart replay", exact: true })
      .click();
  });
  await at(78, "Replay completes; main clock stays at 70:00", async () => {
    assert.match(
      await page.locator(".pitch-panel").innerText(),
      /REPLAY COMPLETE/,
    );
    assert.match(await page.getByTestId("clock").innerText(), /70:00/);
    await shot("08-replay");
  });
  await at(81, "Final application view", async () => {
    await page
      .getByRole("button", { name: "Catch me up", exact: true })
      .click();
    await shot("09-closing-recap");
  });
  // These holds are replaced by labeled, separately rendered architecture/receipt cards in export.
  await at(116, "End capture", async () => {});
  const video = page.video();
  await context.close();
  await fs.rename(await video.path(), out + "/screen-recording.webm");
  assert.deepEqual(errors, []);
  assert.deepEqual(posts, []);
  await fs.writeFile(
    out + "/recording-receipt.json",
    JSON.stringify(
      {
        recordedAt: new Date(start).toISOString(),
        applicationCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        url,
        status,
        seconds: 116,
        viewport: [1600, 790],
        actions,
        errors,
        posts,
        footage:
          "Actual local production application; no interception or injected responses",
        cards:
          "82–108s: separately rendered architecture and historical receipt, not application UI",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Recorded local walkthrough: zero POST requests.");
} finally {
  await browser.close();
}
