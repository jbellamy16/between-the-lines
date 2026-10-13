"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { explanationLabels, presentStory } from "@/lib/explanation";
import {
  ExplanationSelector,
  useExplanationStyle,
} from "./explanation-preference";
import { requestDirector } from "@/lib/ai/director/client-cache";
import type { MatchData } from "@/lib/sources/model";
import {
  matchClock,
  eventClock,
  type NormalizedEvent,
} from "@/lib/sources/model";
import type { Mode, StoryPreferences } from "@/lib/intelligence";
import { observe, claimEmphasis } from "@/lib/ai/director/observer";
import { selectLeadCandidate, isMatchState } from "@/lib/ai/director/editorial";
import { packageStory, type BroadcastStory } from "@/lib/ai/director/story";
import type { DirectorResult } from "@/lib/ai/director/runner";
import { AnimatedDetails, Reveal } from "./motion";
import { EvidenceReplay } from "./evidence-replay";
import { providerLabel } from "./provenance";
import { StoryEvidence } from "./story-evidence";
import { reconstructStorylines } from "@/lib/ai/director/storylines";
import { AnalystPanel } from "./analyst-panel";
import { StorylineHistory } from "./storyline-history";
import { InvestigationSource } from "./investigation-source";
import { InvestigationEvidence } from "./investigation-evidence";

export function BroadcastPreview({
  story,
  match,
}: {
  story: BroadcastStory;
  match: MatchData;
}) {
  const style = useExplanationStyle();
  const wording = presentStory(story, match, style);
  return (
    <AnimatedDetails className="director-disclosure broadcast-preview">
      <summary>Broadcast story</summary>
      <div className="broadcast-frame">
        <span className="eyebrow">
          BETWEEN THE LINES · {explanationLabels[style].toUpperCase()}
        </span>
        <h3>{wording.headline}</h3>
        <p>{wording.explanation}</p>
        <p>{wording.why}</p>
        {wording.qualifications.map((q) => (
          <p key={q.code}>{q.text}</p>
        ))}
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
          {story.coordinates
            .filter((p) => story.highlightedEventIds.includes(p.eventId))
            .slice(-40)
            .map((p) => (
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
          {story.highlightedEventIds.length} highlighted actions ·{" "}
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
export function useDirectorStory({
  match,
  time,
  mode,
  preferences = {},
  active,
  playing,
}: {
  match: MatchData;
  time: number;
  mode: Mode;
  preferences?: StoryPreferences;
  active: boolean;
  playing: boolean;
}) {
  const style = useExplanationStyle();
  const [answer, setAnswer] = useState<DirectorResult | null>(null),
    [busy, setBusy] = useState(false),
    [replay, setReplay] = useState(false);
  const [proactive, setProactive] = useState(false);
  const [provider, setProvider] = useState("offline");
  const [notice, setNotice] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<{
    team: string;
    label: string;
  } | null>(null);
  const request = useRef<AbortController | null>(null),
    lastAttempt = useRef(-Infinity),
    seen = useRef(new Set<string>());
  const [selection, setSelection] = useState<{
    id: string;
    time: number;
  } | null>(null);
  const preferenceKey = JSON.stringify(preferences);
  const candidates = useMemo(
    () => observe(match, time, mode, JSON.parse(preferenceKey)),
    [match, time, mode, preferenceKey],
  );
  const lead = selectLeadCandidate(candidates);
  const candidate =
    candidates.find((c) => selection?.time === time && c.id === selection.id) ??
    (lead && isMatchState(lead)
      ? lead
      : (candidates.find(
          (c) =>
            c.team === selectedMetric?.team &&
            c.statistics[0]?.label === selectedMetric?.label,
        ) ?? lead));
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
            "brief",
            claimEmphasis[candidate.category],
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
    !selectedMetric &&
    !selection &&
    !(lead && isMatchState(lead)) &&
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
      .then((d) => {
        const enabled = ["openai", "foundry"].includes(d.mode);
        setProvider(enabled ? d.mode : "offline");
        setProactive(enabled && d.proactive === true);
      })
      .catch(() => {});
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    request.current?.abort();
    setAnswer(null);
    setBusy(false);
    setReplay(false);
    setNotice("");
    setEvidenceOpen(false);
    setSelectedMetric(null);
    setSelection(null);
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
    if (busy || !candidate || provider === "offline" || isMatchState(candidate))
      return;
    setNotice("");
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    lastAttempt.current = Date.now();
    seen.current.add(candidateEpisode!);
    const cutoff = Math.floor(time);
    requestCutoff.current = cutoff;
    const requestPreferences = {
      ...preferences,
      seenEvidenceIds: [...presentedEvidence.current].slice(-200),
    };
    try {
      const result = await requestDirector(
        match,
        cutoff,
        mode,
        requestPreferences,
        controller.signal,
      );
      if (result.failure && request.current === controller)
        seen.current.delete(candidateEpisode!);
      if (
        !controller.signal.aborted &&
        latestTime.current >= cutoff &&
        latestTime.current - cutoff <= 180
      ) {
        answerContext.current = { match, preferenceKey, mode };
        setSelection(null);
        setSelectedMetric(null);
        setReplay(false);
        setAnswer(result);
        setNotice(
          result.notice ??
            (result.source === "offline"
              ? "AI is unavailable. Showing the explanation checked from recorded events."
              : "Investigation complete. The story and pitch now show the checked evidence."),
        );
        if (result.source !== "offline")
          for (const story of result.stories)
            for (const id of story.evidenceEventIds)
              presentedEvidence.current.add(id);
      }
    } catch {
      if (request.current === controller)
        seen.current.delete(candidateEpisode!);
      if (!controller.signal.aborted)
        setNotice(
          "The investigation could not finish. Your recorded explanation is still available. Try again when the service is available.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
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
      !isMatchState(candidate) &&
      !seen.current.has(candidateEpisode!) &&
      Date.now() - lastAttempt.current >= 60000
    )
      void investigate();
    // Only candidate episodes trigger work. Timestamp ticks must never start a request loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateEpisode, active, playing, proactive]);
  return {
    story,
    wording: story ? presentStory(story, match, style) : null,
    storylines,
    validAnswer,
    busy,
    notice,
    replay,
    setReplay,
    evidenceOpen,
    setEvidenceOpen,
    provider,
    investigate,
    cancelInvestigation: () => {
      request.current?.abort();
      request.current = null;
      requestCutoff.current = null;
      setBusy(false);
      setNotice("");
    },
    setSelectedMetric,
    candidates,
    selectCandidate: (id: string) => {
      request.current?.abort();
      requestCutoff.current = null;
      setBusy(false);
      setNotice("");
      setAnswer(null);
      setSelectedMetric(null);
      setSelection({ id, time });
      setReplay(false);
    },
    selectionActive: candidate !== lead,
    clearSelection: () => {
      setSelection(null);
      setSelectedMetric(null);
      setReplay(false);
    },
  };
}

export function DirectorStory({
  director,
  match,
  time,
  playing,
  active,
  onExplore,
  onReplay,
  onEvent,
  momentAsk = null,
}: {
  director: ReturnType<typeof useDirectorStory>;
  match: MatchData;
  time: number;
  playing: boolean;
  active: boolean;
  onEvent: (id: string) => void;
  onExplore: () => void;
  onReplay: () => void;
  /** A tapped moment: open the analyst on that story's checked answer. */
  momentAsk?: { id: string; storyId: string; cutoff: number } | null;
}) {
  const style = useExplanationStyle();
  const {
    story,
    wording,
    storylines,
    validAnswer,
    busy,
    notice,
    replay,
    setReplay,
    evidenceOpen,
    setEvidenceOpen,
    provider,
    investigate,
    candidates,
    selectCandidate,
    selectionActive,
    clearSelection,
  } = director;
  const observations = candidates.filter((c) => c.id !== story?.storyId);
  const more = observations.length > 0 && (
    <AnimatedDetails className="director-disclosure director-observations">
      <summary>More from this match</summary>
      <div>
        {observations.map((candidate) => (
          <button
            key={candidate.id}
            className="text-button"
            onClick={() => {
              onExplore();
              onReplay();
              selectCandidate(candidate.id);
            }}
          >
            {candidate.headline}
          </button>
        ))}
      </div>
    </AnimatedDetails>
  );
  if (!active) return null;
  if (!story)
    return (
      <div className="quiet-story panel">
        <span className="eyebrow">What matters now</span>
        <p>
          {style !== "analysis"
            ? "No new headline. Explore the recorded actions while the next passage develops."
            : "No new headline. No eligible lead meets the evidence thresholds at this cutoff; secondary observations remain available."}
        </p>
        <ExplanationSelector />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <AnalystPanel
          match={match}
          time={time}
          provider={provider}
          onExplore={onExplore}
          onEvent={onEvent}
        />
        <AnimatedDetails className="director-disclosure quiet-evidence">
          <summary>Explore evidence</summary>
          <p>
            Recorded events through {matchClock(match, time)}. No new headline
            does not mean nothing happened.
          </p>
          {match.events
            .filter((e) => e.time <= time && e.type !== "possession")
            .slice(-8)
            .map((e) => (
              <button
                className="text-button"
                key={e.id}
                onClick={() => onEvent(e.id)}
              >
                {eventClock(match, e)} · {e.type.replaceAll("_", " ")} · Replay
              </button>
            ))}
          <p>{match.attribution}</p>
          <ul>
            {match.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </AnimatedDetails>
        {more}
        <StorylineHistory match={match} time={time} storylines={storylines} />
      </div>
    );
  const events = match.events.filter(
    (e) => e.time <= time && story.evidenceEventIds.includes(e.id),
  );
  const supportIds = new Set(
    story.hypothesis.supportingEvidence.flatMap((e) => e.eventIds),
  );
  const chips = match.events
    .filter((e) => e.time <= story.cutoff && supportIds.has(e.id))
    .slice(-3);
  return (
    <>
      <Reveal change={story.storyId} className="director-story panel">
        <span className="eyebrow">
          {selectionActive ? "Selected observation" : "What matters now"} ·{" "}
          {match.kind === "synthetic" ? "Synthetic demo" : "Recorded match"}
        </span>
        <h2>{wording!.headline}</h2>
        <h3 className="investigation-heading">What changed</h3>
        <p>{wording!.explanation}</p>
        <h3 className="investigation-heading">Why it matters</h3>
        <p className="story-qualification">{wording!.why}</p>
        <div className="story-chips" role="group" aria-label="Story evidence">
          <button
            className="story-chip story-chip-replay"
            disabled={!events.length}
            onClick={() => {
              onExplore();
              onReplay();
              setReplay((v) => !v);
              if (!replay)
                requestAnimationFrame(() =>
                  document
                    .querySelector(".app-shell:not([hidden]) .pitch-panel")
                    ?.scrollIntoView({ block: "start", behavior: "instant" }),
                );
            }}
          >
            {replay ? "Close story replay" : "Replay story evidence"}
          </button>
          {chips.map((event) => (
            <button
              className="story-chip"
              key={event.id}
              onClick={() => onEvent(event.id)}
              aria-label={`Replay supporting ${event.type.replaceAll("_", " ")} at ${eventClock(match, event)}`}
            >
              {eventClock(match, event)} · {event.type.replaceAll("_", " ")}
            </button>
          ))}
          {selectionActive && (
            <button
              className="story-chip"
              onClick={() => {
                clearSelection();
                onReplay();
              }}
            >
              Back to main story
            </button>
          )}
        </div>
        {(busy || notice) && (
          <p className="notice" role="status">
            {busy ? "Checking the passage and its supporting events…" : notice}
          </p>
        )}
        <AnalystPanel
          match={match}
          time={time}
          provider={provider}
          story={story}
          autoAsk={momentAsk}
          onExplore={() => {
            director.cancelInvestigation();
            onExplore();
          }}
          onEvent={onEvent}
        />
        <AnimatedDetails className="director-disclosure story-details">
          <summary>Details</summary>
          <ExplanationSelector />
          <InvestigationEvidence
            story={story}
            match={match}
            wording={wording!}
            style={style}
            onEvent={onEvent}
          />
          <section
            className="story-significance"
            aria-label="What to watch next"
          >
            <h3>What to watch next</h3>
            <p>{wording!.watch}</p>
          </section>
          <InvestigationSource
            source={story.provider}
            cached={validAnswer?.metrics.cached}
          />
          <small>
            Through {matchClock(match, story.cutoff)} ·{" "}
            {story.highlightedEventIds.length} highlighted actions
          </small>
          <div className="director-actions">
            <button
              className="text-button"
              onClick={() => {
                onExplore();
                setEvidenceOpen(true);
              }}
            >
              Explore evidence
            </button>
            {provider !== "offline" && !isMatchState(story) && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  onExplore();
                  onReplay();
                  void investigate();
                }}
              >
                {busy
                  ? "Investigating recorded events…"
                  : `${provider === "foundry" ? "Review story" : "Investigate"} with ${providerLabel(provider)}`}
              </button>
            )}
          </div>
          <StoryEvidence
            story={story}
            match={match}
            events={events}
            answer={validAnswer}
            onEvent={onEvent}
            open={evidenceOpen}
            onToggle={setEvidenceOpen}
          />
          {more}
          <BroadcastPreview story={story} match={match} />
        </AnimatedDetails>
      </Reveal>
      <StorylineHistory match={match} time={time} storylines={storylines} />
    </>
  );
}

export function DirectorReplay({
  director,
  match,
  time,
  suspended,
}: {
  director: ReturnType<typeof useDirectorStory>;
  match: MatchData;
  time: number;
  suspended: boolean;
}) {
  const story = director.story;
  if (!story) return null;
  const events = match.events.filter(
    (e) => e.time <= time && story.highlightedEventIds.includes(e.id),
  );
  if (!events.length) return null;
  return (
    <EvidenceReplay
      key={`${story.storyId}:${story.cutoff}`}
      events={events}
      suspended={suspended}
      generated={false}
      identities={{
        teams: match.teams,
        player: (id) =>
          match.players.find((p) => p.id === id) ?? {
            name: "Unidentified player",
            number: null,
          },
      }}
      formatTime={(t) => matchClock(match, t)}
      formatEventTime={(e) => eventClock(match, e as NormalizedEvent)}
      describe={(e) =>
        `${match.players.find((p) => p.id === e.playerId)?.name ?? "Unidentified player"}: ${e.type}`
      }
    />
  );
}
