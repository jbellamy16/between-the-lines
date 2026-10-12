import { mkdirSync, writeFileSync } from "node:fs";
import { DIRECTORY, digest, fixture } from "../eval/frozen-editorial/plan";
import { createFreeze } from "../eval/frozen-editorial/freeze";
import { runEditorialBaseline } from "../src/lib/ai/director/editorial-baselines";
if (process.argv.length !== 2)
  throw new Error("Offline freeze takes no arguments or live mode");
globalThis.fetch = async () => {
  throw new Error("Offline freeze forbids network");
};
const frozen = createFreeze();
mkdirSync(DIRECTORY); // exclusive: historical and current freezes cannot be overwritten
writeFileSync(
  `${DIRECTORY}/frozen.json`,
  JSON.stringify(frozen, null, 2) + "\n",
  { flag: "wx" },
);
writeFileSync(
  `${DIRECTORY}/offline-measurements.json`,
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      manifestDigest: digest(JSON.stringify(frozen)),
      baseline: [false, true].map((control) => {
        const c = fixture(control);
        return {
          control,
          metrics: runEditorialBaseline(c.match, c.cutoff, "B2", c.context, 1)
            .metrics,
        };
      }),
      modelSelectedDecisions: null,
      modelUsage: null,
      modelLatencyMs: null,
      modelCostUsd: null,
      humanReview: null,
      preparationPaidRequests: 0,
      preparationCostUsd: 0,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    frozen: `${DIRECTORY}/frozen.json`,
    digest: digest(JSON.stringify(frozen)),
    paidCalls: 0,
  }),
);
