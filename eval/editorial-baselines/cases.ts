import { SyntheticMatchSource } from "../../src/lib/sources/synthetic";
import {
  validateMatch,
  type NormalizedEvent,
} from "../../src/lib/sources/model";
import type { StoryPreferences } from "../../src/lib/intelligence";

/** Authored DEVELOPMENT cases only. Labels describe intended editorial behavior,
 * not a human preference study, production predicates or the proposed holdout. */
export const cases = [
  {
    id: "spread-favored",
    variant: "spread",
    team: "harbor",
    lead: "harbor",
    stop: "sufficient",
  },
  {
    id: "fading-favored",
    variant: "fading",
    team: "harbor",
    lead: "riverside",
    stop: "sufficient",
  },
  {
    id: "opponent-favored",
    variant: "spread",
    team: "riverside",
    lead: "riverside",
    stop: "sufficient",
  },
  {
    id: "seen-favored",
    variant: "seen",
    team: "harbor",
    lead: "riverside",
    stop: "sufficient",
  },
  {
    id: "player-favored",
    variant: "player",
    lead: "harbor",
    stop: "sufficient",
  },
  {
    id: "unknown-quality",
    variant: "xg",
    team: "harbor",
    lead: "harbor",
    stop: "unresolved",
  },
  {
    id: "unknown-possession",
    variant: "possession",
    team: "harbor",
    lead: "harbor",
    stop: "unresolved",
  },
  {
    id: "minute-timing",
    variant: "timing",
    team: "harbor",
    lead: "harbor",
    stop: "unresolved",
  },
  { id: "quiet", variant: "quiet", lead: null, stop: "no-material-gain" },
  {
    id: "short-window",
    variant: "early",
    lead: null,
    stop: "no-material-gain",
  },
  {
    id: "goal-over-preference",
    variant: "goal",
    team: "riverside",
    lead: "score-change",
    stop: "sufficient",
  },
  {
    id: "category-filter",
    variant: "categories",
    lead: null,
    stop: "no-material-gain",
  },
] as const;
export type DevelopmentCase = (typeof cases)[number];
export function buildCase(c: DevelopmentCase) {
  const match = structuredClone(new SyntheticMatchSource().read("pressure"));
  // Fixed non-label identity: policy cannot see case IDs or gold labels.
  match.id = "editorial-development";
  match.provenance.sourceMatchId = match.id;
  match.provenance.revision = "editorial-development-v1";
  const templates = Object.fromEntries(
    ["harbor", "riverside"].map((team) => [
      team,
      structuredClone(match.events.find((e) => e.team === team && e.actorId)!),
    ]),
  );
  match.events = [];
  match.finalScore = { harbor: 0, riverside: 0 };
  const add = (
    team: "harbor" | "riverside",
    time: number,
    type: "shot" | "recovery",
    possession: number,
  ) => {
    const e = structuredClone(templates[team]) as NormalizedEvent;
    for (const key of [
      "scoringTeam",
      "ownGoal",
      "assistPlayerId",
      "assistEventId",
      "goalkeeperId",
      "end",
      "recipientId",
      "outcome",
      "xg",
    ] as const)
      delete e[key];
    Object.assign(e, {
      id: `${team}:${time}:${type}`,
      matchId: match.id,
      time,
      periodSeconds: time,
      period: "1H",
      type,
      possessionId: possession,
      position: { x: 80, y: 50 },
      relatedEvents: [],
      qualifiers: {},
      statistics: {},
    });
    if (type === "shot") {
      e.xg = 0.1;
      e.outcome = "wide";
    }
    e.source = {
      ...e.source,
      eventId: e.id,
      matchId: match.id,
      eventType: type,
      precision: "second",
      raw: {},
    };
    match.events.push(e);
  };
  for (const time of [200, 600]) add("harbor", time, "shot", time);
  add("riverside", 400, "shot", 400);
  const times =
    c.variant === "fading"
      ? [1000, 1050, 1100, 1150, 1300, 1700]
      : [1000, 1100, 1300, 1450, 1600, 1700];
  // Two linked shots in separate possessions, fixed totals in the temporal pair.
  times.forEach((time, i) => {
    if (i < 2) add("harbor", time - 10, "recovery", time);
    add("harbor", time, "shot", time);
  });
  for (const time of [1000, 1100, 1450, 1600, 1750])
    add("riverside", time, "shot", time);
  let cutoff = 1800;
  const preferences: StoryPreferences = "team" in c ? { team: c.team } : {};
  if (c.variant === "seen")
    preferences.seenEvidenceIds = match.events
      .filter((e) => e.team === "harbor")
      .map((e) => e.id);
  if (c.variant === "player") preferences.player = templates.harbor.actorId!;
  if (c.variant === "xg")
    delete match.events.find(
      (e) => e.type === "shot" && e.team === "harbor" && e.time > 900,
    )!.xg;
  if (c.variant === "possession")
    match.events.forEach((e) => {
      e.possessionId = null;
    });
  if (c.variant === "timing")
    match.events.forEach((e) => {
      e.source.precision = "minute";
    });
  if (c.variant === "quiet") match.events = [];
  if (c.variant === "early") {
    cutoff = 240;
    match.events = [];
  }
  if (c.variant === "categories") preferences.categories = ["rhythm"];
  if (c.variant === "goal") {
    add("harbor", 1790, "shot", 1790);
    const goal = match.events.at(-1)!;
    match.finalScore = { harbor: 1, riverside: 0 };
    goal.scoringTeam = "harbor";
    goal.outcome = "goal";
    goal.playerId = goal.actorId!;
  }
  match.events
    .sort((a, b) => a.time - b.time)
    .forEach((e, i) => {
      e.order = i;
    });
  validateMatch(match);
  return { match, cutoff, context: { preferences } };
}
