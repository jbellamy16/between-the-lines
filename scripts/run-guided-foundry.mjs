import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

// One owner-authorized guided campaign, never a reusable budget/reset switch.
const output = "docs/intelligence/guided-foundry-2026-10-11";
if (existsSync(`${output}/manifest.json`))
  throw new Error("Guided campaign receipts already exist");
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw new Error("Commit the candidate first");
let key;
try {
  key = JSON.parse(
    execFileSync(
      "az",
      [
        "cognitiveservices",
        "account",
        "keys",
        "list",
        "--resource-group",
        "rg-josh-5843",
        "--name",
        "josh-5098-resource",
        "-o",
        "json",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      },
    ),
  ).key1;
  if (typeof key !== "string" || !key) throw new Error();
} catch {
  throw new Error(
    "Existing credential retrieval unavailable (details withheld)",
  );
}
const child = spawn(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.guided-foundry.config.ts",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SECOND_LOOK_GUIDED_FOUNDRY: "authorized-once",
      AI_ENABLED: "true",
      AI_PROVIDER: "foundry",
      AI_PROACTIVE_ENABLED: "false",
      AI_USAGE_STORE: "redis",
      AI_REDIS_URL: "redis://127.0.0.1:16380",
      AI_MINUTE_LIMIT: "2",
      AI_HOURLY_LIMIT: "12",
      AI_DAILY_LIMIT: "12",
      AI_TOTAL_LIMIT: "12",
      AI_REQUEST_MINUTE_LIMIT: "30",
      AI_TOKEN_MINUTE_LIMIT: "30000",
      FOUNDRY_ENDPOINT: "https://josh-5098-resource.openai.azure.com",
      FOUNDRY_DEPLOYMENT: "between-the-lines-gpt54-mini",
      FOUNDRY_API_KEY: key,
    },
  },
);
key = undefined;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Evaluation process unavailable");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
