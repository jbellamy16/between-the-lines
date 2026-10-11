"use client";

import type { TemporalStoryline } from "@/lib/ai/director/storylines";
import { matchClock, periodAt, type MatchData } from "@/lib/sources/model";
import { AnimatedDetails } from "./motion";

export function StorylineHistory({
  match,
  time,
  storylines,
}: {
  match: MatchData;
  time: number;
  storylines: TemporalStoryline[];
}) {
  const current = storylines.filter(
    (line) =>
      line.matchId === match.id &&
      line.updatedAt <= time &&
      line.period === periodAt(match, time).id,
  );
  if (!current.length) return null;
  return (
    <AnimatedDetails className="director-disclosure storyline-history">
      <summary>How the match story is changing</summary>
      <p className="metric-note">
        Measured every five match minutes from recorded events. A storyline can
        weaken even while an earlier passage remains worth replaying.
      </p>
      {current.map((line) => (
        <section
          key={line.id}
          className="storyline-entry"
          aria-label={`${match.teams[line.team].short} ${line.label} storyline`}
        >
          <div className="story-section-heading">
            <h3>
              {match.teams[line.team].short} · {line.label}
            </h3>
            <span className="storyline-state">{line.state}</span>
          </div>
          <p>{line.summary}</p>
          <p className="metric-note">
            Last assessed at {matchClock(match, line.updatedAt)}.{" "}
            {line.watchNext}
          </p>
          <ol className="storyline-timeline" aria-label="Storyline development">
            {line.observations.map((observation) => (
              <li key={observation.id}>
                <time>{matchClock(match, observation.timestamp)}</time>
                <span>
                  <strong>{observation.state}</strong> ·{" "}
                  {observation.current.count} {line.label} in five minutes
                </span>
              </li>
            ))}
          </ol>
          <AnimatedDetails className="story-technical">
            <summary>Measurements & criteria</summary>
            <p>{line.criterion}</p>
            <p>
              Episode baseline: {line.baseline.count},{" "}
              {matchClock(match, line.baseline.start)}–
              {matchClock(match, line.baseline.end)}.
            </p>
            {line.observations.map((observation) => (
              <p key={observation.id}>
                {matchClock(match, observation.timestamp)}: {observation.reason}
              </p>
            ))}
            {line.historyTruncated && (
              <p>Showing the latest eight assessments.</p>
            )}
            <ul>
              {line.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </AnimatedDetails>
        </section>
      ))}
    </AnimatedDetails>
  );
}
