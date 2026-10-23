import { describe, expect, it } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  goalkeeperStatistics,
  isGoalkeeper,
} from "../src/lib/sources/goalkeeper-statistics";
import { validateMatch, type NormalizedEvent } from "../src/lib/sources/model";

const fixture = () => new SyntheticMatchSource().read("pressure");

describe("goalkeeper statistics", () => {
  it("credits explicit saves and removes future saves on rewind", () => {
    const match = fixture();
    const saved = match.events.filter(
      (e) => e.type === "shot" && e.outcome === "saved",
    );
    expect(saved.length).toBeGreaterThan(0);
    for (const event of saved) {
      const keeper = match.players.find((p) => p.id === event.goalkeeperId)!;
      expect(isGoalkeeper(keeper)).toBe(true);
      expect(keeper.team).not.toBe(event.team);
      const before = goalkeeperStatistics(match, keeper, event.time - 0.01);
      const after = goalkeeperStatistics(match, keeper, event.time);
      expect(after.saves).toBe(before.saves! + 1);
      expect(after.shotsOnTargetFaced).toBe(before.shotsOnTargetFaced! + 1);
    }
  });

  it("counts the goal once, not both the shot and scoring event", () => {
    const match = fixture();
    const keeper = match.players.find((p) => p.id === "riverside-1")!;
    const goalAt = match.events.find((e) => e.scoringTeam)!.time;
    expect(goalkeeperStatistics(match, keeper, goalAt - 1).goalsConceded).toBe(
      0,
    );
    const before = goalkeeperStatistics(match, keeper, goalAt - 1);
    expect(goalkeeperStatistics(match, keeper, goalAt)).toMatchObject({
      goalsConceded: 1,
      shotsOnTargetFaced: before.shotsOnTargetFaced! + 1,
      saves: before.saves,
    });
    const goal = match.events.find((e) => e.scoringTeam)!;
    goal.ownGoal = true;
    expect(goalkeeperStatistics(match, keeper, goalAt).goalsConceded).toBe(1);
    goal.period = "PS";
    expect(goalkeeperStatistics(match, keeper, goalAt).goalsConceded).toBe(0);
  });

  it("splits same-time shots across a keeper substitution and stops at a red card", () => {
    const match = fixture();
    const starter = match.players.find((p) => p.id === "riverside-1")!;
    const reserve = match.players.find((p) => p.id === "riverside-13")!;
    const template = match.events.find(
      (e) => e.type === "shot" && e.team === "harbor",
    )!;
    const make = (
      id: string,
      overrides: Partial<NormalizedEvent>,
    ): NormalizedEvent => ({
      ...template,
      id,
      time: 100,
      outcome: undefined,
      scoringTeam: undefined,
      qualifiers: {},
      ...overrides,
    });
    match.events = [
      make("before", { outcome: "saved", goalkeeperId: starter.id }),
      make("sub", {
        type: "substitution",
        team: "riverside",
        outgoingId: starter.id,
        playerId: reserve.id,
      }),
      make("after", { outcome: "saved", goalkeeperId: reserve.id }),
      make("red", {
        type: "foul",
        time: 200,
        playerId: reserve.id,
        qualifiers: { card: "Red Card" },
      }),
      make("later", { time: 300, outcome: "goal", scoringTeam: "harbor" }),
    ];
    expect(goalkeeperStatistics(match, starter, 400)).toMatchObject({
      saves: 1,
      shotsOnTargetFaced: 1,
      secondsPlayed: 100,
      goalsConceded: 0,
      cleanSheet: false,
    });
    expect(goalkeeperStatistics(match, reserve, 400)).toMatchObject({
      saves: 1,
      shotsOnTargetFaced: 1,
      secondsPlayed: 100,
      goalsConceded: 0,
      cleanSheet: false,
    });
  });

  it("shows a clean sheet only at full-time for a keeper who played the whole match", () => {
    const match = fixture();
    match.events = [];
    const keeper = match.players.find((p) => p.id === "harbor-1")!;
    const reserve = match.players.find((p) => p.id === "harbor-13")!;
    expect(
      goalkeeperStatistics(match, keeper, match.duration - 1).cleanSheet,
    ).toBe(false);
    expect(goalkeeperStatistics(match, keeper, match.duration).cleanSheet).toBe(
      true,
    );
    expect(goalkeeperStatistics(match, reserve, match.duration)).toMatchObject({
      saves: 0,
      secondsPlayed: 0,
      cleanSheet: false,
    });
    match.status = "in_progress";
    expect(goalkeeperStatistics(match, keeper, match.duration).cleanSheet).toBe(
      false,
    );
  });

  it("calculates pass completion only with complete outcome data", () => {
    const match = fixture();
    const keeper = match.players.find((p) => p.id === "harbor-1")!;
    const pass = match.events.find((e) => e.type === "pass")!;
    match.events = [true, true, false].map((success, i) => ({
      ...pass,
      id: `pass-${i}`,
      time: i,
      playerId: keeper.id,
      success,
    }));
    expect(goalkeeperStatistics(match, keeper, 10)).toMatchObject({
      passAttempts: 3,
      passCompletion: 67,
    });
    delete match.events[0].success;
    expect(goalkeeperStatistics(match, keeper, 10).passCompletion).toBeNull();
    match.events = [];
    expect(goalkeeperStatistics(match, keeper, 10).passCompletion).toBeNull();
    delete match.capabilities.goalkeeperSaves;
    expect(goalkeeperStatistics(match, keeper, 10).saves).toBeNull();
    match.capabilities.lineups = false;
    expect(goalkeeperStatistics(match, keeper, 10).goalsConceded).toBeNull();
  });

  it("rejects save attribution to the attacking team or an unused reserve", () => {
    const match = fixture();
    const shot = match.events.find((e) => e.type === "shot")!;
    shot.goalkeeperId = `${shot.team}-1`;
    expect(() => validateMatch(match)).toThrow(
      "Invalid goalkeeper attribution",
    );
    shot.goalkeeperId = `${shot.team === "harbor" ? "riverside" : "harbor"}-13`;
    expect(() => validateMatch(match)).toThrow(
      "Invalid goalkeeper attribution",
    );
  });
});
