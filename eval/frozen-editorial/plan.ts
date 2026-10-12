import { buildCase, cases } from "../editorial-baselines/cases";
import {
  digest,
  DESTINATION,
  proposal as previous,
} from "../investigator-feasibility/plan";
import {
  prepareInvestigation,
  INVESTIGATOR_VERSION,
  investigatorDigest,
} from "../../src/lib/ai/director/investigator-contract";
import {
  evaluateEditorial,
  STYLES,
  LENGTHS,
  WORD_LIMITS,
  RENDER_VERSION,
} from "../investigator-editorial/render";
export { digest, DESTINATION };
export const STUDY = "foundry-editorial-candidate-2026-10-12";
export const DIRECTORY = `docs/intelligence/${STUDY}`;
export const proposal = {
  study: STUDY,
  status: "frozen preparation; no paid authorization",
  supersedes:
    "investigator-feasibility-2026-10-12 (PR #41); historical artifacts remain unchanged",
  sourceBase: "422a5b33ed845bc4930528ab872a033ef15cd984",
  reviewedRendererHead: "7771a476d55a78d8d8beff57e6ab4bd755f07704",
  maxAttempts: previous.maxAttempts,
  maxNanoUsd: previous.maxNanoUsd,
  reserveNanoUsd: previous.reserveNanoUsd,
  price: previous.price,
  model: previous.model,
  deployment: previous.deployment,
  version: previous.version,
  applicationCeilings: [2, 2, 2, 2, 30, 30000],
  presentation: {
    version: RENDER_VERSION,
    styles: STYLES,
    lengths: LENGTHS,
    wordLimits: WORD_LIMITS,
    primary: { style: "plain", length: "brief" },
  },
  criteria: {
    evidence:
      "Same synthetic prefix, catalogue, initial complete B2 reads and available options for both arms. Canonical replay must pass; retain full trace and retrieved bundles. Zero additional reads is valid. Read relevance requires a human rationale, not just valid IDs.",
    interpretations:
      "Harbor lead has two supported interpretations: repeated-route and both-teams. Either can be the useful primary emphasis; neither is a predefined winner. concentrated-attempts stays limited. All alternatives remain visible. Another focal development requires its complete evidence and a human rationale.",
    counterEvidence:
      "Retain opponent activity, unchanged per-shot xG, route denominator, synthetic provenance, causation and continuation limits. A generic caveat alone earns no editorial relevance credit. Compare actual highlighted wording and its visibility with B2.",
    stopping: previous.criteria.stopping,
    editorial:
      "Primary review: Casual Viewer / brief. Rate each arm 1–5 for useful prioritization, clarity, visible counter-evidence and calibrated uncertainty; cite exact wording from BOTH arms. Preference A/B/tie/cannot assess plus improvement/parity/regression/inconclusive after unblinding. Improvement requires a material usefulness benefit absent from B2 with no lost caveats or unsupported conclusions. Different IDs, statistics, retrieval counts or secondary ordering alone are not improvement. Other styles/lengths are sensitivity views, not independent trials.",
    unsupported: previous.criteria.unsupported,
    operational: previous.criteria.operational,
    decision:
      "Operationally valid requires uncached verified output, actual requests within every cap, complete reconciled usage and durable accounting. Editorial benefit additionally requires blinded human judgments meeting the preregistered rule. Invalid, blocked, cancelled, cap-limited, parity and regression outcomes are retained, with no replacement or repair run. No aggregate preference claim from this one authored development case.",
  },
  expected: {
    score: "0-0",
    cutoff: 1800,
    windows: "(0,900] vs (900,1800]; current halves (900,1350] and (1350,1800]",
    harborShots: [2, 6],
    harborRecentHalves: [3, 3],
    riversideShots: [1, 5],
    riversideRecentHalves: [2, 3],
    harborLinkedPossessions: [0, 2],
    xgPerShot: 0.1,
    lead: "Harbor: more shots",
    supported: ["repeated-route", "both-teams"],
    limited: ["concentrated-attempts"],
  },
} as const;
export function fixture(control = false) {
  const c = buildCase(
    cases.find((c) => c.id === (control ? "quiet" : "spread-favored"))!,
  );
  return { ...c, context: { ...c.context, audience: "local" as const } };
}
export function frozenCase(control = false) {
  const c = fixture(control);
  const p = prepareInvestigation(c.match, c.cutoff, c.context);
  const submission = {
    version: INVESTIGATOR_VERSION,
    indexId: p.reader.index.id,
    initialDigest: investigatorDigest(p.initial),
    trace: [],
    plan: null,
  };
  const presentations = STYLES.flatMap((style) =>
    LENGTHS.map((length) => {
      const r = evaluateEditorial(
        c.match,
        c.cutoff,
        c.context,
        submission,
        "mock",
        style,
        length,
      );
      return {
        style,
        length,
        output: r.b2,
        presentationPlan: r.audit.b2PresentationPlan,
      };
    }),
  );
  const { metrics: _metrics, ...baseline } = p.baseline;
  return {
    id: control ? "quiet-no-call" : "coexisting-supported-interpretations",
    mode: control ? "normal" : "evaluation",
    fixture: c,
    index: p.reader.index,
    initialEvidence: p.initial,
    availableEvidence: p.reader.index.options
      .filter((o) => !o.unavailable)
      .map((o) =>
        p.reader.read({ indexId: p.reader.index.id, optionId: o.id }),
      ),
    baseline,
    presentations,
  };
}
export function frozenContent() {
  return { proposal, cases: [frozenCase(), frozenCase(true)] };
}
