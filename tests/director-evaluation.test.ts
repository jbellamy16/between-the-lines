import { afterAll, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { observe } from "../src/lib/ai/director/observer";
import { matchInsights } from "../src/lib/sources/intelligence";
import { packageStory } from "../src/lib/ai/director/story";
import type { MatchData } from "../src/lib/sources/model";
const rows: unknown[] = [];
function evaluate(match: MatchData, time: number, mode: "fan" | "analyst") {
  const start = performance.now(),
    candidates = observe(match, time, mode),
    baseline = matchInsights(match, time);
  for (const c of candidates) {
    expect(
      c.evidenceIds.every((id) =>
        match.events.some((e) => e.id === id && e.time <= time),
      ),
    ).toBe(true);
    const prefix = {
      ...match,
      events: match.events.filter((e) => e.time <= time),
    };
    expect(observe(prefix, time, mode).find((x) => x.id === c.id)).toEqual(c);
    const story = packageStory(c, match, time, mode, "offline");
    expect(story.validation).toBe("verified");
    expect(story.coordinates.length).toBeLessThanOrEqual(
      story.evidenceEventIds.length,
    );
  }
  rows.push({
    match: match.id,
    time,
    mode,
    baseline: baseline.map((c) => ({ id: c.id, text: c.explanation })),
    directorCandidates: candidates.map((c) => ({
      id: c.id,
      category: c.category,
      text: mode === "fan" ? c.brief : c.detail,
      evidence: c.evidenceIds,
    })),
    abstained: !candidates.length,
    latencyMs: performance.now() - start,
    modelRequests: 0,
    costUsd: 0,
    humanReview: {
      factualAccuracy: null,
      evidenceConsistency: null,
      relevance: null,
      narrativeQuality: null,
      novelty: null,
      repetition: null,
      audienceUsefulness: null,
      abstentionQuality: null,
      preferableToBaseline: null,
    },
  });
}
for (const scenario of ["pressure", "substitution", "quiet"] as const)
  for (const seed of [202632, 17, 8911, 46003])
    for (const mode of ["fan", "analyst"] as const)
      it(`${scenario} unseen seed ${seed} ${mode}: prefix invariance`, () => {
        const match = new SyntheticMatchSource().read(scenario, {
          seed,
          profile: seed === 202632 ? "demo" : "balanced",
        });
        for (const time of [0, 600, 1800, 2699, 2700, 3600, 4200, 5400])
          evaluate(match, time, mode);
      });
it("an empty event stream abstains and cannot manufacture an observation", () => {
  const match = new SyntheticMatchSource().read("quiet");
  match.events = [];
  expect(observe(match, 4200)).toEqual([]);
});
afterAll(() => {
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/director-evaluation.json",
    JSON.stringify(
      {
        kind: "deterministic observer and contract evaluation; no live AI quality claim",
        caseCount: rows.length,
        liveAiEvaluated: false,
        improvementRate: null,
        rows,
      },
      null,
      2,
    ),
  );
  const match = new SyntheticMatchSource().read("pressure");
  writeFileSync(
    "artifacts/broadcast-story.json",
    JSON.stringify(
      packageStory(observe(match, 4200)[0], match, 4200, "fan", "offline"),
      null,
      2,
    ),
  );
});
