"use client";

import type { MatchData, NormalizedEvent } from "@/lib/sources/model";
import { matchClock } from "@/lib/sources/model";
import type { BroadcastStory } from "@/lib/ai/director/story";
import type { DirectorResult } from "@/lib/ai/director/runner";
import { AnimatedDetails } from "./motion";
import { EventIcon, Shield } from "./icons";

function readableUnit(unit: string) {
  const seconds = unit.match(/^events \/ (\d+) seconds$/);
  if (seconds) {
    const value = Number(seconds[1]);
    return `${Math.floor(value / 60)}m${value % 60 ? ` ${value % 60}s` : ""} window`;
  }
  return unit
    .replace(/^events \/ /, "per ")
    .replace(/^recorded seconds$/, "seconds")
    .replace(/^events$/, "recorded actions");
}

export function StoryEvidence({
  story,
  match,
  events,
  answer,
}: {
  story: BroadcastStory;
  match: MatchData;
  events: NormalizedEvent[];
  answer: DirectorResult | null;
}) {
  const [current, previous] = story.statistics;
  const comparison =
    current &&
    previous &&
    /^Previous /i.test(previous.label) &&
    current.unit === previous.unit;
  const eventRows = (items: NormalizedEvent[]) => (
    <ol className="story-event-list">
      {items.map((event) => (
        <li key={event.id}>
          <time>{matchClock(match, event.time)}</time>
          <span className="story-event-icon">
            <EventIcon type={event.type} size={16} />
          </span>
          <span className="story-event-player">
            <strong>
              {match.players.find((player) => player.id === event.actorId)
                ?.name ?? "Unidentified player"}
            </strong>
            <span>
              {event.type.replaceAll("_", " ")}
              {event.outcome ? ` · ${event.outcome}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
  return (
    <AnimatedDetails className="director-disclosure story-evidence">
      <summary>How we know this story</summary>
      <div className="story-evidence-body">
        <div className="story-evidence-source">
          <span>
            <Shield size={16} /> Event-backed
          </span>
          <span>
            {match.kind === "synthetic" ? "Synthetic demo" : "Recorded match"}
          </span>
        </div>

        {comparison ? (
          <section
            className="story-comparison"
            aria-label="Supporting comparison"
          >
            <div className="story-section-heading">
              <h3>{current.label.replace(/^Current /i, "")}</h3>
              <span>{readableUnit(current.unit)}</span>
            </div>
            <div className="story-comparison-values">
              {[current, previous].map((stat, index) => (
                <div
                  key={stat.label}
                  className={index === 0 ? "story-current" : "story-previous"}
                >
                  <span>{index === 0 ? "This window" : "Previous window"}</span>
                  <strong>{stat.value}</strong>
                  <div className="story-stat-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${(Math.max(0, stat.value) / Math.max(1, current.value, previous.value)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <dl className="story-stat-grid">
            {story.statistics.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>
                  <strong>{stat.value}</strong>
                  <span>{readableUnit(stat.unit)}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <section className="story-support" aria-label="Recorded evidence">
          <div className="story-section-heading">
            <h3>Recorded evidence</h3>
            <span>{events.length} recorded</span>
          </div>
          {eventRows(events.slice(0, 6))}
          {events.length > 6 && (
            <AnimatedDetails className="story-more-events">
              <summary>Show {events.length - 6} more actions</summary>
              {eventRows(events.slice(6))}
            </AnimatedDetails>
          )}
        </section>

        <p className="story-evidence-note">
          Based on recorded actions. This shows what happened, without
          establishing why.
        </p>
        <section
          className="story-assessment"
          aria-label="Interpretation and counter-evidence"
        >
          <div className="story-section-heading">
            <h3>What the evidence supports</h3>
          </div>
          <p>{story.hypothesis.hypothesis.description}</p>
          {story.hypothesis.contradictoryEvidence.length > 0 && (
            <>
              <h4>What challenges the interpretation</h4>
              <ul>
                {story.hypothesis.contradictoryEvidence.map((evidence) => (
                  <li key={evidence.code}>{evidence.description}</li>
                ))}
              </ul>
            </>
          )}
          {story.hypothesis.missingInformation.length > 0 && (
            <>
              <h4>What this feed cannot establish</h4>
              <ul>
                {story.hypothesis.missingInformation.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </>
          )}
        </section>
        {answer?.notice && (
          <p className="story-evidence-note">{answer.notice}</p>
        )}

        <AnimatedDetails className="story-technical">
          <summary>Source & technical details</summary>
          <div className="story-technical-body">
            <p>{story.source.attribution}</p>
            <h4>Independent hypothesis checks</h4>
            <p>
              {story.hypothesis.verificationStatus.replaceAll("-", " ")}. These
              labels describe evidence, not a confidence percentage.
            </p>
            <ul>
              {story.hypothesis.verificationChecks.map((check) => (
                <li key={check.code}>
                  {check.passed ? "Passed" : "Failed"}: {check.detail}
                </li>
              ))}
            </ul>
            <h4>Measurements</h4>
            <ul>
              {story.hypothesis.measurements.map((measurement) => (
                <li key={measurement.key}>
                  {measurement.label}: {measurement.value} {measurement.unit}
                </li>
              ))}
            </ul>
            <h4>Evidence relationships</h4>
            <p>
              {story.intelligenceGraph.nodes.length} entities and{" "}
              {story.intelligenceGraph.edges.length} traceable relationships.
              The broadcast download includes the hypothesis, windows, events,
              players and team references.
            </p>
            <h4>Data limitations</h4>
            <ul>
              {story.limitations.map((limitation, index) => (
                <li key={index}>{limitation}</li>
              ))}
            </ul>
            {answer?.trace.length ? (
              <>
                <h4>Investigation</h4>
                <p>
                  {answer.metrics.requests} model requests ·{" "}
                  {answer.metrics.toolInvocations} tool calls ·{" "}
                  {answer.metrics.cached ? "cached" : "new response"}
                </p>
                <ul>
                  {answer.trace.map((trace, index) => (
                    <li key={index}>
                      <code>{trace.tool}</code>
                      <span>
                        {matchClock(match, trace.query.start)}–
                        {matchClock(match, trace.query.end)} ·{" "}
                        {trace.eventIds.length} returned events ·{" "}
                        {trace.claimIds.length} verified claims
                      </span>
                    </li>
                  ))}
                </ul>
                <h4>Verification</h4>
                <ul>
                  {answer.provenance.validation.map((validation) => (
                    <li key={validation}>{validation}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Computed from recorded events. No AI tool calls.</p>
            )}
            <h4>Event references</h4>
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <code>{event.id}</code>
                </li>
              ))}
            </ul>
          </div>
        </AnimatedDetails>
      </div>
    </AnimatedDetails>
  );
}
