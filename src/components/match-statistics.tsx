import type { CSSProperties } from "react";
import type { MatchData } from "@/lib/sources/model";
import { matchClock } from "@/lib/sources/model";
import { matchStatistics } from "@/lib/sources/analytics";
import { AnimatedDetails, Metric } from "./motion";
export function MatchStatistics({
  match,
  time,
}: {
  match: MatchData;
  time: number;
}) {
  const stats = matchStatistics(match, time);
  const unknownPasses =
    stats.harbor.unknownPassOutcomes + stats.riverside.unknownPassOutcomes;
  const rows = [
    ["goals", "Goals"],
    ["shots", "Shots"],
    ["onTarget", "Shots on target"],
    ["passes", "Passes attempted"],
    ["completed", "Passes completed"],
    ["accuracy", "Pass completion"],
    ["avgPassLength", "Average pass length"],
    ["progressivePasses", "Progressive passes"],
    ["longPasses", "Long passes completed"],
    ["highRecoveries", "Attacking-third ball wins"],
    [
      "xg",
      match.kind === "synthetic"
        ? "Synthetic expected goals"
        : "Expected goals",
    ],
  ] as const;
  const suffix = (key: string) =>
    key === "accuracy" ? "%" : key === "avgPassLength" ? " m" : "";
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
                    {suffix(key)}
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
                    {suffix(key)}
                  </>
                )}
              </strong>
            </div>
            {a !== null && b !== null && key !== "avgPassLength" && (
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
        {unknownPasses
          ? `Pass completion uses known outcomes; ${unknownPasses} pass ${unknownPasses === 1 ? "outcome is" : "outcomes are"} unknown. `
          : ""}
        Counts do not establish possession duration, pressing intensity or
        tracking.
      </p>
      <AnimatedDetails className="director-disclosure quiet-evidence">
        <summary>How the pass measures work</summary>
        <p>
          Lengths use a 105 × 68 m reference pitch, not tracked distance. A
          progressive pass is a completed pass that moves the ball at least 10 m
          toward goal; a long pass is a completed pass of 25 m or more.
        </p>
      </AnimatedDetails>
    </section>
  );
}
