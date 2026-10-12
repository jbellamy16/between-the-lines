import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  offlineSchema,
  prepareComparison,
  proposal,
  readinessBlockers,
} from "../eval/investigation-preflight/plan";

// Deliberately no authorization flag, key lookup, environment loader, Redis
// connection, provider transport, or live execution branch.
if (process.argv.length !== 2)
  throw new Error("Offline preparation accepts no arguments or live mode");
globalThis.fetch = async () => {
  throw new Error("Network prohibited in offline preflight");
};
const mergedRef = "1f94aca6a4916543d2372bf402800deed65ab3fc";
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" });
const protectedPaths = git(
  "ls-tree",
  "-r",
  "--name-only",
  mergedRef,
  "docs/intelligence",
  "eval",
  "src/lib/ai",
  "src/lib/foundry.ts",
  "tests",
  "scripts/run-guided-foundry.mjs",
  "scripts/run-foundry-continuation.mjs",
  ".env.example",
  "package-lock.json",
)
  .trim()
  .split("\n");
const protectedHashes = Object.fromEntries(
  protectedPaths.map((path) => {
    const expected = hash(
      execFileSync("git", ["show", `${mergedRef}:${path}`], {
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
    if (hash(readFileSync(path)) !== expected)
      throw new Error(`Protected historical/runtime file changed: ${path}`);
    return [path, expected];
  }),
);
const startedAt = new Date().toISOString();
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/^(AI_|FOUNDRY_|OPENAI_|SECOND_LOOK_|REDIS_)/.test(key),
  ),
);
execFileSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "tests/director-offline-evaluation.test.ts",
    "tests/investigation-preflight.test.ts",
  ],
  {
    env: { ...childEnv, NODE_ENV: "test", AI_ENABLED: "false" },
    stdio: "inherit",
  },
);
const raw = JSON.parse(
  readFileSync("artifacts/director-offline/summary.json", "utf8"),
);
const parsed = offlineSchema.parse(raw);
for (const [path, expected] of Object.entries(parsed.sourceHashes))
  if (hash(readFileSync(path)) !== expected)
    throw new Error(`Stale evaluation source: ${path}`);
const comparison = prepareComparison(raw);
for (const [path, expected] of Object.entries(protectedHashes))
  if (hash(readFileSync(path)) !== expected)
    throw new Error(`Protected file changed during preparation: ${path}`);
const readinessPath =
  "docs/intelligence/investigation-foundry-2026-10-12/read-only-readiness.json";
const readiness = JSON.parse(readFileSync(readinessPath, "utf8"));
const output = join(
  "artifacts/investigation-preflight",
  startedAt.replaceAll(":", "-"),
);
mkdirSync("artifacts/investigation-preflight", { recursive: true });
mkdirSync(output); // Exclusive run directory: never replace an earlier preparation.
const write = (name: string, value: unknown) =>
  writeFileSync(join(output, name), JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
const artifactHashes: Record<string, string> = {};
for (const name of ["summary.json", "results.json", "transcripts.json"]) {
  const content = readFileSync(`artifacts/director-offline/${name}`);
  writeFileSync(join(output, `offline-${name}`), content, { flag: "wx" });
  artifactHashes[`offline-${name}`] = hash(content);
}
write("preservation.json", { mergedRef, protectedHashes });
const report = {
  schemaVersion: 1,
  startedAt,
  evaluatedRuntimeRef: mergedRef,
  preparationHead: git("rev-parse", "HEAD").trim(),
  preparationSourceHashes: Object.fromEntries(
    [
      "eval/investigation-preflight/plan.ts",
      "scripts/prepare-investigation-evaluation.ts",
      "tests/investigation-preflight.test.ts",
    ].map((p) => [p, hash(readFileSync(p))]),
  ),
  proposal,
  comparison,
  readiness: {
    snapshotPath: readinessPath,
    snapshotDigest: hash(readFileSync(readinessPath)),
    checkedAt: readiness.checkedAt,
    refreshedByOfflineCommand: false,
    application: readiness.application,
    launchAllowed: false,
    blockers: readinessBlockers(readiness.application),
    beforeLive: [
      "Recheck deployment identity, current prices and source hashes against this proposal.",
      "Read and validate existing durable allowance and ownership without creating, resetting or repurposing a historical study store.",
      "Use all existing production request controls, cooldowns, accounting and model settings; every retry counts toward two attempts.",
      "Reserve 308100000 nanodollars before each dispatch in an append-only durable journal. Unknown usage retains the full reservation and stops the run.",
      "Any failure, unsafe output, capacity rejection or ceiling stops the study. No replacements, repair calls or automatic continuation.",
    ],
  },
  preservation: {
    filesChecked: protectedPaths.length,
    allUnchanged: true,
    detail: "preservation.json",
  },
  artifactHashes,
};
write("preflight.json", report);
console.log(
  JSON.stringify(
    {
      output,
      offlinePreparationPassed: true,
      publicationSafetyPassed: comparison.publicationSafetyPassed,
      launchAllowed: false,
      modelRequests: 0,
      costUsd: 0,
      blockers: report.readiness.blockers,
    },
    null,
    2,
  ),
);
