import "server-only";
import { createHash } from "node:crypto";
import type { MatchData } from "../../sources/model";
import {
  createEvidenceReader,
  type DiscoveryContext,
  type DiscoveryOption,
  type EvidenceIndex,
} from "./discovery";
import { observe, claimEmphasis, type Candidate } from "./observer";
import { evaluateHypothesis, type HypothesisAssessment } from "./hypothesis";
import type { QuestionEvidence } from "./questions";
import { packageStory, validateEditorialPlan } from "./story";

export const EDITORIAL_BASELINE_VERSION = "deterministic-editorial-1.0.0";
export type BaselinePolicy = "B1" | "B2";
type Development = EvidenceIndex["developments"][number];
type Reader = ReturnType<typeof createEvidenceReader>;
type Bundle = ReturnType<Reader["read"]>;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const matchState = (d: Development) =>
  ["score-change", "full-time"].includes(d.category);
const category = (d: Development) =>
  d.category === "recovery-shot" ||
  (d.category === "activity-change" &&
    d.statistics[0]?.label === "ball wins in the attacking third")
    ? "pressure"
    : ["passing-pair", "substitute-involvement"].includes(d.category) ||
        (d.category === "activity-change" &&
          ["pass attempts", "forward passes"].includes(d.statistics[0]?.label))
      ? "rhythm"
      : "chances";

/** Fixed development objective. Points are editorial weights, never probabilities.
 * All inputs are shared catalogue facts, including already-computed verdicts.
 */
export function editorialPriority(index: EvidenceIndex, d: Development) {
  const question = (intent: string) =>
    d.questions.find((q) => q.intent === intent);
  const change = Math.max(
    0,
    (d.statistics[0]?.value ?? 0) - (d.statistics[1]?.value ?? 0),
  );
  const comparison =
    d.category === "activity-change" || d.category === "window-comparison";
  const novelty = d.evidence.count
    ? 1 - d.editorial.seenCount / d.evidence.count
    : 1;
  const factors = {
    materiality: matchState(d)
      ? 1000
      : comparison
        ? 30 + Math.min(12, change * 2)
        : d.category === "shot-location"
          ? 28
          : d.category === "recovery-shot"
            ? 24
            : 16,
    recency: 8 * Math.max(0, 1 - (index.cutoff - d.timestamp) / 900),
    novelty: 16 * novelty,
    preferences:
      (index.preferences.team === d.team ? 6 : 0) +
      (d.editorial.preferredPlayerEvidenceCount ? 6 : 0) +
      (index.mode === "analyst" && comparison ? 1 : 0),
    completeness: -Math.min(
      8,
      d.missingInformation.length * 2 +
        d.questions.filter((q) => q.availability === "unavailable").length * 2,
    ),
    counterEvidence:
      -Math.min(8, d.contradictoryEvidence.length * 2) -
      (question("fading-activity")?.verdict === "lower" ? 8 : 0) -
      (question("opponent-improvement")?.verdict === "higher" ? 2 : 0),
    competingInterpretations: d.questions
      .flatMap((q) => q.interpretations)
      .some((i) => i.status === "supported")
      ? 2
      : 0,
  };
  const eligible =
    matchState(d) ||
    (d.editorial.canLead &&
      novelty > 0 &&
      (!index.preferences.categories ||
        index.preferences.categories.includes(category(d))));
  return {
    id: d.id,
    eligible,
    factors,
    total: Object.values(factors).reduce((a, b) => a + b, 0),
  };
}

/** Preserve every alternative; only the foreground order changes. */
function foreground(d: Development) {
  const priorities: Record<string, number> = {
    "fading-activity": 4,
    "opponent-improvement": 3,
    "chance-quality": 2,
    "shot-surge-explanations": 1,
  };
  return d.questions
    .filter(
      (q) =>
        q.availability === "unavailable" ||
        (q.intent === "fading-activity" && q.verdict === "lower") ||
        (q.intent === "opponent-improvement" && q.verdict === "higher") ||
        (q.intent === "chance-quality" && q.verdict !== "higher") ||
        q.interpretations.some((i) => i.status === "supported"),
    )
    .sort((a, b) => (priorities[b.intent] ?? 0) - (priorities[a.intent] ?? 0))
    .map((q) => q.intent);
}

function assessment(bundle: Bundle | undefined, id: string) {
  return (
    bundle?.payload.assessments as
      { claimId: string; assessment: HypothesisAssessment }[] | undefined
  )?.find((a) => a.claimId === id)?.assessment;
}
function questions(bundle: Bundle | undefined): QuestionEvidence[] {
  const q = bundle?.payload.question as QuestionEvidence | undefined;
  return q ? [q, ...(q.comparison?.baseline ?? [])] : [];
}

/** The policy sees only the public index and registered read interface, never raw events. */
function decide(reader: Reader, policy: BaselinePolicy, storyLimit: number) {
  const index = reader.index;
  const reads = new Map<string, Bundle>();
  const failures = new Map<string, string>();
  const trace: {
    optionId: string;
    purpose: DiscoveryOption["purpose"];
    outcome: "read" | "failed";
    digest: string | null;
  }[] = [];
  const read = (option: DiscoveryOption | undefined) => {
    if (!option || option.unavailable || failures.has(option.id))
      return undefined;
    if (reads.has(option.id)) return reads.get(option.id);
    try {
      const bundle = reader.read({ indexId: index.id, optionId: option.id });
      reads.set(option.id, bundle);
      trace.push({
        optionId: option.id,
        purpose: option.purpose,
        outcome: "read",
        digest: digest(bundle),
      });
      return bundle;
    } catch (error) {
      // Bounded response failures stay visible. No retry can cure absent source data.
      failures.set(
        option.id,
        error instanceof Error ? error.message : "Evidence unavailable",
      );
      trace.push({
        optionId: option.id,
        purpose: option.purpose,
        outcome: "failed",
        digest: null,
      });
      return undefined;
    }
  };
  const priorities = index.developments
    .map((d) => editorialPriority(index, d))
    .sort(
      (a, b) =>
        b.total - a.total ||
        index.developments.find((d) => d.id === b.id)!.timestamp -
          index.developments.find((d) => d.id === a.id)!.timestamp ||
        a.id.localeCompare(b.id),
    );
  // B1 measures real local enumeration, without imitating a model's four-tool allowance.
  if (policy === "B1") for (const option of index.options) read(option);
  const selected: {
    id: string;
    assessmentOptionId: string;
    questionOptionIds: string[];
    foreground: string[];
    unresolved: string[];
  }[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const required = new Set<string>();
  const state = index.developments.find(matchState);
  for (const priority of priorities) {
    if (!priority.eligible || selected.length >= storyLimit) continue;
    const d = index.developments.find((d) => d.id === priority.id)!;
    if (state && !selected.length && d.id !== state.id) break;
    if (selected.some((s) => d.editorial.incompatibleIds.includes(s.id)))
      continue;
    const option = index.options.find(
      (o) => o.developmentId === d.id && o.purpose === "inspect-challenge",
    );
    if (option) required.add(option.id);
    const bundle = read(option);
    const checked = assessment(bundle, d.id);
    if (
      !checked ||
      !["confirmed-observation", "supported-interpretation"].includes(
        checked.verificationStatus,
      ) ||
      checked.verificationChecks.some((c) => !c.passed) ||
      bundle?.coverage.bundle !== "complete"
    ) {
      rejected.push({
        id: d.id,
        reason:
          option?.unavailable ??
          failures.get(option?.id ?? "") ??
          "Complete verified assessment unavailable",
      });
      continue;
    }
    const unanswered = new Set(d.questions.map((q) => q.intent));
    const questionOptionIds: string[] = [];
    // General source limitations (for example off-ball intent) remain in the
    // complete assessment. They do not make a supported descriptive answer unresolved.
    const unresolved: string[] = [];
    // A surge bundle already includes quality, opponent and fading evidence. Read it
    // once before considering narrower answers; partial delivery does not erase unknowns.
    const options = index.options
      .filter((o) => o.developmentId === d.id && o.tool === "guided_question")
      .sort(
        (a, b) =>
          Number(b.intent === "shot-surge-explanations") -
            Number(a.intent === "shot-surge-explanations") ||
          a.id.localeCompare(b.id),
      );
    for (const q of options) {
      if (!q.intent || !unanswered.has(q.intent)) continue;
      required.add(q.id);
      const answer = read(q);
      if (!answer) continue;
      questionOptionIds.push(q.id);
      for (const item of questions(answer)) {
        unanswered.delete(item.question.intent);
        if (item.availability === "unavailable")
          unresolved.push(
            item.reason ?? `${item.question.intent}: unavailable`,
          );
      }
      unresolved.push(...answer.coverage.missingInformation);
      if (answer.coverage.bundle !== "complete")
        unresolved.push(
          "Supplemental evidence is partial or unavailable; interpretations remain qualified.",
        );
    }
    // Never publish an incomplete mandatory question bundle as a complete answer.
    if (unanswered.size) {
      rejected.push({
        id: d.id,
        reason: `Missing question bundles: ${[...unanswered].join(", ")}`,
      });
      continue;
    }
    selected.push({
      id: d.id,
      assessmentOptionId: option!.id,
      questionOptionIds,
      foreground: foreground(d),
      unresolved: [...new Set(unresolved)],
    });
  }
  const catalogueIncomplete =
    index.coverage.developments.omitted > 0 ||
    index.coverage.options.omitted > 0;
  const unresolved =
    selected.some((s) => s.unresolved.length > 0) ||
    rejected.length > 0 ||
    catalogueIncomplete;
  const stop = unresolved
    ? "unresolved"
    : selected.length
      ? "sufficient"
      : "no-material-gain";
  return {
    version: EDITORIAL_BASELINE_VERSION,
    policy,
    indexId: index.id,
    prefixDigest: index.prefixDigest,
    cutoff: index.cutoff,
    storyLimit,
    score: index.score,
    priorities,
    selected,
    rejected,
    trace,
    stop: {
      origin: "deterministic-policy" as const,
      reason: stop as "unresolved" | "sufficient" | "no-material-gain",
      scope: "available-bounded-catalogue" as const,
      catalogueIncomplete,
      // Upstream limits are disclosed even when all offered developments were considered.
      observerOmissions: index.coverage.observerOmissions,
      scopeOmissions: index.coverage.scopeOmissions,
    },
    unavailableOptions: index.options
      .filter((o) => o.unavailable)
      .map((o) => ({ id: o.id, reason: o.unavailable })),
    failures: [...failures].map(([id, reason]) => ({ id, reason })),
    skippedOptions: index.options
      .filter((o) => !reads.has(o.id) && !failures.has(o.id) && !o.unavailable)
      .map((o) => ({
        id: o.id,
        reason:
          "Shared summaries settle priority; no additional evidence is required for the selected answer.",
      })),
    work: {
      optionReads: trace.length,
      successfulReads: reads.size,
      duplicateReads: trace.length - new Set(trace.map((t) => t.optionId)).size,
      supplementalReads: trace.filter((t) => !required.has(t.optionId)).length,
      responseCharacters: [...reads.values()].reduce(
        (sum, b) => sum + JSON.stringify(b).length,
        0,
      ),
    },
  };
}
export type EditorialBaselineDecision = ReturnType<typeof decide>;

/** Fresh canonical replay plus the existing independent arithmetic verifier and renderer.
 * Caller-supplied scores, selections, omissions, stops and trace digests are not trusted.
 */
export function verifyEditorialBaseline(
  match: MatchData,
  cutoff: number,
  context: DiscoveryContext,
  decision: EditorialBaselineDecision,
) {
  if (
    !["B1", "B2"].includes(decision.policy) ||
    !Number.isInteger(decision.storyLimit) ||
    decision.storyLimit < 1 ||
    decision.storyLimit > 3
  )
    throw new Error("Invalid deterministic policy or story limit");
  const reader = createEvidenceReader(match, cutoff, context);
  const replayed = decide(reader, decision.policy, decision.storyLimit);
  if (digest(replayed) !== digest(decision))
    throw new Error("Editorial decision failed fresh canonical replay");
  const candidates = observe(match, cutoff, "fan", {}, { unranked: true });
  const chosen = decision.selected.map((s) =>
    candidates.find((c) => c.id === s.id)!,
  );
  validateEditorialPlan(
    {
      decision: chosen.length ? "publish" : "abstain",
      stories: chosen.map((c) => ({
        claimId: c.id,
        form: context.mode === "analyst" ? "detail" : "brief",
        emphasis: claimEmphasis[c.category],
      })),
    },
    candidates,
    new Set(chosen.map((c) => c.id)),
  );
  const stories = chosen.map((candidate: Candidate, i) => {
    const entry = decision.selected[i];
    const bundle = reader.read({
      indexId: reader.index.id,
      optionId: entry.assessmentOptionId,
    });
    if (
      digest(assessment(bundle, candidate.id)) !==
      digest(evaluateHypothesis(match, cutoff, candidate))
    )
      throw new Error("Independent assessment mismatch");
    return packageStory(
      candidate,
      match,
      cutoff,
      context.mode ?? "fan",
      "offline",
      context.mode === "analyst" ? "detail" : "brief",
      claimEmphasis[candidate.category],
    );
  });
  const answers = decision.selected.flatMap((s) =>
    s.questionOptionIds.flatMap((id) =>
      questions(reader.read({ indexId: reader.index.id, optionId: id })),
    ),
  );
  return { stories, answers, verificationReads: replayed.work.optionReads };
}

/** Offline, opt-in evaluation entry point. No runner, endpoint, provider or spending changes. */
export function runEditorialBaseline(
  match: MatchData,
  cutoff: number,
  policy: BaselinePolicy,
  context: DiscoveryContext = {},
  storyLimit = 1,
) {
  if (
    !["B1", "B2"].includes(policy) ||
    !Number.isInteger(storyLimit) ||
    storyLimit < 1 ||
    storyLimit > 3
  )
    throw new Error("Invalid deterministic policy or story limit");
  const started = performance.now();
  const reader = createEvidenceReader(match, cutoff, context);
  const indexed = performance.now();
  const decision = decide(reader, policy, storyLimit);
  const decided = performance.now();
  const verified = verifyEditorialBaseline(match, cutoff, context, decision);
  const finished = performance.now();
  return {
    decision,
    ...verified,
    metrics: {
      indexMs: indexed - started,
      policyMs: decided - indexed,
      verificationMs: finished - decided,
      latencyMs: finished - started,
      localOptionReads: decision.work.optionReads,
      verificationReads: verified.verificationReads,
      providerRequests: 0,
      inferenceCostUsd: 0,
    },
  };
}
