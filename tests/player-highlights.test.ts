import { describe, expect, it } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  playerHighlights,
  scorelineNames,
} from "../src/lib/sources/player-highlights";

const fixture = () => new SyntheticMatchSource().read("pressure");
describe("player highlights at the current match clock", () => {
  it("counts the scoring record once and removes it on rewind", () => {
    const match = fixture();
    const goal = match.events.find((e) => e.scoringTeam)!;
    expect(
      playerHighlights(match, goal.time - 1).get(goal.playerId)?.goals,
    ).toBe(0);
    expect(playerHighlights(match, goal.time).get(goal.playerId)?.goals).toBe(
      1,
    );
    expect(playerHighlights(match, goal.time).get(goal.playerId)?.assists).toBe(
      0,
    );
    goal.ownGoal = true;
    expect(playerHighlights(match, goal.time).get(goal.playerId)?.goals).toBe(
      0,
    );
    goal.ownGoal = false;
    goal.period = "PS";
    expect(playerHighlights(match, goal.time).get(goal.playerId)?.goals).toBe(
      0,
    );
  });
  it("shows both sides of a substitution only when it happens", () => {
    const match = fixture();
    const sub = match.events.find((e) => e.type === "substitution")!;
    expect(
      playerHighlights(match, sub.time - 1).get(sub.playerId)?.substitutions,
    ).toEqual([]);
    const current = playerHighlights(match, sub.time);
    expect(current.get(sub.playerId)?.substitutions[0].direction).toBe("On");
    expect(current.get(sub.outgoingId!)?.substitutions[0].direction).toBe(
      "Off",
    );
  });
  it("requires an explicit assist linked to a visible same-team goal", () => {
    const match = fixture();
    match.provenance.provider = "statsbomb";
    for (const event of match.events) {
      delete event.assistPlayerId;
      delete event.assistEventId;
    }
    const goal = match.events.find((e) => e.scoringTeam)!;
    const passer = match.players.find(
      (p) => p.team === goal.team && p.id !== goal.playerId,
    )!;
    const pass = {
      ...goal,
      id: "assisting-pass",
      time: goal.time - 2,
      type: "pass" as const,
      scoringTeam: undefined,
      playerId: passer.id,
      source: {
        ...goal.source,
        provider: "statsbomb",
        raw: {
          pass: { goal_assist: true, assisted_shot_id: goal.source.eventId },
        },
      },
    };
    match.events.unshift(pass);
    expect(playerHighlights(match, pass.time).get(passer.id)?.assists).toBe(0);
    expect(playerHighlights(match, goal.time).get(passer.id)?.assists).toBe(1);
    pass.source.raw.pass.goal_assist = false;
    expect(playerHighlights(match, goal.time).get(passer.id)?.assists).toBe(0);
    pass.source.raw.pass.goal_assist = true;
    pass.team = goal.team === "harbor" ? "riverside" : "harbor";
    expect(playerHighlights(match, goal.time).get(passer.id)?.assists).toBe(0);
  });
});

it("provides nine reserves per synthetic team without putting unused substitutes on the pitch", () => {
  const match = fixture();
  for (const team of ["harbor", "riverside"] as const) {
    const roster = match.players.filter((player) => player.team === team);
    const bench = roster.filter((player) =>
      match.teams[team].bench.includes(player.id),
    );
    expect(match.teams[team].lineup).toHaveLength(11);
    expect(bench).toHaveLength(9);
    expect(new Set(roster.map((player) => player.number)).size).toBe(20);
    expect(new Set(roster.map((player) => player.id)).size).toBe(20);
    expect(bench.some((player) => player.role === "Goalkeeper")).toBe(true);
    for (const player of bench) {
      const entered = match.events.some(
        (event) =>
          event.type === "substitution" && event.playerId === player.id,
      );
      if (!entered)
        expect(
          match.events.some(
            (event) =>
              event.playerId === player.id || event.recipientId === player.id,
          ),
        ).toBe(false);
    }
  }
});

it("records Leon's direct assist on Arlo's goal and reveals it only at the goal", () => {
  const match = fixture();
  const goal = match.events.find((event) => event.scoringTeam)!;
  expect(goal.assistPlayerId).toBe("harbor-10");
  const pass = match.events.find((event) => event.id === goal.assistEventId)!;
  expect(pass.time).toBe(2466);
  expect(pass.playerId).toBe("harbor-10");
  expect(pass.recipientId).toBe("harbor-11");
  expect(playerHighlights(match, 2467).get("harbor-10")?.assists).toBe(0);
  expect(playerHighlights(match, 2468).get("harbor-10")?.assists).toBe(1);
  expect(playerHighlights(match, 2468).get("harbor-11")?.assists).toBe(0);
  expect(playerHighlights(match, 2466).get("harbor-10")?.assistEvents).toEqual(
    [],
  );
});

it("groups repeated scorer and assister names with chronological minutes", () => {
  const match = fixture();
  const first = match.events.find((e) => e.scoringTeam)!;
  const second = {
    ...first,
    id: "second-goal",
    time: 2880,
    period: "2H" as const,
  };
  const third = {
    ...first,
    id: "third-goal",
    time: 4320,
    period: "2H" as const,
  };
  for (const [id, name] of [
    ["harbor-11", "Arlo Hayes"],
    ["harbor-10", "Leon Costa"],
  ]) {
    expect(
      scorelineNames(
        match,
        [third, first, second].map((event) => ({ playerId: id, event })),
      ),
    ).toEqual([{ id, label: `${name} (42′, 48′, 72′)` }]);
  }
  expect(
    scorelineNames(match, [
      { playerId: first.playerId, event: first },
      { playerId: first.playerId, event: { ...second, ownGoal: true } },
    ])[0].label,
  ).toBe("Arlo Hayes (42′, 48′ OG)");
});
