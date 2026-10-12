import type { MatchData } from "../../src/lib/sources/model";
import type { QuestionEvidence } from "../../src/lib/ai/director/questions";
import type { HypothesisAssessment } from "../../src/lib/ai/director/hypothesis";
import type { QuestionResult } from "../../src/lib/ai/director/question-runner";
import { referenceFacts, referenceEventIds, type Case } from "./cases";

const aliases: Record<string, string> = {
  "current-count": "own-current",
  "previous-count": "own-previous",
  "current-first-half-count": "early-count",
  "current-second-half-count": "late-count",
  "high-recovery-linked-shots": "current:linkedShots",
  "opponent-current-shots": "opponent-current",
  "previous:shots": "own-previous",
  "current:shots": "own-current",
  "previous-shots": "own-previous",
  "current-shots": "own-current",
  "current:early": "early-count",
  "current:late": "late-count",
};
const key = (id: string) => aliases[id] ?? id;
export type Fact = { id: string; value: number | null; eventIds: string[] };
export function factsFor(
  answers: QuestionEvidence[],
  assessment?: HypothesisAssessment,
): Fact[] {
  const values = [
    ...answers.flatMap((a) => a.measurements),
    ...(assessment?.measurements.map((m) => ({
      id: m.key,
      value: m.value,
      eventIds: m.eventIds,
    })) ?? []),
  ];
  // Preserve conflicting repetitions: deduplicate identical assertions, not just IDs.
  return [
    ...new Map(
      values
        .map(
          (f) =>
            [
              {
                id: key(f.id),
                value: f.value === null ? null : Number(f.value.toFixed(9)),
              },
              f,
            ] as const,
        )
        .map(([identity, f]) => [
          JSON.stringify(identity),
          { ...f, id: identity.id },
        ]),
    ).values(),
  ];
}
const equal = (a: number | null, b: number | null) =>
  a === b || (a !== null && b !== null && Math.abs(a - b) < 1e-9);
export function score(
  c: Case,
  match: MatchData,
  facts: Fact[],
  answers: QuestionEvidence[],
  baselineFacts: Fact[],
  result?: QuestionResult,
  attemptedQueries?: Pick<QuestionResult["trace"][number], "tool" | "query">[],
) {
  const gold = referenceFacts(c);
  gold["count-change"] = c.shots.length - c.previousShots.length;
  gold["current-shot-goal-outcomes"] = 0;
  const expected = Object.fromEntries(
    Object.entries(gold).map(([id, value]) => [key(id), value]),
  );
  const valid = (f: Fact) =>
    Object.hasOwn(expected, f.id) && equal(f.value, expected[f.id]);
  const incorrectFacts = facts.filter((f) => !valid(f));
  const incorrectCitations = facts
    .filter(
      (f) =>
        JSON.stringify([...new Set(f.eventIds)].sort()) !==
        JSON.stringify(referenceEventIds(c, f.id).sort()),
    )
    .map((f) => f.id);
  const comparison = answers.find((a) => a.comparison)?.comparison;
  const incorrectInterpretations =
    comparison?.interpretations.filter((i) => {
      const index = [
        "repeated-route",
        "concentrated-attempts",
        "both-teams",
      ].indexOf(i.id);
      return !c.statuses || i.status !== c.statuses[index];
    }) ?? [];
  const direction = (a: number, b: number) =>
    a === b ? "level" : b > a ? "higher" : "lower";
  const guided = answers.filter((a) => !a.comparison);
  const incorrectVerdicts = guided.flatMap((a) => {
    const expectedVerdict =
      a.question.intent === "chance-quality"
        ? c.missing === "xg"
          ? "unknown"
          : "level"
        : a.question.intent === "opponent-improvement"
          ? direction(gold["opponent-previous"]!, gold["opponent-current"]!)
          : direction(gold["early-count"]!, gold["late-count"]!);
    return a.verdict === expectedVerdict
      ? []
      : [
          {
            intent: a.question.intent,
            actual: a.verdict,
            expected: expectedVerdict,
          },
        ];
  });
  const cited = [
    ...facts.flatMap((f) => f.eventIds),
    ...answers.flatMap((a) => a.eventIds),
    ...(result?.supplements.flatMap((s) => s.eventIds) ?? []),
  ];
  const invalidReferences = [...new Set(cited)].filter((id) => {
    const e = match.events.find((e) => e.id === id);
    return (
      !e ||
      e.time > 1800 ||
      e.period !== "1H" ||
      e.matchId !== match.id ||
      e.source.eventId !== id ||
      e.source.teamId !== e.teamId
    );
  });
  const present = new Set(facts.filter(valid).map((f) => f.id));
  const old = new Set(baselineFacts.map((f) => f.id));
  const usefulPresent = c.useful.filter((id) => present.has(key(id)));
  const additionalUseful = usefulPresent.filter((id) => !old.has(key(id)));
  const qualifications = answers
    .flatMap((a) => [...a.qualifications, ...(a.reason ? [a.reason] : [])])
    .join(" ");
  const missingCaveats: string[] = [];
  if (
    c.statuses &&
    !qualifications.includes("not overall performance or control")
  )
    missingCaveats.push("descriptive-only");
  if (
    c.missing === "xg" &&
    !qualifications.includes("Missing ratings are unknown")
  )
    missingCaveats.push("missing-xg");
  if (
    c.statuses &&
    c.shots.filter((s) => s[0] > 1350).length <
      c.shots.filter((s) => s[0] <= 1350).length &&
    !qualifications.includes("not sustained")
  )
    missingCaveats.push("fading-activity");
  if (comparison && !qualifications.includes("synthetic"))
    missingCaveats.push("synthetic-possessions");
  if (
    comparison &&
    c.statuses?.[0] === "unresolved" &&
    !qualifications.includes("unavailable") &&
    !qualifications.includes("incomplete")
  )
    missingCaveats.push("incomplete-route");
  const followups = (attemptedQueries ?? result?.trace ?? []).filter(
    (t) => t.tool !== "get_team_statistics",
  );
  const relevant = followups.filter(
    (t) =>
      t.query.team === "harbor" &&
      t.query.start === 900 &&
      t.query.end === 1800 &&
      (t.tool === "compare_shot_routes" ||
        (t.tool === "get_recorded_sequence" &&
          c.relevantAnchors.some(
            (time) =>
              match.events.find((e) => e.id === t.query.eventId)?.time === time,
          ))),
  );
  const assertions =
    facts.length + guided.length + (comparison?.interpretations.length ?? 0);
  return {
    assertions,
    correctAssertions:
      assertions -
      incorrectFacts.length -
      incorrectInterpretations.length -
      incorrectVerdicts.length,
    factualAccuracy: assertions
      ? (assertions -
          incorrectFacts.length -
          incorrectInterpretations.length -
          incorrectVerdicts.length) /
        assertions
      : null,
    incorrectFacts,
    incorrectVerdicts,
    incorrectInterpretations: incorrectInterpretations.map((i) => i.id),
    invalidReferences,
    incorrectCitations,
    missingCaveats,
    unsupportedPublishedConclusions:
      incorrectInterpretations.length + incorrectVerdicts.length,
    usefulEvidence: {
      available: c.useful.length,
      covered: usefulPresent,
      additionalVsA: additionalUseful,
    },
    investigationRelevance: {
      relevant: relevant.length,
      attempted: followups.length,
      precision: followups.length ? relevant.length / followups.length : null,
    },
  };
}
