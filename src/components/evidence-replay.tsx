"use client";
import { eventLabel } from "@/lib/event-label";
import { useLayoutEffect, useRef, useState, useId, useEffect } from "react";
import { clock, player, type MatchEvent } from "@/lib/match";
import { playbackTime, type PlaybackSample } from "@/lib/playback";
import { Pitch } from "./pitch";
import { Pause, Play, RotateCcw } from "./icons";
import { usePageVisibility } from "./motion";

/** How long a stepped replay holds each action at the default 8× speed. */
const STEP_MS = 1400;

type ReplayEvent = Omit<MatchEvent, "position"> & {
  position: MatchEvent["position"] | null;
};
export function EvidenceReplay({
  events,
  suspended,
  identities,
  formatTime = clock,
  describe,
  formatEventTime,
  generated = true,
  stepped = false,
  completeNote,
}: {
  events: ReplayEvent[];
  suspended: boolean;
  identities?: Parameters<typeof Pitch>[0]["identities"];
  formatTime?: (time: number) => string;
  formatEventTime?: (event: ReplayEvent) => string;
  describe?: (event: ReplayEvent) => string;
  generated?: boolean;
  /**
   * Step from one recorded action to the next instead of running the match
   * clock between them. Story evidence can be minutes apart; a clock-time
   * replay would sit on one action for most of a minute.
   */
  stepped?: boolean;
  /** Shown once the replay has reached its last action. */
  completeNote?: string;
}) {
  const timelineId = useId();
  const start = events[0].time,
    end = events.at(-1)!.time;
  const [time, setTime] = useState(start);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(8);
  const visiblePage = usePageVisibility();
  const sample = useRef<PlaybackSample>({
    time: start,
    sampledAt: 0,
    speed: 8,
    playing: false,
  });
  const running = playing && !suspended && visiblePage;
  useEffect(() => {
    if (suspended) setPlaying(false);
  }, [suspended]);
  // Stepped: hold each action for STEP_MS at 8×, then move to the next.
  // Times are read through a ref so a parent re-render doesn't restart the hold.
  const times = useRef(events.map((e) => e.time));
  times.current = events.map((e) => e.time);
  useEffect(() => {
    if (!stepped || !running) return;
    const next = times.current.find((t) => t > time);
    if (next === undefined) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => {
        setStepIndex(null);
        setTime(next);
      },
      // 1× would hold for 11 s; cap it so the slowest speed still moves.
      Math.min(3000, (STEP_MS * 8) / speed),
    );
    return () => clearTimeout(timer);
  }, [stepped, running, speed, time]);
  // Re-anchor before changing speed/pause so fractional progress is preserved.
  useLayoutEffect(() => {
    if (stepped) return;
    const previous = sample.current;
    const current = playbackTime(previous, performance.now(), end);
    sample.current = {
      time: current,
      sampledAt: performance.now(),
      speed,
      playing: running,
    };
    setTime(current);
    if (!running) return;
    const timer = window.setInterval(() => {
      const next = playbackTime(sample.current, performance.now(), end);
      setTime(next);
      if (next >= end) setPlaying(false);
    }, 100);
    return () => {
      clearInterval(timer);
      sample.current = {
        ...sample.current,
        time: playbackTime(sample.current, performance.now(), end),
        sampledAt: performance.now(),
        playing: false,
      };
    };
  }, [running, speed, end, stepped]);
  function seek(next: number, resume = false) {
    setStepIndex(null);
    const bounded = Math.max(start, Math.min(end, next));
    sample.current = {
      time: bounded,
      sampledAt: performance.now(),
      speed,
      playing: resume && !suspended && visiblePage,
    };
    setTime(bounded);
    setPlaying(resume);
  }
  function selectStep(index: number) {
    seek(events[index].time);
    setStepIndex(index);
  }
  const visible =
    stepIndex === null
      ? events.filter((e) => e.time <= time)
      : events.slice(0, stepIndex + 1);
  const frame = { visible, active: visible.at(-1), index: visible.length - 1 };
  const active = frame.active!;
  return (
    <>
      <Pitch
        events={frame.visible.filter(
          (e): e is MatchEvent => e.position !== null,
        )}
        identities={identities}
        formatTime={formatTime}
        includeAllActions
        aggregate={false}
        selected={active.id}
        sequence
        onSelect={(event) =>
          selectStep(events.findIndex((e) => e.id === event.id))
        }
        playback={
          generated
            ? {
                sample,
                end,
                nextTime: events[frame.index + 1]?.time ?? end,
                running,
              }
            : undefined
        }
      />
      <div className="event-inspector">
        <div>
          <span className="card-kicker">
            {time >= end
              ? "REPLAY COMPLETE"
              : running
                ? "REPLAYING ACTIONS"
                : "REPLAY PAUSED"}
          </span>
          <p>
            {formatEventTime?.(active) ?? formatTime(active.time)}{" "}
            {describe
              ? describe(active)
              : `${player(active.playerId).name}: ${eventLabel(active.type)}`}
            {active.outcome
              ? ` (${active.outcome})`
              : active.type === "pass"
                ? active.success === undefined
                  ? " (outcome unavailable)"
                  : active.success
                    ? " completed"
                    : " incomplete"
                : ""}
          </p>
          {"source" in active && (
            <small>
              Source ID:{" "}
              {
                (active as ReplayEvent & { source: { eventId: string } }).source
                  .eventId
              }
            </small>
          )}
        </div>
        <select
          aria-label="Recorded event"
          value={active.id}
          onChange={(e) =>
            selectStep(events.findIndex((event) => event.id === e.target.value))
          }
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {formatEventTime?.(event) ?? formatTime(event.time)}{" "}
              {eventLabel(event.type)} by{" "}
              {(identities?.player ?? player)(event.playerId).name}
            </option>
          ))}
        </select>
      </div>
      {completeNote && time >= end && (
        <p className="replay-note">{completeNote}</p>
      )}
      {!active.position && (
        <p className="limitations">
          This action has no recorded pitch location.
        </p>
      )}
      <div className="event-steps">
        <button
          className="text-button"
          disabled={frame.index <= 0}
          onClick={() => selectStep(frame.index - 1)}
        >
          Previous action
        </button>
        <button
          className="text-button"
          disabled={frame.index >= events.length - 1}
          onClick={() => selectStep(frame.index + 1)}
        >
          Next action
        </button>
      </div>
      <div className="replay-transport" aria-label="Sequence playback">
        <button
          className="play-button"
          aria-label={running ? "Pause replay" : "Play replay"}
          onClick={() =>
            time >= end
              ? seek(start, true)
              : seek(
                  stepped
                    ? time
                    : playbackTime(sample.current, performance.now(), end),
                  !playing,
                )
          }
        >
          {running ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          className="icon-button"
          aria-label="Restart replay"
          onClick={() => seek(start, true)}
        >
          <RotateCcw size={16} />
        </button>
        <div className="replay-progress">
          <label htmlFor={timelineId}>
            <span>
              REPLAY <time data-testid="replay-clock">{formatTime(time)}</time>
            </span>
            <span>{formatTime(end)}</span>
          </label>
          <input
            id={timelineId}
            aria-label="Replay timeline"
            aria-valuetext={formatTime(time)}
            type="range"
            min={start}
            max={end}
            step="0.1"
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
          />
        </div>
        <select
          className="speed-select"
          aria-label="Replay speed"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {[1, 4, 8, 16].map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
      </div>
      <div className="replay-caption">
        <span>
          Event {frame.index + 1} of {events.length}
        </span>
        <span>
          {generated
            ? "Schematic generated endpoints, without player tracking"
            : "Recorded passage · no possession or motion inferred"}
        </span>
      </div>
    </>
  );
}
