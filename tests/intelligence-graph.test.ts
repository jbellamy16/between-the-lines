import { describe, expect, it } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import type { MatchData } from "../src/lib/sources/model";
import { observe, type Candidate } from "../src/lib/ai/director/observer";
import {
  buildIntelligenceGraph,
  type IntelligenceGraph,
} from "../src/lib/ai/director/graph";
import { packageStory } from "../src/lib/ai/director/story";

const source = new SyntheticMatchSource();
const cutoff = 4200;

function comparison(match: MatchData, label = "shots") {
  const candidate = observe(
    match,
    cutoff,
    "analyst",
    {},
    { unranked: true },
  ).find(
    (c) =>
      c.category === "activity-change" &&
      c.team === "harbor" &&
      c.statistics[0].label === label,
  );
  expect(candidate).toBeDefined();
  return candidate!;
}

function reachable(graph: IntelligenceGraph, from = graph.root) {
  const visited = new Set<string>();
  const remaining = [from];
  while (remaining.length) {
    const node = remaining.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const edge of graph.edges)
      if (edge.from === node) remaining.push(edge.to);
  }
  return visited;
}

function expectCompleteGraph(graph: IntelligenceGraph, match: MatchData) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  expect(nodes.size).toBe(graph.nodes.length);
  expect(nodes.get(graph.root)?.kind).toBe("insight");
  expect(
    graph.edges.every((edge) => nodes.has(edge.from) && nodes.has(edge.to)),
  ).toBe(true);
  expect(new Set(graph.edges.map((edge) => JSON.stringify(edge))).size).toBe(
    graph.edges.length,
  );
  expect(reachable(graph)).toEqual(new Set(nodes.keys()));
  expect(
    graph.nodes.every(
      (node) => node.timestamp === undefined || node.timestamp <= graph.cutoff,
    ),
  ).toBe(true);
  for (const node of graph.nodes.filter((node) => node.kind === "event")) {
    const event = match.events.find((event) => event.id === node.reference)!;
    expect(event).toBeDefined();
    expect(event.time).toBeLessThanOrEqual(graph.cutoff);
    const descendants = reachable(graph, node.id);
    expect(descendants.has(`team:${match.id}:${event.teamId}`)).toBe(true);
    expect(descendants.has(`match:${match.id}`)).toBe(true);
    if (event.actorId)
      expect(descendants.has(`player:${match.id}:${event.actorId}`)).toBe(true);
  }
}

function withOpponentResponse() {
  const match = source.read("pressure");
  const opponent = match.events.find(
    (event) => event.type === "shot" && event.team === "riverside",
  )!;
  for (let index = 0; index < 5; index++) {
    const time = 3800 + index * 25;
    match.events.push({
      ...structuredClone(opponent),
      id: `opponent-response-${index}`,
      time,
      period: "2H",
      periodSeconds: time - match.secondHalfStart,
      relatedEvents: [],
      source: {
        ...opponent.source,
        eventId: `opponent-response-${index}`,
        raw: {},
      },
    });
  }
  match.events
    .sort((a, b) => a.time - b.time)
    .forEach((event, order) => {
      event.order = order;
    });
  return match;
}

describe("portable intelligence graph and story packaging", () => {
  it("traces a published comparison through its hypothesis, observation, windows and recorded identities", () => {
    const match = source.read("pressure");
    const candidate = comparison(match);
    const story = packageStory(candidate, match, cutoff, "analyst", "offline");
    const graph = story.intelligenceGraph;
    expect(graph.matchId).toBe(match.id);
    expect(graph.cutoff).toBe(cutoff);
    expectCompleteGraph(graph, match);
    const hypothesis = graph.nodes.find((node) => node.kind === "hypothesis")!;
    const observation = graph.nodes.find(
      (node) => node.kind === "observation",
    )!;
    expect(hypothesis.reference).toBe(story.hypothesis.hypothesis.id);
    expect(observation.reference).toBe(candidate.id);
    expect(graph.edges).toContainEqual({
      from: graph.root,
      to: hypothesis.id,
      relationship: "assesses",
    });
    expect(graph.edges).toContainEqual({
      from: hypothesis.id,
      to: observation.id,
      relationship: "supported-by",
    });
    for (const window of graph.nodes.filter((node) => node.kind === "window")) {
      expect(graph.edges).toContainEqual({
        from: observation.id,
        to: window.id,
        relationship: "bounded-by",
      });
      expect(
        graph.edges.some(
          (edge) => edge.from === window.id && edge.relationship === "contains",
        ),
      ).toBe(true);
    }
    expect(
      graph.nodes
        .filter((node) => node.kind === "event")
        .map((node) => node.reference)
        .sort(),
    ).toEqual([...story.evidenceEventIds].sort());
  });

  it("includes every measurement event even when it is contextual rather than the candidate's evidence", () => {
    const match = source.read("pressure");
    const candidate = comparison(match, "recoveries in the attacking third");
    const story = packageStory(candidate, match, cutoff, "analyst", "offline");
    const measured = story.hypothesis.measurements.flatMap(
      (measurement) => measurement.eventIds,
    );
    // Recovery counts and shot xG are separate recorded samples in this fixture.
    expect(measured.some((id) => !candidate.evidenceIds.includes(id))).toBe(
      true,
    );
    const reachableNodes = reachable(story.intelligenceGraph);
    for (const id of measured) {
      expect(story.evidenceEventIds).toContain(id);
      expect(reachableNodes.has(`event:${id}`)).toBe(true);
    }
    for (const measurement of story.hypothesis.measurements) {
      const measurementId = `measurement:${story.hypothesis.hypothesis.id}:${measurement.key}`;
      expect(story.intelligenceGraph.edges).toContainEqual({
        from: `hypothesis:${story.hypothesis.hypothesis.id}`,
        to: measurementId,
        relationship: "measured-by",
      });
      for (const id of measurement.eventIds)
        expect(story.intelligenceGraph.edges).toContainEqual({
          from: measurementId,
          to: `event:${id}`,
          relationship: "supported-by",
        });
    }
    expectCompleteGraph(story.intelligenceGraph, match);
    expect(story.storyline?.metric).toBe("attacking-third-recoveries");
    expect(story.intelligenceGraph.edges).toContainEqual({
      from: story.intelligenceGraph.root,
      to: `storyline:${story.storyline!.id}`,
      relationship: "continues",
    });
  });

  it("keeps contradictory opponent events explicitly linked to the hypothesis and their own identities", () => {
    const match = withOpponentResponse();
    const candidate = comparison(match);
    const story = packageStory(candidate, match, cutoff, "analyst", "offline");
    const counter = story.hypothesis.contradictoryEvidence.find(
      (evidence) => evidence.code === "opponent-shot-response",
    )!;
    expect(counter).toBeDefined();
    expect(counter.eventIds).toHaveLength(5);
    const hypothesisId = `hypothesis:${story.hypothesis.hypothesis.id}`;
    for (const eventId of counter.eventIds) {
      expect(candidate.evidenceIds).not.toContain(eventId);
      expect(story.evidenceEventIds).toContain(eventId);
      expect(story.intelligenceGraph.edges).toContainEqual({
        from: hypothesisId,
        to: `event:${eventId}`,
        relationship: "contradicted-by",
      });
      expect(
        reachable(story.intelligenceGraph, `event:${eventId}`).has(
          `team:${match.id}:${match.teams.riverside.id}`,
        ),
      ).toBe(true);
    }
    expectCompleteGraph(story.intelligenceGraph, match);
  });

  it("honors inclusive observation-window starts for sequence evidence", () => {
    const match = source.read("pressure");
    const candidate = observe(match, cutoff).find(
      (c) => c.category === "recovery-shot",
    )!;
    const story = packageStory(candidate, match, cutoff, "fan", "offline");
    const observationWindow = story.hypothesis.windows[0];
    expect(observationWindow.boundary).toBe("[start,end]");
    const first = match.events.find(
      (event) => event.id === candidate.evidenceIds[0],
    )!;
    expect(first.time).toBe(observationWindow.start);
    const window = story.intelligenceGraph.nodes.find(
      (node) => node.kind === "window",
    )!;
    expect(story.intelligenceGraph.edges).toContainEqual({
      from: window.id,
      to: `event:${first.id}`,
      relationship: "contains",
    });
  });

  it("is prefix invariant and emits no raw payload or future references", () => {
    const match = source.read("pressure");
    const candidate = comparison(match, "recoveries in the attacking third");
    const expected = packageStory(
      candidate,
      match,
      cutoff,
      "analyst",
      "offline",
    );
    const prefix = structuredClone(match);
    prefix.events = prefix.events.filter((event) => event.time <= cutoff);
    prefix.finalScore = { harbor: 20, riverside: 30 };
    prefix.provenance.raw = { marker: "PRIVATE_RAW_SENTINEL" };
    for (const event of prefix.events) {
      event.source.raw = { marker: "PRIVATE_RAW_SENTINEL" };
      event.relatedEvents = ["FUTURE_SECRET_EVENT"];
    }
    const actual = packageStory(
      candidate,
      prefix,
      cutoff,
      "analyst",
      "offline",
    );
    expect(actual).toEqual(expected);
    const serialized = JSON.stringify(actual);
    expect(serialized).not.toContain("PRIVATE_RAW_SENTINEL");
    expect(serialized).not.toContain("FUTURE_SECRET_EVENT");
    expect(serialized).not.toContain('"raw":');
    expect(serialized).not.toContain('"finalScore":');
    const future = new Set(
      match.events
        .filter((event) => event.time > cutoff)
        .map((event) => event.id),
    );
    expect(
      actual.intelligenceGraph.nodes.every(
        (node) => node.kind !== "event" || !future.has(node.reference),
      ),
    ).toBe(true);
    expect(
      actual.storyline!.observations.every(
        (observation) => observation.timestamp <= cutoff,
      ),
    ).toBe(true);
  });

  it("does not fabricate possessions when the source cannot provide them", () => {
    const match = source.read("pressure");
    match.capabilities.possession = "unavailable";
    const story = packageStory(
      comparison(match),
      match,
      cutoff,
      "fan",
      "offline",
    );
    expect(
      story.intelligenceGraph.nodes.some((node) => node.kind === "possession"),
    ).toBe(false);
    expect(
      story.intelligenceGraph.edges.some(
        (edge) => edge.relationship === "in-possession",
      ),
    ).toBe(false);
    expectCompleteGraph(story.intelligenceGraph, match);
  });

  it("records source limitations as limiting evidence rather than contradicting the measured count", () => {
    const match = source.read("pressure");
    match.capabilities.xg = false;
    const story = packageStory(
      comparison(match),
      match,
      cutoff,
      "analyst",
      "offline",
    );
    const missingQuality = story.hypothesis.limitingEvidence.find(
      (evidence) => evidence.code === "chance-quality-unavailable",
    )!;
    expect(missingQuality.eventIds.length).toBeGreaterThan(0);
    expect(
      story.hypothesis.contradictoryEvidence.some(
        (evidence) => evidence.code === "chance-quality-unavailable",
      ),
    ).toBe(false);
    for (const eventId of missingQuality.eventIds)
      expect(story.intelligenceGraph.edges).toContainEqual({
        from: `hypothesis:${story.hypothesis.hypothesis.id}`,
        to: `event:${eventId}`,
        relationship: "limited-by",
      });
    expectCompleteGraph(story.intelligenceGraph, match);
  });

  it.each([
    "id",
    "evidence",
    "future",
    "team",
    "headline",
    "statistics",
  ] as const)(
    "rejects a candidate with forged %s before producing a verified graph",
    (field) => {
      const match = source.read("pressure");
      const candidate = structuredClone(comparison(match));
      if (field === "id") candidate.id = "fabricated-claim";
      if (field === "evidence") candidate.evidenceIds.push("unknown-event");
      if (field === "future")
        candidate.evidenceIds.push(
          match.events.find((event) => event.time > cutoff)!.id,
        );
      if (field === "team") candidate.team = "riverside";
      if (field === "headline")
        candidate.headline = "This proves a tactical change";
      if (field === "statistics") candidate.statistics[0].value += 100;
      expect(() =>
        packageStory(candidate, match, cutoff, "analyst", "offline"),
      ).toThrow("verification failed");
    },
  );

  it("rejects direct graph references to missing, future or cross-match events", () => {
    const match = source.read("pressure");
    const candidate = comparison(match);
    const direct = (
      changed: Candidate,
      fixture = match,
      windows: { id: string; start: number; end: number }[] = [],
    ) =>
      buildIntelligenceGraph(
        fixture,
        cutoff,
        changed,
        "hypothesis-test",
        windows,
      );
    expect(() =>
      direct({ ...candidate, evidenceIds: ["missing-event"] }),
    ).toThrow("identity");
    expect(() =>
      direct({
        ...candidate,
        evidenceIds: [match.events.find((event) => event.time > cutoff)!.id],
      }),
    ).toThrow("identity");
    expect(() => direct({ ...candidate, timestamp: cutoff + 1 })).toThrow(
      "future",
    );
    expect(() =>
      direct(candidate, match, [
        { id: "future", start: cutoff - 100, end: cutoff + 1 },
      ]),
    ).toThrow("future");
    const wrongMatch = structuredClone(match);
    wrongMatch.events.find(
      (event) => event.id === candidate.evidenceIds[0],
    )!.matchId = "different-match";
    expect(() => direct(candidate, wrongMatch)).toThrow("identity");
    const unknownActor = structuredClone(match);
    unknownActor.events.find(
      (event) => event.id === candidate.evidenceIds[0],
    )!.actorId = "unknown-player";
    expect(() => direct(candidate, unknownActor)).toThrow("player identity");
  });
});
