import { z } from "zod";
import { CAPS, ENVELOPE, PRICE } from "../guided-study/ledger";

// Preparation only. These values grant no allowance and are not a dispatch guard.
export const proposal = {
  study: "investigation-foundry-2026-10-12",
  status: "proposed-not-authorized",
  caseIds: ["matched-separate-possessions"],
  caps: { ...CAPS, workflows: 1, attempts: 2, perWorkflow: 2 },
  envelope: ENVELOPE,
  price: PRICE,
  deployment: "between-the-lines-gpt54-mini",
  model: "gpt-5.4-mini",
  version: "2026-03-17",
  region: "westus3",
  sku: "GlobalStandard",
  outputTokens: 1800,
  requestBytes: 131072,
  requestMinuteCeiling: 30,
  tokenMinuteCeiling: 30000,
  deadlineMs: 55000,
} as const;

const integer = z.number().int().nonnegative().safe();
const rowSchema = z.object({
  caseId: z.string(),
  arm: z.enum([
    "A-existing-deterministic",
    "B-strengthened-deterministic",
    "C-fixed-mock",
    "D-adaptive-mock",
  ]),
  eligible: z.boolean(),
  disposition: z.string(),
  requests: integer,
  latencyMs: z.number().nonnegative(),
  tokenEstimate: z.object({
    input: integer,
    scriptedOutput: integer,
    reservation: integer,
  }),
  metrics: z.object({
    assertions: integer,
    correctAssertions: integer,
    unsupportedPublishedConclusions: integer,
    invalidReferences: z.array(z.string()),
    incorrectCitations: z.array(z.string()),
    missingCaveats: z.array(z.string()),
    usefulEvidence: z.object({
      covered: z.array(z.string()),
      additionalVsA: z.array(z.string()),
    }),
    investigationRelevance: z.object({
      relevant: integer,
      attempted: integer,
      precision: z.number().nullable(),
    }),
  }),
});
export const offlineSchema = z.object({
  manifestDigest: z.string(),
  sourceHashes: z.record(z.string(), z.string()),
  cases: z.array(z.object({ id: z.string(), eligible: z.boolean() })),
  rows: z.array(rowSchema),
  gates: z.object({
    publishedConclusionSafetyPassed: z.boolean(),
    allCanonicalCitationsCorrect: z.boolean(),
    injectedPlansRejected: integer,
    injectedPlansAttempted: integer,
    actualAiImprovementEstablished: z.literal(false),
  }),
  actualModelRequests: z.literal(0),
  actualCostUsd: z.literal(0),
});

export function prepareComparison(raw: unknown) {
  const data = offlineSchema.parse(raw);
  if (
    data.manifestDigest !==
    "2e0894c3e0fa54de48886bd15283175a317d6b14a2fa103029e5768fa71ec8df"
  )
    throw new Error("Diagnostic corpus changed; review the proposal again");
  const ids = data.cases.map((c) => c.id);
  if (ids.length !== 14 || new Set(ids).size !== 14 || data.rows.length !== 56)
    throw new Error("Incomplete comparison matrix");
  for (const id of ids) {
    const rows = data.rows.filter((r) => r.caseId === id);
    if (rows.length !== 4 || new Set(rows.map((r) => r.arm)).size !== 4)
      throw new Error("Missing or duplicate comparison arm");
    if (
      rows.some(
        (r) => r.eligible !== data.cases.find((c) => c.id === id)!.eligible,
      )
    )
      throw new Error("Eligibility mismatch");
  }
  const controls = data.rows.filter((r) => !r.eligible);
  if (controls.some((r) => r.requests !== 0))
    throw new Error("No-call control dispatched");
  if (
    !data.gates.allCanonicalCitationsCorrect ||
    data.gates.injectedPlansRejected !== 40 ||
    data.gates.injectedPlansAttempted !== 40
  )
    throw new Error("Offline verification regression");
  const comparisons = data.rows
    .filter((r) => r.arm.startsWith("C-") || r.arm.startsWith("D-"))
    .map((r) => {
      const baseline = data.rows.find(
        (b) =>
          b.caseId === r.caseId && b.arm === "B-strengthened-deterministic",
      )!;
      return {
        ...r,
        additionalUsefulFactsVsB: r.metrics.usefulEvidence.covered.filter(
          (f) => !baseline.metrics.usefulEvidence.covered.includes(f),
        ),
        unsupportedConclusionDeltaVsB:
          r.metrics.unsupportedPublishedConclusions -
          baseline.metrics.unsupportedPublishedConclusions,
        evidenceKind: "scripted; not model-selected" as const,
      };
    });
  const selected = comparisons.filter((r) =>
    (proposal.caseIds as readonly string[]).includes(r.caseId),
  );
  return {
    offlinePreparationPassed: true,
    publicationSafetyPassed: data.gates.publishedConclusionSafetyPassed,
    states: ids.length,
    noCallStates: data.cases.filter((c) => !c.eligible).length,
    comparisons,
    selectedSizing: selected.map((r) => ({
      arm: r.arm,
      caseId: r.caseId,
      scriptedDispatches: r.requests,
      scriptedDisposition: r.disposition,
      tokenEstimate: r.tokenEstimate,
      // This illustration is neither provider usage nor a spending guard.
      heuristicUncachedNanoUsd:
        r.tokenEstimate.input * 750 + r.tokenEstimate.scriptedOutput * 4500,
      fitsProposedAttemptCap: r.requests <= proposal.caps.attempts,
    })),
    actualModelRequests: 0,
    actualCostUsd: 0,
    modelSelectedResults: null,
    meaningfulModelValue:
      "not measured; authorization and live readiness pending",
  };
}

/** Pure arithmetic for reviewing the proposed ceiling, never authorization. */
export function canReserveProposal(accountedNanoUsd: number, attempts: number) {
  if (
    ![accountedNanoUsd, attempts].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    )
  )
    return false;
  return (
    attempts < proposal.caps.attempts &&
    accountedNanoUsd + ENVELOPE.nanoUsd <= proposal.caps.nanoUsd
  );
}

export function readinessBlockers(application: {
  limits: number[];
  store: string;
  remainingWorkflows: number | null;
  remainingAttempts: number | null;
}) {
  const blockers = [
    "Explicit authorization for this proposed study is absent.",
  ];
  const { limits, store, remainingWorkflows, remainingAttempts } = application;
  if (
    limits.length !== 6 ||
    limits.some((v) => !Number.isSafeInteger(v) || v < 0) ||
    limits[0] < 1 ||
    limits[4] < 1 ||
    limits[5] < 1 ||
    Math.min(...limits.slice(1, 4)) < proposal.caps.attempts
  )
    blockers.push(
      "Existing application limits cannot support this proposal; do not raise them.",
    );
  if (
    store !== "shared" ||
    remainingWorkflows === null ||
    remainingAttempts === null ||
    !Number.isSafeInteger(remainingWorkflows) ||
    !Number.isSafeInteger(remainingAttempts) ||
    remainingWorkflows < proposal.caps.workflows ||
    remainingAttempts < proposal.caps.attempts
  )
    blockers.push(
      "Sufficient existing durable allowance has not been verified; do not initialize or reset counters.",
    );
  blockers.push(
    "A separately reviewed, single-use execution adapter with durable reservation and claim is required; this command has no live mode.",
  );
  return blockers;
}
