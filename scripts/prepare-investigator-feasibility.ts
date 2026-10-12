import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  DIRECTORY,
  digest,
  frozenContent,
  fixture,
} from "../eval/investigator-feasibility/plan";
import { runEditorialBaseline } from "../src/lib/ai/director/editorial-baselines";
if (process.argv.length !== 2)
  throw new Error("Offline preparation accepts no live mode");
globalThis.fetch = async () => {
  throw new Error("Offline preparation forbids network");
};
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const sourcePaths = git(
  "ls-files",
  "src",
  "eval",
  "scripts",
  "package.json",
  "package-lock.json",
).split("\n");
// Include this new preparation before it is committed; no historical artifacts
// are regenerated. CI only recomputes and compares content in tests.
const manifest = {
  ...frozenContent(),
  sourceHashes: Object.fromEntries(
    sourcePaths.map((p) => [p, digest(readFileSync(p, "utf8"))]),
  ),
};
mkdirSync(DIRECTORY, { recursive: true });
writeFileSync(
  `${DIRECTORY}/frozen.json`,
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    frozen: `${DIRECTORY}/frozen.json`,
    digest: digest(JSON.stringify(manifest)),
    paidCalls: 0,
  }),
);

const offline = [false, true].map((control) => {
  const c = fixture(control);
  const result = runEditorialBaseline(c.match, c.cutoff, "B2", c.context);
  return {
    caseId: control ? "quiet-no-call" : "fading-favored",
    metrics: result.metrics,
  };
});
writeFileSync(
  `${DIRECTORY}/offline-measurements.json`,
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      manifestDigest: digest(JSON.stringify(manifest)),
      baseline: offline,
      modelSelectedDecisions: null,
      modelUsage: null,
      modelLatencyMs: null,
      modelCostUsd: null,
      preparationPaidRequests: 0,
      preparationCostUsd: 0,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
