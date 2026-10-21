import { describe, expect, it } from "vitest";
import {
  calculateStatistics,
  matchStatistics,
} from "../src/lib/sources/analytics";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";

type Input = Parameters<typeof calculateStatistics>[0][number];
let n = 0;
const pass = (
  from: [number, number],
  to: [number, number] | null,
  extra: Partial<Input> = {},
) =>
  ({
    id: `p${n++}`,
    time: n,
    team: "harbor",
    playerId: "1",
    type: "pass",
    position: { x: from[0], y: from[1] },
    ...(to ? { end: { x: to[0], y: to[1] } } : {}),
    success: true,
    possessionId: null,
    ...extra,
  }) as Input;
const harbor = (events: Input[]) => calculateStatistics(events).harbor;

describe("pass quality measures", () => {
  it("averages the reference-pitch length of measured passes", () => {
    // 20 units along the pitch is 21 m; 10 units across is 6.8 m.
    const stats = harbor([pass([10, 50], [30, 50]), pass([10, 50], [10, 60])]);
    expect(stats.avgPassLength).toBe(13.9);
  });

  it("leaves length unknown, not zero, when no pass has both ends", () => {
    expect(harbor([]).avgPassLength).toBeNull();
    expect(harbor([pass([10, 50], null)]).avgPassLength).toBeNull();
    // A pass with no end is skipped, not averaged in as zero.
    expect(
      harbor([pass([10, 50], null), pass([10, 50], [30, 50])]).avgPassLength,
    ).toBe(21);
  });

  it("counts a completed pass as progressive from 10 m toward goal", () => {
    expect(harbor([pass([10, 50], [20, 50])]).progressivePasses).toBe(1); // 10.5 m
    expect(harbor([pass([10, 50], [19, 50])]).progressivePasses).toBe(0); // 9.45 m
    expect(harbor([pass([20, 50], [10, 50])]).progressivePasses).toBe(0); // backwards
    expect(
      harbor([pass([10, 50], [40, 50], { success: false })]).progressivePasses,
    ).toBe(0);
    expect(
      harbor([pass([10, 50], [40, 50], { success: undefined })])
        .progressivePasses,
    ).toBe(0);
  });

  it("counts a completed pass as long from 25 m, in any direction", () => {
    expect(harbor([pass([10, 50], [34, 50])]).longPasses).toBe(1); // 25.2 m
    expect(harbor([pass([10, 50], [33, 50])]).longPasses).toBe(0); // 24.15 m
    expect(harbor([pass([50, 50], [26, 50])]).longPasses).toBe(1); // backwards
    expect(
      harbor([pass([10, 50], [60, 50], { success: false })]).longPasses,
    ).toBe(0);
  });

  it("keeps teams apart and ignores shootout attempts", () => {
    const stats = calculateStatistics([
      pass([10, 50], [40, 50]),
      pass([10, 50], [40, 50], { team: "riverside" }),
      pass([10, 50], [40, 50], { period: "PS" }),
    ]);
    expect(stats.harbor.longPasses).toBe(1);
    expect(stats.riverside.longPasses).toBe(1);
  });
});

describe("pass quality on the synthetic match", () => {
  const match = new SyntheticMatchSource().read("pressure");
  const teams = ["harbor", "riverside"] as const;

  it("is unknown before any pass and measured by full time", () => {
    for (const team of teams) {
      expect(matchStatistics(match, 0)[team].avgPassLength).toBeNull();
      const end = matchStatistics(match, match.duration)[team];
      expect(end.avgPassLength).toBeGreaterThan(3);
      expect(end.avgPassLength).toBeLessThan(60);
      expect(end.progressivePasses).toBeGreaterThan(0);
      expect(end.progressivePasses).toBeLessThanOrEqual(end.completed);
      expect(end.longPasses).toBeLessThanOrEqual(end.completed);
    }
  });

  it("uses only events up to the viewer's time, so counts never fall", () => {
    let previous = { harbor: [0, 0], riverside: [0, 0] };
    for (const time of [600, 1800, 2700, 3804, 4700, match.duration]) {
      const stats = matchStatistics(match, time);
      const prefix = calculateStatistics(
        match.events.filter((e) => e.time <= time),
      );
      for (const team of teams) {
        expect(stats[team].progressivePasses).toBe(
          prefix[team].progressivePasses,
        );
        const now = [stats[team].progressivePasses, stats[team].longPasses];
        expect(now[0]).toBeGreaterThanOrEqual(previous[team][0]);
        expect(now[1]).toBeGreaterThanOrEqual(previous[team][1]);
        previous = { ...previous, [team]: now };
      }
    }
  });

  it("is deterministic for a seeded match", () => {
    const again = new SyntheticMatchSource().read("pressure");
    expect(matchStatistics(again, 3804)).toEqual(matchStatistics(match, 3804));
  });
});
