import assert from "node:assert/strict";
import { intelligenceCases } from "../intelligence-cases";
import { loadCases as historicalCases } from "../foundry-study/cases";
import { observe } from "../../src/lib/ai/director/observer";
import {
  questionEvidence,
  presentQuestion,
  type QuestionIntent,
} from "../../src/lib/ai/director/questions";
import {
  deterministicQuestion,
  type QuestionResult,
} from "../../src/lib/ai/director/question-runner";
import { validIdentity } from "../../src/lib/ai/director/hypothesis";
import { digest } from "./ledger";

/** Declared before any provider results. Historical fixtures, new typed questions.
 * No replacement cases or post-result selection. All use the first canonical shot-increase story. */
export const DECLARATIONS: {
  id: string;
  fixture: number;
  intent: QuestionIntent;
}[] = [
  { id: "unavailable-quality", fixture: 1, intent: "chance-quality" },
  { id: "misleading-quality", fixture: 0, intent: "chance-quality" },
  { id: "opponent-response", fixture: -1, intent: "opponent-improvement" },
  { id: "fading-increase", fixture: 2, intent: "fading-activity" },
  { id: "unfamiliar-opponent", fixture: 4, intent: "opponent-improvement" },
  { id: "unfamiliar-quality", fixture: 4, intent: "chance-quality" },
];
export function loadCases() {
  const historical = historicalCases();
  return DECLARATIONS.map((d) => {
    const source =
      d.fixture === -1
        ? {
            ...intelligenceCases().find((c) => c.id === "opponent-matches")!,
            regeneration:
              "existing explicit opponent-matches diagnostic from eval/intelligence-cases.ts; events and source metadata unchanged",
          }
        : historical[d.fixture];
    const story = observe(source.match, source.cutoff).find(
      (s) =>
        s.category === "activity-change" &&
        s.team === "harbor" &&
        s.statistics[0].label === "shots",
    )!;
    assert(story);
    const question = { intent: d.intent, storyId: story.id };
    const baseline = deterministicQuestion(
      source.match,
      source.cutoff,
      question,
    );
    return {
      id: d.id,
      fixture: source.id,
      cutoff: source.cutoff,
      match: source.match,
      digest: digest(JSON.stringify(source.match)),
      question,
      baseline,
      eligibility:
        baseline.evidence.availability === "available" ? "eligible" : "no-call",
      regeneration: source.regeneration,
    };
  });
}
export type GuidedCase = ReturnType<typeof loadCases>[number];
/** Acceptance uses fresh canonical reconstruction AND direct event arithmetic. */
export function verifyCase(c: GuidedCase, result: QuestionResult) {
  assert.deepEqual(
    result.evidence,
    questionEvidence(c.match, c.cutoff, c.question),
  );
  assert.equal(result.evidence.question.intent, c.question.intent);
  for (const m of result.evidence.measurements) {
    const w = result.evidence.windows.find((w) => w.id === m.window)!;
    const shots = c.match.events.filter(
      (e) =>
        e.team === m.team &&
        e.type === "shot" &&
        e.period === w.period &&
        e.time > w.start &&
        e.time <= w.end,
    );
    const total = shots.reduce((s, e) => s + (e.xg ?? 0), 0);
    const expected =
      m.metric === "source xG total"
        ? total
        : m.metric === "source xG per shot"
          ? shots.length
            ? total / shots.length
            : null
          : m.metric === "shots with source xG"
            ? shots.filter((e) => e.xg !== undefined).length
            : shots.length;
    assert.equal(m.value, expected);
    for (const id of m.eventIds)
      assert(shots.some((e) => e.id === id && validIdentity(c.match, e)));
  }
  for (const s of result.supplements)
    for (const id of s.eventIds)
      assert(
        c.match.events.some(
          (e) => e.id === id && e.time <= c.cutoff && validIdentity(c.match, e),
        ),
      );
  const renderings = {
    plain: presentQuestion(result.evidence, c.match, "plain"),
    analysis: presentQuestion(result.evidence, c.match, "analysis"),
  };
  for (const text of Object.values(renderings)) {
    assert(text.answer && text.measurement && text.windows);
    assert.deepEqual(text.qualifications, [
      ...new Set(result.evidence.qualifications),
    ]);
  }
  return {
    canonicalEvidenceIdentical: true,
    independentArithmetic: true,
    allReferencesVisible: true,
    renderings,
  };
}
