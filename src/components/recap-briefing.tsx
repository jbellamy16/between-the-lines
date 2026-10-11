"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  buildBriefing,
  briefingClock as matchClock,
  durationLabel,
  momentLabel,
} from "@/lib/recap-briefing";
import { eventClock, type MatchData } from "@/lib/sources/model";
import type { StoryPreferences } from "@/lib/intelligence";
import type { DirectorResult } from "@/lib/ai/director/runner";
import {
  requestDirector,
  cachedDirectorResult,
} from "@/lib/ai/director/client-cache";
import { ArrowRight, EventIcon } from "./icons";
import { Crest } from "./team-identity";
import { StorylineHistory } from "./storyline-history";
import { StoryEvidence } from "./story-evidence";
import { providerLabel } from "./provenance";
import { AnimatedDetails } from "./motion";
import styles from "./recap-briefing.module.css";

export function RecapBriefing({
  match,
  time,
  since,
  preferences = {},
  provider,
  onMoment,
  onBack,
}: {
  match: MatchData;
  time: number;
  since: number | null;
  preferences?: StoryPreferences;
  provider: string;
  onMoment: (id: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [wholeMatch, setWholeMatch] = useState(false);
  const [entrySince] = useState(since);
  const [answer, setAnswer] = useState<DirectorResult | null>(() =>
    cachedDirectorResult(match, time, "analyst", preferences),
  );
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [timeline, setTimeline] = useState(false);
  const [eventLimit, setEventLimit] = useState(40);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const id = useId();
  const preferenceKey = JSON.stringify(preferences);
  const briefing = useMemo(
    () =>
      buildBriefing(match, time, {
        since: wholeMatch ? null : entrySince,
        preferences: JSON.parse(preferenceKey),
        stories: answer?.stories,
      }),
    [match, time, entrySince, wholeMatch, preferenceKey, answer],
  );
  const metrics = briefing.metrics.slice(0, mode === "quick" ? 2 : 6);
  const moments = briefing.moments
    .slice(0, mode === "quick" ? 3 : 8)
    .sort((a, b) => a.event.time - b.event.time);
  const events = match.events.filter(
    (e) => e.time <= time && e.type !== "possession",
  );
  const evidence = new Set(briefing.evidenceIds);
  const clock = matchClock(match, time);
  async function investigate() {
    if (loading || answer) return;
    setLoading(true);
    setNotice("");
    try {
      // Quick/full and since/kickoff are two views of one verified investigation.
      const result = await requestDirector(
        match,
        time,
        "analyst",
        JSON.parse(preferenceKey),
      );
      if (!mounted.current) return;
      setAnswer(result);
      setNotice(
        result.source === "offline"
          ? "Verified from recorded events. AI investigation is unavailable or disabled."
          : "Editorial selection checked against the match evidence.",
      );
    } catch {
      if (mounted.current)
        setNotice(
          "AI review is unavailable. Your verified briefing is still here.",
        );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  const explore = (ids: string[]) => {
    const event =
      events.findLast((e) => ids.includes(e.id) && e.position) ??
      events.findLast((e) => ids.includes(e.id));
    if (event) onMoment(event.id);
  };
  return (
    <div className={styles.briefing}>
      <div className={styles.intro}>
        <p className="recap-cutoff">
          {briefing.since !== null
            ? `Everything you missed from ${matchClock(match, briefing.since)} to ${clock}`
            : `Everything you missed through ${clock}`}
        </p>
        {briefing.since !== null && (
          <div className={styles.welcome}>
            <p>Welcome back. Here’s what you missed.</p>
            <button onClick={() => setWholeMatch(true)}>
              From kickoff instead
            </button>
          </div>
        )}
        <div className={styles.tabs} role="tablist" aria-label="Recap length">
          {(["quick", "full"] as const).map((value) => (
            <button
              key={value}
              id={`${id}-${value}`}
              role="tab"
              aria-selected={mode === value}
              aria-controls={`${id}-panel`}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => setMode(value)}
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? "quick"
                    : e.key === "End"
                      ? "full"
                      : mode === "quick"
                        ? "full"
                        : "quick";
                setMode(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }}
            >
              {value === "quick" ? "Quick recap" : "Full recap"}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.scoreboard} aria-label={`Score through ${clock}`}>
        <div className={styles.team}>
          {match.kind === "synthetic" && <Crest team="harbor" small />}
          <span>{match.teams.harbor.name}</span>
        </div>
        <strong className={styles.score}>
          {briefing.score.harbor}
          <span>–</span>
          {briefing.score.riverside}
        </strong>
        <div className={`${styles.team} ${styles.away}`}>
          <span>{match.teams.riverside.name}</span>
          {match.kind === "synthetic" && <Crest team="riverside" small />}
        </div>
        <span className={styles.clock}>
          {clock} · {time >= match.duration ? "Full time" : "Match position"}
          {match.kind === "synthetic" ? " · Synthetic demo" : ""}
        </span>
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${mode}`}
        tabIndex={0}
        className={styles.panel}
      >
        <section className={styles.story} aria-labelledby={`${id}-story`}>
          <p className={styles.eyebrow}>The story so far</p>
          <h3 id={`${id}-story`}>{briefing.headline}</h3>
          <p className={`recap-summary ${styles.narrative}`}>
            {briefing.narrative}
          </p>
          {briefing.qualifications.length > 0 && (
            <p className={styles.qualification}>
              {briefing.qualifications.join(" ")}
            </p>
          )}
          {mode === "full" &&
            briefing.expanded.map((text) => (
              <p className={styles.expanded} key={text}>
                {text}
              </p>
            ))}
        </section>
        {metrics.length > 0 && (
          <section
            className={styles.section}
            aria-label="The numbers behind the story"
          >
            <h4 className={styles.eyebrow}>The numbers behind the story</h4>
            <div className={styles.metrics}>
              {metrics.map((metric) => (
                <div className={styles.metric} key={metric.id}>
                  <div className={styles.metricTitle}>
                    <strong>{metric.label}</strong>
                    <span>
                      {metric.team}
                      {metric.windows.length
                        ? ` · Equal ${durationLabel(metric.windows[1].end - metric.windows[1].start)} windows`
                        : ""}
                    </span>
                  </div>
                  <div className={styles.value}>
                    <strong>{metric.current}</strong>
                    <span>{metric.currentLabel}</span>
                  </div>
                  <div className={`${styles.value} ${styles.previous}`}>
                    <strong>{metric.previous}</strong>
                    <span>{metric.previousLabel}</span>
                  </div>
                </div>
              ))}
            </div>
            {briefing.since !== null &&
              metrics.some((metric) =>
                metric.windows.some((window) => window.start < briefing.since!),
              ) && (
                <p className={styles.quiet}>
                  Comparisons include earlier context; key moments start after{" "}
                  {matchClock(match, briefing.since)}.
                </p>
              )}
          </section>
        )}
        <section className={styles.section} aria-labelledby={`${id}-moments`}>
          <div className={styles.sectionHeader}>
            <h4 id={`${id}-moments`} className={styles.eyebrow}>
              Key moments
            </h4>
            <button
              className={styles.textButton}
              aria-expanded={timeline}
              aria-controls={`${id}-timeline`}
              onClick={() => setTimeline(!timeline)}
            >
              {timeline ? "Close timeline" : "Explore complete timeline"}
              <ArrowRight size={16} />
            </button>
          </div>
          <ol className={`recap-timeline ${styles.moments}`}>
            {moments.map(({ event, label }) => (
              <li key={event.id}>
                <button onClick={() => onMoment(event.id)}>
                  <time>{eventClock(match, event)}</time>
                  <EventIcon
                    type={event.scoringTeam ? "goal" : event.type}
                    size={16}
                  />
                  <span>{label}</span>
                  <span className={styles.explore}>
                    Explore <ArrowRight size={16} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {!moments.length && (
            <p className={styles.quiet}>
              No significant events recorded in this interval.
            </p>
          )}
          {timeline && (
            <div className={styles.timeline} id={`${id}-timeline`}>
              <p>
                All recorded events through {clock}. Select an action to explore
                its evidence.
              </p>
              <ol>
                {events.slice(0, eventLimit).map((event) => (
                  <li key={event.id}>
                    <button onClick={() => onMoment(event.id)}>
                      <time>{eventClock(match, event)}</time>
                      <span>{momentLabel(match, event)}</span>
                      <ArrowRight size={16} />
                    </button>
                  </li>
                ))}
              </ol>
              {events.length > eventLimit && (
                <button
                  className={styles.textButton}
                  onClick={() => setEventLimit((n) => n + 60)}
                >
                  Show more events ({events.length - eventLimit} remaining)
                </button>
              )}
            </div>
          )}
        </section>
        {briefing.watch && (
          <section className={styles.watch} aria-labelledby={`${id}-watch`}>
            <p className={styles.eyebrow}>What to watch next</p>
            <h4 id={`${id}-watch`}>{briefing.watch.headline}</h4>
            <p>{briefing.watch.text}</p>
            <button
              className={styles.textButton}
              onClick={() => explore(briefing.watch!.evidenceIds)}
            >
              Explore the developing story <ArrowRight size={16} />
            </button>
          </section>
        )}
        {mode === "full" && (
          <StorylineHistory
            match={match}
            time={time}
            storylines={briefing.storylines}
          />
        )}
      </div>
      <AnimatedDetails className={`provenance ${styles.method}`}>
        <summary>How we reached this conclusion</summary>
        <div className={styles.methodBody}>
          <p>
            <strong>Evidence through {clock}.</strong> {match.attribution}
          </p>
          <p>
            {answer ? providerLabel(answer.source) : "Deterministic offline"}.{" "}
            {answer?.source && answer.source !== "offline"
              ? "AI selected independently verified stories; factual wording is controlled."
              : "Computed from verified match events; no AI-generated prose."}
          </p>
          <h4>Verified facts and supported interpretations</h4>
          <p>
            The score and event timeline are recorded facts. Changes in activity
            are interpretations of measured counts, checked independently
            against the source. A watch-next question remains unresolved; it is
            not a prediction.
          </p>
          {briefing.metrics
            .filter((m) => m.windows.length)
            .map((m) => (
              <p key={m.id}>
                {m.team} · {m.label}: {m.current} against {m.previous}.{" "}
                {m.windows
                  .map(
                    (w) =>
                      `${w.id}: ${matchClock(match, w.start)}–${matchClock(match, w.end)} (${w.boundary === "(start,end]" ? "start excluded, end included" : "both endpoints included"})`,
                  )
                  .join("; ")}
                . Each window lasts{" "}
                {durationLabel(m.windows[1].end - m.windows[1].start)}.
              </p>
            ))}
          {briefing.watch && (
            <p>
              <strong>Next assessment: </strong>
              {briefing.watch.criterion}
            </p>
          )}
          {briefing.stories.map((story) => (
            <StoryEvidence
              key={story.storyId}
              story={story}
              match={match}
              events={events.filter((e) =>
                story.evidenceEventIds.includes(e.id),
              )}
              answer={answer}
            />
          ))}
          <h4>Source events</h4>
          <ul>
            {events
              .filter((e) => evidence.has(e.id))
              .slice(0, 12)
              .map((event) => (
                <li key={event.id}>
                  <button
                    className={styles.textButton}
                    onClick={() => onMoment(event.id)}
                  >
                    {eventClock(match, event)} · {momentLabel(match, event)}
                    <ArrowRight size={16} />
                  </button>
                </li>
              ))}
          </ul>
          <p>
            Use the complete timeline for all source events. Comparisons use
            recorded actions, not possession time or off-ball tracking. Shot
            frequency alone does not establish chance quality.
          </p>
          <ul>
            {match.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
          {answer?.notice && <p>{answer.notice}</p>}
          {answer?.provenance.cached && (
            <p>Reused a validated investigation.</p>
          )}
        </div>
      </AnimatedDetails>
      <footer className={styles.footer}>
        <div>
          <span className={styles.verified}>Evidence-backed briefing</span>
          <button
            className={styles.textButton}
            disabled={loading || !!answer}
            onClick={investigate}
          >
            {loading
              ? "Checking evidence…"
              : answer
                ? "Evidence reviewed"
                : provider === "offline"
                  ? "Review verified recap"
                  : `Review with ${providerLabel(provider)}`}
          </button>
        </div>
        <button className={styles.back} onClick={onBack}>
          Back to the match <ArrowRight size={16} />
        </button>
      </footer>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
