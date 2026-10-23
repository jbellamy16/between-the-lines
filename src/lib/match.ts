import { calculateStatistics } from "./sources/analytics";
export type TeamId = "harbor" | "riverside";
export type Scenario = "pressure" | "substitution" | "quiet";
export type EventType =
  | "pass"
  | "carry"
  | "shot"
  | "goal"
  | "tackle"
  | "interception"
  | "recovery"
  | "possession"
  | "corner"
  | "foul"
  | "substitution"
  | "duel"
  | "restart"
  | "offside"
  | "touch"
  | "interruption"
  | "save"
  | "free_kick"
  | "card"
  | "period_start"
  | "period_end"
  | "other";
export type Point = { x: number; y: number };
export type Player = {
  id: string;
  name: string;
  number: number;
  role: string;
  team: TeamId;
};
export type MatchEvent = {
  id: string;
  time: number;
  team: TeamId;
  playerId: string;
  type: EventType;
  position: Point;
  end?: Point;
  recipientId?: string;
  success?: boolean;
  outcome?: "saved" | "wide" | "goal";
  xg?: number;
  outgoingId?: string;
  assistPlayerId?: string;
  assistEventId?: string;
  goalkeeperId?: string;
  possessionId: number | null;
};
export const TEAMS = {
  harbor: {
    name: "Harbor Athletic",
    short: "Harbor",
    code: "HBA",
    color: "#72c6ff",
    formation: "4–3–3",
  },
  riverside: {
    name: "Riverside FC",
    short: "Riverside",
    code: "RIV",
    color: "#ff7a83",
    formation: "4–2–3–1",
  },
} as const;
const names = {
  harbor: [
    "Luca Vale",
    "Ellis Reed",
    "Noah Flint",
    "Otis Lane",
    "Finn Ash",
    "Milo Serrano",
    "Theo March",
    "Jude Moreno",
    "Kai Solberg",
    "Leon Costa",
    "Arlo Hayes",
    "Nico Wells",
    "Toby Mercer",
    "Callum Pike",
    "Eli Brooks",
    "Rory Blake",
    "Seth Palmer",
    "Owen Ellis",
    "Luca Bennett",
    "Jasper Ford",
  ],
  riverside: [
    "Ruben Moss",
    "Evan Cole",
    "Leo Hart",
    "Isaac Stone",
    "Adam West",
    "Oscar Voss",
    "Felix Lake",
    "Max Rowan",
    "Hugo Silva",
    "Ben Rivers",
    "Ivo Cruz",
    "Asa Quinn",
    "Dylan Ward",
    "Reece Shaw",
    "Joel Nash",
    "Kian Holt",
    "Lewis Gray",
    "Micah Stone",
    "Elliot Mason",
    "Rafael Reid",
  ],
};
export const PLAYERS: Player[] = (Object.keys(TEAMS) as TeamId[]).flatMap(
  (team) =>
    names[team].map((name, i) => ({
      id: `${team}-${i + 1}`,
      name,
      team,
      number: [
        1, 2, 4, 5, 3, 6, 8, 10, 9, 11, 7, 17, 13, 12, 14, 15, 16, 18, 19, 20,
      ][i],
      role:
        i === 0 || i === 12
          ? "Goalkeeper"
          : i < 5 || (i >= 13 && i <= 15)
            ? "Defender"
            : i < 8 || (i >= 16 && i <= 17)
              ? "Midfielder"
              : "Forward",
    })),
);
export const player = (id: string) => PLAYERS.find((p) => p.id === id)!;
export const other = (team: TeamId): TeamId =>
  team === "harbor" ? "riverside" : "harbor";
export const SCENARIOS: Record<
  Scenario,
  { name: string; description: string; seed: number }
> = {
  pressure: {
    name: "The pressure builds",
    description: "Harbor begin winning the ball higher up the pitch.",
    seed: 163530,
  },
  substitution: {
    name: "A change in the game",
    description: "Watch the rhythm before and after a second-half change.",
    seed: 2011,
  },
  quiet: {
    name: "A game of patience",
    description: "A low-event match. Sometimes the story is restraint.",
    seed: 32,
  },
};
export const DURATION = 90 * 60;
export const DEMO_TIME = 63 * 60 + 24;
export function clock(time: number) {
  return `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(time % 60)
    .toString()
    .padStart(2, "0")}`;
}
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Goal mouth on the end line, in pitch percent (7.32 m of 68 m, centred). */
export const GOAL_MOUTH = { low: 44.6, high: 55.4 } as const;
export type ShotKind = "open" | "header" | "cutback" | "counter";
const SHOT_KIND_FACTOR: Record<ShotKind, number> = {
  open: 1,
  header: 0.7,
  cutback: 1.25,
  counter: 1.1,
};
/**
 * Synthetic shot model. Chance quality falls with distance and with a wider
 * angle; the route that created the shot scales it. A goal is drawn with
 * probability `xg`, an on-target attempt with `onTarget` (always above `xg`),
 * so saved = onTarget − xg and wide = 1 − onTarget. Event-model values only.
 */
export function shotModel(position: Point, kind: ShotKind) {
  const distance = Math.hypot(
    (100 - position.x) * 1.05,
    (position.y - 50) * 0.68,
  );
  const central = 1 - Math.abs(position.y - 50) / 50;
  const xg = Number(
    Math.max(
      0.02,
      Math.min(
        0.45,
        0.5 *
          Math.exp(-distance / 16) *
          (0.6 + 0.4 * central) *
          SHOT_KIND_FACTOR[kind],
      ),
    ).toFixed(2),
  );
  const onTarget = Math.max(xg + 0.08, Math.min(0.65, 0.85 - distance / 55));
  return { distance, xg, onTarget };
}
/** Where a shot ends on the goal line, consistent with its outcome. */
export function shotEnd(
  outcome: "saved" | "wide" | "goal",
  position: Point,
  random: () => number,
): Point {
  const { low, high } = GOAL_MOUTH;
  const clamp = (v: number, a: number, b: number) =>
    Math.max(a, Math.min(b, v));
  const round = (v: number) => Number(v.toFixed(1));
  if (outcome === "wide") {
    // Misses grow with range and tend to drift away from the shooter's side.
    const miss =
      1.2 +
      random() * 3 +
      (Math.hypot(100 - position.x, position.y - 50) / 60) * random() * 6;
    const high_side = position.y < 50 ? random() < 0.4 : random() < 0.6;
    return {
      x: 100,
      y: round(clamp(high_side ? high + miss : low - miss, 28, 72)),
    };
  }
  if (outcome === "goal") {
    // Scorers favour the corners; some beat the keeper through the middle.
    const corner = random() < 0.65;
    const top = random() < 0.5;
    return {
      x: 100,
      y: round(
        corner
          ? top
            ? low + 0.6 + random() * 2.6
            : high - 0.6 - random() * 2.6
          : 48 + random() * 4,
      ),
    };
  }
  // Saved: on target, usually within the keeper's reach of the centre.
  const spread = (random() + random() + random() - 1.5) * 2 * 3.6;
  return { x: 100, y: round(clamp(50 + spread, low + 0.4, high - 0.4)) };
}

type Route = "build" | "cross" | "cutback" | "counter";
// Attacking slots are fixed per team: 1 keeper, 2–5 defenders (2 and 5 the
// full-backs), 6–8 midfielders, 9–11 forwards (10 and 11 the wide forwards).
// Top/bottom is a position on the pitch, not a claim about runs or marking.
const SIDE_PLAYERS = { top: [5, 10], bottom: [2, 11] } as const;
const ZONE_WEIGHT = [
  [0.3, 1, 0.8, 0.05],
  [0, 0.35, 1, 0.4],
  [0, 0.05, 0.6, 1],
];

// Feed boundary: coordinates are normalized to each team's attacking direction (left → right).
// Discrete possession sequences; no off-ball tracking is implied.
// Failed passes transfer at their endpoint; goals restart at the centre spot.
// Each possession is one recognisable attacking route (sustained build-up,
// cross, cutback or counter) that can end in a shot, a lost ball or a foul.
export function generateMatch(
  scenario: Scenario,
  seed = SCENARIOS[scenario].seed,
  profile: "demo" | "balanced" = "demo",
): MatchEvent[] {
  const random = seeded(seed),
    events: MatchEvent[] = [];
  let time = 0,
    possessionId = 0,
    team: TeamId = "riverside",
    substituted = false,
    cornerNext = false;
  const balanced = profile === "balanced";
  const point = (x: number, y = 10 + random() * 80): Point => ({
    x: Math.max(1, Math.min(99, x)),
    y: Math.max(0, Math.min(100, y)),
  });
  const between = (a: number, b: number) => a + random() * (b - a);
  const slot = (t: TeamId, n: number) =>
    t === "harbor" && substituted && n === 11 ? "harbor-12" : `${t}-${n}`;
  const weighted = <T>(items: [T, number][]) => {
    let r = random() * items.reduce((sum, [, w]) => sum + w, 0);
    for (const [item, w] of items) if ((r -= w) < 0) return item;
    return items.at(-1)![0];
  };
  /** Pick the player who suits this area of the pitch and this lane. */
  const who = (
    t: TeamId,
    x: number,
    y: number,
    exclude?: string,
    attackers = false,
  ) => {
    const lane = y < 30 ? "top" : y > 70 ? "bottom" : "centre";
    const zone = x < 35 ? 0 : x < 65 ? 1 : 2;
    const options: [string, number][] = [];
    for (let n = 1; n <= 11; n++) {
      const id = slot(t, n);
      if (id === exclude) continue;
      const role = n === 1 ? 0 : n <= 5 ? 1 : n <= 8 ? 2 : 3;
      let w = ZONE_WEIGHT[zone][role];
      if (n === 1 && x >= 20) w = 0;
      // Finishing chances go to midfielders and forwards, not the back line.
      if (attackers && n <= 5) w = 0;
      // Slot 6 holds the midfield; slot 8 joins the attack.
      if (zone === 2) w *= n === 6 ? 0.5 : n === 7 ? 0.8 : n === 8 ? 1.25 : 1;
      const own = (SIDE_PLAYERS.top as readonly number[]).includes(n)
        ? "top"
        : (SIDE_PLAYERS.bottom as readonly number[]).includes(n)
          ? "bottom"
          : "centre";
      w *=
        lane === "centre"
          ? own === "centre"
            ? 1.3
            : 0.6
          : own === lane
            ? 2.2
            : own === "centre"
              ? 0.8
              : 0.3;
      options.push([id, w]);
    }
    return weighted(options);
  };
  const emit = (
    type: EventType,
    who: string,
    pos: Point,
    extra: Partial<MatchEvent> = {},
  ) => {
    if (time > DURATION) return;
    const event: MatchEvent = {
      id: `${scenario}-${seed}-${events.length}`,
      time,
      team,
      playerId: who,
      type,
      position: pos,
      possessionId,
      ...extra,
    };
    events.push(event);
    return event;
  };
  const isBack = (id: string) => Number(id.split("-")[1]) <= 5;
  const surgeAt = (t: TeamId, now: number) =>
    t === "harbor"
      ? scenario === "pressure"
        ? Math.max(0, Math.min(1, (now - 40 * 60) / (20 * 60)))
        : scenario === "substitution" && substituted
          ? 1
          : 0
      : 0;
  // Seconds between actions: slower in a quiet game, quicker in a balanced one.
  const beat = () =>
    balanced
      ? (scenario === "quiet" ? 5 : 2) + Math.floor(random() * 5)
      : (scenario === "quiet" ? 9 : 5) + Math.floor(random() * 7);
  const quick = () => Math.max(2, Math.round(beat() * 0.45));
  const passRate = balanced ? 0.84 : 0.88;
  // How often a delivered ball becomes a clear attempt: a quiet game wastes more.
  const volume = scenario === "quiet" ? 0.3 : balanced ? 1 : 0.75;

  /** Run one possession as an attacking route; returns once it has ended. */
  function attack(
    start: Point,
    first: string,
    route: Route | "corner" | "pressed",
    surge: number,
  ) {
    let pos = start,
      holder = first,
      lastPass: MatchEvent | undefined;
    const reach = balanced ? 2.3 : scenario === "quiet" ? 0.5 : 1;
    const pass = (to: Point, success: boolean, dt: number, named?: string) => {
      const recipient =
        named && named !== holder ? named : who(team, to.x, to.y, holder);
      time += dt;
      lastPass = emit("pass", holder, pos, {
        end: to,
        recipientId: recipient,
        success,
      });
      pos = to;
      holder = recipient;
      return success;
    };
    const carry = (to: Point, dt: number) => {
      time += dt;
      emit("carry", holder, pos, { end: to, success: true });
      pos = to;
    };
    /** Short passing moves that work the ball towards `targetX`. */
    const build = (passes: number, targetX: number, safe = false) => {
      for (let i = 0; i < passes; i++) {
        const back = random() < 0.15;
        const dx = back
          ? -between(4, 14) * Math.min(1.5, reach)
          : (targetX - pos.x) / (passes - i) +
            (random() - 0.5) * 14 * Math.min(1.6, reach);
        const to = point(
          Math.min(93, pos.x + dx),
          Math.max(8, Math.min(92, pos.y + (random() - 0.5) * 45 * reach)),
        );
        const long = Math.abs(to.x - pos.x) > 25;
        if (!pass(to, safe || random() < passRate - (long ? 0.08 : 0), beat()))
          return false;
      }
      return true;
    };
    const shoot = (kind: ShotKind) => {
      const { xg, onTarget } = shotModel(pos, kind);
      const roll = random();
      const outcome =
        roll < xg ? "goal" : roll < onTarget ? "saved" : ("wide" as const);
      time += 2;
      emit("shot", holder, pos, {
        goalkeeperId: `${other(team)}-1`,
        end: shotEnd(outcome, pos, random),
        xg,
        outcome,
      });
      if (outcome === "goal") {
        // A pass straight to the scorer is credited on the goal, so the
        // earlier pass cannot reveal it.
        const assisted =
          lastPass?.success &&
          lastPass.team === team &&
          lastPass.recipientId === holder &&
          lastPass.playerId !== holder &&
          lastPass.possessionId === possessionId &&
          lastPass.time < 2700 === time < 2700;
        emit(
          "goal",
          holder,
          point(99, 50),
          assisted
            ? {
                assistPlayerId: lastPass!.playerId,
                assistEventId: lastPass!.id,
              }
            : {},
        );
      } else if (outcome === "saved") cornerNext = random() < 0.3;
    };
    /** The attack stalls: usually a lost ball, occasionally a foul against. */
    const stall = (at?: Point) => {
      const last = events.at(-1);
      if (!at && last?.success && random() < 0.18) {
        time += 3;
        emit(
          "foul",
          who(other(team), 100 - pos.x, 100 - pos.y),
          point(100 - pos.x, 100 - pos.y),
          { team: other(team) },
        );
        return;
      }
      // The move ends on a completed ball; the opponents win it nearby.
      if (!at && last?.success && random() < 0.45) return;
      pass(
        at ??
          point(
            Math.min(96, pos.x + between(3, 14)),
            pos.y + (random() - 0.5) * 30,
          ),
        false,
        beat(),
      );
    };
    const side = (y: number) =>
      y < 42 ? "top" : y > 58 ? "bottom" : random() < 0.5 ? "top" : "bottom";
    const lane = (s: "top" | "bottom", a: number, b: number) =>
      s === "top" ? between(a, b) : 100 - between(a, b);
    /** A delivery into the box; completed ones become headers or volleys. */
    const cross = (chance: number) => {
      const to = point(between(87, 94), between(38, 62));
      const target = who(team, to.x, 50, holder, true);
      if (!pass(to, random() < chance, beat(), target)) return;
      if (random() < 0.8) shoot("header");
      else stall(point(pos.x - between(8, 16), pos.y + (random() - 0.5) * 20));
    };

    if (route === "pressed") {
      // Riverside caught in their own third while Harbor press: the ball is
      // lost where Harbor win it high.
      build(1 + Math.floor(random() * 3), 26, true);
      stall(point(between(19, 31), pos.y + (random() - 0.5) * 40));
    } else if (route === "corner") {
      pass(
        point(between(82, 92), between(35, 65)),
        random() < 0.72 * volume,
        beat(),
      );
      if (lastPass?.success) {
        if (random() < 0.7) shoot("header");
        else
          stall(point(pos.x - between(6, 14), pos.y + (random() - 0.5) * 20));
      }
    } else if (route === "counter") {
      const lead = who(team, 70, 50, holder, true);
      const ahead = point(between(58, 72), between(28, 72));
      if (
        !pass(
          ahead,
          random() < (passRate - 0.14) * Math.max(volume, 0.55),
          quick(),
          lead,
        )
      )
        return;
      carry(
        point(
          Math.min(90, pos.x + between(8, 17)),
          pos.y + (random() - 0.5) * 14,
        ),
        quick(),
      );
      if (random() < 0.4 + volume * 0.3) shoot("counter");
      else stall();
    } else if (route === "cross") {
      const s = side(pos.y);
      // Work the ball out to the wide player on this side first.
      const wide = point(
        pos.x < 55 ? between(66, 74) : Math.max(66, pos.x + between(0, 6)),
        lane(s, 8, 20),
      );
      if (
        !pass(
          wide,
          random() < passRate,
          beat(),
          slot(team, SIDE_PLAYERS[s][pos.x < 55 && random() < 0.55 ? 1 : 0]),
        )
      )
        return;
      carry(point(between(84, 90), lane(s, 6, 14)), quick() + 3);
      cross(0.5 * volume);
    } else if (route === "cutback") {
      const s = side(pos.y);
      if (pos.x < 62 && !build(1 + Math.floor(random() * 2), 66)) return;
      const half = point(between(75, 83), lane(s, 16, 30));
      if (
        !pass(half, random() < passRate, beat(), slot(team, SIDE_PLAYERS[s][1]))
      )
        return;
      carry(point(between(92, 96), lane(s, 10, 24)), quick() + 2);
      const to = point(between(79, 86), between(42, 58));
      if (
        !pass(
          to,
          random() < 0.72 * volume,
          beat(),
          who(team, 82, 50, holder, true),
        )
      )
        return;
      if (random() < 0.6 + volume * 0.3) shoot("cutback");
      else stall();
    } else {
      const passes = 3 + Math.floor(random() * 5);
      const target = surge > 0.4 ? between(70, 90) : between(42, 78);
      if (!build(passes, target)) return;
      const chance =
        scenario === "quiet"
          ? 0.18
          : balanced
            ? 0.2 + surge * 0.2
            : 0.22 + surge * 0.4;
      // Keepers and defenders recycle the ball rather than shoot from open play.
      if (pos.x >= 64 && !isBack(holder) && random() < chance) {
        // A short recorded carry connects the pass to the attempt.
        carry(point(Math.min(95, pos.x + between(2, 9)), pos.y), 3);
        shoot("open");
      } else stall();
    }
  }

  while (time < DURATION - 110) {
    time += balanced
      ? 4 + Math.floor(random() * 7)
      : 9 + Math.floor(random() * 15);
    if (!substituted && time >= 55 * 60) {
      const prior: TeamId = team;
      team = "harbor";
      emit("substitution", "harbor-12", point(50, 0), {
        outgoingId: "harbor-11",
      });
      substituted = true;
      team = prior;
    }
    const preceding = events.findLast((e) => e.type !== "substitution");
    const cornerRestart = cornerNext;
    cornerNext = false;
    team = cornerRestart
      ? team
      : preceding?.type === "foul"
        ? other(preceding.team)
        : other(team);
    possessionId++;
    const surge = surgeAt(team, time);
    // Harbor press: Riverside lose the ball in their own third.
    const pressed =
      team === "riverside" && random() < 0.025 + surgeAt("harbor", time) * 0.66;
    let position = point(15 + random() * 40);
    if (
      (preceding?.type === "pass" || preceding?.type === "carry") &&
      preceding.end
    )
      position = point(100 - preceding.end.x, 100 - preceding.end.y);
    if (!preceding || preceding.type === "goal") position = point(50, 50);
    // A missed/saved attempt restarts deep, rather than inventing a high ball win.
    if (preceding?.type === "shot") position = point(8, 50);
    if (preceding?.type === "foul")
      position = point(100 - preceding.position.x, 100 - preceding.position.y);
    if (cornerRestart) position = point(99, 1);
    const carrier = who(team, position.x, position.y);
    emit("possession", carrier, position);
    if (cornerRestart) emit("corner", carrier, position);
    if (preceding && !["goal", "shot", "foul"].includes(preceding.type))
      emit(
        random() < 0.66
          ? "recovery"
          : random() < 0.5
            ? "interception"
            : "tackle",
        carrier,
        position,
      );
    const won = position.x >= 65;
    const wonDeep =
      preceding?.type === "pass" && !preceding.success && position.x < 30;
    const route: Route | "corner" | "pressed" = cornerRestart
      ? "corner"
      : pressed
        ? "pressed"
        : weighted<Route>([
            ["build", scenario === "quiet" ? 0.65 : won ? 0.35 : 0.45],
            ["cross", scenario === "quiet" ? 0.08 : won ? 0.1 : 0.13],
            [
              "cutback",
              won ? 0.14 + surge * 0.12 : position.x >= 45 ? 0.06 : 0.025,
            ],
            [
              "counter",
              wonDeep ? 0.16 : preceding?.type === "shot" ? 0.03 : 0.05,
            ],
          ]);
    attack(position, carrier, route, surge);
  }
  return events;
}
export function eventsAt(events: MatchEvent[], time: number) {
  return events.filter((e) => e.time <= time);
}
/** Compatibility entrypoint; all sources use the same calculation engine. */
export const statistics = calculateStatistics;
export function sequenceFor(events: MatchEvent[], event: MatchEvent) {
  if (event.possessionId === null) return [event];
  return events.filter(
    (e) =>
      e.possessionId === event.possessionId &&
      e.time <= event.time &&
      e.type !== "possession" &&
      e.type !== "substitution",
  );
}
export function activePlayers(events: MatchEvent[], team: TeamId) {
  const subs = events.filter(
    (e) => e.type === "substitution" && e.team === team,
  );
  return PLAYERS.filter(
    (p) =>
      p.team === team &&
      (Number(p.id.split("-")[1]) <= 11 ||
        subs.some((e) => e.playerId === p.id)) &&
      !subs.some((e) => e.outgoingId === p.id),
  );
}
