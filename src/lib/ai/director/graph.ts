import type { MatchData } from "../../sources/model";
import type { Candidate } from "./observer";

export type IntelligenceNode = {
  id: string;
  kind:
    | "match"
    | "team"
    | "player"
    | "event"
    | "possession"
    | "window"
    | "measurement"
    | "observation"
    | "hypothesis"
    | "storyline"
    | "insight";
  reference: string;
  timestamp?: number;
};
export type IntelligenceEdge = {
  from: string;
  to: string;
  relationship:
    | "assesses"
    | "measured-by"
    | "supported-by"
    | "limited-by"
    | "contradicted-by"
    | "bounded-by"
    | "contains"
    | "performed-by"
    | "for-team"
    | "in-match"
    | "in-possession"
    | "continues";
};
export type IntelligenceGraph = {
  schemaVersion: "1.0.0";
  matchId: string;
  cutoff: number;
  root: string;
  nodes: IntelligenceNode[];
  edges: IntelligenceEdge[];
};

/** A portable evidence graph. No raw feed, roster prediction or database is needed. */
export function buildIntelligenceGraph(
  match: MatchData,
  cutoff: number,
  candidate: Candidate,
  hypothesisId: string,
  windows: {
    id: string;
    start: number;
    end: number;
    boundary?: "(start,end]" | "[start,end]";
  }[],
  storylineId?: string,
  contextEvidence: {
    eventIds: string[];
    relationship: "supported-by" | "limited-by" | "contradicted-by";
  }[] = [],
  measurements: { key: string; eventIds: string[]; window?: string }[] = [],
): IntelligenceGraph {
  const nodes = new Map<string, IntelligenceNode>();
  const edges = new Map<string, IntelligenceEdge>();
  const node = (
    kind: IntelligenceNode["kind"],
    reference: string,
    timestamp?: number,
  ) => {
    const id = `${kind}:${reference}`;
    if (timestamp !== undefined && timestamp > cutoff)
      throw new Error("Graph future evidence");
    nodes.set(id, {
      id,
      kind,
      reference,
      ...(timestamp !== undefined ? { timestamp } : {}),
    });
    return id;
  };
  const edge = (
    from: string,
    to: string,
    relationship: IntelligenceEdge["relationship"],
  ) => {
    edges.set(JSON.stringify([from, to, relationship]), {
      from,
      to,
      relationship,
    });
  };
  const matchNode = node("match", match.id);
  const root = node("insight", `${candidate.id}:${cutoff}`, cutoff);
  const hypothesis = node("hypothesis", hypothesisId, cutoff);
  const observation = node("observation", candidate.id, candidate.timestamp);
  edge(root, hypothesis, "assesses");
  edge(hypothesis, observation, "supported-by");
  edge(observation, matchNode, "in-match");
  if (storylineId) edge(root, node("storyline", storylineId), "continues");
  const eventMap = new Map(
    match.events
      .filter((event) => event.time <= cutoff)
      .map((event) => [event.id, event]),
  );
  const windowNodes = windows.map((window) => {
    const id = node(
      "window",
      `${candidate.id}:${window.id}:${window.start}:${window.end}`,
      window.end,
    );
    edge(observation, id, "bounded-by");
    return { ...window, id };
  });
  const measurementNodes = measurements.map((measurement) => {
    const id = node(
      "measurement",
      `${hypothesisId}:${measurement.key}`,
      cutoff,
    );
    edge(hypothesis, id, "measured-by");
    const windowIndex = windows.findIndex(
      (window) => window.id === measurement.window,
    );
    if (windowIndex >= 0) edge(id, windowNodes[windowIndex].id, "bounded-by");
    return { ...measurement, id };
  });
  for (const id of new Set([
    ...candidate.evidenceIds,
    ...contextEvidence.flatMap((evidence) => evidence.eventIds),
    ...measurements.flatMap((measurement) => measurement.eventIds),
  ])) {
    const event = eventMap.get(id);
    if (!event || event.matchId !== match.id)
      throw new Error("Graph evidence identity violation");
    const eventNode = node("event", id, event.time);
    const teamNode = node("team", `${match.id}:${event.teamId}`);
    if (candidate.evidenceIds.includes(id))
      edge(observation, eventNode, "supported-by");
    for (const evidence of contextEvidence)
      if (evidence.eventIds.includes(id))
        edge(hypothesis, eventNode, evidence.relationship);
    for (const measurement of measurementNodes)
      if (measurement.eventIds.includes(id))
        edge(measurement.id, eventNode, "supported-by");
    edge(eventNode, teamNode, "for-team");
    edge(teamNode, matchNode, "in-match");
    for (const window of windowNodes)
      if (
        (window.boundary === "[start,end]"
          ? event.time >= window.start
          : event.time > window.start) &&
        event.time <= window.end
      )
        edge(window.id, eventNode, "contains");
    if (event.actorId) {
      const player = match.players.find(
        (player) => player.id === event.actorId && player.team === event.team,
      );
      if (!player) throw new Error("Graph player identity violation");
      const playerNode = node("player", `${match.id}:${player.id}`);
      edge(eventNode, playerNode, "performed-by");
      edge(playerNode, teamNode, "for-team");
    }
    if (
      match.capabilities.possession !== "unavailable" &&
      event.possessionId !== null
    ) {
      const possession = node(
        "possession",
        `${match.id}:${event.period}:${event.team}:${event.possessionId}`,
      );
      edge(eventNode, possession, "in-possession");
      edge(possession, teamNode, "for-team");
    }
  }
  return {
    schemaVersion: "1.0.0",
    matchId: match.id,
    cutoff,
    root,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
}
