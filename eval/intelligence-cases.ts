import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  validateMatch,
  type MatchData,
  type NormalizedEvent,
} from "../src/lib/sources/model";
import type { Mode, StoryPreferences } from "../src/lib/intelligence";

export type IntelligenceCase = {
  id: string;
  question: string;
  match: MatchData;
  cutoff: number;
  mode: Mode;
  preferences: StoryPreferences;
  historicalCase?: string;
  frozenCase?: string;
  rewindOf?: string;
};
const source = new SyntheticMatchSource();

// Explicit test-only challenges mirror the existing adversarial architecture.
// The shipped generator, original fixtures and source capabilities are unchanged.
function challenge(
  name: string,
  specs: {
    time: number;
    team?: "harbor" | "riverside";
    xg?: number;
    type?: "shot" | "pass";
  }[],
): MatchData {
  const match = source.read("quiet");
  match.id = `live-challenge-${name}`;
  match.provenance.sourceMatchId = match.id;
  match.provenance.revision = "challenge-v1";
  match.provenance.raw = {
    fixture: name,
    testOnly: true,
    derivedFrom: "quiet",
    seed: "explicit-events",
  };
  match.capabilities.xg = specs.every(
    (s) => s.type === "pass" || s.xg !== undefined,
  );
  match.finalScore = { harbor: 0, riverside: 0 };
  match.events = specs
    .toSorted((a, b) => a.time - b.time)
    .map((s, order): NormalizedEvent => {
      const team = s.team ?? "harbor",
        actorId = match.teams[team].lineup[7],
        id = `${match.id}:${order}`,
        type = s.type ?? "shot";
      return {
        id,
        matchId: match.id,
        order,
        teamId: team,
        team,
        time: s.time,
        period: "1H",
        periodSeconds: s.time,
        playerId: actorId,
        actorId,
        type,
        position: { x: type === "shot" ? 80 : 25, y: 50 },
        ...(type === "pass"
          ? {
              end: { x: 25, y: 51 },
              success: true,
              recipientId: match.teams[team].lineup[8],
            }
          : { outcome: "wide" as const }),
        possessionId: Math.floor(s.time / 30),
        qualifiers: {},
        relatedEvents: [],
        statistics: s.xg === undefined ? {} : { xg: s.xg },
        ...(s.xg === undefined ? {} : { xg: s.xg }),
        source: {
          provider: "synthetic",
          matchId: match.id,
          eventId: id,
          teamId: team,
          playerId: actorId,
          eventType: type,
          tags: [],
          precision: "second",
          coordinates: { transform: "identity-percent-v1" },
          raw: {},
        },
      };
    });
  return validateMatch(match);
}

export function intelligenceCases(): IntelligenceCase[] {
  const pressure = source.read("pressure"),
    quiet = source.read("quiet"),
    sub = source.read("substitution");
  const base = { mode: "fan" as const, preferences: {} };
  const decliningQuality = challenge("misleading-quality", [
    { time: 100, xg: 0.8 },
    ...[1200, 1300, 1400, 1500].map((time) => ({ time, xg: 0.05 })),
  ]);
  const opposed = challenge("opponent-matches", [
    ...[100, 1200, 1300, 1400, 1500].map((time) => ({ time })),
    ...[1210, 1310, 1410, 1510, 1610].map((time) => ({
      time,
      team: "riverside" as const,
    })),
  ]);
  const fading = challenge(
    "fading-burst",
    [100, 910, 920, 930, 940].map((time) => ({ time })),
  );
  const inactive = challenge(
    "inactive-favorite",
    [100, 1200, 1300, 1400, 1500].map((time) => ({ time })),
  );
  return [
    {
      ...base,
      id: "misleading-quality",
      question:
        "Four shots versus one, but total synthetic xG falls from 0.8 to 0.2; qualify quality.",
      match: decliningQuality,
      cutoff: 1800,
    },
    {
      ...base,
      id: "opponent-matches",
      question:
        "Harbor shot rise while Riverside has five attempts; no dominance claim.",
      match: opposed,
      cutoff: 1800,
    },
    {
      ...base,
      id: "fading-burst",
      question:
        "Old four-shot burst has ended; wider count increase is not sustained momentum.",
      match: fading,
      cutoff: 1800,
    },
    {
      ...base,
      id: "inactive-favorite",
      question: "Favorite has zero events; do not manufacture a player story.",
      match: inactive,
      cutoff: 1800,
      preferences: { player: inactive.teams.harbor.lineup[1], team: "harbor" },
    },
    {
      ...base,
      id: "quiet-routine",
      question:
        "Repeated safe passes offer no meaningful change; consider silence.",
      match: challenge(
        "routine-passes",
        Array.from({ length: 30 }, (_, i) => ({
          time: 1200 + i * 10,
          type: "pass" as const,
        })),
      ),
      cutoff: 1800,
    },
    {
      ...base,
      id: "kickoff",
      question: "No events; abstain without a model call.",
      match: quiet,
      cutoff: 0,
    },
    {
      ...base,
      id: "pressure-fan",
      question: "Find the strongest change and a complementary named moment.",
      match: pressure,
      cutoff: 3804,
      historicalCase: "pressure-fan",
    },
    {
      ...base,
      id: "pressure-analyst",
      question: "Explain the shot rise with useful qualification.",
      match: pressure,
      cutoff: 3804,
      mode: "analyst",
      historicalCase: "pressure-analyst",
    },
    {
      ...base,
      id: "temporal-emerging",
      question:
        "Recognize emerging high recoveries without claiming pressing intensity.",
      match: pressure,
      cutoff: 3900,
    },
    {
      ...base,
      id: "temporal-weakening",
      question: "Recognize that Harbor high recoveries have weakened.",
      match: pressure,
      cutoff: 4200,
      frozenCase: "pressure-4200-fan",
    },
    {
      ...base,
      id: "temporal-resolved",
      question:
        "Resolve the earlier Harbor recovery rise and notice Riverside.",
      match: pressure,
      cutoff: 4500,
    },
    {
      ...base,
      id: "rewind",
      question:
        "Only the earlier state can influence this independent backward seek.",
      match: {
        ...pressure,
        events: pressure.events.filter((e) => e.time <= 3900),
      },
      cutoff: 3900,
      rewindOf: "temporal-emerging",
    },
    {
      ...base,
      id: "after-substitution",
      question:
        "Name the substitute's recorded contributions without causal improvement.",
      match: sub,
      cutoff:
        Math.ceil(sub.events.find((e) => e.type === "substitution")!.time) +
        600,
      mode: "analyst",
      historicalCase: "after-substitution",
    },
    {
      ...base,
      id: "player-preference",
      question:
        "Investigate Leon Costa when useful without hiding match-wide change.",
      match: pressure,
      cutoff: 3804,
      preferences: { player: "harbor-9", team: "harbor" },
      historicalCase: "player-preference",
    },
    {
      ...base,
      id: "unfamiliar-8911",
      question:
        "Repeat the earlier balanced fixture for a historical comparison.",
      match: source.read("pressure", { seed: 8911, profile: "balanced" }),
      cutoff: 4200,
      historicalCase: "unfamiliar-fan",
    },
    {
      ...base,
      id: "unfamiliar-73129",
      question: "Generalize to a seed absent from previous live evaluation.",
      match: source.read("pressure", { seed: 73129, profile: "balanced" }),
      cutoff: 4200,
      mode: "analyst",
    },
    {
      ...base,
      id: "quiet-fan",
      question: "Distinguish worthwhile recorded events from routine activity.",
      match: quiet,
      cutoff: 3804,
      historicalCase: "quiet-fan",
    },
    {
      ...base,
      id: "full-time",
      question:
        "Give coherent end-of-match context and no future-match watch criterion.",
      match: pressure,
      cutoff: 5400,
    },
  ];
}
