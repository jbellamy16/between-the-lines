import { isHighBallWin } from "./metrics";
import { referenceDistance } from "./coordinates";
import type { MatchEvent, TeamId } from "../match";
import type { MatchData } from "./model";

type Action = Omit<MatchEvent, "position"> & {
  position: MatchEvent["position"] | null;
  scoringTeam?: TeamId;
  period?: string;
  qualifiers?: Record<string, unknown>;
};
/** Reference-pitch metres: a pass this long, completed, counts as a long pass. */
export const LONG_PASS_METRES = 25;
/** A completed pass that moves the ball this far toward goal is progressive. */
export const PROGRESSIVE_PASS_METRES = 10;

/** One calculation engine for generated and imported actions. Unknown is never failure. */
export function calculateStatistics(events: Action[]) {
  return Object.fromEntries(
    (["harbor", "riverside"] as const).map((team) => {
      const own = events.filter((e) => e.team === team && e.period !== "PS");
      const passes = own.filter((e) => e.type === "pass");
      const known = passes.filter((e) => e.success !== undefined);
      const shots = own.filter((e) => e.type === "shot");
      const completed = passes.filter((e) => e.success === true).length;
      // Only passes with both ends recorded can be measured; unknown is never zero.
      const measured = passes.flatMap((e) =>
        e.position && e.end
          ? [
              {
                done: e.success === true,
                length: referenceDistance(e.position, e.end),
                toward: (e.end.x - e.position.x) * 1.05,
              },
            ]
          : [],
      );
      return [
        team,
        {
          goals: events.filter(
            (e) =>
              e.period !== "PS" &&
              (e.scoringTeam
                ? e.scoringTeam === team
                : e.type === "goal" &&
                  e.team === team &&
                  !("scoringTeam" in e)),
          ).length,
          shots: shots.length,
          onTarget: shots.filter(
            (e) =>
              e.qualifiers?.onTarget === true ||
              e.outcome === "saved" ||
              e.outcome === "goal",
          ).length,
          xg: Number(shots.reduce((sum, e) => sum + (e.xg ?? 0), 0).toFixed(2)),
          passes: passes.length,
          completed,
          accuracy: known.length
            ? Math.round((100 * completed) / known.length)
            : 0,
          unknownPassOutcomes: passes.length - known.length,
          recoveries: own.filter(
            (e) => e.type === "recovery" && e.success !== false,
          ).length,
          highRecoveries: own.filter(isHighBallWin).length,
          attackingThird: own.filter(
            (e) =>
              ["pass", "shot", "touch"].includes(e.type) &&
              (e.position?.x ?? -1) >= (100 / 3) * 2,
          ).length,
          interceptions: own.filter(
            (e) =>
              e.type === "interception" || e.qualifiers?.interception === true,
          ).length,
          avgPassLength: measured.length
            ? Number(
                (
                  measured.reduce((sum, m) => sum + m.length, 0) /
                  measured.length
                ).toFixed(1),
              )
            : null,
          progressivePasses: measured.filter(
            (m) => m.done && m.toward >= PROGRESSIVE_PASS_METRES,
          ).length,
          longPasses: measured.filter(
            (m) => m.done && m.length >= LONG_PASS_METRES,
          ).length,
          forward: passes.filter(
            (e) => e.position && e.end && e.end.x > e.position.x,
          ).length,
          backward: passes.filter(
            (e) => e.position && e.end && e.end.x < e.position.x,
          ).length,
        },
      ];
    }),
  ) as Record<
    TeamId,
    {
      goals: number;
      shots: number;
      onTarget: number;
      xg: number;
      passes: number;
      completed: number;
      accuracy: number;
      unknownPassOutcomes: number;
      recoveries: number;
      highRecoveries: number;
      attackingThird: number;
      interceptions: number;
      avgPassLength: number | null;
      progressivePasses: number;
      longPasses: number;
      forward: number;
      backward: number;
    }
  >;
}
export function matchStatistics(match: MatchData, time: number) {
  if (!Number.isFinite(time) || time < 0 || time > match.duration)
    throw new Error("Invalid replay timestamp");
  const stats = calculateStatistics(match.events.filter((e) => e.time <= time));
  return Object.fromEntries(
    (["harbor", "riverside"] as const).map((team) => [
      team,
      {
        ...stats[team],
        onTarget: match.capabilities.shotOutcomes ? stats[team].onTarget : null,
        recoveries: match.capabilities.recoveries
          ? stats[team].recoveries
          : null,
        xg:
          match.capabilities.xg &&
          match.events
            .filter(
              (e) =>
                e.time <= time &&
                e.team === team &&
                e.type === "shot" &&
                e.period !== "PS",
            )
            .every((e) => e.xg !== undefined)
            ? stats[team].xg
            : null,
        highRecoveries: match.capabilities.ballRecoveries
          ? stats[team].highRecoveries
          : null,
        accuracy:
          stats[team].passes > stats[team].unknownPassOutcomes
            ? stats[team].accuracy
            : null,
        possessionPercentage: null,
      },
    ]),
  ) as Record<
    TeamId,
    Omit<
      typeof stats.harbor,
      "xg" | "highRecoveries" | "accuracy" | "onTarget" | "recoveries"
    > & {
      onTarget: number | null;
      recoveries: number | null;
      xg: number | null;
      highRecoveries: number | null;
      accuracy: number | null;
      possessionPercentage: null;
    }
  >;
}
