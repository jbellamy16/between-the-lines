import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { MatchData } from "../../sources/model";
import {
  createEvidenceReader,
  type DiscoveryContext,
  type EvidenceIndex,
} from "./discovery";
import { editorialPriority, runEditorialBaseline } from "./editorial-baselines";
import { evaluateHypothesis, type HypothesisAssessment } from "./hypothesis";
import { observe, claimEmphasis } from "./observer";
import { packageStory, validateEditorialPlan } from "./story";
import { assessmentEventIds } from "./discovery-coverage";
import type { QuestionEvidence } from "./questions";
import { interpretationIds, type ShotRoutes } from "./shot-routes";

export const INVESTIGATOR_VERSION = "bounded-investigator-1.0.0";
export const investigatorDigest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const id = z.string().min(1).max(300);
const interpretations = z.array(z.enum(interpretationIds)).max(3);
export const investigationReadSchema = z
  .object({
    indexId: z.string().length(64),
    optionId: id,
    focalId: id,
    interpretationIds: interpretations,
    purpose: z.enum([
      "resolve-priority",
      "distinguish-concentration",
      "challenge-continuation",
      "check-opponent",
      "check-quality",
      "inspect-challenge",
      "illustrate-sequence",
    ]),
  })
  .strict();
export const investigationPlanSchema = z
  .object({
    indexId: z.string().length(64),
    focalId: id.nullable(),
    interpretationIds: interpretations,
    supportIds: z.array(id).max(3),
    challengeIds: z.array(id).max(3),
    stop: z.enum(["sufficient", "no-material-gain", "unresolved"]),
  })
  .strict();
export type InvestigationRead = z.infer<typeof investigationReadSchema>;
export type InvestigationPlan = z.infer<typeof investigationPlanSchema>;
type Reader = ReturnType<typeof createEvidenceReader>;
export type InvestigationBundle = ReturnType<Reader["read"]>;
export function investigationTraceEntry(
  action: InvestigationRead,
  bundle: InvestigationBundle,
) {
  const assessments = bundle.payload.assessments as
    { assessment: HypothesisAssessment }[] | undefined;
  return {
    action,
    digest: investigatorDigest(bundle),
    resolvedAction: bundle.resolvedAction,
    evidenceIds: [
      ...new Set([
        ...bundle.events.map((e) => e.id),
        ...investigationAnswers(bundle).flatMap((q) => q.eventIds),
        ...(assessments ?? []).flatMap((a) => assessmentEventIds(a.assessment)),
      ]),
    ],
    coverage: bundle.coverage,
  };
}
export type InvestigationTrace = ReturnType<typeof investigationTraceEntry>[];
const unique = (ids: string[]) => new Set(ids).size === ids.length;
const state = (d: EvidenceIndex["developments"][number]) =>
  ["score-change", "full-time"].includes(d.category);

export function investigationAnswers(
  bundle: InvestigationBundle,
): QuestionEvidence[] {
  const q = bundle.payload.question as QuestionEvidence | undefined;
  return q ? [q, ...(q.comparison?.baseline ?? [])] : [];
}

/** Full canonical evidence stays server-side. These IDs select emphasis only;
 * they can never remove mandatory support, alternatives or qualifications. */
export function investigationMaterial(
  index: EvidenceIndex,
  bundles: InvestigationBundle[],
  focalId: string,
) {
  const development = index.developments.find((d) => d.id === focalId);
  if (!development) throw new Error("Unknown focal development");
  const relevant = bundles.filter((b) => b.option.developmentId === focalId);
  const assessmentBundle = relevant.find(
    (b) => b.option.purpose === "inspect-challenge",
  );
  const assessment = (
    assessmentBundle?.payload.assessments as
      { claimId: string; assessment: HypothesisAssessment }[] | undefined
  )?.find((a) => a.claimId === focalId)?.assessment;
  const answers = [
    ...new Map(
      relevant.flatMap(investigationAnswers).map((q) => [q.question.intent, q]),
    ).values(),
  ];
  const support =
    assessment?.supportingEvidence.map((e) => ({
      id: `support:${e.code}`,
      evidence: e,
    })) ?? [];
  const challenges = [
    ...(assessment
      ? [
          ...assessment.limitingEvidence,
          ...assessment.contradictoryEvidence,
        ].map((e) => ({
          id: `challenge:${e.code}`,
          text: e.description,
          eventIds: e.eventIds,
        }))
      : []),
    ...answers.flatMap((q) =>
      q.qualifications.map((text) => ({
        id: `qualification:${investigatorDigest(text).slice(0, 24)}`,
        text,
        eventIds: [] as string[],
      })),
    ),
  ];
  const complete =
    !!assessment &&
    assessmentBundle?.coverage.bundle === "complete" &&
    assessment.verificationChecks.every((c) => c.passed) &&
    ["confirmed-observation", "supported-interpretation"].includes(
      assessment.verificationStatus,
    ) &&
    development.questions.every((q) =>
      answers.some((a) => a.question.intent === q.intent),
    );
  const unresolved =
    relevant.some(
      (b) =>
        b.option.tool === "guided_question" &&
        (b.coverage.bundle !== "complete" ||
          b.coverage.missingInformation.length > 0),
    ) || answers.some((q) => q.availability === "unavailable");
  return {
    development,
    assessment,
    answers,
    support,
    challenges: [...new Map(challenges.map((c) => [c.id, c])).values()],
    complete,
    unresolved,
    interpretations: answers.flatMap(
      (q) => q.comparison?.interpretations ?? [],
    ),
  };
}

export function validateInvestigationRead(
  index: EvidenceIndex,
  bundles: InvestigationBundle[],
  trace: InvestigationTrace,
  raw: unknown,
) {
  const action = investigationReadSchema.parse(raw);
  const focal = index.developments.find((d) => d.id === action.focalId);
  const option = index.options.find((o) => o.id === action.optionId);
  if (
    action.indexId !== index.id ||
    !focal ||
    !option ||
    option.unavailable ||
    option.purpose !== action.purpose ||
    (option.developmentId !== null && option.developmentId !== focal.id) ||
    (option.team !== null && option.team !== focal.team) ||
    bundles.some((b) => b.option.id === option.id) ||
    trace.some((t) => t.action.optionId === option.id)
  )
    throw new Error("Invalid, unavailable or duplicate evidence selection");
  const known = focal.questions.flatMap((q) =>
    q.interpretations.map((i) => i.id),
  );
  if (
    !unique(action.interpretationIds) ||
    action.interpretationIds.some((i) => !known.includes(i))
  )
    throw new Error("Unregistered competing interpretation");
  // Whole surge answers contain these narrower questions; repeating them is a no-op.
  if (
    option.intent &&
    bundles
      .filter((b) => b.option.developmentId === focal.id)
      .flatMap(investigationAnswers)
      .some((q) => q.question.intent === option.intent)
  )
    throw new Error("Evidence already supplied by a complete question bundle");
  if (option.tool === "compare_shot_routes") {
    const known = bundles.flatMap((bundle) => [
      ...(bundle.payload.routes ? [bundle.payload.routes as ShotRoutes] : []),
      ...investigationAnswers(bundle).flatMap((q) =>
        q.comparison ? [q.comparison.routes] : [],
      ),
    ]);
    const windows = option.windowRefs.map((ref) => index.windows[ref]);
    if (
      known.some(
        (routes) =>
          routes.team === option.team &&
          [routes.previous.window, routes.current.window].every(
            (w, i) =>
              w.start === windows[i]?.start &&
              w.end === windows[i]?.end &&
              w.period === windows[i]?.period,
          ),
      )
    )
      throw new Error("Route aggregates already supplied by a question bundle");
  }
  return action;
}

export function prepareInvestigation(
  match: MatchData,
  cutoff: number,
  context: DiscoveryContext = {},
) {
  const baseline = runEditorialBaseline(match, cutoff, "B2", context, 1);
  const reader = createEvidenceReader(match, cutoff, context);
  // Supply all successful B2 reads, not a deliberately weakened initial answer.
  const initial = baseline.decision.trace
    .filter((t) => t.outcome === "read")
    .map((t) =>
      reader.read({ indexId: reader.index.id, optionId: t.optionId }),
    );
  return { baseline, reader, initial };
}

/** Fresh replay of selections, not a replay of B2's editorial choice. The model
 * may select another eligible development, but cannot supply its facts. */
export function verifyInvestigation(
  match: MatchData,
  cutoff: number,
  context: DiscoveryContext,
  receipt: {
    version: string;
    indexId: string;
    initialDigest: string;
    trace: InvestigationTrace;
    plan: InvestigationPlan;
  },
) {
  if (receipt.version !== INVESTIGATOR_VERSION || receipt.trace.length > 2)
    throw new Error("Invalid investigation version or rounds");
  const { reader, baseline, initial } = prepareInvestigation(
    match,
    cutoff,
    context,
  );
  const index = reader.index;
  if (
    receipt.indexId !== index.id ||
    receipt.initialDigest !== investigatorDigest(initial)
  )
    throw new Error("Stale investigation identity");
  const bundles = [...initial];
  const replayed: InvestigationTrace = [];
  for (const entry of receipt.trace) {
    const action = validateInvestigationRead(
      index,
      bundles,
      replayed,
      entry.action,
    );
    const bundle = reader.read({
      indexId: index.id,
      optionId: action.optionId,
    });
    if (
      investigatorDigest(investigationTraceEntry(action, bundle)) !==
      investigatorDigest(entry)
    )
      throw new Error("Evidence replay mismatch");
    bundles.push(bundle);
    replayed.push(investigationTraceEntry(action, bundle));
  }
  const plan = investigationPlanSchema.parse(receipt.plan);
  if (
    plan.indexId !== index.id ||
    !unique(plan.interpretationIds) ||
    !unique(plan.supportIds) ||
    !unique(plan.challengeIds)
  )
    throw new Error("Invalid plan identity or repeated references");
  const incompleteCatalogue =
    index.coverage.developments.omitted > 0 ||
    index.coverage.options.omitted > 0;
  if (!plan.focalId) {
    if (
      plan.interpretationIds.length ||
      plan.supportIds.length ||
      plan.challengeIds.length ||
      plan.stop === "sufficient" ||
      baseline.stories.length ||
      (incompleteCatalogue && plan.stop !== "unresolved") ||
      plan.stop !== baseline.decision.stop.reason
    )
      throw new Error("Premature abstention");
    return {
      stories: [],
      answers: [],
      material: null,
      plan,
      score: index.score,
    };
  }
  const material = investigationMaterial(index, bundles, plan.focalId);
  const score = index.developments.find(state);
  if (
    !editorialPriority(index, material.development).eligible ||
    (score && score.id !== plan.focalId)
  )
    throw new Error("Ineligible lead or omitted score priority");
  if (!material.complete)
    throw new Error("Premature stop: mandatory evidence missing");
  const unresolved = material.unresolved || incompleteCatalogue;
  if (
    (unresolved && plan.stop !== "unresolved") ||
    (!unresolved && plan.stop === "unresolved")
  )
    throw new Error("Unsupported stopping claim");
  if (
    plan.interpretationIds.some(
      (id) => !material.interpretations.some((i) => i.id === id),
    ) ||
    plan.supportIds.some((id) => !material.support.some((s) => s.id === id)) ||
    plan.challengeIds.some(
      (id) => !material.challenges.some((c) => c.id === id),
    ) ||
    (material.support.length > 0 && !plan.supportIds.length) ||
    (material.challenges.length > 0 && !plan.challengeIds.length)
  )
    throw new Error(
      "Unsupported interpretation, support or challenge selection",
    );
  const candidates = observe(match, cutoff, "fan", {}, { unranked: true });
  const candidate = candidates.find((c) => c.id === plan.focalId)!;
  validateEditorialPlan(
    {
      decision: "publish",
      stories: [
        {
          claimId: plan.focalId,
          form: context.mode === "analyst" ? "detail" : "brief",
          emphasis: claimEmphasis[candidate.category],
        },
      ],
    },
    candidates,
    new Set([plan.focalId]),
  );
  if (
    investigatorDigest(evaluateHypothesis(match, cutoff, candidate)) !==
    investigatorDigest(material.assessment)
  )
    throw new Error("Independent assessment mismatch");
  return {
    plan,
    material,
    score: index.score,
    answers: material.answers,
    stories: [
      packageStory(
        candidate,
        match,
        cutoff,
        context.mode ?? "fan",
        "offline",
        context.mode === "analyst" ? "detail" : "brief",
        claimEmphasis[candidate.category],
      ),
    ],
  };
}
