import { describe, expect, it } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { SCENARIOS } from "../src/lib/match";
import { observe, type Candidate } from "../src/lib/ai/director/observer";
import {
  evaluateHypothesis,
  type HypothesisAssessment,
} from "../src/lib/ai/director/hypothesis";
import { createInvestigation } from "../src/lib/ai/director/tools";

const source = new SyntheticMatchSource();
const fixture = source.read("pressure");
const cutoff = 4200;
const query = {
  matchId: fixture.id,
  start: 2700,
  end: cutoff,
  team: null,
  playerId: null,
  eventId: null,
};
const references = (assessment: HypothesisAssessment) =>
  [
    ...assessment.supportingEvidence,
    ...assessment.limitingEvidence,
    ...assessment.contradictoryEvidence,
    ...assessment.measurements,
    ...assessment.verificationChecks,
  ].flatMap((item) => item.eventIds);
const shotsClaim = () =>
  observe(fixture, cutoff).find(
    (candidate) =>
      candidate.category === "activity-change" &&
      candidate.statistics[0].label === "shots",
  )!;

describe("deterministic hypothesis assessments", () => {
  it("verifies all deterministic categories independently of the editorial shortlist", () => {
    const kinds = new Set<string>();
    for (const scenario of Object.keys(SCENARIOS)) {
      const match = source.read(scenario);
      for (const time of [900, 2690, 4200, match.duration]) {
        for (const candidate of observe(
          match,
          time,
          "fan",
          {},
          { unranked: true },
        )) {
          kinds.add(candidate.category);
          const assessment = evaluateHypothesis(match, time, candidate);
          expect(
            assessment.verificationChecks.filter((check) => !check.passed),
            `${scenario}/${time}/${candidate.id}`,
          ).toEqual([]);
          expect(assessment.verificationStatus).not.toBe("unsupported");
          expect(
            references(assessment).every((id) =>
              match.events.some(
                (event) => event.id === id && event.time <= time,
              ),
            ),
          ).toBe(true);
          expect(assessment.whyItMatters).toBeTruthy();
        }
      }
    }
    expect(kinds).toContain("recovery-shot");
    expect(kinds).toContain("activity-change");
    expect(kinds).toContain("substitute-involvement");
  });

  it("rejects forged prose, statistics, duplicate evidence and wrong event identities", () => {
    const candidate = shotsClaim();
    for (const forged of [
      {
        ...candidate,
        detail: "The manager changed the press and transformed the match.",
      },
      {
        ...candidate,
        statistics: candidate.statistics.map((statistic) => ({
          ...statistic,
          value: statistic.value + 1,
        })),
      },
      {
        ...candidate,
        evidenceIds: [...candidate.evidenceIds, candidate.evidenceIds[0]],
      },
      { ...candidate, timestamp: candidate.timestamp + 1 },
    ])
      expect(
        evaluateHypothesis(fixture, cutoff, forged).verificationStatus,
      ).toBe("unsupported");
    const changed = structuredClone(fixture);
    changed.events.find(
      (event) => event.id === candidate.evidenceIds[0],
    )!.teamId = "invented";
    expect(
      evaluateHypothesis(changed, cutoff, candidate).verificationChecks.find(
        (check) => check.code === "event-identities",
      )?.passed,
    ).toBe(false);
    expect(
      evaluateHypothesis(changed, cutoff, candidate).verificationStatus,
    ).toBe("unsupported");
  });

  it("adds a specific high-recovery attacking route without claiming pressing or inventing chance quality", () => {
    const match = structuredClone(fixture);
    match.capabilities.xg = false;
    match.events.forEach((event) => {
      delete event.xg;
    });
    const candidate = observe(match, cutoff).find(
      (item) =>
        item.category === "activity-change" &&
        item.statistics[0].label === "shots",
    )!;
    const assessment = evaluateHypothesis(match, cutoff, candidate);
    expect(assessment.verificationStatus).toBe("confirmed-observation");
    expect(
      assessment.supportingEvidence.find(
        (item) => item.code === "attacking-third-recovery-shot-links",
      )?.eventIds.length,
    ).toBeGreaterThan(1);
    expect(assessment.whyItMatters).toContain("attacking-third recoveries");
    expect(assessment.whyItMatters).not.toContain("more recorded attacks");
    expect(
      assessment.limitingEvidence.some(
        (item) => item.code === "chance-quality-unavailable",
      ),
    ).toBe(true);
    expect(
      assessment.measurements.some((item) => item.key.includes("xg")),
    ).toBe(false);
  });

  it("uses complete recorded shot outcomes for consequence, without treating unknown outcomes as misses", () => {
    const match = structuredClone(fixture);
    match.capabilities.shotOutcomes = true;
    const candidate = shotsClaim();
    const shots = match.events.filter(
      (event) =>
        event.type === "shot" &&
        event.team === candidate.team &&
        event.time > 3450 &&
        event.time <= cutoff,
    );
    shots.forEach((event) => {
      event.outcome = "wide";
    });
    const assessment = evaluateHypothesis(match, cutoff, candidate);
    expect(assessment.whyItMatters).toContain(
      "have not produced a recorded goal",
    );
    expect(
      assessment.measurements.find(
        (item) => item.key === "current-shot-goal-outcomes",
      )?.value,
    ).toBe(0);
    delete shots[0].outcome;
    const incomplete = evaluateHypothesis(match, cutoff, candidate);
    expect(incomplete.whyItMatters).not.toContain(
      "have not produced a recorded goal",
    );
    expect(
      incomplete.measurements.some(
        (item) => item.key === "current-shot-goal-outcomes",
      ),
    ).toBe(false);
  });

  it("does not turn source capability flags into fabricated per-shot xG", () => {
    const match = structuredClone(fixture);
    match.capabilities.xg = true;
    const candidate = shotsClaim();
    delete match.events.find((event) => event.id === candidate.evidenceIds[0])!
      .xg;
    const assessment = evaluateHypothesis(match, cutoff, candidate);
    expect(
      assessment.limitingEvidence.some(
        (item) => item.code === "chance-quality-incomplete",
      ),
    ).toBe(true);
    expect(
      assessment.measurements.some((item) => item.key.includes("xg")),
    ).toBe(false);
  });

  it("keeps minute-precision recovery sequences but does not invent elapsed seconds", () => {
    const match = structuredClone(fixture);
    const original = observe(match, cutoff).find(
      (candidate) => candidate.category === "recovery-shot",
    )!;
    for (const id of [original.evidenceIds[0], original.evidenceIds.at(-1)!])
      match.events.find((event) => event.id === id)!.source.precision =
        "minute";
    const candidate = observe(match, cutoff).find(
      (item) => item.id === original.id,
    )!;
    const assessment = evaluateHypothesis(match, cutoff, candidate);
    expect(assessment.verificationStatus).toBe("supported-interpretation");
    expect(
      assessment.measurements.some(
        (item) => item.key === "recovery-shot-seconds",
      ),
    ).toBe(false);
    expect(
      assessment.limitingEvidence.some(
        (item) => item.code === "minute-precision",
      ),
    ).toBe(true);
    match.capabilities.ballRecoveries = false;
    expect(
      evaluateHypothesis(match, cutoff, candidate).verificationStatus,
    ).toBe("unsupported");
  });

  it("is unchanged when future events and full-match score are withheld or changed", () => {
    const candidate = shotsClaim();
    const prefix = structuredClone(fixture);
    prefix.events = prefix.events.filter((event) => event.time <= cutoff);
    prefix.finalScore = { harbor: 0, riverside: 99 };
    expect(evaluateHypothesis(prefix, cutoff, candidate)).toEqual(
      evaluateHypothesis(fixture, cutoff, candidate),
    );
    const future = fixture.events.find((event) => event.time > cutoff)!;
    const invalid = evaluateHypothesis(fixture, cutoff, {
      ...candidate,
      evidenceIds: [future.id],
    });
    expect(invalid.verificationStatus).toBe("unsupported");
    expect(references(invalid)).not.toContain(future.id);
  });

  it("bounds watch windows to the current period and stops at full time", () => {
    const time = 2690;
    const candidate = observe(fixture, time)[0];
    const assessment = evaluateHypothesis(fixture, time, candidate);
    expect(assessment.watchNext).not.toBeNull();
    expect(assessment.watchNext!.endsAt).toBe(fixture.periods[0].end);
    expect(assessment.watchNext!.period).toBe("1H");
    const final = evaluateHypothesis(
      fixture,
      fixture.duration,
      observe(fixture, fixture.duration)[0],
    );
    expect(final.watchNext).toBeNull();
    expect(
      evaluateHypothesis(fixture, cutoff, shotsClaim()).watchNext,
    ).not.toBeNull();
  });

  it("rebuilds query-selected comparisons and player contributions without trusting their text", () => {
    const session = createInvestigation(fixture, cutoff, "fan");
    const comparison = session.execute("compare_time_windows", {
      ...query,
      start: 3450,
      team: "harbor",
    });
    const candidates: Candidate[] = comparison.claims.filter(
      (candidate) => candidate.category === "window-comparison",
    );
    const players = fixture.players
      .filter((player) => player.team === "harbor")
      .sort(
        (a, b) =>
          fixture.events.filter(
            (event) =>
              event.time > 3300 &&
              event.time <= cutoff &&
              event.actorId === b.id,
          ).length -
          fixture.events.filter(
            (event) =>
              event.time > 3300 &&
              event.time <= cutoff &&
              event.actorId === a.id,
          ).length,
      );
    const playerResult = session.execute("get_player_involvement", {
      ...query,
      start: 3300,
      team: "harbor",
      playerId: players[0].id,
    });
    candidates.push(
      ...playerResult.claims.filter(
        (candidate) => candidate.category === "player-involvement",
      ),
    );
    expect(
      candidates.some(
        (candidate) => candidate.category === "window-comparison",
      ),
    ).toBe(true);
    expect(
      candidates.some(
        (candidate) => candidate.category === "player-involvement",
      ),
    ).toBe(true);
    for (const candidate of candidates) {
      expect(
        evaluateHypothesis(fixture, cutoff, candidate).verificationStatus,
      ).toBe("confirmed-observation");
      expect(
        evaluateHypothesis(fixture, cutoff, {
          ...candidate,
          brief: "An invented consequence.",
        }).verificationStatus,
      ).toBe("unsupported");
    }
  });

  it("keeps a player-selected shot increase scoped to that player when team volume is unchanged", () => {
    const match = source.read("pressure", { seed: 17, profile: "balanced" });
    const player = match.players.find((item) => item.name === "Hugo Silva")!;
    const session = createInvestigation(match, 1800, "analyst");
    const result = session.execute("compare_time_windows", {
      matchId: match.id,
      start: 1200,
      end: 1800,
      team: player.team,
      playerId: player.id,
      eventId: null,
    });
    const candidate = result.claims.find(
      (item) => item.category === "window-comparison",
    )!;
    const assessment = evaluateHypothesis(match, 1800, candidate);
    const teamShots = (start: number, end: number) =>
      match.events.filter(
        (event) =>
          event.team === player.team &&
          event.type === "shot" &&
          event.time > start &&
          event.time <= end,
      ).length;
    expect(teamShots(600, 1200)).toBe(2);
    expect(teamShots(1200, 1800)).toBe(2);
    expect(candidate.statistics.map((item) => item.value)).toEqual([2, 0]);
    expect(assessment.verificationStatus).toBe("confirmed-observation");
    expect(assessment.hypothesis.description).toContain("Hugo Silva");
    expect(assessment.whyItMatters).toContain("Hugo Silva");
    expect(assessment.watchNext?.description).toContain("Hugo Silva");
    expect(assessment.watchNext?.playerId).toBe(player.id);
    expect(
      [
        assessment.hypothesis.description,
        assessment.whyItMatters,
        assessment.watchNext?.description,
      ].join(" "),
    ).not.toContain("Riverside");
    expect(
      assessment.measurements.some(
        (item) => item.key === "opponent-current-shots",
      ),
    ).toBe(false);
    expect(
      assessment.contradictoryEvidence.some(
        (item) => item.code === "opponent-shot-response",
      ),
    ).toBe(false);
    for (const measurement of assessment.measurements.filter((item) =>
      [
        "current-count",
        "previous-count",
        "current-xg",
        "previous-xg",
        "current-shot-goal-outcomes",
      ].includes(item.key),
    )) {
      expect(
        measurement.eventIds.every(
          (id) =>
            match.events.find((event) => event.id === id)?.actorId ===
            player.id,
        ),
      ).toBe(true);
    }
  });

  it("returns bounded complete counter-evidence assessments using the same query and tool budget", () => {
    const session = createInvestigation(fixture, cutoff, "fan");
    const output = session.execute("inspect_counter_evidence", query);
    const result = output as typeof output & {
      assessments: { claimId: string; assessment: HypothesisAssessment }[];
      assessmentsTruncated: boolean;
      totalAssessments: number;
    };
    expect(result.assessments.length).toBeGreaterThan(0);
    expect(result.assessments.length).toBeLessThanOrEqual(2);
    expect(result.assessmentsTruncated).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(48000);
    const retrieved = new Set(
      fixture.events
        .filter((event) => event.time > query.start && event.time <= query.end)
        .map((event) => event.id),
    );
    for (const item of result.assessments) {
      expect(references(item.assessment).every((id) => retrieved.has(id))).toBe(
        true,
      );
      expect(
        result.claims.some((candidate) => candidate.id === item.claimId),
      ).toBe(true);
    }
    for (let attempt = 0; attempt < 3; attempt++)
      session.execute("get_match_context", query);
    expect(() => session.execute("inspect_counter_evidence", query)).toThrow(
      "budget",
    );
    expect(() =>
      createInvestigation(fixture, cutoff, "fan").execute(
        "inspect_counter_evidence",
        { ...query, end: cutoff + 1 },
      ),
    ).toThrow();
  });
});
