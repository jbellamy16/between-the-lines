import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { validateMatch, type NormalizedEvent } from "../src/lib/sources/model";
import { observe } from "../src/lib/ai/director/observer";

/** Development-only diagnostic, never changes the bundled pressure fixture. */
export function surgeFixture(spread = false) {
  const match = structuredClone(new SyntheticMatchSource().read("pressure"));
  const templates = Object.fromEntries(
    ["harbor", "riverside"].map((team) => [
      team,
      match.events.find((e) => e.team === team && e.actorId)!,
    ]),
  );
  match.id = spread ? "surge-spread" : "surge-cluster";
  match.provenance.sourceMatchId = match.id;
  match.events = [];
  match.finalScore = { harbor: 0, riverside: 0 };
  const add = (
    time: number,
    type: NormalizedEvent["type"],
    possessionId: number,
    team: "harbor" | "riverside" = "harbor",
  ) => {
    const e = structuredClone(templates[team]);
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
  add(190, "recovery", 1);
  add(200, "shot", 1);
  add(600, "shot", 2);
  if (spread) {
    for (const [i, t] of [1000, 1100, 1400, 1600].entries()) {
      add(t - 10, "recovery", 10 + i);
      add(t, "shot", 10 + i);
    }
  } else {
    add(990, "recovery", 10);
    for (const t of [1000, 1010, 1020]) add(t, "shot", 10);
    add(1190, "recovery", 20);
    add(1200, "shot", 20);
  }
  add(1300, "shot", 30);
  add(1700, "shot", 40);
  add(400, "shot", 1, "riverside");
  for (const [i, t] of [1040, 1140, 1240, 1340, 1740].entries())
    add(t, "shot", 10 + i, "riverside");
  match.events
    .sort((a, b) => a.time - b.time)
    .forEach((e, order) => {
      e.order = order;
    });
  validateMatch(match);
  const cutoff = 1800;
  const story = observe(match, cutoff).find(
    (c) =>
      c.category === "activity-change" &&
      c.team === "harbor" &&
      c.statistics[0].label === "shots",
  )!;
  if (!story) throw new Error("Diagnostic story missing");
  return {
    match,
    cutoff,
    question: { intent: "shot-surge-explanations" as const, storyId: story.id },
  };
}
