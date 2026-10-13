import type { CSSProperties } from "react";
import type { MatchData } from "@/lib/sources/model";
import { matchClock } from "@/lib/sources/model";
import { matchStatistics } from "@/lib/sources/analytics";
import { Metric } from "./motion";
export function MatchStatistics({
  match,
  time,
}: {
  match: MatchData;
  time: number;
}) {
  const stats = matchStatistics(match, time);
  const rows = [
    ["goals", "Goals"],
    ["shots", "Shots"],
    ["onTarget", "Shots on target"],
    ["passes", "Passes attempted"],
    ["completed", "Passes completed"],
    ["accuracy", "Pass completion"],
    ["highRecoveries", "Attacking-third ball wins"],
    [
      "xg",
      match.kind === "synthetic"
        ? "Synthetic expected goals"
        : "Expected goals",
    ],
  ] as const;
  return (
    <section
      className="panel section-panel section-enter match-statistics"
      id="historical-statistics"
    >
      <div className="panel-header">
        <h2>Match statistics</h2>
        <span>Computed through {matchClock(match, time)}</span>
      </div>
      <div className="stats-team-header">
        <span>
          <i className="team-dot harbor" aria-hidden="true" />
          {match.teams.harbor.name}
        </span>
        <span>
          {match.teams.riverside.name}
          <i className="team-dot riverside" aria-hidden="true" />
        </span>
      </div>
      {rows.map(([key, label]) => {
        const a = stats.harbor[key],
          b = stats.riverside[key];
        return (
          <div className="stat-row" key={key}>
            <div>
              <strong>
                {a === null ? (
                  <span className="unavailable">Unavailable</span>
                ) : (
                  <>
                    <Metric value={a} />
                    {key === "accuracy" ? "%" : ""}
                  </>
                )}
              </strong>
              <span>{label}</span>
              <strong>
                {b === null ? (
                  <span className="unavailable">Unavailable</span>
                ) : (
                  <>
                    <Metric value={b} />
                    {key === "accuracy" ? "%" : ""}
                  </>
                )}
              </strong>
            </div>
            {a !== null && b !== null && (
              <div
                className="stat-bars"
                style={
                  {
                    "--share": a + b === 0 ? 0.5 : a / (a + b),
                  } as CSSProperties
                }
              >
                <i />
                <i />
              </div>
            )}
          </div>
        );
      })}
      <p className="limitations">
        {match.kind === "synthetic"
          ? "xG is generated chance probability, not a validated real-world model. "
          : "Unavailable means this source does not support the metric. "}
        Pass completion uses known outcomes;{" "}
        {stats.harbor.unknownPassOutcomes + stats.riverside.unknownPassOutcomes}{" "}
        pass outcomes are unknown. Counts do not establish possession duration,
        pressing intensity or tracking.
      </p>
    </section>
  );
}
