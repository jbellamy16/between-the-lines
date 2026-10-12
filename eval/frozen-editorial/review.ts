import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blindedArtifact } from "../investigator-editorial/artifact";
import {
  evaluateEditorial,
  STYLES,
  LENGTHS,
} from "../investigator-editorial/render";
import { fixture, digest, STUDY, proposal } from "./plan";
import type { runBoundedInvestigator } from "../../src/lib/ai/director/investigator";
export type Result = Awaited<ReturnType<typeof runBoundedInvestigator>>;
export const reviewerInstructions = `Compare the two explanations without guessing their source. Primary view: Casual Viewer, brief. Other views are sensitivity checks of the same case, not new trials.
Rate A and B separately from 1 (poor) to 5 (excellent): useful prioritization, clarity, visibility of counter-evidence, calibrated uncertainty. Record preference A / B / tie / cannot assess. Cite exact wording from BOTH explanations, describe any material benefit, and identify regressions or missing qualifications. Correct statistics or different ordering alone are not a benefit. Submit ratings before receiving the answer key. Record responses separately; HTML input is not saved.\n`;
export function reviewComparison(
  result: Result,
  provenance: "mock" | "recorded-model",
) {
  if (result.receipt.disposition === "cancelled") return [];
  const c = fixture();
  return STYLES.flatMap((style) =>
    LENGTHS.map((length) => {
      const r = evaluateEditorial(
        c.match,
        c.cutoff,
        c.context,
        {
          version: result.receipt.version,
          indexId: result.receipt.indexId,
          initialDigest: result.receipt.initialDigest,
          trace: result.receipt.trace,
          // Rejected raw provider output is retained in transport records, never
          // promoted to a published selection by a second, more permissive parser.
          plan:
            result.receipt.verification === "passed"
              ? result.receipt.plan
              : null,
        },
        provenance,
        style,
        length,
      );
      return {
        ...r,
        audit: { ...r.audit, newFrozenCandidateRequired: false },
        executionAudit: {
          provenance,
          study: STUDY,
          actualModelSelectedDecisions:
            provenance === "recorded-model" ? result.receipt.plan : null,
          modelUsage:
            provenance === "recorded-model" ? result.receipt.usage : null,
          paidCalls:
            provenance === "recorded-model" ? result.receipt.attempts : 0,
          originalReceipt: result.receipt,
          actualPublishedOutput: {
            stories: result.stories,
            answers: result.answers,
            score: result.score,
          },
          rawDecisionLocation:
            "private/transport-events.jsonl and private/result.json",
        },
      };
    }),
  );
}
export function writeReview(
  output: string,
  comparisons: ReturnType<typeof reviewComparison>,
  seed = randomBytes(32).toString("hex"),
) {
  // Caller creates an exclusive run directory; no previous review is overwritten.
  mkdirSync(join(output, "review"));
  const assignments: unknown[] = [];
  const ordered = [...comparisons].sort((a, b) =>
    digest(seed + a.b2.style + a.b2.length).localeCompare(
      digest(seed + b.b2.style + b.b2.length),
    ),
  );
  if (ordered.some((r) => r.status !== "reviewable"))
    throw new Error("Complete evidence exceeds shared presentation limits");
  writeFileSync(join(output, "review/instructions.txt"), reviewerInstructions, {
    flag: "wx",
  });
  const orientation = Number.parseInt(digest(seed).slice(0, 2), 16) % 2;
  for (const [i, r] of ordered.entries()) {
    const pairId = String(i + 1).padStart(3, "0");
    const artifact = blindedArtifact(r, pairId, (i + orientation) % 2 === 0);
    writeFileSync(join(output, `review/pair-${pairId}.html`), artifact.html, {
      flag: "wx",
    });
    assignments.push({
      ...artifact.key,
      style: r.b2.style,
      length: r.b2.length,
      primary:
        r.b2.style === proposal.presentation.primary.style &&
        r.b2.length === proposal.presentation.primary.length,
    });
  }
  writeFileSync(
    join(output, "private/key.json"),
    JSON.stringify({ seed, assignments }, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  writeFileSync(
    join(output, "private/presentations.json"),
    JSON.stringify(comparisons, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return assignments.length;
}
