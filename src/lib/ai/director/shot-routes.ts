import type { MatchData, NormalizedEvent } from "../../sources/model";
import { highRecoveryBefore, visibleEvents } from "./observer";
import { validIdentity, type ObservationWindow } from "./hypothesis";

export const interpretationIds = [
  "repeated-route",
  "concentrated-attempts",
  "both-teams",
] as const;
export type InterpretationId = (typeof interpretationIds)[number];
export type RouteFact = {
  id: string;
  value: number | null;
  eventIds: string[];
};
export type RouteWindow = {
  window: ObservationWindow;
  shots: number;
  linkedShots: number;
  shotPossessions: number | null;
  linkedPossessions: number | null;
  largestPossession: number | null;
  early: number;
  late: number;
  complete: boolean;
  unavailable: string[];
};
export type ShotRoutes = {
  matchId: string;
  team: NormalizedEvent["team"];
  possessionKind: MatchData["capabilities"]["possession"];
  previous: RouteWindow;
  current: RouteWindow;
  facts: RouteFact[];
  relations: {
    id: string;
    window: string;
    eventIds: string[];
    possessionId: number;
  }[];
  eventIds: string[];
  contextBounds: { start: number; end: number };
  referenceCoverage: { eligible: number; returned: number; omitted: number };
  complete: boolean;
  suppressed: boolean;
};
export type Interpretation = {
  id: InterpretationId;
  status: "supported" | "limited" | "unresolved";
  supportIds: string[];
  challengeIds: string[];
  text: string;
};

/** Complete paired aggregates, never computed from the tool's last 40 display events. */
export function compareShotRoutes(
  match: MatchData,
  cutoff: number,
  team: NormalizedEvent["team"],
  start: number,
  end: number,
): ShotRoutes {
  const width = end - start;
  const period = match.periods.find(
    (p) => start - width >= p.start && end <= p.end,
  );
  if (!period || width <= 0 || width > 1800 || end > cutoff)
    throw new Error("Invalid route windows");
  const visible = visibleEvents(match, cutoff);
  if (new Set(visible.map((e) => e.id)).size !== visible.length)
    throw new Error("Duplicate route event identity");
  const facts: RouteFact[] = [],
    relations: ShotRoutes["relations"] = [];
  const refs = new Set<string>();
  const windows = [
    {
      id: "previous",
      start: start - width,
      end: start,
      period: period.id,
      boundary: "(start,end]" as const,
    },
    {
      id: "current",
      start,
      end,
      period: period.id,
      boundary: "(start,end]" as const,
    },
  ];
  const summaries = windows.map((window) => {
    const shots = visible.filter(
      (e) =>
        e.team === team &&
        e.period === period.id &&
        e.type === "shot" &&
        e.time > window.start &&
        e.time <= window.end,
    );
    // Include possible boundary-spanning recovery context, even when identity or timing is missing.
    const recoveries = visible.filter(
      (e) =>
        e.team === team &&
        e.period === period.id &&
        e.type === "recovery" &&
        e.success !== false &&
        e.time >= window.start - 30 &&
        e.time <= window.end,
    );
    const unavailable: string[] = [];
    if (!match.capabilities.ballRecoveries)
      unavailable.push("Recovery events unavailable.");
    if (
      match.capabilities.possession === "unavailable" ||
      [...shots, ...recoveries].some((e) => e.possessionId === null)
    )
      unavailable.push("Possession identity incomplete.");
    if ([...shots, ...recoveries].some((e) => e.source.precision === "minute"))
      unavailable.push("Second-level timing unavailable.");
    if (recoveries.some((e) => !e.position))
      unavailable.push("Recovery locations incomplete.");
    for (const e of [...shots, ...recoveries]) {
      if (!validIdentity(match, e))
        throw new Error("Route evidence identity violation");
      refs.add(e.id);
    }
    const linked = shots.flatMap((shot) => {
      const recovery = highRecoveryBefore(match, visible, shot);
      return recovery ? [{ recovery, shot }] : [];
    });
    for (const { recovery, shot } of linked) {
      relations.push({
        id: `link:${shot.id}`,
        window: window.id,
        eventIds: [recovery.id, shot.id],
        possessionId: shot.possessionId!,
      });
      refs.add(recovery.id);
    }
    const groups = new Map<number, NormalizedEvent[]>();
    for (const shot of shots)
      if (shot.possessionId !== null)
        groups.set(shot.possessionId, [
          ...(groups.get(shot.possessionId) ?? []),
          shot,
        ]);
    const complete = unavailable.length === 0;
    const possessionsKnown =
      match.capabilities.possession !== "unavailable" &&
      shots.every((e) => e.possessionId !== null);
    const early = shots.filter(
      (e) => e.time <= (window.start + window.end) / 2,
    );
    const late = shots.filter((e) => e.time > (window.start + window.end) / 2);
    const summary: RouteWindow = {
      window,
      shots: shots.length,
      linkedShots: linked.length,
      shotPossessions: possessionsKnown ? groups.size : null,
      linkedPossessions: complete
        ? new Set(linked.map((v) => v.shot.possessionId)).size
        : null,
      largestPossession: possessionsKnown
        ? Math.max(0, ...[...groups.values()].map((v) => v.length))
        : null,
      early: early.length,
      late: late.length,
      complete,
      unavailable,
    };
    for (const key of [
      "shots",
      "linkedShots",
      "shotPossessions",
      "linkedPossessions",
      "largestPossession",
      "early",
      "late",
    ] as const) {
      facts.push({
        id: `${window.id}:${key}`,
        value: summary[key],
        eventIds:
          key === "early"
            ? early.map((e) => e.id)
            : key === "late"
              ? late.map((e) => e.id)
              : key === "linkedShots" || key === "linkedPossessions"
                ? [
                    ...new Set(
                      linked.flatMap((v) => [v.recovery.id, v.shot.id]),
                    ),
                  ]
                : shots.map((e) => e.id),
      });
    }
    return summary;
  });
  const eventIds = visible.filter((e) => refs.has(e.id)).map((e) => e.id);
  const result: ShotRoutes = {
    matchId: match.id,
    team,
    possessionKind: match.capabilities.possession,
    previous: summaries[0],
    current: summaries[1],
    facts,
    relations,
    eventIds,
    referenceCoverage: {
      eligible: eventIds.length,
      returned: eventIds.length,
      omitted: 0,
    },
    contextBounds: {
      start: Math.min(
        windows[0].start,
        ...visible.filter((e) => refs.has(e.id)).map((e) => e.time),
      ),
      end,
    },
    complete: summaries.every((s) => s.complete),
    suppressed: false,
  };
  if (eventIds.length > 120 || JSON.stringify(result).length > 20000) {
    // No partial comparison, extrapolation, or enlarged evidence caps.
    result.suppressed = true;
    result.complete = false;
    result.facts = [];
    result.relations = [];
    result.eventIds = [];
    result.referenceCoverage = {
      eligible: eventIds.length,
      returned: 0,
      omitted: eventIds.length,
    };
    for (const w of [result.previous, result.current]) {
      w.complete = false;
      w.linkedPossessions = null;
      w.shotPossessions = null;
      w.largestPossession = null;
      w.unavailable.push(
        "Complete route references exceed the evidence limit; comparison suppressed.",
      );
    }
  }
  return result;
}

export function routeInterpretations(
  routes: ShotRoutes,
  opponent: { previous: number; current: number },
): Interpretation[] {
  const a = routes.previous,
    b = routes.current;
  const repeated =
    routes.complete &&
    b.linkedPossessions! >= 2 &&
    b.linkedPossessions! > a.linkedPossessions!;
  const concentrated =
    !routes.suppressed &&
    b.shots >= 2 &&
    ((b.largestPossession !== null &&
      b.largestPossession >= b.shots / 2 &&
      b.largestPossession >= 2) ||
      b.early === 0 ||
      b.late === 0);
  const both = b.shots > a.shots && opponent.current > opponent.previous;
  const fact = (key: string) =>
    routes.facts.filter((f) => f.id.endsWith(`:${key}`)).map((f) => f.id);
  return [
    {
      id: "repeated-route",
      status: !routes.complete
        ? "unresolved"
        : repeated
          ? "supported"
          : "limited",
      supportIds: fact("linkedPossessions"),
      challengeIds: [...fact("linkedShots"), ...fact("early"), ...fact("late")],
      text: !routes.complete
        ? "The recurrence of the recovery-to-shot route cannot be compared completely."
        : repeated
          ? "The recovery-to-shot route recurred in multiple possessions, more often than in the earlier window."
          : "The evidence does not establish an increase in repeated recovery-to-shot possessions.",
    },
    {
      id: "concentrated-attempts",
      status: routes.suppressed
        ? "unresolved"
        : concentrated
          ? "supported"
          : b.largestPossession === null
            ? "unresolved"
            : "limited",
      supportIds: [
        ...fact("largestPossession"),
        ...fact("shots"),
        ...fact("early"),
        ...fact("late"),
      ],
      challengeIds: fact("linkedPossessions"),
      text: concentrated
        ? "The attempts are concentrated in one possession or one fixed half of this spell."
        : "The evidence does not establish a brief concentration of attempts.",
    },
    {
      id: "both-teams",
      status: both ? "supported" : "limited",
      supportIds: [
        "own-previous",
        "own-current",
        "opponent-previous",
        "opponent-current",
      ],
      challengeIds: [],
      text: both
        ? "Both teams increased their shot activity across the same windows."
        : "The shot increase is not shared by both teams across these windows.",
    },
  ];
}
