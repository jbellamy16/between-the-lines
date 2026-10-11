import { z } from "zod";
import { other, TEAMS, type TeamId } from "../match";
import {
  CANONICAL_PITCH,
  recordedScore,
  validateMatch,
  type MatchData,
  type MatchSource,
  type NormalizedEvent,
} from "./model";
const rawEventSchema = z.object({
  id: z.number(),
  matchId: z.number(),
  teamId: z.number(),
  playerId: z.number(),
  matchPeriod: z.enum(["1H", "2H"]),
  eventSec: z.number().nonnegative(),
  eventId: z.number(),
  eventName: z.string(),
  subEventName: z.string(),
  subEventId: z.union([z.number(), z.literal("")]),
  positions: z.array(
    z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
  ),
  tags: z.array(z.object({ id: z.number() })),
});
const lineup = z.array(z.object({ playerId: z.number() }));
export const rawMatchSchema = z.object({
  match: z.object({
    wyId: z.number(),
    dateutc: z.string(),
    status: z.literal("Played"),
    competitionId: z.number(),
    seasonId: z.number(),
    teamsData: z.record(
      z.string(),
      z.object({
        teamId: z.number(),
        side: z.enum(["home", "away"]),
        score: z.number(),
        formation: z.object({
          lineup,
          bench: lineup,
          substitutions: z.array(
            z.object({
              playerIn: z.number(),
              playerOut: z.number(),
              minute: z.number().nonnegative(),
            }),
          ),
        }),
      }),
    ),
  }),
  events: z.array(rawEventSchema),
  teams: z.array(z.object({ wyId: z.number(), name: z.string() })),
  players: z.array(
    z.object({ wyId: z.number(), shortName: z.string(), role: z.string() }),
  ),
});
export const HISTORICAL_LIMITATIONS = [
  "Wyscout historical events, not live coverage or continuous player tracking. Coordinates are relative to the attacking team; physical stadium direction is unavailable.",
  "No calibrated xG, possession duration, pass recipients or off-ball positions. Possession is not reconstructed from contested touches. High-ball-win/pressing claims are disabled.",
  "Substitutions come from match metadata at minute precision, appear at the end of the reported minute, and have no pitch position. Jersey numbers are unavailable.",
  "Replay preserves both halves and stoppage time, omits the interval, and ends at the last available record. Counts describe this dataset, not an independent official statistics feed.",
  "Activity comparisons use equal windows within one half. Their actual duration is shown with each measurement. They describe activity, not statistical significance or tactical cause.",
];
export function normalizeHistorical(input: unknown): MatchData {
  const raw = rawMatchSchema.parse(input),
    id = String(raw.match.wyId);
  if (raw.match.competitionId !== 364 || raw.match.seasonId !== 181150)
    throw new Error("Unsupported competition/season");
  const entries = Object.values(raw.match.teamsData);
  if (entries.length !== 2 || new Set(entries.map((t) => t.side)).size !== 2)
    throw new Error("Expected home and away teams");
  const side = (teamId: number): TeamId => {
    const t = entries.find((t) => t.teamId === teamId);
    if (!t) throw new Error("Unknown team");
    return t.side === "home" ? "harbor" : "riverside";
  };
  if (
    !raw.events.some((e) => e.matchPeriod === "1H") ||
    !raw.events.some((e) => e.matchPeriod === "2H")
  )
    throw new Error("Incomplete match periods");
  const secondHalfStart = Math.max(
    2700,
    Math.ceil(
      Math.max(
        ...raw.events
          .filter((e) => e.matchPeriod === "1H")
          .map((e) => e.eventSec),
      ),
    ) + 1,
  );
  const events: NormalizedEvent[] = raw.events.map((e, order) => {
    if (String(e.matchId) !== id) throw new Error("Mismatched match ID");
    const tags = e.tags.map((t) => t.id),
      team = side(e.teamId);
    const shot = e.eventId === 10 || [33, 35].includes(Number(e.subEventId));
    const ownGoal = tags.includes(102),
      goal = shot && tags.includes(101);
    const type: NormalizedEvent["type"] = shot
      ? "shot"
      : e.eventId === 8
        ? "pass"
        : e.eventId === 1
          ? "duel"
          : e.eventId === 2
            ? "foul"
            : e.subEventId === 30
              ? "corner"
              : e.eventId === 3
                ? "restart"
                : e.eventId === 6
                  ? "offside"
                  : e.eventId === 7
                    ? "touch"
                    : e.eventId === 5
                      ? "interruption"
                      : e.eventId === 9
                        ? "save"
                        : "other";
    // Shot second coordinates often encode the goalmouth, not a pitch endpoint.
    // Keep only pass endpoints as verified pitch destinations.
    const positioned =
      !["interruption", "save", "other"].includes(type) &&
      e.positions.length > 0;
    return {
      id: `wyscout-${id}-${e.id}`,
      matchId: id,
      order,
      teamId: String(e.teamId),
      actorId: e.playerId === 0 ? null : String(e.playerId),
      qualifiers: {
        ...(tags.includes(1401) ? { interception: true } : {}),
        ...(tags.includes(1701)
          ? { card: "Red Card" }
          : tags.includes(1702)
            ? { card: "Yellow Card" }
            : tags.includes(1703)
              ? { card: "Second Yellow" }
              : {}),
      },
      relatedEvents: [],
      statistics: {},
      ...(tags.includes(1801)
        ? { result: "complete" }
        : tags.includes(1802)
          ? { result: "incomplete" }
          : {}),
      time: (e.matchPeriod === "2H" ? secondHalfStart : 0) + e.eventSec,
      period: e.matchPeriod,
      periodSeconds: e.eventSec,
      team,
      playerId: String(e.playerId),
      type,
      position: positioned ? e.positions[0] : null,
      ...(type === "pass" && e.positions.length > 1
        ? { end: e.positions[1] }
        : {}),
      ...(tags.includes(1801)
        ? { success: true }
        : tags.includes(1802)
          ? { success: false }
          : {}),
      ...(goal ? { outcome: "goal" as const } : {}),
      ...(goal || ownGoal
        ? { scoringTeam: ownGoal ? other(team) : team, ownGoal }
        : {}),
      possessionId: null,
      source: {
        provider: "wyscout",
        matchId: id,
        eventId: String(e.id),
        teamId: String(e.teamId),
        playerId: String(e.playerId),
        eventType: `${e.eventName} / ${e.subEventName}`,
        tags,
        precision: "second",
        coordinates: {
          ...(e.positions[0]
            ? { start: [e.positions[0].x, e.positions[0].y] }
            : {}),
          ...(e.positions[1]
            ? { end: [e.positions[1].x, e.positions[1].y] }
            : {}),
          transform: "identity-percent-v1",
        },
        raw: {
          ...(input as { events: Record<string, unknown>[] }).events[order],
        },
      },
    };
  });
  for (const t of entries)
    for (const [i, s] of t.formation.substitutions.entries()) {
      const period = s.minute < 45 ? "1H" : "2H";
      const periodSeconds = (s.minute + 1 - (period === "2H" ? 45 : 0)) * 60;
      const ref = `teamsData.${t.teamId}.formation.substitutions.${i}`;
      events.push({
        id: `wyscout-${id}-${ref}`,
        matchId: id,
        order: 0,
        teamId: String(t.teamId),
        actorId: String(s.playerOut),
        qualifiers: {},
        relatedEvents: [],
        statistics: {},
        time: (period === "2H" ? secondHalfStart : 0) + periodSeconds,
        period,
        periodSeconds,
        team: side(t.teamId),
        playerId: String(s.playerIn),
        outgoingId: String(s.playerOut),
        type: "substitution",
        position: null,
        possessionId: null,
        source: {
          provider: "wyscout",
          matchId: id,
          eventId: ref,
          teamId: String(t.teamId),
          playerId: String(s.playerIn),
          eventType: "Metadata substitution",
          tags: [],
          precision: "minute",
          coordinates: { transform: "none" },
          raw: { ...s },
          reportedMinute: s.minute,
        },
      });
    }
  events.sort((a, b) => a.time - b.time);
  events.forEach((e, i) => {
    e.order = i;
  });
  const teams = Object.fromEntries(
    entries.map((t) => {
      const identity = raw.teams.find((x) => x.wyId === t.teamId);
      if (!identity) throw new Error("Missing team identity");
      return [
        side(t.teamId),
        {
          id: String(t.teamId),
          lineup: t.formation.lineup.map((p) => String(p.playerId)),
          bench: t.formation.bench.map((p) => String(p.playerId)),
          name: identity.name,
          short: identity.name,
          color: TEAMS[side(t.teamId)].color,
        },
      ];
    }),
  ) as MatchData["teams"];
  const finalScore = Object.fromEntries(
    entries.map((t) => [side(t.teamId), t.score]),
  ) as MatchData["finalScore"];
  const actual = recordedScore(events);
  if (
    actual.harbor !== finalScore.harbor ||
    actual.riverside !== finalScore.riverside
  )
    throw new Error("Goal events do not reconcile with match metadata");
  const players = entries.flatMap((t) => {
    const ids = new Set(
      [...t.formation.lineup, ...t.formation.bench].map((p) => p.playerId),
    );
    raw.events
      .filter((e) => e.teamId === t.teamId && e.playerId !== 0)
      .forEach((e) => ids.add(e.playerId));
    return [...ids].map((pid) => {
      const p = raw.players.find((p) => p.wyId === pid);
      return {
        id: String(pid),
        sourceId: String(pid),
        name: p?.shortName ?? `Unidentified player (${pid})`,
        role: p?.role ?? "Unavailable",
        team: side(t.teamId),
        number: null,
      };
    });
  });
  return validateMatch({
    schemaVersion: "1.0.0",
    pitch: CANONICAL_PITCH,
    season: "2017–18",
    venue: null,
    status: "finished",
    periods: [
      { id: "1H", start: 0, end: secondHalfStart - 1, clockStart: 0 },
      {
        id: "2H",
        start: secondHalfStart,
        end: Math.ceil(events.at(-1)!.time),
        clockStart: 2700,
      },
    ],
    provenance: {
      provider: "wyscout",
      sourceMatchId: id,
      adapterVersion: "1.0.0",
      revision: "figshare-4415000-pinned",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      redistribution: "permitted-with-attribution",
      raw: { match: (input as { match: unknown }).match },
    },
    id,
    kind: "historical",
    title: `${teams.harbor.name} vs ${teams.riverside.name}`,
    date: raw.match.dateutc.replace(" ", "T") + "Z",
    competition: "Premier League · 2017–18",
    duration: Math.ceil(events.at(-1)!.time),
    secondHalfStart,
    teams,
    players,
    events,
    finalScore,
    attribution: "Wyscout · Pappalardo & Massucco (2019) · CC BY 4.0",
    sourceUrl: "https://doi.org/10.6084/m9.figshare.c.4415000",
    capabilities: {
      recoveries: false,
      shotOutcomes: false,
      comparisonScope: "period",
      lineups: true,
      substitutions: true,
      passRecipients: false,
      physicalDirection: false,
      tracking: false,
      xg: false,
      ballRecoveries: false,
      possession: "unavailable",
    },
    limitations: HISTORICAL_LIMITATIONS,
  });
}
export class HistoricalMatchSource implements MatchSource {
  readonly kind = "historical" as const;
  constructor(private readonly read: (id: string) => Promise<unknown>) {}
  async load(id: string) {
    return normalizeHistorical(await this.read(id));
  }
}

/** Explicit provider name; HistoricalMatchSource is retained for existing callers. */
export {
  HistoricalMatchSource as WyscoutMatchSource,
  normalizeHistorical as normalizeWyscout,
};
