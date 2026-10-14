"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { presentStory } from "@/lib/explanation";
import type { Mode, StoryPreferences } from "@/lib/intelligence";
import {
  arrivedMoment,
  createMomentScanner,
  type MatchMoment,
} from "@/lib/moments";
import { matchClock, type MatchData } from "@/lib/sources/model";
import { useExplanationStyle } from "./explanation-preference";
import { ArrowRight, X } from "./icons";

/** How long an arriving card stays when nobody interacts with it. */
export const MOMENT_CARD_MS = 8000;

/** Small steps are scanned in render, so a playback tick finds its moment. */
const SYNC_SCAN_SECONDS = 60;
/** Longer catch-ups (page load, a seek forward) are scanned in slices. */
const SLICE_SECONDS = 600;

/** Moments at or before the viewer's position. Never anything later. */
export function useMatchMoments(
  match: MatchData,
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
) {
  const key = JSON.stringify(preferences);
  const scanner = useMemo(
    () => createMomentScanner(match, mode, JSON.parse(key)),
    [match, mode, key],
  );
  const [, setProgress] = useState(0);
  // Incremental and idempotent: positions already scanned are not revisited.
  if (time - scanner.scannedThrough() <= SYNC_SCAN_SECONDS)
    scanner.advance(time);
  useEffect(() => {
    if (!scanner.behind(time)) return;
    let timer: ReturnType<typeof setTimeout>;
    const slice = () => {
      scanner.advance(Math.min(time, scanner.scannedThrough() + SLICE_SECONDS));
      setProgress((p) => p + 1);
      if (scanner.behind(time)) timer = setTimeout(slice, 0);
    };
    timer = setTimeout(slice, 0);
    return () => clearTimeout(timer);
  }, [scanner, time]);
  return scanner.through(Math.min(time, scanner.scannedThrough()));
}

export function momentClock(match: MatchData, moment: MatchMoment) {
  return moment.kind === "full-time"
    ? "Full time"
    : matchClock(match, moment.time);
}

function useMomentWording(match: MatchData, moment: MatchMoment) {
  const style = useExplanationStyle();
  return presentStory(moment.story, match, style);
}

/** Slides in when playback reaches a moment; tap to replay it and ask. */
export function MomentCard({
  match,
  moments,
  time,
  playing,
  opened,
  onOpen,
}: {
  match: MatchData;
  moments: MatchMoment[];
  time: number;
  playing: boolean;
  /** Changes whenever a moment is opened from anywhere; the card steps aside. */
  opened?: string;
  onOpen: (moment: MatchMoment) => void;
}) {
  const [shown, setShown] = useState<MatchMoment | null>(null);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!opened) return;
    setShown(null);
    setHeld(false);
  }, [opened]);
  const previous = useRef(time);
  useEffect(() => {
    const from = previous.current;
    previous.current = time;
    if (playing && time > from) {
      const arrived = arrivedMoment(moments, from, time);
      if (arrived) setShown(arrived);
    }
  }, [time, playing, moments]);
  // A card never outlives a rewind past it, or a change of match.
  const visible =
    shown &&
    shown.matchId === match.id &&
    shown.time <= time &&
    moments.some((m) => m.id === shown.id)
      ? shown
      : null;
  useEffect(() => {
    if (shown && !visible) setShown(null);
  }, [shown, visible]);
  useEffect(() => {
    if (!visible || held) return;
    const timer = setTimeout(() => setShown(null), MOMENT_CARD_MS);
    return () => clearTimeout(timer);
  }, [visible, held]);
  return (
    <div className="moment-card-region" aria-live="polite">
      {visible && (
        <MomentCardBody
          key={visible.id}
          match={match}
          moment={visible}
          onHold={setHeld}
          onOpen={() => {
            setShown(null);
            setHeld(false);
            onOpen(visible);
          }}
          onDismiss={() => {
            setShown(null);
            setHeld(false);
          }}
        />
      )}
    </div>
  );
}

function MomentCardBody({
  match,
  moment,
  onOpen,
  onDismiss,
  onHold,
}: {
  match: MatchData;
  moment: MatchMoment;
  onOpen: () => void;
  onDismiss: () => void;
  onHold: (held: boolean) => void;
}) {
  const wording = useMomentWording(match, moment);
  return (
    <aside
      className={`moment-card moment-${moment.kind}`}
      aria-label="New moment"
      onPointerEnter={() => onHold(true)}
      onPointerLeave={() => onHold(false)}
      onFocus={() => onHold(true)}
      onBlur={() => onHold(false)}
    >
      <button className="moment-card-open" onClick={onOpen}>
        <span className="eyebrow">Moment · {momentClock(match, moment)}</span>
        <strong>{wording.headline}</strong>
        <span className="moment-card-line">{wording.explanation}</span>
        <span className="moment-card-action">
          Replay and ask the analyst <ArrowRight size={16} />
        </span>
      </button>
      <button
        className="icon-button"
        aria-label="Dismiss moment"
        onClick={onDismiss}
      >
        <X size={16} />
      </button>
    </aside>
  );
}

/** Every moment so far, newest first. Same behaviour as tapping a card. */
export function MomentTimeline({
  match,
  moments,
  time,
  onOpen,
}: {
  match: MatchData;
  moments: MatchMoment[];
  time: number;
  onOpen: (moment: MatchMoment) => void;
}) {
  return (
    <section className="moments-page panel" aria-label="Moments">
      <h2>Moments so far</h2>
      <p className="metric-note">
        When the match story started or changed, through{" "}
        {matchClock(match, time)}. Tap one to replay it and ask the analyst.
      </p>
      {moments.length ? (
        <ol className="moment-timeline">
          {moments
            .slice()
            .reverse()
            .map((moment) => (
              <MomentRow
                key={moment.id}
                match={match}
                moment={moment}
                onOpen={() => onOpen(moment)}
              />
            ))}
        </ol>
      ) : (
        <p className="moments-empty">
          No moments yet. They appear here as the match story starts or changes.
        </p>
      )}
    </section>
  );
}

function MomentRow({
  match,
  moment,
  onOpen,
}: {
  match: MatchData;
  moment: MatchMoment;
  onOpen: () => void;
}) {
  const wording = useMomentWording(match, moment);
  return (
    <li className={`moment-${moment.kind}`}>
      <button onClick={onOpen}>
        <time>{momentClock(match, moment)}</time>
        <span>
          <strong>{wording.headline}</strong>
          <span className="moment-card-line">{wording.explanation}</span>
        </span>
        <ArrowRight size={16} />
      </button>
    </li>
  );
}

/** The desktop frame's left panel: every moment so far, newest first. */
export function MomentRail({
  match,
  moments,
  onOpen,
}: {
  match: MatchData;
  moments: MatchMoment[];
  onOpen: (moment: MatchMoment) => void;
}) {
  return (
    <section className="moment-rail" aria-labelledby="moment-rail-title">
      <h2 id="moment-rail-title">
        Moments <span>{moments.length}</span>
      </h2>
      {moments.length ? (
        <ol>
          {moments
            .slice()
            .reverse()
            .map((moment, i) => (
              <MomentRailRow
                key={moment.id}
                match={match}
                moment={moment}
                latest={i === 0}
                onOpen={() => onOpen(moment)}
              />
            ))}
        </ol>
      ) : (
        <p>Moments appear here as the match story starts or changes.</p>
      )}
    </section>
  );
}

function MomentRailRow({
  match,
  moment,
  latest,
  onOpen,
}: {
  match: MatchData;
  moment: MatchMoment;
  latest: boolean;
  onOpen: () => void;
}) {
  const wording = useMomentWording(match, moment);
  return (
    <li className={`moment-${moment.kind}${latest ? " latest" : ""}`}>
      <button onClick={onOpen}>
        <time>{momentClock(match, moment)}</time>
        <span>{wording.headline}</span>
      </button>
    </li>
  );
}
