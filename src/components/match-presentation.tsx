"use client";
import { ANALYSIS_MODE, type Insight, type Mode } from "@/lib/intelligence";
import { clock } from "@/lib/match";
import scoreboardStyles from "./scoreboard.module.css";
import { EMPTY_MATCH_CONTEXT } from "@/lib/match-context";
import { matchContext } from "@/lib/sources/context";
import {
  playerHighlights,
  scorelineNames,
} from "@/lib/sources/player-highlights";
import { eventDescription } from "@/lib/sources/intelligence";
import {
  eventClock,
  matchClock,
  periodAt,
  pitchEvents,
  recordedScore,
  type MatchData,
  type NormalizedEvent,
} from "@/lib/sources/model";
import type { CSSProperties, ReactNode } from "react";
import {
  EventIcon,
  Goal,
  Substitution,
  ArrowLeft,
  BarChart3,
  HighBallWins,
  Shot,
  Pass,
  ArrowRight,
  ListVideo,
  Pause,
  Play,
  RotateCcw,
} from "./icons";
import { PitchViewControl, type PitchView } from "./match-shell";
import { AnimatedDetails, Metric, SelectionGroup } from "./motion";
import { Pitch } from "./pitch";
import { Crest } from "./team-identity";
import { TimelineEvent } from "./timeline-event";

export const displayClock = (match: MatchData, time: number) =>
  match.kind === "synthetic" ? clock(time) : matchClock(match, time);
const identitiesFor = (match: MatchData) => ({
  teams: match.teams,
  player: (id: string) =>
    match.players.find((p) => p.id === id) ?? {
      name: "Unidentified player",
      number: null,
    },
});

export function MatchHeader({
  match,
  time,
  playing,
  speed,
  onPlay,
  onSeek,
  onSpeed,
  onRecap,
}: {
  match: MatchData;
  time: number;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onSeek: (time: number) => void;
  onSpeed: (speed: number) => void;
  onRecap: () => void;
}) {
  const visible = match.events.filter((e) => e.time <= time);
  const score = recordedScore(visible);
  const goals = visible.filter((e) => e.scoringTeam && e.period !== "PS");
  const highlights = playerHighlights(match, time);
  const halfTime =
    time >= match.secondHalfStart
      ? recordedScore(visible.filter((e) => e.period === "1H"))
      : null;
  const scorerEntries = (team: "harbor" | "riverside") =>
    scorelineNames(
      match,
      goals
        .filter((e) => e.scoringTeam === team)
        .map((event) => ({ playerId: event.playerId, event })),
    );
  const assistEntries = (team: "harbor" | "riverside") =>
    scorelineNames(
      match,
      match.players
        .filter((p) => p.team === team)
        .flatMap((p) =>
          (highlights.get(p.id)?.assistEvents ?? []).map((event) => ({
            playerId: p.id,
            event,
          })),
        ),
    );
  const homeAssists = assistEntries("harbor"),
    awayAssists = assistEntries("riverside");
  const names = (entries: { id: string; label: string }[]) =>
    entries.length ? (
      entries.map((entry) => <span key={entry.id}>{entry.label}</span>)
    ) : (
      <span className="no-score-event">—</span>
    );
  return (
    <div className="match-header">
      <section
        className="scoreboard"
        aria-label="Match scoreboard"
        data-match-id={match.id}
      >
        <h1 className="sr-only">{match.title}</h1>
        <div className={scoreboardStyles.summary}>
          <div className={scoreboardStyles.competition}>
            {match.competition}
          </div>
          <div className={scoreboardStyles.matchup}>
            <div
              className={`${scoreboardStyles.team} ${scoreboardStyles.home}`}
            >
              <span>{match.teams.harbor.name}</span>
              {match.kind === "synthetic" ? (
                <Crest team="harbor" />
              ) : (
                <span className={scoreboardStyles.monogram} aria-hidden="true">
                  {match.teams.harbor.short.slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>
            <div className={scoreboardStyles.center}>
              <strong
                className={scoreboardStyles.score}
                data-testid="score"
                aria-live="polite"
                aria-atomic="true"
                aria-label={`${match.teams.harbor.name} ${score.harbor}, ${match.teams.riverside.name} ${score.riverside}`}
              >
                <Metric value={score.harbor} important />
                <span className={scoreboardStyles.separator}>:</span>
                <Metric value={score.riverside} important />
              </strong>
              <div className={scoreboardStyles.clock} data-testid="clock">
                <time>{displayClock(match, time)}</time>
                <span className={scoreboardStyles.status}>
                  {time >= match.duration ? (
                    "Full time"
                  ) : (
                    <>
                      {periodAt(match, time).id === "1H"
                        ? "1st half"
                        : "2nd half"}
                      {playing ? " · Playing" : " · Paused"}
                    </>
                  )}
                </span>
              </div>
            </div>
            <div
              className={`${scoreboardStyles.team} ${scoreboardStyles.away}`}
            >
              {match.kind === "synthetic" ? (
                <Crest team="riverside" />
              ) : (
                <span className={scoreboardStyles.monogram} aria-hidden="true">
                  {match.teams.riverside.short.slice(0, 3).toUpperCase()}
                </span>
              )}
              <span>{match.teams.riverside.name}</span>
            </div>
          </div>
          {goals.length > 0 && (
            <div
              className={`score-contributions ${scoreboardStyles.details}`}
              aria-label="Goals and assists"
            >
              <div
                className={`score-contribution-row score-goals ${scoreboardStyles.detailRow}`}
              >
                <div
                  className="home-scorers"
                  aria-label={`${match.teams.harbor.name} scorers`}
                >
                  {names(scorerEntries("harbor"))}
                </div>
                <span className="score-contribution-label">
                  {halfTime
                    ? `HT ${halfTime.harbor}–${halfTime.riverside}`
                    : "Goals"}
                </span>
                <div
                  className="away-scorers"
                  aria-label={`${match.teams.riverside.name} scorers`}
                >
                  {names(scorerEntries("riverside"))}
                </div>
              </div>
              {(homeAssists.length > 0 || awayAssists.length > 0) && (
                <div
                  className={`score-contribution-row score-assists ${scoreboardStyles.detailRow} ${scoreboardStyles.assists}`}
                >
                  <div aria-label={`${match.teams.harbor.name} assists`}>
                    {names(homeAssists)}
                  </div>
                  <span className="score-contribution-label">Assists</span>
                  <div aria-label={`${match.teams.riverside.name} assists`}>
                    {names(awayAssists)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      <div className="match-controls">
        <div className="playback">
          <button
            className="play-button"
            aria-label={playing ? "Pause match" : "Play match"}
            onClick={onPlay}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div className="timeline">
            <div className="timeline-events">
              {match.events
                .filter(
                  (e) =>
                    e.time <= time &&
                    (e.scoringTeam || e.type === "substitution"),
                )
                .map((e) => (
                  <TimelineEvent
                    key={e.id}
                    match={match}
                    event={e}
                    onSeek={onSeek}
                  />
                ))}
            </div>
            <input
              type="range"
              aria-label="Match timeline"
              aria-valuetext={displayClock(match, time)}
              min={0}
              max={match.duration}
              step={1}
              value={time}
              onChange={(e) => onSeek(Number(e.target.value))}
              style={
                {
                  "--progress": `${(time / match.duration) * 100}%`,
                } as CSSProperties
              }
            />
            <div className="timeline-labels">
              <span>Kickoff</span>
              <span>Half-time</span>
              <span>Full-time</span>
            </div>
          </div>
          <select
            className="speed-select"
            aria-label="Playback speed"
            value={speed}
            onChange={(e) => onSpeed(Number(e.target.value))}
          >
            {[1, 4, 8, 16, 32].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label="Restart match"
            onClick={() => onSeek(0)}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <div className="view-toolbar">
        <button className="catchup-button" onClick={onRecap}>
          <ListVideo size={20} />
          Catch me up
        </button>
      </div>
    </div>
  );
}

export function InsightComparison({
  insight,
  match,
}: {
  insight: Insight;
  match: MatchData;
}) {
  const max = Math.max(insight.current, insight.previous, 1);
  return (
    <div
      className="measured-change"
      aria-label={`${insight.metric}: ${insight.current} versus ${insight.previous}`}
    >
      <p className="metric-label">{insight.metric}</p>
      <div className="change-total">
        <strong>{insight.current}</strong>
        <div className="change-comparison">
          <span className="change-delta">
            {insight.current - insight.previous > 0 ? "+" : ""}
            {insight.current - insight.previous}
          </span>
          <small>vs previous 15 min</small>
        </div>
      </div>
      {[
        [insight.current, insight.start, insight.end],
        [insight.previous, insight.start - 900, insight.start],
      ].map(([value, start, end], n) => (
        <div className={`window-row ${n ? "baseline" : ""}`} key={n}>
          <span>
            {displayClock(match, start)}–{displayClock(match, end)}
          </span>
          <span className="window-track">
            <i style={{ width: `${(value / max) * 100}%` }} />
          </span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}
function RecordedIcon({ event }: { event: NormalizedEvent }) {
  return event.scoringTeam ? (
    <Goal size={20} />
  ) : (
    <EventIcon type={event.type} size={20} />
  );
}
function InsightGlyph({ insight }: { insight: Insight }) {
  const Glyph =
    insight.category === "pressure"
      ? HighBallWins
      : insight.category === "chances"
        ? Shot
        : Pass;
  return <Glyph size={20} />;
}
export function InsightCard({
  insight,
  match,
  onSelect,
  lead = false,
  mode = ANALYSIS_MODE,
}: {
  insight: Insight;
  match: MatchData;
  onSelect: () => void;
  lead?: boolean;
  mode?: Mode;
}) {
  return (
    <button
      className={`observation-card insight-card ${lead ? "lead-observation" : ""}`}
      onClick={onSelect}
    >
      <span className="insight-badges">
        <span className="observation-team">
          <i className={`team-marker ${insight.team}`} />
          {match.teams[insight.team].name}
        </span>
        <span className="context-label">Analytical insight</span>
      </span>
      <h3>
        <InsightGlyph insight={insight} />
        {insight.headline}
      </h3>
      {lead ? (
        <InsightComparison insight={insight} match={match} />
      ) : (
        <p>
          <strong>{insight.current}</strong> {insight.metric.toLowerCase()}{" "}
          <span>
            vs {insight.previous} · {displayClock(match, insight.start)}–
            {displayClock(match, insight.end)}
          </span>
        </p>
      )}
      {mode === "analyst" && <p>{insight.analyst}</p>}
      <span className="explore-evidence">
        {insight.evidenceIds.length} supporting actions <ArrowRight size={16} />
      </span>
    </button>
  );
}
/** Recorded context occupies the existing intelligence space, without trend styling. */
export function MatchContext({
  match,
  time,
  onEvent,
}: {
  match: MatchData;
  time: number;
  onEvent: (id: string) => void;
}) {
  const { items } = matchContext(match, time);
  if (!items.length)
    return <p className="empty-observation">{EMPTY_MATCH_CONTEXT}</p>;
  return (
    <div className="match-context" data-testid="match-context">
      <h2>Match context</h2>
      {items.map((item) => (
        <article className="context-item" key={item.id}>
          <span className="context-label">
            {item.kind === "event" ? "Recorded event" : "Match statistics"}
          </span>
          <h3>
            {item.kind === "event" ? (
              <RecordedIcon
                event={match.events.find((e) => e.id === item.eventId)!}
              />
            ) : (
              <BarChart3 size={20} />
            )}
            {item.headline}
          </h3>
          <p>{item.text}</p>
          {item.kind === "event" && (
            <time>
              {eventClock(
                match,
                match.events.find((e) => e.id === item.eventId)!,
              )}
            </time>
          )}
          <AnimatedDetails className="context-evidence">
            <summary>
              View {item.evidenceIds.length} recorded{" "}
              {item.evidenceIds.length === 1 ? "action" : "actions"}
            </summary>
            <div
              className="evidence-list"
              tabIndex={0}
              aria-label={`${item.headline} evidence`}
            >
              {match.events
                .filter(
                  (e) => e.time <= time && item.evidenceIds.includes(e.id),
                )
                .map((e) => (
                  <button key={e.id} onClick={() => onEvent(e.id)}>
                    <time>{eventClock(match, e)}</time>
                    <span>{eventDescription(match, e)}</span>
                    <Play size={16} />
                  </button>
                ))}
            </div>
          </AnimatedDetails>
        </article>
      ))}
    </div>
  );
}
export function InsightOverview({
  match,
  insights,
  onSelect,
  mode,
  empty,
}: {
  match: MatchData;
  insights: Insight[];
  onSelect: (i: Insight) => void;
  mode: Mode;
  empty: ReactNode;
}) {
  return (
    <section className="observations-page" aria-label="Insights">
      <h2 className="sr-only">Insights</h2>
      {insights.length ? (
        <>
          <InsightCard
            insight={insights[0]}
            match={match}
            lead
            mode={mode}
            onSelect={() => onSelect(insights[0])}
          />
          <div className="supporting-observations">
            {insights.slice(1).map((i) => (
              <InsightCard
                key={`${i.team}-${i.category}`}
                insight={i}
                match={match}
                mode={mode}
                onSelect={() => onSelect(i)}
              />
            ))}
          </div>
        </>
      ) : (
        empty
      )}
    </section>
  );
}
export function InsightDetails({
  match,
  insight,
  insights,
  onSelect,
  onEvent,
  onReplay,
  tab,
  onTab,
  mode,
  explanation,
  children,
  empty,
  story,
}: {
  story?: ReactNode;
  match: MatchData;
  insight?: Insight;
  insights: Insight[];
  onSelect: (i: Insight) => void;
  onEvent: (id: string) => void;
  onReplay: () => void;
  tab: "visual" | "evidence" | "explanation";
  onTab: (tab: "visual" | "evidence" | "explanation") => void;
  mode: Mode;
  explanation?: ReactNode;
  children: ReactNode;
  empty: ReactNode;
}) {
  const evidence = insight
    ? match.events.filter(
        (e) => e.time <= insight.end && insight.evidenceIds.includes(e.id),
      )
    : [];
  return (
    <aside className="panel detail-panel" aria-label="Match intelligence">
      {story}
      {insight ? (
        <>
          <div className="selected-observation">
            <div className="insight-badges">
              <span className="observation-team">
                <i className={`team-marker ${insight.team}`} />
                {match.teams[insight.team].name}
              </span>
              <span className="context-label">Analytical insight</span>
            </div>
            <h2>
              <InsightGlyph insight={insight} />
              {insight.headline}
            </h2>
            {mode === "analyst" && <p>{insight.analyst}</p>}
            <InsightComparison insight={insight} match={match} />
          </div>
          <SelectionGroup
            className="detail-tabs"
            label="Insight details"
            value={tab}
          >
            {(["visual", "evidence", "explanation"] as const).map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                aria-pressed={tab === t}
                onClick={() => onTab(t)}
              >
                {t === "evidence"
                  ? `Evidence (${evidence.length})`
                  : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </SelectionGroup>
          <div className="detail-content">
            {tab === "visual" && (
              <>
                <div className="comparison-pitches">
                  {[insight.evidenceIds, insight.baselineIds].map((ids, n) => (
                    <div key={n}>
                      <Pitch
                        compact
                        aggregate={ids.length > 24}
                        events={pitchEvents(
                          match.events.filter(
                            (e) => e.time <= insight.end && ids.includes(e.id),
                          ),
                        )}
                        identities={identitiesFor(match)}
                      />
                      <span>
                        {n ? "Previous 15 minutes" : "Last 15 minutes"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="metric-note">
                  {insight.metric} locations · attacking direction normalized.
                </p>
              </>
            )}
            {tab === "evidence" && (
              <div
                className="evidence-list"
                tabIndex={0}
                aria-label="Supporting actions"
              >
                {evidence.map((e) => (
                  <button key={e.id} onClick={() => onEvent(e.id)}>
                    <time>{displayClock(match, e.time)}</time>
                    <span className={`event-glyph ${e.team}`}>
                      <EventIcon type={e.type} />
                    </span>
                    <span>
                      {eventDescription(match, e)}
                      <small>{match.teams[e.team].short}</small>
                    </span>
                    <Play size={16} />
                  </button>
                ))}
              </div>
            )}
            {tab === "explanation" &&
              (explanation ?? (
                <>
                  <p>{insight.explanation}</p>
                  <p>{insight.why}</p>
                  <p>{insight.watch}</p>
                </>
              ))}
            <button className="sequence-button" onClick={onReplay}>
              Show me the sequence <ArrowRight size={20} />
            </button>
            {children}
          </div>
          {insights.length > 1 && (
            <AnimatedDetails className="more-observations">
              <summary>
                More observations{" "}
                <span className="disclosure-count">{insights.length - 1}</span>
              </summary>
              {insights
                .filter((i) => i.id !== insight.id)
                .map((i) => (
                  <InsightCard
                    key={`${i.team}-${i.category}`}
                    insight={i}
                    match={match}
                    onSelect={() => onSelect(i)}
                  />
                ))}
            </AnimatedDetails>
          )}
        </>
      ) : (
        empty
      )}
    </aside>
  );
}
export function MatchPitch({
  match,
  time,
  events,
  selected,
  onSelect,
  view,
  onView,
  hasPattern,
  hasPassage,
  replay,
  onClear,
  onSeek,
}: {
  match: MatchData;
  time: number;
  events: NormalizedEvent[];
  selected?: string;
  onSelect: (id: string) => void;
  view: PitchView;
  onView: (view: PitchView) => void;
  hasPattern: boolean;
  hasPassage: boolean;
  replay?: ReactNode;
  onClear: () => void;
  onSeek: (time: number) => void;
}) {
  const actions = events.filter(
    (e) => !["possession", "substitution"].includes(e.type),
  );
  const active = actions.find((e) => e.id === selected) ?? actions.at(-1);
  return (
    <section className="panel pitch-panel">
      <div className="panel-header">
        <h2>
          {view === "passage"
            ? "Passage replay"
            : view === "pattern"
              ? "Where it happened"
              : "Recent actions"}
        </h2>
        {view === "passage" && (
          <button className="text-button" onClick={onClear}>
            Clear selection
          </button>
        )}
      </div>
      <PitchViewControl
        value={view}
        onChange={onView}
        hasPattern={hasPattern}
        hasPassage={hasPassage}
      />
      <div className="pitch-topline">
        <span>
          <i className="team-marker harbor" />
          {match.teams.harbor.short} <ArrowRight size={16} />
        </span>
        <span>
          <ArrowLeft size={16} /> {match.teams.riverside.short}
          <i className="team-marker riverside" />
        </span>
      </div>
      {replay ?? (
        <>
          <Pitch
            events={pitchEvents(actions)}
            selected={selected}
            onSelect={(e) => onSelect(e.id)}
            sequence={view !== "pattern"}
            aggregate={view === "pattern" && actions.length > 24}
            includeAllActions
            identities={identitiesFor(match)}
            formatTime={(t) => displayClock(match, t)}
          />
          <div className="event-inspector action-picker">
            <div>
              <p>
                {active
                  ? `${displayClock(match, active.time)} · ${eventDescription(match, active)}`
                  : "No actions in this window."}
              </p>
            </div>
            {actions.length > 0 && (
              <select
                aria-label="Recorded event"
                value={active?.id ?? ""}
                onChange={(e) => onSelect(e.target.value)}
              >
                {actions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {displayClock(match, e.time)} · {eventDescription(match, e)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="event-steps">
            <button
              className="text-button"
              disabled={
                !match.events.some(
                  (e) => e.time < time && e.type !== "possession",
                )
              }
              onClick={() =>
                onSeek(
                  match.events.findLast(
                    (e) => e.time < time && e.type !== "possession",
                  )?.time ?? 0,
                )
              }
            >
              Previous action
            </button>
            <button
              className="text-button"
              disabled={
                !match.events.some(
                  (e) => e.time > time && e.type !== "possession",
                )
              }
              onClick={() =>
                onSeek(
                  match.events.find(
                    (e) => e.time > time && e.type !== "possession",
                  )?.time ?? match.duration,
                )
              }
            >
              Next action
            </button>
          </div>
        </>
      )}
      <AnimatedDetails className="pitch-notes">
        <summary>About this view</summary>
        <p>
          Home attacks right; away attacks left. This is a normalized schematic,
          not actual stadium orientation. Markers show actions, not player
          positions. Area counts count actions, not time spent.
        </p>
        <p>
          {match.kind === "synthetic"
            ? "Generated event locations. Replay motion connects generated endpoints; it is not player tracking."
            : "Recorded event locations. No possession or motion between sparse events is inferred."}
        </p>
      </AnimatedDetails>
    </section>
  );
}
export function MatchEventFeed({
  match,
  time,
  onEvent,
}: {
  match: MatchData;
  time: number;
  onEvent: (id: string) => void;
}) {
  const events = match.events
    .filter((e) => e.time <= time && e.type !== "possession")
    .slice(-50)
    .reverse();
  return (
    <AnimatedDetails className="panel match-event-feed">
      <summary>
        Recent events <span className="disclosure-count">{events.length}</span>
      </summary>
      <div className="event-feed-list" tabIndex={0} aria-label="Recent events">
        {events.map((e) => (
          <button key={e.id} onClick={() => onEvent(e.id)}>
            <time>{displayClock(match, e.time)}</time>
            <span className={`event-glyph ${e.team}`}>
              <EventIcon type={e.type} />
            </span>
            <span>
              {eventDescription(match, e)}
              <small>{match.teams[e.team].short}</small>
            </span>
            <Play size={16} />
          </button>
        ))}
        {!events.length && <p>No events yet.</p>}
      </div>
    </AnimatedDetails>
  );
}
