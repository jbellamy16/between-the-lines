import { SyntheticMatchSource } from "../../src/lib/sources/synthetic";
import {
  validateMatch,
  type NormalizedEvent,
} from "../../src/lib/sources/model";

// These are authored diagnostics, not held-out matches or model-generated labels.
// Tuple: recorded second, possession ID. All shots have xG .1 unless marked missing.
type Action = [number, number];
type Status = "supported" | "limited" | "unresolved";
export type Case = {
  id: string;
  family: string;
  category: string;
  previousShots: Action[];
  previousRecoveries: Action[];
  shots: Action[];
  recoveries: Action[];
  opponent: number[];
  missing?: "possession" | "location" | "timing" | "xg";
  eligible: boolean;
  statuses: [Status, Status, Status] | null;
  // Independent hand-labelled facts which change/qualify an interpretation.
  useful: string[];
  relevantAnchors: number[];
};
const cluster = {
  previousShots: [
    [210, 1],
    [610, 2],
  ] as Action[],
  previousRecoveries: [[200, 1]] as Action[],
  shots: [
    [960, 10],
    [970, 10],
    [980, 10],
    [1190, 20],
    [1300, 30],
    [1710, 40],
  ] as Action[],
  recoveries: [
    [950, 10],
    [1180, 20],
  ] as Action[],
  opponent: [410, 1050, 1150, 1250, 1450, 1750],
};
const spread = {
  ...cluster,
  shots: [
    [960, 10],
    [1120, 11],
    [1430, 12],
    [1640, 13],
    [1300, 30],
    [1710, 40],
  ] as Action[],
  recoveries: [
    [950, 10],
    [1110, 11],
    [1420, 12],
    [1630, 13],
  ] as Action[],
};
const routes = [
  "previous:linkedPossessions",
  "current:linkedPossessions",
  "current:largestPossession",
];
export const cases: Case[] = [
  {
    ...cluster,
    id: "misleading-many-shots-one-recovery",
    family: "grouping",
    category: "misleading evidence",
    eligible: true,
    statuses: ["supported", "supported", "supported"],
    useful: routes,
    relevantAnchors: [960, 970, 980],
  },
  {
    ...spread,
    id: "matched-separate-possessions",
    family: "grouping",
    category: "repeated routes",
    eligible: true,
    statuses: ["supported", "limited", "supported"],
    useful: routes,
    relevantAnchors: [1710],
  },
  {
    ...cluster,
    previousRecoveries: [
      [200, 1],
      [600, 2],
    ],
    id: "unchanged-route-frequency",
    family: "frequency",
    category: "misleading evidence",
    eligible: true,
    statuses: ["limited", "supported", "supported"],
    useful: routes,
    relevantAnchors: [960, 970, 980],
  },
  {
    ...spread,
    id: "opponent-also-active",
    family: "opponent",
    category: "opponent activity",
    eligible: true,
    statuses: ["supported", "limited", "supported"],
    useful: ["opponent-current", ...routes],
    relevantAnchors: [1710],
  },
  {
    ...spread,
    opponent: [410, 1450],
    id: "opponent-unchanged",
    family: "opponent",
    category: "opponent activity",
    eligible: true,
    statuses: ["supported", "limited", "limited"],
    useful: ["opponent-current", ...routes],
    relevantAnchors: [1710],
  },
  {
    ...spread,
    shots: [
      [960, 10],
      [1060, 11],
      [1160, 12],
      [1260, 13],
      [1300, 30],
      [1710, 40],
    ],
    recoveries: [
      [950, 10],
      [1050, 11],
      [1150, 12],
      [1250, 13],
    ],
    id: "momentum-fades",
    family: "timing",
    category: "fading momentum",
    eligible: true,
    statuses: ["supported", "limited", "supported"],
    useful: ["early-count", "late-count", ...routes],
    relevantAnchors: [1710],
  },
  {
    ...spread,
    id: "matched-momentum-persists",
    family: "timing",
    category: "fading momentum",
    eligible: true,
    statuses: ["supported", "limited", "supported"],
    useful: ["early-count", "late-count", ...routes],
    relevantAnchors: [1710],
  },
  ...(["possession", "location", "timing"] as const).map((missing) => ({
    ...cluster,
    id: `missing-${missing}`,
    family: "missing",
    category: "missing information",
    missing,
    eligible: false,
    statuses: ["unresolved", "supported", "supported"] as Case["statuses"],
    useful: ["current:linkedPossessions"],
    relevantAnchors: [],
  })),
  {
    ...cluster,
    id: "missing-xg",
    family: "missing",
    category: "missing information",
    missing: "xg",
    eligible: true,
    statuses: ["supported", "supported", "supported"],
    useful: ["current-xg", ...routes],
    relevantAnchors: [960, 970, 980],
  },
  {
    ...cluster,
    recoveries: [],
    previousRecoveries: [],
    id: "no-recovery-links",
    family: "control",
    category: "settled no-call",
    eligible: false,
    statuses: ["limited", "supported", "supported"],
    useful: ["current:linkedPossessions"],
    relevantAnchors: [],
  },
  {
    ...cluster,
    shots: [[1200, 10]],
    recoveries: [],
    previousRecoveries: [],
    opponent: [410, 1450],
    id: "quiet-match",
    family: "quiet",
    category: "quiet match",
    eligible: false,
    statuses: null,
    useful: [],
    relevantAnchors: [],
  },
  {
    ...cluster,
    shots: [],
    previousShots: [],
    recoveries: [],
    previousRecoveries: [],
    opponent: [],
    id: "empty-match",
    family: "quiet",
    category: "quiet match",
    eligible: false,
    statuses: null,
    useful: [],
    relevantAnchors: [],
  },
];

export function buildCase(c: Case) {
  const match = structuredClone(new SyntheticMatchSource().read("pressure"));
  const templates = Object.fromEntries(
    ["harbor", "riverside"].map((team) => [
      team,
      match.events.find((e) => e.team === team && e.actorId)!,
    ]),
  );
  match.id = `offline-eval:${c.id}`;
  match.provenance.sourceMatchId = match.id;
  match.provenance.revision = "director-offline-v1";
  match.events = [];
  match.finalScore = { harbor: 0, riverside: 0 };
  const add = (
    time: number,
    possessionId: number,
    type: "shot" | "recovery",
    team: "harbor" | "riverside",
  ) => {
    const e: NormalizedEvent = structuredClone(templates[team]);
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
      id: `${match.id}:${team}:${time}:${type}`,
      matchId: match.id,
      time,
      period: "1H",
      periodSeconds: time,
      type,
      possessionId,
      position: { x: 80, y: 50 },
      success: true,
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
    if (team === "harbor" && time === c.recoveries[0]?.[0]) {
      if (c.missing === "possession") e.possessionId = null;
      if (c.missing === "location") e.position = null;
      if (c.missing === "timing") e.source.precision = "minute";
    }
    if (c.missing === "xg" && team === "harbor" && time === c.shots[0]?.[0])
      delete e.xg;
    match.events.push(e);
  };
  for (const [time, id] of [...c.previousShots, ...c.shots])
    add(time, id, "shot", "harbor");
  for (const [time, id] of [...c.previousRecoveries, ...c.recoveries])
    add(time, id, "recovery", "harbor");
  c.opponent.forEach((time, index) =>
    add(time, index + 1, "shot", "riverside"),
  );
  match.events
    .sort((a, b) => a.time - b.time)
    .forEach((e, order) => {
      e.order = order;
    });
  validateMatch(match);
  return match;
}

/** Reference arithmetic consumes authored tuples only, never production evidence or predicates. */
export function referenceFacts(c: Case): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const [label, shots, recoveries] of [
    ["previous", c.previousShots, c.previousRecoveries],
    ["current", c.shots, c.recoveries],
  ] as const) {
    const missingRoute =
      label === "current" &&
      ["possession", "location", "timing"].includes(c.missing ?? "");
    const usableRecoveries = missingRoute ? recoveries.slice(1) : recoveries;
    const linked = shots.filter(([time, id]) =>
      usableRecoveries.some(([r, p]) => p === id && time > r && time - r <= 30),
    );
    const groupSizes = [...new Set(shots.map((s) => s[1]))].map(
      (id) => shots.filter((s) => s[1] === id).length,
    );
    Object.assign(result, {
      [`${label}:shots`]: shots.length,
      [`${label}:linkedShots`]: linked.length,
      [`${label}:shotPossessions`]: groupSizes.length,
      [`${label}:linkedPossessions`]: missingRoute
        ? null
        : new Set(linked.map((s) => s[1])).size,
      [`${label}:largestPossession`]: Math.max(0, ...groupSizes),
      [`${label}:early`]: shots.filter(
        (s) => s[0] <= (label === "previous" ? 450 : 1350),
      ).length,
      [`${label}:late`]: shots.filter(
        (s) => s[0] > (label === "previous" ? 450 : 1350),
      ).length,
      [`${label}-shots`]: shots.length,
      [`${label}-xg`]:
        label === "current" && c.missing === "xg" ? null : shots.length / 10,
      [`${label}-mean-xg`]:
        (label === "current" && c.missing === "xg") || !shots.length
          ? null
          : 0.1,
      [`${label}-rated-shots`]:
        shots.length - (label === "current" && c.missing === "xg" ? 1 : 0),
    });
  }
  return {
    ...result,
    "own-previous": c.previousShots.length,
    "own-current": c.shots.length,
    "opponent-previous": c.opponent.filter((t) => t <= 900).length,
    "opponent-current": c.opponent.filter((t) => t > 900).length,
    "early-count": result["current:early"],
    "late-count": result["current:late"],
  };
}

/** Expected citations use the authored event tuples, independently of production IDs lists. */
export function referenceEventIds(c: Case, id: string): string[] {
  const eventId = (team: string, time: number, type = "shot") =>
    `offline-eval:${c.id}:${team}:${time}:${type}`;
  const window =
    id.startsWith("previous") || id === "own-previous" ? "previous" : "current";
  const shots = window === "previous" ? c.previousShots : c.shots;
  if (id.startsWith("opponent"))
    return c.opponent
      .filter((t) => (id === "opponent-previous" ? t <= 900 : t > 900))
      .map((t) => eventId("riverside", t));
  if (id === "count-change")
    return [...c.previousShots, ...c.shots].map((s) => eventId("harbor", s[0]));
  if (id.includes("linked")) {
    let recoveries =
      window === "previous" ? c.previousRecoveries : c.recoveries;
    if (
      window === "current" &&
      ["possession", "location", "timing"].includes(c.missing ?? "")
    )
      recoveries = recoveries.slice(1);
    return [
      ...new Set(
        shots.flatMap(([time, possession]) => {
          const recovery = recoveries.findLast(
            ([t, p]) => p === possession && time > t && time - t <= 30,
          );
          return recovery
            ? [
                eventId("harbor", recovery[0], "recovery"),
                eventId("harbor", time),
              ]
            : [];
        }),
      ),
    ];
  }
  return shots
    .filter(([time]) => {
      if (id === "early-count" || id.endsWith(":early"))
        return time <= (window === "previous" ? 450 : 1350);
      if (id === "late-count" || id.endsWith(":late"))
        return time > (window === "previous" ? 450 : 1350);
      if (
        id.endsWith("rated-shots") &&
        c.missing === "xg" &&
        window === "current"
      )
        return time !== c.shots[0][0];
      return true;
    })
    .map((s) => eventId("harbor", s[0]));
}
