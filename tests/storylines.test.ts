import { describe, expect, it } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import type { MatchData, NormalizedEvent } from "../src/lib/sources/model";
import {
  reconstructStorylines,
  STORYLINE_HISTORY_LIMIT,
  STORYLINE_WINDOW_EVIDENCE_LIMIT,
  type StorylineMetric,
} from "../src/lib/ai/director/storylines";

const source = new SyntheticMatchSource();
const template = source.read("pressure");

function fixture(
  counts: number[],
  {
    metric = "shots",
    team = "harbor",
    period = "1H",
  }: {
    metric?: StorylineMetric;
    team?: NormalizedEvent["team"];
    period?: NormalizedEvent["period"];
  } = {},
): MatchData {
  const match = structuredClone(template);
  const periodStart = match.periods.find((p) => p.id === period)!.start;
  const prototype = match.events.find(
    (e) => e.team === team && e.type === "shot",
  )!;
  match.events = counts.flatMap((count, index) =>
    Array.from({ length: count }, (_, i): NormalizedEvent => {
      const time = periodStart + index * 300 + ((i + 1) * 299) / (count + 1);
      return {
        ...prototype,
        id: `event:${team}:${period}:${index}:${i}`,
        time,
        period,
        periodSeconds: time - periodStart,
        type: metric === "shots" ? "shot" : "recovery",
        success: true,
        position: { x: 80, y: 50 },
        relatedEvents: [],
        source: { ...prototype.source, precision: "second" },
      };
    }),
  );
  match.events.forEach((e, i) => {
    e.order = i;
  });
  return match;
}

function one(match: MatchData, cutoff: number) {
  const storylines = reconstructStorylines(match, cutoff);
  expect(storylines).toHaveLength(1);
  return storylines[0];
}

describe("measured temporal storylines", () => {
  it("uses repeated complete-window evidence for every state, without requiring endless growth", () => {
    const match = fixture([1, 3, 3, 4, 1, 0]);
    const states = [600, 900, 1200, 1500, 1800].map((cutoff) =>
      one(match, cutoff),
    );
    expect(states.map((s) => s.state)).toEqual([
      "emerging",
      "developing",
      "sustained",
      "weakening",
      "resolved",
    ]);
    expect(new Set(states.map((s) => s.id)).size).toBe(1);
    expect(states.map((s) => s.revision)).toEqual([1, 2, 3, 4, 5]);
    expect(states.map((s) => s.baseline.count)).toEqual([1, 1, 1, 1, 1]);
    expect(states[1].previous.count).toBe(3);
    expect(states[1].current.count).toBe(3);
    expect(states[1].observations.at(-1)?.confirmsBaseline).toBe(true);
    expect(states[3].observations.at(-1)?.nonQualifyingWindowStreak).toBe(1);
    expect(states[4].observations.at(-1)?.nonQualifyingWindowStreak).toBe(2);
    expect(states[4].firstObservedAt).toBe(600);
    expect(states[4].criterion).toContain("two are resolved");
  });

  it("stays quiet for empty matches, one isolated shot, repeated low counts and incomplete windows", () => {
    expect(reconstructStorylines(fixture([]), 2400)).toEqual([]);
    expect(reconstructStorylines(fixture([0, 1, 0, 0]), 2400)).toEqual([]);
    expect(reconstructStorylines(fixture([2, 2, 2, 2]), 2400)).toEqual([]);
    expect(reconstructStorylines(fixture([0, 4]), 599.999)).toEqual([]);
    expect(one(fixture([0, 4]), 600).state).toBe("emerging");
  });

  it("is prefix invariant and reconstructs a rewind independently of later reconstruction", () => {
    const match = fixture([1, 3, 3, 4, 1, 0]);
    const at600 = one(match, 600);
    one(match, 1800);
    expect(one(match, 600)).toEqual(at600);
    const prefix = structuredClone(match);
    prefix.events = prefix.events.filter((e) => e.time <= 600);
    prefix.finalScore = { harbor: 20, riverside: 30 };
    expect(reconstructStorylines(prefix, 600)).toEqual([at600]);
    const changedFuture = structuredClone(match);
    for (const event of changedFuture.events.filter((e) => e.time > 600)) {
      event.type = "goal";
      event.position = null;
      event.relatedEvents = ["future-secret"];
    }
    expect(reconstructStorylines(changedFuture, 600)).toEqual([at600]);
    for (const cutoff of [600, 777, 900, 1200, 1500, 1800]) {
      const story = one(match, cutoff);
      expect(story.observations.every((o) => o.timestamp <= cutoff)).toBe(true);
      expect(
        story.observations
          .flatMap((o) => o.evidenceIds)
          .every((id) => match.events.find((e) => e.id === id)!.time <= cutoff),
      ).toBe(true);
    }
  });

  it("does not invent revisions between assessments or repeatedly resolve a quiet storyline", () => {
    const match = fixture([1, 3, 3, 4, 1, 0]);
    const emerging = one(match, 600),
      between = one(match, 899.9);
    expect(between.observations).toEqual(emerging.observations);
    expect(between.revision).toBe(emerging.revision);
    expect(between.updatedAt).toBe(600);
    const resolved = one(match, 1800),
      later = one(match, 2400);
    expect(later.observations).toEqual(resolved.observations);
    expect(later.updatedAt).toBe(1800);
    expect(later.revision).toBe(5);
  });

  it("reopens a resolved identity only after a fresh adjacent-window increase", () => {
    const match = fixture([1, 3, 3, 4, 1, 0, 4, 4]);
    const resolved = one(match, 1800),
      reopened = one(match, 2100);
    expect(reopened.id).toBe(resolved.id);
    expect(reopened.state).toBe("emerging");
    expect(reopened.episode).toBe(2);
    expect(reopened.episodeStartedAt).toBe(2100);
    expect(reopened.firstObservedAt).toBe(600);
    expect(reopened.baseline.count).toBe(0);
    expect(reopened.revision).toBe(6);
    expect(one(match, 2400).state).toBe("developing");
  });

  it("keeps periods, teams, match identities and metrics separate", () => {
    const first = fixture([0, 3]);
    const second = fixture([0, 3], { period: "2H" });
    const opponent = fixture([0, 3], { team: "riverside" });
    const recoveries = fixture([0, 3], {
      metric: "attacking-third-recoveries",
    });
    // Namespaced event IDs are a canonical input contract.
    recoveries.events.forEach((e) => {
      e.id = `recovery:${e.id}`;
    });
    first.events.push(
      ...second.events,
      ...opponent.events,
      ...recoveries.events,
    );
    first.events
      .sort((a, b) => a.time - b.time)
      .forEach((e, i) => {
        e.order = i;
      });
    const beforeSecondAssessment = reconstructStorylines(first, 3299.999);
    expect(beforeSecondAssessment.every((s) => s.period === "1H")).toBe(true);
    const all = reconstructStorylines(first, 3300);
    expect(all).toHaveLength(4);
    expect(new Set(all.map((s) => s.id)).size).toBe(4);
    for (const story of all)
      for (const observation of story.observations)
        for (const eventId of observation.evidenceIds) {
          const event = first.events.find((e) => e.id === eventId)!;
          expect(event.team).toBe(story.team);
          expect(event.period).toBe(story.period);
        }
    const otherScenario = fixture([0, 3]);
    otherScenario.id = "different-scenario";
    expect(one(otherScenario, 600).id).not.toBe(one(fixture([0, 3]), 600).id);
  });

  it("assigns exact boundary events once, including period start", () => {
    const match = fixture([2, 4]);
    match.events[0].time = 0;
    match.events[1].time = 300;
    match.events.at(-1)!.time = 600;
    const story = one(match, 600);
    expect(story.previous.count).toBe(2);
    expect(story.current.count).toBe(4);
    expect(story.previous.startInclusive).toBe(true);
    expect(story.current.startInclusive).toBe(false);
    expect(
      new Set([...story.previous.evidenceIds, ...story.current.evidenceIds])
        .size,
    ).toBe(6);
  });

  it("excludes unrecorded recovery capabilities, failed recoveries and missing or non-attacking locations", () => {
    const match = fixture([0, 4], { metric: "attacking-third-recoveries" });
    expect(one(match, 600).metric).toBe("attacking-third-recoveries");
    for (const scenario of [
      "capability",
      "failed",
      "missing",
      "outside",
    ] as const) {
      const modified = structuredClone(match);
      if (scenario === "capability")
        modified.capabilities.ballRecoveries = false;
      for (const event of modified.events) {
        if (scenario === "failed") event.success = false;
        if (scenario === "missing") event.position = null;
        if (scenario === "outside") event.position = { x: 66.6, y: 50 };
      }
      expect(reconstructStorylines(modified, 600)).toEqual([]);
    }
    match.capabilities.xg = false;
    const story = one(match, 600);
    expect(story.limitations.join(" ")).toContain("not pressing intensity");
    expect(story.summary).not.toMatch(/quality|pressure|caus/);
  });

  it("provides traversable observation/evidence links with bounded history and honest evidence sampling", () => {
    const match = fixture([0, ...Array.from({ length: 18 }, () => 3)]);
    match.duration = 6000;
    match.periods = [{ id: "1H", start: 0, end: 6000, clockStart: 0 }];
    const story = one(match, 5700);
    expect(story.observations).toHaveLength(STORYLINE_HISTORY_LIMIT);
    expect(story.historyTruncated).toBe(true);
    expect(story.revision).toBe(18);
    const nodes = new Set([
      story.id,
      ...story.observations.map((o) => o.id),
      ...match.events.map((e) => e.id),
    ]);
    expect(
      story.relationships.every((r) => nodes.has(r.from) && nodes.has(r.to)),
    ).toBe(true);
    for (const observation of story.observations)
      expect(
        story.relationships
          .filter((r) => r.from === observation.id && r.kind === "supported-by")
          .map((r) => r.to),
      ).toEqual(observation.evidenceIds);
    const dense = one(fixture([0, STORYLINE_WINDOW_EVIDENCE_LIMIT + 50]), 600);
    expect(dense.current.count).toBe(STORYLINE_WINDOW_EVIDENCE_LIMIT + 50);
    expect(dense.current.evidenceIds).toHaveLength(
      STORYLINE_WINDOW_EVIDENCE_LIMIT,
    );
    expect(dense.current.evidenceTruncated).toBe(true);
    expect(dense.limitations.join(" ")).toContain(
      "Counts use all recorded events",
    );
  });

  it("does not compare across the interval break or during penalty shootouts", () => {
    const match = fixture([0, 0, 0, 0, 0, 0, 0, 0, 4]);
    const second = fixture([5], { period: "2H" });
    match.events.push(...second.events);
    expect(reconstructStorylines(match, 3000)).toEqual([]);
    match.events = second.events.map((e) => ({ ...e, period: "PS" }));
    match.periods = [{ id: "PS", start: 2700, end: 5400, clockStart: 0 }];
    expect(reconstructStorylines(match, 5400)).toEqual([]);
  });

  it("offers measurable watch criteria and closes the full-time instruction", () => {
    const match = fixture([1, 3, 3, 4, 1, 0]);
    expect(one(match, 600).watchNext).toContain("3 or more shots");
    expect(one(match, 1800).watchNext).toContain("fresh increase");
    expect(one(match, 2700).watchNext).toContain("This period has ended");
    expect(one(match, match.duration).watchNext).toContain(
      "The match has ended",
    );
    expect(one(match, match.duration).watchNext).not.toContain("later period");
  });

  it.each([-1, NaN, Infinity, template.duration + 1])(
    "rejects invalid cutoff %s",
    (cutoff) => {
      expect(() => reconstructStorylines(template, cutoff)).toThrow(
        "Invalid storyline cutoff",
      );
    },
  );
});
