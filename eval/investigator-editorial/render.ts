import { matchClock } from "../../src/lib/sources/model";
import type { MatchData } from "../../src/lib/sources/model";
import type { DiscoveryContext } from "../../src/lib/ai/director/discovery";
import {
  investigationMaterial,
  investigationPlanSchema,
  investigatorDigest,
  prepareInvestigation,
  verifyInvestigation,
  type InvestigationPlan,
} from "../../src/lib/ai/director/investigator-contract";
import {
  presentQuestion,
  questionText,
} from "../../src/lib/ai/director/questions";
import { presentStory, type ExplanationStyle } from "../../src/lib/explanation";

export const RENDER_VERSION = "offline-editorial-1";
export const STYLES = ["plain", "fan", "analysis"] as const;
export const LENGTHS = ["brief", "detail"] as const;
export type Length = (typeof LENGTHS)[number];
// Whole explanations, including mandatory evidence. Overflow blocks BOTH arms;
// no truncation, hidden appendix, smaller B2 allowance, or model prose repair.
export const WORD_LIMITS: Record<Length, number> = {
  brief: 1800,
  detail: 2600,
};
type Replay = ReturnType<typeof verifyInvestigation>;
type Verified = {
  stories: Replay["stories"];
  answers: Replay["answers"];
  material: Replay["material"];
  plan: InvestigationPlan;
  score: Replay["score"];
};
type Material = NonNullable<Verified["material"]>;
type Receipt = Parameters<typeof verifyInvestigation>[3];
export type Submission = Omit<Receipt, "plan"> & { plan: unknown };
export type Block = { role: string; text: string };
export type Explanation = {
  style: ExplanationStyle;
  length: Length;
  focalId: string | null;
  headline: string;
  stop: InvestigationPlan["stop"];
  emphasis: Block[];
  mandatory: Block[];
  words: number;
  limit: number;
};
export const wordCount = (s: string) =>
  s.trim().split(/\s+/u).filter(Boolean).length;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Give B2 the same emphasis surface, preserving its existing foreground policy.
 * Supported alternatives and material counter-evidence are never hidden from it. */
function baselinePlan(
  prepared: ReturnType<typeof prepareInvestigation>,
  material: Material | null,
): InvestigationPlan {
  const b = prepared.baseline;
  const foreground = b.decision.selected[0]?.foreground ?? [];
  const challengeForQuestion: Record<string, string[]> = {
    "opponent-improvement": ["opponent-shot-response"],
    "fading-activity": ["latest-rate-not-sustained"],
    "chance-quality": [
      "shot-volume-without-xg-increase",
      "chance-quality-unavailable",
      "chance-quality-incomplete",
    ],
  };
  const preferredChallenges = foreground.flatMap((intent) => [
    ...(challengeForQuestion[intent] ?? [])
      .map((code) => `challenge:${code}`)
      .filter((id) => material?.challenges.some((c) => c.id === id)),
    ...(material?.answers
      .filter((q) => q.question.intent === intent)
      .flatMap((q) => q.qualifications)
      .map((text) => material.challenges.find((c) => c.text === text)?.id)
      .filter((id): id is string => !!id) ?? []),
  ]);
  return {
    indexId: prepared.reader.index.id,
    focalId: material?.development.id ?? null,
    supportIds: material?.support.slice(0, 1).map((s) => s.id) ?? [],
    challengeIds: [
      ...new Set([
        ...preferredChallenges,
        ...(material?.assessment?.contradictoryEvidence.map(
          (e) => `challenge:${e.code}`,
        ) ?? []),
        ...(material?.challenges.map((c) => c.id) ?? []),
      ]),
    ].slice(0, 1),
    interpretationIds: [...(material?.interpretations ?? [])]
      .sort(
        (a, b) =>
          Number(b.status === "supported") - Number(a.status === "supported"),
      )
      .map((i) => i.id),
    stop: b.decision.stop.reason,
  };
}

/** Internal only: every factual string comes from fresh canonical verification. */
function render(
  match: MatchData,
  verified: Verified,
  plan: InvestigationPlan,
  style: ExplanationStyle,
  length: Length,
  foreground: string[] = [],
): Explanation {
  const material = verified.material;
  const story = verified.stories[0];
  const wording = story ? presentStory(story, match, style) : null;
  const emphasis: Block[] = [];
  const mandatory: Block[] = [];
  const add = (role: string, text: string) => mandatory.push({ role, text });
  add(
    "Recorded score",
    `${match.teams.harbor.short} ${verified.score.harbor}–${verified.score.riverside} ${match.teams.riverside.short}.`,
  );
  if (story) add("Evidence cutoff", matchClock(match, story.cutoff));
  if (wording && material) {
    // The first interpretation is explicitly the editorial focus, not a new verdict.
    // Its canonical status stays attached even when a limited alternative is chosen.
    for (const [i, id] of plan.interpretationIds.entries()) {
      const item = material.interpretations.find((x) => x.id === id)!;
      emphasis.push({
        role: i === 0 ? "Interpretation in focus" : "Also considered",
        text: `${item.status}: ${questionText(item.text, style)}`,
      });
    }
    for (const id of plan.supportIds)
      emphasis.push({
        role: "Evidence in focus",
        text: questionText(
          material.support.find((s) => s.id === id)!.evidence.description,
          style,
        ),
      });
    for (const id of plan.challengeIds)
      emphasis.push({
        role: "Counter-evidence in focus",
        text: questionText(
          material.challenges.find((c) => c.id === id)!.text,
          style,
        ),
      });
    add("Observation", wording.explanation);
    add("Why it matters", wording.why);
    if (wording.watch) add("What to watch", wording.watch);
    for (const q of wording.qualifications) add("Qualification", q.text);
    // Retain ALL support, limits, contradictions and unknowns, even codes that the
    // public presentation does not yet have special style wording for.
    for (const s of material.support)
      add("Supporting evidence", questionText(s.evidence.description, style));
    for (const c of material.challenges)
      add("Qualification", questionText(c.text, style));
    for (const missing of material.assessment!.missingInformation)
      add("Missing information", questionText(missing, style));
    const answers = [...verified.answers].sort((a, b) => {
      const rank = (intent: string) =>
        foreground.includes(intent)
          ? foreground.indexOf(intent)
          : foreground.length;
      return rank(a.question.intent) - rank(b.question.intent);
    });
    for (const q of answers) {
      const text = presentQuestion(q, match, style);
      add("Recorded comparison", text.answer);
      add("Measurements", text.measurement);
      add("Comparison windows", text.windows);
      for (const qualification of text.qualifications)
        add("Qualification", qualification);
    }
    for (const i of material.interpretations)
      add(
        "Competing interpretation",
        `${i.status}: ${questionText(i.text, style)}`,
      );
    // Detail adds measured values, never a different selection or less evidence.
    if (length === "detail")
      for (const m of material.assessment!.measurements)
        add(
          "Measurement detail",
          `${m.label}: ${m.value} ${m.unit}${m.window ? ` (${m.window})` : ""}.`,
        );
  } else
    add(
      "Observation",
      "No verified focal development is available in this bounded evidence catalogue.",
    );
  add(
    "Investigation boundary",
    plan.stop === "unresolved"
      ? "The available evidence leaves unresolved questions. Further conclusions are not established."
      : plan.stop === "no-material-gain"
        ? "The selection stops with no further material gain claimed from the available bounded catalogue."
        : "The mandatory evidence for this selection is complete within the available bounded catalogue.",
  );
  // Shared question bundles repeat identical caveats/windows. Display each exact
  // role/text pair once; every distinct qualification remains visible in full.
  const complete = mandatory.filter(
    (b, i) =>
      mandatory.findIndex(
        (other) => other.role === b.role && other.text === b.text,
      ) === i,
  );
  const headline = wording?.headline ?? "No focal development";
  const words = wordCount(
    [
      headline,
      ...emphasis.map((b) => `${b.role} ${b.text}`),
      ...complete.map((b) => `${b.role} ${b.text}`),
    ].join(" "),
  );
  return {
    style,
    length,
    focalId: plan.focalId,
    stop: plan.stop,
    headline,
    emphasis,
    mandatory: complete,
    words,
    limit: WORD_LIMITS[length],
  };
}

const bag = (blocks: Block[], roles = true) =>
  [
    ...new Set(blocks.map((b) => (roles ? `${b.role}: ${b.text}` : b.text))),
  ].sort();
const display = (e: Explanation) => [e.headline, e.emphasis, e.mandatory];
/** Text/role comparisons deliberately ignore IDs. No automatic preference claim. */
export function compareExplanations(a: Explanation, b: Explanation) {
  const identical = same(display(a), display(b));
  const sameInformation = same(
    bag(
      [
        ...a.emphasis,
        ...a.mandatory.filter((b) => b.role !== "Investigation boundary"),
      ],
      false,
    ),
    bag(
      [
        ...b.emphasis,
        ...b.mandatory.filter((b) => b.role !== "Investigation boundary"),
      ],
      false,
    ),
  );
  const sameEmphasis = same(bag(a.emphasis), bag(b.emphasis));
  return {
    kind: identical
      ? "identical"
      : a.focalId !== b.focalId
        ? "focal-development-change"
        : a.stop !== b.stop
          ? "stopping-change"
          : !sameInformation
            ? "information-change"
            : !sameEmphasis
              ? "editorial-emphasis-change"
              : "reordered-only",
    identical,
    sameInformation,
    sameEmphasis,
    humanPreference: null,
    improvementEstablished: false,
  };
}

/** Offline entry: never imports the investigator runner, providers, controls or Redis.
 * Receipt flags and caller-rendered stories are not trusted. Rebuild everything. */
export function evaluateEditorial(
  match: MatchData,
  cutoff: number,
  context: DiscoveryContext,
  submission: Submission,
  provenance: "mock" | "recorded-model",
  style: ExplanationStyle,
  length: Length,
) {
  if (!STYLES.includes(style) || !LENGTHS.includes(length))
    throw new Error("Unknown presentation contract");
  const p = prepareInvestigation(match, cutoff, context);
  const focal = p.baseline.stories[0]?.storyId;
  const material = focal
    ? investigationMaterial(p.reader.index, p.initial, focal)
    : null;
  const b2Plan = baselinePlan(p, material);
  const baselineVerified = {
    ...p.baseline,
    material,
    plan: b2Plan,
    score: p.reader.index.score,
  };
  let verified: Verified = baselineVerified;
  let verification: "passed" | "rejected" = "rejected";
  let rejectionReason: string | null = null;
  try {
    verified = verifyInvestigation(match, cutoff, context, {
      ...submission,
      plan: investigationPlanSchema.parse(submission.plan),
    });
    verification = "passed";
  } catch (error) {
    // Diagnostic data stays private and never enters factual presentation.
    rejectionReason =
      error instanceof Error ? error.message : "Canonical verification failed";
  }
  const foreground = p.baseline.decision.selected[0]?.foreground ?? [];
  const b2 = render(match, baselineVerified, b2Plan, style, length, foreground);
  const investigator =
    verification === "passed"
      ? render(
          match,
          verified,
          verified.plan,
          style,
          length,
          verified.plan.focalId === focal ? foreground : [],
        )
      : structuredClone(b2);
  const withinLimit = [b2, investigator].every((e) => e.words <= e.limit);
  return {
    version: RENDER_VERSION,
    status: withinLimit ? ("reviewable" as const) : ("blocked-length" as const),
    b2,
    investigator,
    comparison: compareExplanations(b2, investigator),
    audit: {
      provenance,
      exactSubmittedDecision: structuredClone(submission),
      actualModelSelectedDecisions:
        provenance === "recorded-model" ? structuredClone(submission) : null,
      verification: {
        result: verification,
        rejectionReason,
        selectedAssessmentChecks:
          verification === "passed"
            ? (verified.material?.assessment?.verificationChecks ?? [])
            : null,
        method:
          "fresh catalogue, evidence trace and independent assessment replay",
        rejectedSelectionPublished: false,
      },
      disposition:
        verification === "passed" ? "verified-selection" : "B2-fallback",
      selectedPlan: verification === "passed" ? verified.plan : null,
      appliedPlan: verified.plan,
      b2Decision: p.baseline.decision,
      b2PresentationPlan: b2Plan,
      // Full input/material supports event, measurement and limitation audits.
      fixture: { match, cutoff, context },
      inputDigest: investigatorDigest({ match, cutoff, context }),
      initialEvidence: p.initial,
      verifiedMaterial: verified.material,
      baselineMaterial: material,
      baselineOutput: {
        stories: p.baseline.stories,
        answers: p.baseline.answers,
      },
      verifiedOutput: { stories: verified.stories, answers: verified.answers },
      stopVerification:
        "Coverage/plan consistency only; voluntary model stopping and transport accounting require the original runner receipt.",
      modelUsage: null,
      modelCostUsd: null,
      paidCalls: 0,
      newFrozenCandidateRequired: true,
    },
  };
}
export type Evaluation = ReturnType<typeof evaluateEditorial>;
