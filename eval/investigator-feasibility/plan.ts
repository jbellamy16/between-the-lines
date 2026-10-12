import { createHash } from "node:crypto";
import { buildCase, cases } from "../editorial-baselines/cases";
import { prepareInvestigation } from "../../src/lib/ai/director/investigator-contract";
export const STUDY = "investigator-feasibility-2026-10-12";
export const DIRECTORY = `docs/intelligence/${STUDY}`;
export const DESTINATION =
  "https://josh-5098-resource.openai.azure.com/openai/v1/responses";
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export const proposal = {
  study: STUDY,
  status: "preparation-only; separate explicit authorization required",
  maxAttempts: 2,
  maxNanoUsd: 500_000_000,
  reserveNanoUsd: 308_100_000,
  price: { input: 0.75, cachedInput: 0.075, output: 4.5 },
  model: "gpt-5.4-mini",
  deployment: "between-the-lines-gpt54-mini",
  version: "2026-03-17",
  sourceCommit: "6b88da3",
  criteria: {
    evidence:
      "Canonical replay passes; no unavailable, duplicate, invented or future references. Report relevant reads / attempted reads; zero reads is valid and precision is null.",
    interpretations:
      "For the Riverside lead, both-teams must be first. Repeated-route and concentrated-attempts remain limited; all canonical alternatives stay visible.",
    counterEvidence:
      "Select challenge:opponent-shot-response or its equivalent qualification for emphasis. Generic tracking caveats alone are valid but insufficient relevance.",
    stopping:
      "Immediate verified sufficient/no-material-gain is voluntary only when tools were offered. Forced final, deadline, retry, failure and budget exhaustion earn no voluntary-stop credit.",
    editorial:
      "Compare full B2 stories, answers and foreground order against rendered output AND selected plan. Same facts/order are parity. A different ID, more reads or reordered IDs alone are not improvement. A human must cite a material prioritization benefit absent from B2, with no loss of relevant caveats. No automatic improvement claim.",
    unsupported:
      "Record rejected raw structured decisions separately from published output. Zero unsupported published conclusions and no lost mandatory caveats required. Invalid decisions fail feasibility even when B2 fallback is safe.",
    operational:
      "One synthetic case, at most two HTTP attempts including retries, at most $0.50 subject to all lower existing limits; no cache credit; no replacement cases or repair calls.",
    decision:
      "Feasible = uncached verified selection + relevant interpretation and challenge + no unsupported publication + reconciled accounting. Beyond-B2 value additionally requires the cited human review. Parity, regression, inconclusive and blocked are valid outcomes.",
  },
  expected: {
    score: "0-0",
    windows: "(0,900] vs (900,1800]; current halves (900,1350] and (1350,1800]",
    harborShots: [2, 6],
    harborRecentHalves: [5, 1],
    riversideShots: [1, 5],
    riversideRecentHalves: [2, 3],
    xgPerShot: 0.1,
    lead: "Riverside: more shots",
    qualification:
      "Both teams increased activity; no one-sided control, pressing causation, better per-shot quality or future continuation established.",
    likelyOutcome:
      "Parity with B2 or failure is plausible. One development case cannot establish generalization or human preference.",
  },
} as const;
export function fixture(control = false) {
  const c = buildCase(
    cases.find((c) => c.id === (control ? "quiet" : "fading-favored"))!,
  );
  return { ...c, context: { ...c.context, audience: "local" as const } };
}
export function frozenCase(control = false) {
  const c = fixture(control);
  const p = prepareInvestigation(c.match, c.cutoff, c.context);
  const { metrics, ...baseline } = p.baseline;
  return {
    id: control ? "quiet-no-call" : "fading-favored",
    mode: control ? "normal" : "evaluation",
    fixture: c,
    index: p.reader.index,
    initialEvidence: p.initial,
    baseline,
    deterministicUsage: {
      requests: metrics.providerRequests,
      costUsd: metrics.inferenceCostUsd,
      reads: metrics.localOptionReads,
    },
  };
}
export function frozenContent() {
  return { proposal, cases: [frozenCase(), frozenCase(true)] };
}
