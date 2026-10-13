"use client";
import { eventLabel } from "@/lib/event-label";
import {
  type RefObject,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  actionPoint,
  pitchPoint,
  playbackTime,
  type PlaybackSample,
} from "@/lib/playback";
import { useReducedMotion } from "./motion";
import { revealSoon } from "./reveal";
import { pitchGroups } from "@/lib/sources/replay-view";
import { MatchEvent, player, clock, TEAMS } from "@/lib/match";
export function Pitch({
  events,
  selected,
  onSelect,
  compact = false,
  sequence = false,
  includeAllActions = false,
  playback,
  identities,
  formatTime = clock,
  aggregate,
}: {
  identities?: {
    teams: Record<"harbor" | "riverside", { short: string; color: string }>;
    player: (id: string) => { name: string; number: number | null };
  };
  formatTime?: (time: number) => string;
  aggregate?: boolean;
  events: MatchEvent[];
  selected?: string;
  onSelect?: (event: MatchEvent) => void;
  includeAllActions?: boolean;
  compact?: boolean;
  sequence?: boolean;
  playback?: {
    sample: RefObject<PlaybackSample>;
    end: number;
    nextTime: number;
    running: boolean;
  };
}) {
  const [openedGroup, setOpenedGroup] = useState<string | null>(null);
  const choices = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hitRadius, setHitRadius] = useState(30);
  useLayoutEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const resize = () => {
      const width = node.getBoundingClientRect().width;
      if (width) setHitRadius(Math.max(30, 22000 / width));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const teams = identities?.teams ?? TEAMS;
  const lookupPlayer = identities?.player ?? player;
  const id = useId().replace(/:/g, "");
  const point = pitchPoint;
  const activeEvent = events.find((event) => event.id === selected);
  const filtered = events.filter(
    (e) =>
      includeAllActions ||
      !["possession", "substitution", "foul", "goal"].includes(e.type),
  );
  const density = aggregate ?? (!playback && filtered.length > 24);
  const cellSize = hitRadius > 45 ? 25 : 10;
  const groups = pitchGroups(filtered, density, cellSize);
  const expanded = groups.find((g) => g.id === openedGroup);
  const goalTeam =
    activeEvent &&
    ((activeEvent as MatchEvent & { scoringTeam?: "harbor" | "riverside" })
      .scoringTeam ??
      (activeEvent.type === "goal" ? activeEvent.team : undefined));
  return (
    <>
      <svg
        ref={svgRef}
        viewBox="0 0 1000 640"
        className={`pitch ${compact ? "compact" : ""} ${playback || sequence ? "replay-pitch" : ""}`}
        data-event-cutoff={events.at(-1)?.time}
        role={onSelect ? "group" : "img"}
        aria-label={
          sequence
            ? "Recorded football sequence"
            : "Football pitch showing recorded event locations"
        }
      >
        <defs>
          <pattern
            id={`grass-${id}`}
            x="50"
            y="45"
            width="180"
            height="550"
            patternUnits="userSpaceOnUse"
          >
            <rect width="90" height="550" fill="#fff" fillOpacity=".055" />
          </pattern>
          <pattern
            id={`net-${id}`}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M5 0H0V5"
              fill="none"
              stroke="#fff"
              strokeOpacity=".35"
              strokeWidth=".6"
            />
          </pattern>
          <marker
            id={`arrow-${id}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        <rect
          x="12"
          y="12"
          width="976"
          height="616"
          rx="9"
          fill="var(--sl-pitch-surround)"
        />
        <g aria-hidden="true" pointerEvents="none">
          <rect x="50" y="45" width="900" height="550" fill="var(--sl-pitch)" />
          <rect
            x="50"
            y="45"
            width="900"
            height="550"
            fill={`url(#grass-${id})`}
          />
          {!compact && (
            <g fill={`url(#net-${id})`}>
              <rect x="35" y="285" width="15" height="70" />
              <rect x="950" y="285" width="15" height="70" />
            </g>
          )}
        </g>
        <g
          className="pitch-field"
          fill="none"
          stroke="var(--sl-pitch-line)"
          strokeOpacity="var(--sl-pitch-line-opacity)"
          strokeWidth="1"
        >
          <rect x="50" y="45" width="900" height="550" />
          <path d="M500 45V595" />
          <circle cx="500" cy="320" r="76" />
          <circle cx="500" cy="320" r="2" fill="var(--sl-pitch-line)" />
          <path d="M50 170H190V470H50M950 170H810V470H950M50 250H103V390H50M950 250H897V390H950M50 285H35V355H50M950 285H965V355H950" />
          <path d="M190 262a76 76 0 0 1 0 116M810 262a76 76 0 0 0 0 116M50 58a13 13 0 0 0 13-13M937 45a13 13 0 0 0 13 13M50 582a13 13 0 0 1 13 13M937 595a13 13 0 0 1 13-13" />
          <circle cx="145" cy="320" r="2" fill="var(--sl-pitch-line)" />
          <circle cx="855" cy="320" r="2" fill="var(--sl-pitch-line)" />
        </g>
        {sequence &&
          filtered
            .filter((e) => !density || e.id === selected)
            .map((e) => {
              const p = point(e),
                q = point(e, true);
              return (
                e.end && (
                  <path
                    key={`line-${e.id}`}
                    className={`event-path ${e.id === selected ? "active-path" : ""} ${e.type}`}
                    d={`M${p.x} ${p.y}L${q.x} ${q.y}`}
                    stroke={teams[e.team].color}
                    strokeWidth="3"
                    strokeDasharray={
                      e.type === "shot"
                        ? "6 5"
                        : e.type === "carry"
                          ? "2 7"
                          : e.type === "pass" && e.success === false
                            ? "8 6"
                            : undefined
                    }
                    opacity=".85"
                    markerEnd={`url(#arrow-${id})`}
                  />
                )
              );
            })}
        {groups.map((group) => {
          const e =
            group.events.find((e) => e.id === selected) ?? group.events[0];
          const index = filtered.findIndex((v) => v.id === e.id);
          const p = point(e),
            active = group.events.some((e) => e.id === selected);
          const label =
            group.events.length > 1
              ? `${group.events.length} actions ${density ? "in this area" : "at this location"}. Choose an action`
              : `${formatTime(e.time)} ${eventLabel(e.type)} by ${lookupPlayer(e.playerId).name}`;
          const choose = () => {
            if (group.events.length > 1) {
              const opening = openedGroup !== group.id;
              setOpenedGroup(opening ? group.id : null);
              // The list renders under the pitch, often below the fold.
              if (opening)
                revealSoon(() => choices.current, { align: "nearest" });
            } else onSelect?.(e);
          };
          if (density)
            return (
              <g
                key={group.id}
                role={onSelect ? "button" : "img"}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={label}
                aria-pressed={onSelect ? active : undefined}
                onClick={choose}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    choose();
                  }
                }}
              >
                <rect
                  x={50 + group.x * 9}
                  y={45 + group.y * 5.5}
                  width={cellSize * 9}
                  height={cellSize * 5.5}
                  fill={
                    group.events.every((e) => e.team === group.events[0].team)
                      ? teams[e.team].color
                      : "var(--sl-pitch-line)"
                  }
                  fillOpacity={Math.min(0.8, 0.22 + group.events.length * 0.04)}
                  stroke="var(--sl-pitch-line)"
                  strokeOpacity=".3"
                />
                <text
                  x={50 + (group.x + cellSize / 2) * 9}
                  y={45 + (group.y + cellSize / 2) * 5.5}
                  fontSize={cellSize === 25 ? 36 : 25}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#071320"
                  fontWeight="700"
                >
                  {group.events.length}
                </text>
              </g>
            );

          return (
            <g
              key={group.id}
              className={`event-point ${onSelect ? "event-marker" : ""} ${active ? "is-selected" : ""} event-${e.type}`}
              data-event-time={e.time}
              tabIndex={onSelect ? 0 : undefined}
              role={onSelect ? "button" : "img"}
              aria-label={label}
              aria-pressed={onSelect ? active : undefined}
              onClick={choose}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  choose();
                }
              }}
            >
              <circle
                className="marker-hit"
                cx={p.x}
                cy={p.y}
                r={hitRadius}
                fill="transparent"
              />
              {active && (
                <circle
                  className="selection-ring"
                  cx={p.x}
                  cy={p.y}
                  r="27"
                  fill="none"
                  stroke="var(--sl-pitch-line)"
                  strokeWidth="2"
                />
              )}
              {e.team === "harbor" ? (
                <circle
                  cx={p.x}
                  cy={p.y}
                  className="marker-dot"
                  r={compact ? 15 : 18}
                  fill={teams[e.team].color}
                  stroke="#071320"
                  strokeWidth="3"
                />
              ) : (
                <rect
                  x={p.x - (compact ? 15 : 18)}
                  y={p.y - (compact ? 15 : 18)}
                  width={compact ? 30 : 36}
                  height={compact ? 30 : 36}
                  rx="6"
                  className="marker-square"
                  fill={teams[e.team].color}
                  stroke="#071320"
                  strokeWidth="3"
                />
              )}
              {!compact && (
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  fill="#071320"
                  fontSize="16"
                  dominantBaseline="central"
                  fontWeight="650"
                >
                  {group.events.length > 1
                    ? `×${group.events.length}`
                    : index + 1}
                </text>
              )}
            </g>
          );
        })}
        {playback && activeEvent && (
          <RecordedBall
            key={activeEvent.id}
            event={activeEvent}
            playback={playback}
          />
        )}
        {goalTeam && (
          <g className="goal-moment" aria-hidden="true">
            <rect
              x="375"
              y="12"
              width="250"
              height="44"
              rx="8"
              fill="#071320"
              stroke={teams[goalTeam].color}
            />
            <text
              x="500"
              y="40"
              textAnchor="middle"
              fill="#f8fbff"
              fontSize="18"
              fontWeight="650"
            >
              GOAL FOR {teams[goalTeam].short.toUpperCase()}
            </text>
          </g>
        )}
        {!filtered.length && (
          <text
            x="500"
            y="325"
            fill="var(--sl-pitch-line)"
            textAnchor="middle"
            fontSize="18"
          >
            No events in this view
          </text>
        )}
      </svg>
      {density && filtered.length > 0 && !compact && (
        <p className="density-caption">
          Counts per pitch area · {filtered.length} actions. Select an area to
          inspect its records.
        </p>
      )}
      {expanded && onSelect && (
        <div
          ref={choices}
          className="pitch-event-choices"
          aria-label="Actions at selected location"
        >
          <div className="panel-header">
            <strong>
              {expanded.events.length} actions{" "}
              {density ? "in this area" : "at this location"}
            </strong>
            <button
              className="text-button"
              onClick={() => setOpenedGroup(null)}
            >
              Close actions
            </button>
          </div>
          {expanded.events.map((e) => (
            <button
              key={e.id}
              className="text-button"
              onClick={() => {
                setOpenedGroup(null);
                onSelect(e);
              }}
            >
              {formatTime(e.time)} · {lookupPlayer(e.playerId).name} ·{" "}
              {eventLabel(e.type)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function RecordedBall({
  event,
  playback,
}: {
  event: MatchEvent;
  playback: NonNullable<Parameters<typeof Pitch>[0]["playback"]>;
}) {
  const ref = useRef<SVGGElement>(null);
  const trace = useRef<SVGPathElement>(null);
  const reduced = useReducedMotion();
  const { sample, end, nextTime, running } = playback;
  useLayoutEffect(() => {
    let frame = 0;
    const draw = () => {
      const time = playbackTime(sample.current, performance.now(), end);
      const p = reduced
        ? pitchPoint(event, true)
        : actionPoint(event, time, nextTime);
      const progress =
        reduced || nextTime <= event.time
          ? 1
          : Math.max(
              0,
              Math.min(1, (time - event.time) / (nextTime - event.time)),
            );
      trace.current?.setAttribute("stroke-dashoffset", String(1 - progress));
      ref.current?.setAttribute("transform", `translate(${p.x} ${p.y})`);
      if (running && !reduced && time < nextTime)
        frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [event, sample, end, nextTime, running, reduced, sample.current.time]);
  const initial = pitchPoint(event, true);
  const start = pitchPoint(event);
  return (
    <>
      {event.end && (
        <path
          ref={trace}
          d={`M${start.x} ${start.y}L${initial.x} ${initial.y}`}
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset="1"
          stroke={TEAMS[event.team].color}
          strokeWidth="4"
          fill="none"
          pointerEvents="none"
          aria-hidden="true"
        />
      )}
      <g
        ref={ref}
        className="recorded-ball"
        transform={`translate(${initial.x} ${initial.y})`}
        pointerEvents="none"
        aria-hidden="true"
      >
        <circle r="12" fill="#071320" fillOpacity=".8" />
        <circle r="6" fill="#fff" stroke="#071320" strokeWidth="2" />
      </g>
    </>
  );
}
