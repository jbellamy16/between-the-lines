import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { controls } from "../eval/investigator-editorial/controls";
import {
  evaluateEditorial,
  STYLES,
  LENGTHS,
  RENDER_VERSION,
  WORD_LIMITS,
} from "../eval/investigator-editorial/render";
import { blindedArtifact } from "../eval/investigator-editorial/artifact";

if (process.argv.length !== 3)
  throw new Error("Supply one NEW output directory; offline only");
// No credentials/configuration are read and no runner/transport is imported.
globalThis.fetch = async () => {
  throw new Error("Offline editorial evaluation forbids network");
};
const output = resolve(process.argv[2]);
mkdirSync(output); // Exclusive run; do not overwrite a previous review or frozen study.
mkdirSync(`${output}/review`);
mkdirSync(`${output}/private`);
const write = (path: string, value: unknown) =>
  writeFileSync(
    `${output}/${path}`,
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    { flag: "wx" },
  );
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const paths = git(
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "src",
  "eval",
  "scripts",
  "package.json",
  "package-lock.json",
).split("\n");
const seed = randomBytes(32).toString("hex");
const key: unknown[] = [];
const summaries: unknown[] = [];
const compact: unknown[] = [];
const rows = controls().sort((a, b) =>
  sha(seed + a.id).localeCompare(sha(seed + b.id)),
);
let n = 0;
for (const [caseIndex, c] of rows.entries()) {
  for (const style of STYLES)
    for (const length of LENGTHS) {
      const result = evaluateEditorial(
        c.match,
        c.cutoff,
        c.context,
        c.submission,
        "mock",
        style,
        length,
      );
      if (result.status !== "reviewable")
        throw new Error("Shared length limit exceeded; both arms withheld");
      const pairId = String(++n).padStart(3, "0");
      // Alternate assignments after seeded scenario shuffle; each pair has one of each arm.
      const artifact = blindedArtifact(
        result,
        pairId,
        (caseIndex + STYLES.indexOf(style) + LENGTHS.indexOf(length)) % 2 === 0,
      );
      write(`review/pair-${pairId}.html`, artifact.html);
      key.push({ ...artifact.key, caseId: c.id, style, length });
      const { audit, ...presentation } = result;
      compact.push({
        pairId,
        caseId: c.id,
        style,
        length,
        verification: audit.verification.result,
        disposition: audit.disposition,
        comparison: result.comparison,
        words: { B2: result.b2.words, investigator: result.investigator.words },
        limit: result.b2.limit,
      });
      if (style === "plain" && length === "brief")
        write(`private/${c.id}.audit.json`, audit);
      summaries.push({
        pairId,
        caseId: c.id,
        verification: audit.verification.result,
        disposition: audit.disposition,
        ...presentation,
      });
    }
}
write("private/key.json", { seed, assignments: key });
write("private/presentations.json", summaries);
write("private/summary.json", compact);
write("private/manifest.json", {
  version: RENDER_VERSION,
  sourceCommit: git("rev-parse", "HEAD"),
  sourceHashes: Object.fromEntries(
    paths.map((p) => [p, sha(readFileSync(p, "utf8"))]),
  ),
  originalPR41FreezeSha256: sha(
    readFileSync(
      "docs/intelligence/investigator-feasibility-2026-10-12/frozen.json",
      "utf8",
    ),
  ),
  provenance: "mock",
  paidCalls: 0,
  modelSelectedDecisions: null,
  modelUsage: null,
  modelCostUsd: null,
  humanReview: null,
  improvementEstablished: false,
  newFrozenCandidateRequired: true,
  styles: STYLES,
  lengths: LENGTHS,
  wordLimits: WORD_LIMITS,
});
console.log(
  JSON.stringify({
    output,
    comparisons: n,
    paidCalls: 0,
    status: "mock controls only; no model value established",
  }),
);
