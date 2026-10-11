import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

// One owner-authorized continuation, never a reusable budget/reset switch.
const output = "docs/intelligence/foundry-bounded-2026-10-11-continuation-1";
if (existsSync(`${output}/manifest.json`))
  throw new Error("Continuation receipts already exist");
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
    "vitest.bounded-foundry.config.ts",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SECOND_LOOK_BOUNDED_FOUNDRY: "continuation",
      AI_ENABLED: "true",
      AI_PROVIDER: "foundry",
      AI_PROACTIVE_ENABLED: "false",
      AI_USAGE_STORE: "redis",
      AI_REDIS_URL: "redis://127.0.0.1:16379",
      AI_MINUTE_LIMIT: "2",
      AI_HOURLY_LIMIT: "12",
      AI_DAILY_LIMIT: "12",
      AI_TOTAL_LIMIT: "12",
      AI_REQUEST_MINUTE_LIMIT: "10",
      AI_TOKEN_MINUTE_LIMIT: "10000",
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
