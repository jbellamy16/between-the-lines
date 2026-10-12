import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { mockStore, mockEnvironment } from "../eval/frozen-editorial/mock";
import {
  decodeInvestigationWire,
  scriptedPlan,
} from "../eval/investigator/scripted";
import { experiment } from "../eval/frozen-editorial/experiment";
import { writeReview } from "../eval/frozen-editorial/review";
if (process.argv.length !== 3)
  throw new Error("Supply one NEW output directory; mock only");
// Never read .env, credential files, authorization or the ambient transport.
globalThis.fetch = async () => {
  throw new Error("Offline mock forbids network");
};
Object.assign(process.env, mockEnvironment);
const output = resolve(process.argv[2]);
mkdirSync(output);
mkdirSync(join(output, "private"), { mode: 0o700 });
const record = (event: Record<string, unknown>) =>
  appendFileSync(
    join(output, "private/transport-events.jsonl"),
    JSON.stringify({ provenance: "mock", ...event }) + "\n",
    { mode: 0o600 },
  );
const native: typeof fetch = async (_url, init) => {
  const packet = decodeInvestigationWire(
    JSON.parse(JSON.parse(init!.body as string).input[0].content),
  );
  const plan = scriptedPlan(packet);
  plan.interpretationIds = [
    "both-teams",
    "repeated-route",
    "concentrated-attempts",
  ];
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(plan) }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
  });
};
const report = await experiment(
  mockStore().store,
  native,
  2,
  new AbortController().signal,
  "mock",
  record,
);
writeFileSync(
  join(output, "private/result.json"),
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx", mode: 0o600 },
);
const pairs = writeReview(output, report.comparisons);
console.log(
  JSON.stringify({
    output,
    pairs,
    paidCalls: 0,
    provenance: "authored mock responses; no model quality measured",
  }),
);
