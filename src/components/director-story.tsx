"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchData } from "@/lib/sources/model";
import { matchClock } from "@/lib/sources/model";
import type { Mode, StoryPreferences } from "@/lib/intelligence";
import { observe } from "@/lib/ai/director/observer";
import { packageStory, type BroadcastStory } from "@/lib/ai/director/story";
import type { DirectorResult } from "@/lib/ai/director/runner";
import { AnimatedDetails, Reveal } from "./motion";
import { EvidenceReplay } from "./evidence-replay";
import { providerLabel } from "./provenance";
import { StoryEvidence } from "./story-evidence";
import { reconstructStorylines } from "@/lib/ai/director/storylines";
import { StorylineHistory } from "./storyline-history";

export function BroadcastPreview({ story }: { story: BroadcastStory }) {
  return (
    <AnimatedDetails className="director-disclosure broadcast-preview">
      <summary>Broadcast story</summary>
      <div className="broadcast-frame">
        <span className="eyebrow">
          BETWEEN THE LINES · {story.audience.toUpperCase()}
        </span>
        <h3>{story.headline}</h3>
        <p>{story.explanation}</p>
        <p>{story.whyItMatters}</p>
        <svg
          viewBox="0 0 100 64"
          role="img"
          aria-label="Recorded evidence locations on a normalized pitch"
        >
          <rect
            x="1"
            y="1"
            width="98"
            height="62"
            rx="1"
            fill="none"
            stroke="currentColor"
          />
          <path
            d="M50 1V63 M1 18H16V46H1 M99 18H84V46H99"
            fill="none"
            stroke="currentColor"
          />
          <circle cx="50" cy="32" r="9" fill="none" stroke="currentColor" />
          {story.coordinates.slice(-40).map((p) => (
            <circle
              key={p.eventId}
              cx={p.x * 0.98 + 1}
              cy={p.y * 0.62 + 1}
              r={p.type === "shot" ? 2 : 1.2}
              fill="currentColor"
              role="img"
              aria-label={`${p.type} · ${p.eventId}`}
            />
          ))}
        </svg>
        <small>
          {story.evidenceEventIds.length} recorded actions ·{" "}
          {providerLabel(story.provider)} · Verified
        </small>
      </div>
      <p className="metric-note">
        Action coordinates normalized toward the attacking goal.{" "}
        {story.source.attribution}
      </p>
      <button
        className="text-button"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(story, null, 2)], {
              type: "application/json",
            }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "between-the-lines-story.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download verified story JSON
      </button>
    </AnimatedDetails>
  );
}
export function DirectorStory({
  match,
  time,
  mode,
  preferences = {},
  active,
  playing,
  onExplore,
}: {
  match: MatchData;
  time: number;
  mode: Mode;
  preferences?: StoryPreferences;
  active: boolean;
  playing: boolean;
  onExplore: () => void;
}) {
  const [answer, setAnswer] = useState<DirectorResult | null>(null),
    [busy, setBusy] = useState(false),
    [replay, setReplay] = useState(false);
  const [proactive, setProactive] = useState(false);
  const request = useRef<AbortController | null>(null),
    lastAttempt = useRef(-Infinity),
    seen = useRef(new Set<string>());
  const preferenceKey = JSON.stringify(preferences);
  const candidates = useMemo(
    () => observe(match, time, mode, JSON.parse(preferenceKey)),
    [match, time, mode, preferenceKey],
  );
  const candidate = candidates[0];
  const storylines = useMemo(
    () => reconstructStorylines(match, time),
    [match, time],
  );
  const fallback = useMemo(
    () =>
      candidate
        ? packageStory(
            candidate,
            match,
            time,
            mode,
            "offline",
            mode === "fan" ? "brief" : "detail",
            ["activity-change", "shot-location"].includes(candidate.category)
              ? "comparison"
              : ["passing-pair", "substitute-involvement"].includes(
                    candidate.category,
                  )
                ? "contribution"
                : "sequence",
          )
        : null,
    [candidate, match, time, mode],
  );
  const answerContext = useRef<{
    match: MatchData;
    preferenceKey: string;
    mode: Mode;
  } | null>(null);
  const validAnswer =
    answer &&
    answerContext.current?.match === match &&
    answerContext.current?.preferenceKey === preferenceKey &&
    answerContext.current?.mode === mode &&
    answer.provenance.cutoff <= time &&
    time - answer.provenance.cutoff <= 180 &&
    answer.stories.every(
      (s) =>
        s.audience === mode &&
        s.matchId === match.id &&
        (time < s.presentation.expires ||
          (time === match.duration && s.cutoff === match.duration)),
    )
      ? answer
      : null;
  const story = validAnswer ? validAnswer.stories[0] : fallback;
  const requestCutoff = useRef<number | null>(null);
  const presentedEvidence = useRef(new Set<string>());
  const latestTime = useRef(time);
  latestTime.current = time;
  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => setProactive(d.proactive === true))
      .catch(() => {});
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    request.current?.abort();
    setAnswer(null);
    setBusy(false);
    setReplay(false);
    seen.current.clear();
    presentedEvidence.current.clear();
  }, [match, mode, preferenceKey]);
  useEffect(() => {
    if (!active) {
      request.current?.abort();
      setBusy(false);
      setReplay(false);
    }
  }, [active]);
  const previousTime = useRef(time);
  useEffect(() => {
    if (
      time < previousTime.current ||
      time - previousTime.current > 180 ||
      (requestCutoff.current !== null && time - requestCutoff.current > 180)
    ) {
      request.current?.abort();
      requestCutoff.current = null;
      setAnswer(null);
      setBusy(false);
      setReplay(false);
      seen.current.clear();
      presentedEvidence.current.clear();
    }
    previousTime.current = time;
  }, [time]);
  async function investigate() {
    if (busy || !candidate) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    lastAttempt.current = Date.now();
    seen.current.add(candidateEpisode!);
    const cutoff = Math.floor(time);
    requestCutoff.current = cutoff;
    const source =
      match.kind === "synthetic"
        ? {
            scenario: match.provenance.raw.scenario,
            profile: match.provenance.raw.profile,
          }
        : { matchId: match.id };
    try {
      const response = await fetch("/api/director", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...source,
          time: cutoff,
          mode,
          preferences: {
            ...preferences,
            seenEvidenceIds: [...presentedEvidence.current].slice(-200),
          },
        }),
      });
      if (!response.ok) throw new Error("Unavailable");
      const result: DirectorResult = await response.json();
      if (
        !controller.signal.aborted &&
        latestTime.current >= cutoff &&
        latestTime.current - cutoff <= 180
      ) {
        answerContext.current = { match, preferenceKey, mode };
        setAnswer(result);
        for (const story of result.stories)
          for (const id of story.evidenceEventIds)
            presentedEvidence.current.add(id);
      }
    } catch {
      /* The computed story stays visible on transport failures. */
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        requestCutoff.current = null;
      }
    }
  }
  const candidateEpisode = fallback?.storyline
    ? `${fallback.storyline.id}:${fallback.storyline.episode}:${fallback.storyline.state}`
    : candidate?.id;
  useEffect(() => {
    if (
      active &&
      playing &&
      proactive &&
      candidate &&
      candidate.rank >= 7 &&
      !seen.current.has(candidateEpisode!) &&
      Date.now() - lastAttempt.current >= 60000
    )
      void investigate();
    // Only candidate episodes trigger work. Timestamp ticks must never start a request loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateEpisode, active, playing, proactive]);
  if (!active) return null;
  if (!story)
    return (
      <StorylineHistory match={match} time={time} storylines={storylines} />
    );
  const events = match.events.filter(
    (e) => e.time <= time && story.evidenceEventIds.includes(e.id),
  );
  return (
    <>
      <Reveal change={story.storyId} className="director-story">
        <span className="eyebrow">
          {providerLabel(story.provider)} · recorded relationship
        </span>
        <h2>{story.headline}</h2>
        <p>{story.explanation}</p>
        <div className="story-significance">
          <h3>Why it matters</h3>
          <p>{story.whyItMatters}</p>
          <h3>Watch next</h3>
          <p>{story.watchNext}</p>
        </div>
        <small>
          Through {matchClock(match, story.cutoff)} ·{" "}
          {story.evidenceEventIds.length} evidence actions
        </small>
        <div className="director-actions">
          <button
            className="text-button"
            onClick={() => {
              if (!replay) onExplore();
              setReplay((v) => !v);
            }}
          >
            {replay ? "Close story replay" : "Replay story evidence"}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              onExplore();
              void investigate();
            }}
          >
            {busy ? "Checking evidence…" : "Investigate this passage"}
          </button>
        </div>
        {replay && (
          <EvidenceReplay
            key={story.storyId}
            events={events}
            suspended={playing || !active}
            generated={match.kind === "synthetic"}
            identities={{
              teams: match.teams,
              player: (id) =>
                match.players.find((p) => p.id === id) ?? {
                  name: "Unidentified player",
                  number: null,
                },
            }}
            formatTime={(t) => matchClock(match, t)}
          />
        )}
        <StoryEvidence
          story={story}
          match={match}
          events={events}
          answer={validAnswer}
        />
        <BroadcastPreview story={story} />
      </Reveal>
      <StorylineHistory match={match} time={time} storylines={storylines} />
    </>
  );
}
