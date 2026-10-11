import { describe, expect, it } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { observe } from "../src/lib/ai/director/observer";
import {
  distinctEditorialStories,
  editorialGroup,
} from "../src/lib/ai/director/editorial";
import { validateEditorialPlan } from "../src/lib/ai/director/story";
import { createInvestigation } from "../src/lib/ai/director/tools";

const match = new SyntheticMatchSource().read("pressure");
describe("editorial evidence and presentation regressions", () => {
  it("exposes incompatible evidence pairs while still rejecting their combined publication", () => {
    const session = createInvestigation(match, 3804, "analyst");
    const result = session.execute("get_match_events", {
      matchId: match.id,
      start: 2700,
      end: 3804,
      team: null,
      playerId: null,
      eventId: null,
    });
    const shots = result.claims.find(
      (c) =>
        c.category === "activity-change" && c.statistics[0].label === "shots",
    )!;
    const duplicate = session
      .execute("compare_time_windows", {
        matchId: match.id,
        start: 3252,
        end: 3804,
        team: "harbor",
        playerId: null,
        eventId: null,
      })
      .claims.find(
        (c) => c.category === "window-comparison" && c.id.endsWith(":shot"),
      )!;
    expect(duplicate.incompatibleClaimIds).toContain(shots.id);
    expect(() =>
      validateEditorialPlan(
        {
          decision: "publish",
          stories: [shots, duplicate].map((c) => ({
            claimId: c.id,
            form: "detail",
            emphasis: "comparison",
          })),
        },
        session.candidates,
        new Set(session.claims.keys()),
      ),
    ).toThrow("Overlapping stories");
  });
  it("surfaces the early-half shot and recovery changes over equal complete windows", () => {
    const candidates = observe(match, 3804);
    for (const label of ["shots", "ball wins in the attacking third"]) {
      const claim = candidates.find(
        (c) =>
          c.category === "activity-change" && c.statistics[0].label === label,
      )!;
      expect(claim).toBeDefined();
      expect(claim.statistics.map((s) => s.value)).toEqual([4, 0]);
      expect(
        claim.statistics.every((s) => s.unit === "events / 552 seconds"),
      ).toBe(true);
      expect(claim.detail).toContain("54:12–63:24");
      expect(claim.detail).toContain("45:00–54:12");
      expect(
        claim.evidenceIds.every((id) =>
          match.events.some(
            (e) => e.id === id && e.time > 2700 && e.time <= 3804,
          ),
        ),
      ).toBe(true);
    }
    expect(candidates[0].category).toBe("activity-change");
    const unsupported = structuredClone(match);
    unsupported.capabilities.ballRecoveries = false;
    expect(
      observe(unsupported, 3804).some(
        (c) => c.statistics[0]?.label === "ball wins in the attacking third",
      ),
    ).toBe(false);
    expect(
      observe(match, 2999).some((c) => c.category === "activity-change"),
    ).toBe(false);
  });
  it("identifies each shot by its recorded player and time rather than an ambiguous reference", () => {
    const sequence = observe(match, 3804).find(
      (c) => c.category === "shot-sequence",
    )!;
    const shot = match.events.find(
      (e) => e.id === sequence.evidenceIds.at(-1),
    )!;
    const player = match.players.find((p) => p.id === shot.actorId)!;
    expect(sequence.brief).toContain(player.name);
    expect(sequence.detail).toContain(player.name);
    expect(sequence.brief).toMatch(/shot at \d{2}:\d{2}/);
    expect(sequence.brief).not.toContain("this shot");
  });
  it("keeps the first verified passage and removes another telling the same kind of story", () => {
    const candidates = observe(match, 3804);
    const sequences = candidates
      .filter((c) => c.category === "shot-sequence" && c.team === "harbor")
      .slice(0, 2);
    expect(sequences).toHaveLength(2);
    const plan = validateEditorialPlan(
      {
        decision: "publish",
        stories: sequences.map((c) => ({
          claimId: c.id,
          form: "brief",
          emphasis: "sequence",
        })),
      },
      candidates,
      new Set(sequences.map((c) => c.id)),
    );
    expect(distinctEditorialStories(plan, candidates)).toEqual([
      plan.stories[0],
    ]);
    const comparisons = candidates.filter(
      (c) => c.category === "activity-change",
    );
    expect(new Set(comparisons.map(editorialGroup)).size).toBe(
      comparisons.length,
    );
  });
});
