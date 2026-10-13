"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  eventClock,
  type MatchData,
  type NormalizedEvent,
} from "@/lib/sources/model";
import { eventDescription } from "@/lib/sources/intelligence";
import { Goal, Substitution } from "./icons";

export function TimelineEvent({
  match,
  event,
  onSeek,
  onGoal,
  left,
}: {
  match: MatchData;
  event: NormalizedEvent;
  onSeek: (time: number) => void;
  /** Position on the lane; defaults to the event's share of the match. */
  left?: string;
  /** When set, a goal replays its build-up instead of only seeking. */
  onGoal?: (event: NormalizedEvent) => void;
}) {
  const replaysGoal = !!(onGoal && event.scoringTeam);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    above: boolean;
  } | null>(null);
  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const close = () => {
    cancelClose();
    setPosition(null);
  };
  const show = () => {
    cancelClose();
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 24);
    const above = rect.top >= 160;
    setPosition({
      width,
      above,
      left: Math.max(
        12,
        Math.min(
          window.innerWidth - width - 12,
          rect.left + rect.width / 2 - width / 2,
        ),
      ),
      top: above ? rect.top - 10 : rect.bottom + 10,
    });
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => setPosition(null), 150);
  };
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [position]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const assister = event.assistPlayerId
    ? match.players.find((player) => player.id === event.assistPlayerId)?.name
    : null;
  return (
    <>
      <button
        ref={button}
        className={event.scoringTeam ? "goal-tick" : "sub-tick"}
        style={{ left: left ?? `${(event.time / match.duration) * 100}%` }}
        aria-label={
          replaysGoal
            ? `Replay the ${eventClock(match, event)} goal`
            : `Seek to ${eventClock(match, event)} ${event.scoringTeam ? "goal" : "substitution"}`
        }
        aria-describedby={position ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={close}
        onClick={() => {
          close();
          if (replaysGoal) onGoal!(event);
          else onSeek(event.time);
        }}
      >
        {event.scoringTeam ? <Goal size={16} /> : <Substitution size={16} />}
      </button>
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="timeline-event-tooltip"
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              transform: position.above ? "translateY(-100%)" : undefined,
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <strong>
              {eventClock(match, event)} ·{" "}
              {event.scoringTeam
                ? event.ownGoal
                  ? "Own goal"
                  : "Goal"
                : "Substitution"}
            </strong>
            <span>{eventDescription(match, event)}</span>
            {assister && <span>Assist: {assister}</span>}
            <small>
              {replaysGoal
                ? "Select to replay the build-up"
                : "Select to jump to this moment"}
            </small>
          </div>,
          document.body,
        )}
    </>
  );
}
