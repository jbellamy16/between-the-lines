import {
  matchClock,
  periodAt,
  type MatchData,
  type NormalizedEvent,
} from "../../sources/model";
import {
  EVIDENCE_LIMITS,
  observe,
  possessionBefore,
  visibleEvents,
  type Candidate,
} from "./observer";

export type VerificationStatus =
  | "confirmed-observation"
  | "supported-interpretation"
  | "unresolved"
  | "unsupported";
export type HypothesisEvidence = {
  code: string;
  description: string;
  eventIds: string[];
};
export type ObservationWindow = {
  id: string;
  start: number;
  end: number;
  period: NormalizedEvent["period"];
  boundary: "(start,end]" | "[start,end]";
};
export type HypothesisMeasurement = {
  key: string;
  label: string;
  value: number;
  unit: string;
  eventIds: string[];
  window?: string;
};
export type VerificationCheck = {
  code: string;
  passed: boolean;
  detail: string;
  eventIds: string[];
};
export type HypothesisAssessment = {
  hypothesis: { id: string; description: string };
  timestamp: number;
  verificationStatus: VerificationStatus;
  supportingEvidence: HypothesisEvidence[];
  limitingEvidence: HypothesisEvidence[];
  contradictoryEvidence: HypothesisEvidence[];
  measurements: HypothesisMeasurement[];
  windows: ObservationWindow[];
  sourceCapabilities: MatchData["capabilities"];
  missingInformation: string[];
  verificationChecks: VerificationCheck[];
  whyItMatters: string;
  watchNext: {
    description: string;
    metric: string;
    team: Candidate["team"];
    windowSeconds: number;
    startsAt: number;
    endsAt: number;
    period: NormalizedEvent["period"];
    baseline: number;
    target: number;
    direction: "at-least" | "more-than";
    eventTypes: NormalizedEvent["type"][];
    playerId?: string;
    recipientId?: string;
  } | null;
};
const ids = (events: NormalizedEvent[]) => events.map((event) => event.id);
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const round = (value: number) => Math.round(value * 1000) / 1000;
const durationLabel = (seconds: number) => {
  const minutes = Math.floor(seconds / 60),
    remainder = round(seconds % 60);
  return minutes
    ? `${minutes}m${remainder ? ` ${remainder}s` : ""}`
    : `${remainder}s`;
};
const involvementTypes = ["pass", "carry", "shot", "recovery", "interception"];

function sameClaim(a: Candidate, b: Candidate) {
  // Rank is an editorial preference, not an evidential quantity.
  return (
    [
      "id",
      "category",
      "team",
      "timestamp",
      "importance",
      "headline",
      "brief",
      "detail",
      "evidenceIds",
      "statistics",
      "limitations",
    ] as const
  ).every((key) => same(a[key], b[key]));
}
function validIdentity(match: MatchData, event: NormalizedEvent) {
  const period = match.periods.find((p) => p.id === event.period);
  return (
    event.matchId === match.id &&
    match.events[event.order]?.id === event.id &&
    !!event.source.eventId &&
    (event.source.playerId === "0"
      ? event.actorId === null
      : match.players.some(
          (player) =>
            player.sourceId === event.source.playerId &&
            player.team === event.team &&
            (player.id === event.actorId ||
              (event.type === "substitution" && player.id === event.playerId)),
        )) &&
    (!match.capabilities.xg ||
      event.xg === undefined ||
      (Number.isFinite(event.xg) && event.xg >= 0 && event.xg <= 1)) &&
    event.teamId === match.teams[event.team]?.id &&
    event.source.teamId === event.teamId &&
    event.source.provider === match.provenance.provider &&
    event.source.matchId === match.provenance.sourceMatchId &&
    event.actorId ===
      (event.type === "substitution" && event.outgoingId
        ? event.outgoingId
        : event.playerId === "0"
          ? null
          : event.playerId) &&
    [
      event.actorId,
      event.playerId === "0" ? null : event.playerId,
      event.recipientId,
      event.outgoingId,
    ].every(
      (id) =>
        !id || match.players.some((p) => p.id === id && p.team === event.team),
    ) &&
    !!period &&
    event.time >= period.start &&
    event.time <= period.end &&
    Math.abs(event.time - period.start - event.periodSeconds) < 1e-6
  );
}

/** Rebuild the two query-derived claim types from identities and finite window bounds. */
function reconstructDerived(
  match: MatchData,
  cutoff: number,
  candidate: Candidate,
  visible: NormalizedEvent[],
) {
  if (!["window-comparison", "player-involvement"].includes(candidate.category))
    return null;
  const prefix = `${match.id}:${candidate.category}:${candidate.team}:`;
  if (!candidate.id.startsWith(prefix)) return null;
  const suffix = candidate.id
    .slice(prefix.length)
    .match(/^(.*):([\d.]+):([\d.]+):(shot|pass|actions)$/);
  if (!suffix) return null;
  const [, actorId, rawStart, rawEnd, metric] = suffix;
  const start = Number(rawStart),
    end = Number(rawEnd),
    width = end - start;
  const player =
    actorId === "team"
      ? undefined
      : match.players.find(
          (p) => p.id === actorId && p.team === candidate.team,
        );
  if (
    (actorId !== "team" && !player) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    width <= 0 ||
    width > 1800 ||
    end > cutoff
  )
    return null;
  const filter = (event: NormalizedEvent) =>
    event.team === candidate.team && (!player || event.actorId === player.id);
  const current = visible.filter(
    (event) => filter(event) && event.time > start && event.time <= end,
  );
  const name = player?.name ?? match.teams[candidate.team].short;
  let support: NormalizedEvent[],
    headline: string,
    brief: string,
    detail: string,
    statistics: Candidate["statistics"];
  let windows: ObservationWindow[];
  if (candidate.category === "window-comparison") {
    if (metric !== "shot" && metric !== "pass") return null;
    const period = match.periods.find(
      (p) => start - width >= p.start && end <= p.end,
    );
    if (!period) return null;
    const previous = visible.filter(
      (event) =>
        filter(event) &&
        event.time > start - width &&
        event.time <= start &&
        event.type === metric,
    );
    const recent = current.filter((event) => event.type === metric);
    if (
      recent.length < (metric === "shot" ? 2 : 8) ||
      recent.length - previous.length < (metric === "shot" ? 2 : 5)
    )
      return null;
    support = [...previous, ...recent];
    const label = metric === "shot" ? "shots" : "pass attempts";
    headline = `${name}: ${label} in focus`;
    brief = `${name} recorded ${recent.length} ${label} from ${matchClock(match, start)} to ${matchClock(match, end)}, compared with ${previous.length} in the preceding equal window.`;
    detail = `${name}: ${recent.length} ${label} from ${matchClock(match, start)} to ${matchClock(match, end)}, versus ${previous.length} from ${matchClock(match, start - width)} to ${matchClock(match, start)}. Each window is ${width} seconds in ${period.id}. Selection is exploratory; this is not statistical significance or causation.`;
    statistics = [
      {
        label: `Current ${label}`,
        value: recent.length,
        unit: `events / ${width} seconds`,
      },
      {
        label: `Previous ${label}`,
        value: previous.length,
        unit: `events / ${width} seconds`,
      },
    ];
    windows = [
      {
        id: "previous",
        start: start - width,
        end: start,
        period: period.id,
        boundary: "(start,end]",
      },
      { id: "current", start, end, period: period.id, boundary: "(start,end]" },
    ];
  } else {
    if (metric !== "actions" || !player) return null;
    support = current.filter((event) => involvementTypes.includes(event.type));
    const shots = support.filter((event) => event.type === "shot").length,
      passes = support.filter((event) => event.type === "pass").length;
    if (support.length < 4 || (shots === 0 && passes < 5)) return null;
    headline = `${name}: recorded contributions`;
    brief = `${name} recorded ${passes} pass ${passes === 1 ? "attempt" : "attempts"} and ${shots} ${shots === 1 ? "shot" : "shots"} from ${matchClock(match, start)} to ${matchClock(match, end)}.`;
    detail = `${name} recorded ${support.length} passes, carries, shots, recoveries or interceptions from ${matchClock(match, start)} to ${matchClock(match, end)}, including ${passes} pass ${passes === 1 ? "attempt" : "attempts"} and ${shots} ${shots === 1 ? "shot" : "shots"}. This counts recorded actions, not touches, time in possession or off-ball influence.`;
    statistics = [
      { label: "Pass attempts", value: passes, unit: "events" },
      { label: "Shots", value: shots, unit: "events" },
    ];
    windows = match.periods
      .filter((p) => p.start < end && p.end > start)
      .map((p) => ({
        id: `sample-${p.id}`,
        start: Math.max(start, p.start),
        end: Math.min(end, p.end),
        period: p.id,
        boundary: "(start,end]" as const,
      }));
  }
  if (
    !support.length ||
    support.length > 120 ||
    support.at(-1)!.time < cutoff - 900
  )
    return null;
  const expected: Candidate = {
    id: `${match.id}:${candidate.category}:${candidate.team}:${actorId}:${start}:${end}:${metric}`,
    category: candidate.category,
    team: candidate.team,
    timestamp: support.at(-1)!.time,
    importance: "pattern",
    rank: 6,
    headline,
    brief,
    detail,
    statistics,
    evidenceIds: ids(support),
    limitations: [
      ...EVIDENCE_LIMITS,
      "Investigation-selected sample; descriptive evidence, not a statistical test.",
    ],
  };
  return { expected, windows, playerId: player?.id, metric };
}

/** Deterministic, cutoff-bound assessment. Candidate prose is never trusted as evidence. */
export function evaluateHypothesis(
  match: MatchData,
  cutoff: number,
  candidate: Candidate,
): HypothesisAssessment {
  const cutoffValid =
    Number.isFinite(cutoff) && cutoff >= 0 && cutoff <= match.duration;
  const visible = cutoffValid ? visibleEvents(match, cutoff) : [];
  const eventMap = new Map(visible.map((event) => [event.id, event]));
  const support = candidate.evidenceIds.flatMap((id) =>
    eventMap.get(id) ? [eventMap.get(id)!] : [],
  );
  const checks: VerificationCheck[] = [];
  const check = (
    code: string,
    passed: boolean,
    detail: string,
    events: NormalizedEvent[] = [],
  ) => checks.push({ code, passed, detail, eventIds: ids(events) });
  check(
    "cutoff-boundary",
    cutoffValid,
    "Cutoff is finite and inside the recorded match duration.",
  );
  check(
    "evidence-completeness",
    support.length > 0 &&
      support.length <= 120 &&
      support.length === candidate.evidenceIds.length &&
      new Set(candidate.evidenceIds).size === candidate.evidenceIds.length &&
      new Set(visible.map((event) => event.id)).size === visible.length,
    "Every cited event is unique, present in this match, and visible by the cutoff.",
    support,
  );
  check(
    "event-identities",
    support.every(
      (event) => validIdentity(match, event) && event.team === candidate.team,
    ),
    "Cited event, team, player, provider and period identities agree.",
    support,
  );
  check(
    "candidate-timestamp",
    !!support.length &&
      candidate.timestamp === support.at(-1)!.time &&
      candidate.timestamp <= cutoff,
    "The claim timestamp equals its latest recorded evidence.",
    support.slice(-1),
  );
  const derived = cutoffValid
    ? reconstructDerived(match, cutoff, candidate, visible)
    : null;
  const canonical =
    derived?.expected ??
    (cutoffValid
      ? observe(match, cutoff, "fan", {}, { unranked: true }).find(
          (item) => item.id === candidate.id,
        )
      : undefined);
  check(
    "canonical-claim",
    !!canonical && sameClaim(candidate, canonical),
    "Description, statistics, evidence, category and limitations match the deterministic claim reconstruction.",
    support,
  );
  const base: HypothesisAssessment = {
    hypothesis: {
      id: `${match.id}:hypothesis:${candidate.category}:${candidate.team}`,
      description:
        "The supplied claim cannot be established from the recorded evidence.",
    },
    timestamp: cutoffValid ? cutoff : 0,
    verificationStatus: "unsupported",
    supportingEvidence: [],
    limitingEvidence: [],
    contradictoryEvidence: [],
    measurements: [],
    windows: [],
    sourceCapabilities: { ...match.capabilities },
    missingInformation: [],
    verificationChecks: checks,
    whyItMatters:
      "This claim needs valid, reproducible recorded evidence before it can inform the match story.",
    watchNext: null,
  };
  if (checks.some((item) => !item.passed)) return base;
  base.hypothesis.id = `${candidate.id}:hypothesis`;
  base.timestamp = candidate.timestamp;
  base.verificationStatus = "confirmed-observation";
  base.supportingEvidence.push({
    code: "recorded-observation",
    description: canonical!.brief,
    eventIds: ids(support),
  });
  const addEvidence = (
    kind: "limitingEvidence" | "contradictoryEvidence",
    code: string,
    description: string,
    events: NormalizedEvent[] = [],
  ) => base[kind].push({ code, description, eventIds: ids(events) });
  const measure = (
    key: string,
    label: string,
    value: number,
    unit: string,
    events: NormalizedEvent[],
    window?: string,
  ) =>
    base.measurements.push({
      key,
      label,
      value: round(value),
      unit,
      eventIds: ids(events),
      ...(window ? { window } : {}),
    });
  const missing = (description: string) => {
    if (!base.missingInformation.includes(description))
      base.missingInformation.push(description);
  };
  const assessedPlayer = derived?.playerId
    ? match.players.find(
        (player) =>
          player.id === derived.playerId && player.team === candidate.team,
      )
    : undefined;
  const name = assessedPlayer?.name ?? match.teams[candidate.team].short;
  const period = periodAt(match, cutoff);
  const width = Math.min(900, Math.floor((cutoff - period.start) / 2));
  const comparison = [
    "activity-change",
    "shot-location",
    "window-comparison",
  ].includes(candidate.category);
  if (comparison)
    base.windows = derived?.windows ?? [
      {
        id: "previous",
        start: cutoff - 2 * width,
        end: cutoff - width,
        period: period.id,
        boundary: "(start,end]",
      },
      {
        id: "current",
        start: cutoff - width,
        end: cutoff,
        period: period.id,
        boundary: "(start,end]",
      },
    ];
  else if (derived) base.windows = derived.windows;
  else
    base.windows = [
      {
        id: "observation",
        start: Math.max(
          period.start,
          candidate.category === "passing-pair"
            ? cutoff - 900
            : support[0].time,
        ),
        end: cutoff,
        period: period.id,
        boundary: "[start,end]",
      },
    ];
  const currentWindow = base.windows.at(-1)!;
  const inWindow = (event: NormalizedEvent, window: ObservationWindow) =>
    (window.boundary === "[start,end]"
      ? event.time >= window.start
      : event.time > window.start) &&
    event.time <= window.end &&
    event.period === window.period;
  const ownCurrent = visible.filter(
    (event) =>
      event.team === candidate.team &&
      inWindow(event, currentWindow) &&
      (!derived?.playerId || event.actorId === derived.playerId),
  );
  const ownPrevious = comparison
    ? visible.filter(
        (event) =>
          event.team === candidate.team &&
          inWindow(event, base.windows[0]) &&
          (!derived?.playerId || event.actorId === derived.playerId),
      )
    : [];
  let watchMetric = "shots",
    baseline = 0,
    target = 1,
    eventTypes: NormalizedEvent["type"][] = ["shot"];
  let watchPlayerId = derived?.playerId,
    watchRecipientId: string | undefined;
  let watchDescription = `${name}: record at least one further shot in the next observation window.`;
  if (
    candidate.category === "activity-change" ||
    candidate.category === "window-comparison"
  ) {
    const label = candidate.statistics[0].label.replace(/^Current /, "");
    const predicates: Record<string, (event: NormalizedEvent) => boolean> = {
      shots: (event) => event.type === "shot",
      "pass attempts": (event) => event.type === "pass",
      "recoveries in the attacking third": (event) =>
        match.capabilities.ballRecoveries &&
        event.type === "recovery" &&
        event.success !== false &&
        (event.position?.x ?? -1) >= 66.7,
      "attacking-third actions": (event) =>
        ["pass", "carry", "shot"].includes(event.type) &&
        (event.position?.x ?? -1) >= 66.7,
      "forward passes": (event) =>
        event.type === "pass" &&
        !!event.position &&
        !!event.end &&
        event.end.x > event.position.x + 5,
    };
    const predicate = predicates[label];
    const current = ownCurrent.filter(predicate),
      previous = ownPrevious.filter(predicate);
    check(
      "recomputed-window-counts",
      !!predicate &&
        current.length === candidate.statistics[0].value &&
        previous.length === candidate.statistics[1]?.value &&
        same(ids([...previous, ...current]), candidate.evidenceIds),
      "Counts and all cited events were recomputed in complete equal windows inside one period.",
      [...previous, ...current],
    );
    measure(
      "current-count",
      label,
      current.length,
      "events",
      current,
      "current",
    );
    measure(
      "previous-count",
      `Previous ${label}`,
      previous.length,
      "events",
      previous,
      "previous",
    );
    measure(
      "count-change",
      `Change in ${label}`,
      current.length - previous.length,
      "events",
      [...previous, ...current],
    );
    base.hypothesis.description = `${name}'s recorded ${label} increased in the measured equal windows.`;
    base.whyItMatters =
      label === "shots"
        ? `${name}'s recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence.`
        : label === "recoveries in the attacking third"
          ? `${name}'s higher recovery count in the attacking third (${current.length} versus ${previous.length}) identifies advanced ball-winning starting points. Inspect subsequent same-possession shots to see whether those regains become attempts; counts alone do not establish pressing intensity.`
          : `${name} recorded ${current.length} ${label} against ${previous.length} in the preceding equal window, identifying a change in on-ball activity to follow.`;
    baseline = current.length;
    target = current.length;
    watchMetric = label;
    eventTypes =
      label === "shots"
        ? ["shot"]
        : label.includes("recoveries")
          ? ["recovery"]
          : label === "attacking-third actions"
            ? ["pass", "carry", "shot"]
            : ["pass"];
    watchDescription = `${name}: record at least ${target} ${label} in the next equal ${durationLabel(currentWindow.end - currentWindow.start)} window to sustain the measured count.`;
    const midpoint = (currentWindow.start + currentWindow.end) / 2;
    const early = current.filter((event) => event.time <= midpoint),
      late = current.filter((event) => event.time > midpoint);
    measure(
      "current-first-half-count",
      `First half of current window: ${label}`,
      early.length,
      "events",
      early,
      "current",
    );
    measure(
      "current-second-half-count",
      `Second half of current window: ${label}`,
      late.length,
      "events",
      late,
      "current",
    );
    if (late.length < early.length)
      addEvidence(
        "contradictoryEvidence",
        "latest-rate-not-sustained",
        `The current-window increase is not sustained at the same rate in its latest half: ${late.length} ${label}, after ${early.length} in the first half. This limits an inference that the increase is continuing.`,
        current,
      );
  } else if (
    candidate.category === "recovery-shot" ||
    candidate.category === "shot-sequence"
  ) {
    const shot = support.at(-1)!;
    const sequence = possessionBefore(match, visible, shot);
    const first = support[0];
    check(
      "same-possession-sequence",
      match.capabilities.possession !== "unavailable" &&
        shot.type === "shot" &&
        shot.possessionId !== null &&
        support.every(
          (event) =>
            event.team === shot.team &&
            event.period === shot.period &&
            event.possessionId === shot.possessionId &&
            event.order <= shot.order,
        ),
      "Sequence events share team, period and possession and end at the recorded shot.",
      support,
    );
    if (candidate.category === "recovery-shot") {
      const win =
        (first.type === "recovery" && first.success !== false) ||
        (["interception", "tackle"].includes(first.type) &&
          first.success === true);
      const seconds = shot.time - first.time;
      check(
        "recovery-shot-link",
        match.capabilities.ballRecoveries &&
          win &&
          first.order < shot.order &&
          seconds >= 0 &&
          seconds <= 30 &&
          same(
            ids(sequence.filter((event) => event.order >= first.order)),
            candidate.evidenceIds,
          ),
        "A successful recorded ball win precedes the shot in the same bounded possession.",
        support,
      );
      base.hypothesis.description = `${name} has a recorded route from a ball win to a shot within the same possession.`;
      base.whyItMatters = `This possession shows ${name} turning a recorded ${first.type} into a shot. It identifies an attacking route to track; it does not establish that the ball win caused the chance or that pressing improved.`;
      measure("linked-shots", "Shots following this ball win", 1, "events", [
        shot,
      ]);
      if (
        first.source.precision !== "minute" &&
        shot.source.precision !== "minute"
      )
        measure(
          "recovery-shot-seconds",
          "Recorded recovery to shot interval",
          Math.round(seconds * 10) / 10,
          "recorded seconds",
          [first, shot],
        );
      else {
        missing("Second-level timestamps for the recovery-to-shot interval.");
        addEvidence(
          "limitingEvidence",
          "minute-precision",
          "At least one sequence endpoint has minute precision; elapsed seconds cannot be established.",
          [first, shot],
        );
      }
      base.verificationStatus = "supported-interpretation";
      watchMetric = "recovery-shot-links";
      baseline = 1;
      target = 1;
      eventTypes = ["recovery", "interception", "tackle", "shot"];
      watchDescription = `${name}: observe one further shot in the same possession as a preceding successful recorded ball win, with no more than 30 recorded seconds between them; minute-precision feeds require a sequence-only check.`;
    } else {
      const passes = sequence.filter(
        (event) => event.type === "pass" && event.success === true,
      );
      check(
        "recomputed-sequence-passes",
        passes.length >= 4 &&
          passes.length === candidate.statistics[0].value &&
          same(ids(sequence), candidate.evidenceIds),
        "Completed pass count is reproduced across the complete recorded possession.",
        passes,
      );
      measure(
        "completed-passes",
        "Completed passes before the shot",
        passes.length,
        "events",
        passes,
      );
      base.hypothesis.description = `${name} completed a recorded passing passage before the shot.`;
      base.whyItMatters = `${passes.length} completed passes connect this recorded possession to a shot, showing the on-ball route to that attempt without establishing off-ball movement or chance quality.`;
      watchMetric = "passing-shot-sequences";
      baseline = 1;
      target = 1;
      eventTypes = ["pass", "shot"];
      watchDescription = `${name}: record another possession with at least four completed passes before a shot.`;
    }
    if (match.capabilities.possession === "generated")
      addEvidence(
        "limitingEvidence",
        "generated-possession",
        "The source generates possession groups for a synthetic match; this is not an observed real-match possession.",
        support,
      );
  } else if (candidate.category === "shot-location") {
    const current = ownCurrent.filter(
        (event) => event.type === "shot" && event.position,
      ),
      previous = ownPrevious.filter(
        (event) => event.type === "shot" && event.position,
      );
    const mean = (events: NormalizedEvent[]) =>
      Math.round(
        events.reduce((sum, event) => sum + event.position!.x, 0) /
          events.length,
      );
    check(
      "recomputed-shot-origins",
      current.length >= 3 &&
        previous.length >= 3 &&
        mean(current) === candidate.statistics[0].value &&
        mean(previous) === candidate.statistics[1].value &&
        same(ids([...previous, ...current]), candidate.evidenceIds),
      "Shot-origin means and complete located-shot samples are reproduced in equal windows.",
      [...previous, ...current],
    );
    measure(
      "current-mean-x",
      "Current mean shot-origin x",
      mean(current),
      "normalized percent",
      current,
      "current",
    );
    measure(
      "previous-mean-x",
      "Previous mean shot-origin x",
      mean(previous),
      "normalized percent",
      previous,
      "previous",
    );
    base.hypothesis.description = `${name}'s recorded shot origins shifted along the normalized pitch.`;
    base.whyItMatters = `The shot-origin sample moved from mean x ${mean(previous)} to ${mean(current)}. This changes where recorded attempts start, while angle, pressure and chance quality need separate evidence.`;
    baseline = current.length;
    target = 3;
    watchMetric = "located-shots";
    watchDescription = `${name}: collect at least three further located shots in the next equal window and compare their mean origin with x ${mean(current)}.`;
  } else if (candidate.category === "passing-pair") {
    const first = support[0];
    check(
      "passing-pair-identities",
      match.capabilities.passRecipients &&
        !!first.actorId &&
        !!first.recipientId &&
        support.length >= 3 &&
        support.every(
          (event) =>
            event.type === "pass" &&
            event.success === true &&
            event.actorId === first.actorId &&
            event.recipientId === first.recipientId,
        ) &&
        candidate.statistics[0].value === support.length,
      "Every completed pass joins the same known passer and recipient.",
      support,
    );
    const from = match.players.find(
        (player) => player.id === first.actorId,
      )!.name,
      to = match.players.find(
        (player) => player.id === first.recipientId,
      )!.name;
    measure(
      "pair-completions",
      "Completed passes in directional pair",
      support.length,
      "events",
      support,
    );
    base.hypothesis.description = `${from} repeatedly found ${to} with recorded completed passes.`;
    base.whyItMatters = `The ${support.length} completed passes identify a repeated on-ball connection. Receiving space, movement and whether the pair bypassed opponents remain unknown.`;
    watchPlayerId = first.actorId!;
    watchRecipientId = first.recipientId!;
    watchMetric = "pair-completions";
    baseline = support.length;
    target = 1;
    eventTypes = ["pass"];
    watchDescription = `Record at least one further completed pass from ${from} to ${to} in the next observation window.`;
  } else {
    const sub =
      candidate.category === "substitute-involvement" ? support[0] : undefined;
    const involvement = sub ? support.slice(1) : support;
    const playerId = sub?.playerId ?? derived?.playerId;
    const actor = match.players.find(
      (player) => player.id === playerId && player.team === candidate.team,
    );
    check(
      "player-involvement-identities",
      !!actor &&
        involvement.every(
          (event) =>
            event.actorId === playerId && involvementTypes.includes(event.type),
        ) &&
        (!sub ||
          (match.capabilities.substitutions &&
            sub.type === "substitution" &&
            involvement.every((event) => event.order > sub.order))),
      "Contributions belong to the named player and, when relevant, follow their recorded substitution.",
      support,
    );
    measure(
      "involvements",
      "Recorded on-ball actions",
      involvement.length,
      "events",
      involvement,
    );
    const shots = involvement.filter((event) => event.type === "shot");
    measure("player-shots", "Player shots", shots.length, "events", shots);
    base.hypothesis.description = `${actor?.name ?? name} has recorded on-ball contributions${sub ? " after coming on" : " in the selected window"}.`;
    base.whyItMatters = `${involvement.length} recorded actions, including ${shots.length} shots, describe this player's observed involvement${sub ? " since the substitution" : " in this sample"}. The sample does not establish a change in team performance or off-ball influence.`;
    watchPlayerId = playerId;
    watchMetric = "player-involvements";
    baseline = involvement.length;
    target = 1;
    eventTypes = ["pass", "carry", "shot", "recovery", "interception"];
    watchDescription = `Record at least one further pass, carry, shot, recovery or interception by ${actor?.name ?? "the same player"} in the next observation window.`;
    if (sub)
      addEvidence(
        "limitingEvidence",
        "substitution-causation-unavailable",
        "Recorded post-substitution contributions alone do not isolate the effect of a substitution.",
        support,
      );
  }
  const currentShots = comparison
    ? ownCurrent.filter((event) => event.type === "shot")
    : support.filter((event) => event.type === "shot");
  const previousShots = ownPrevious.filter((event) => event.type === "shot");
  if (currentShots.length) {
    const shotActivity =
      (candidate.category === "activity-change" &&
        candidate.statistics[0].label === "shots") ||
      (candidate.category === "window-comparison" &&
        candidate.statistics[0].label === "Current shots");
    if (
      shotActivity &&
      match.capabilities.shotOutcomes &&
      currentShots.every((event) => event.outcome !== undefined)
    ) {
      const goals = currentShots.filter(
        (event) => event.outcome === "goal",
      ).length;
      measure(
        "current-shot-goal-outcomes",
        "Goal outcomes among current shots",
        goals,
        "shot events",
        currentShots,
        "current",
      );
      const detail =
        goals === 0
          ? "The extra attempts have not produced a recorded goal in this window."
          : `The extra attempts have included ${goals} recorded goal ${goals === 1 ? "outcome" : "outcomes"} in this window.`;
      base.supportingEvidence.push({
        code: "current-shot-outcomes",
        description: detail,
        eventIds: ids(currentShots),
      });
      base.whyItMatters += ` ${detail}`;
    }
    if (
      comparison &&
      match.capabilities.ballRecoveries &&
      match.capabilities.possession !== "unavailable"
    ) {
      const linked = currentShots.flatMap((shot) => {
        const recovery = possessionBefore(match, visible, shot).findLast(
          (event) =>
            event.type === "recovery" &&
            event.success !== false &&
            (event.position?.x ?? -1) >= 66.7 &&
            event.order < shot.order &&
            shot.time >= event.time &&
            shot.time - event.time <= 30 &&
            event.source.precision !== "minute" &&
            shot.source.precision !== "minute",
        );
        return recovery ? [{ recovery, shot }] : [];
      });
      const linkedEvents = [
        ...new Map(
          linked.flatMap(
            ({ recovery, shot }) =>
              [
                [recovery.id, recovery],
                [shot.id, shot],
              ] as const,
          ),
        ).values(),
      ];
      measure(
        "high-recovery-linked-shots",
        "Shots after recorded attacking-third recoveries",
        linked.length,
        "shot events",
        linkedEvents,
        "current",
      );
      if (linked.length) {
        const detail = `${linked.length} of the ${currentShots.length} recent shots followed recorded attacking-third recoveries in the same possession within 30 recorded seconds. This identifies a recorded attacking route, without proving pressing or causation.`;
        base.supportingEvidence.push({
          code: "attacking-third-recovery-shot-links",
          description: detail,
          eventIds: ids(linkedEvents),
        });
        base.whyItMatters += ` ${linked.length} recent shots followed attacking-third recoveries in the same possession within 30 recorded seconds: a route to watch, without establishing pressing or causation.`;
      }
    }
    if (!match.capabilities.xg) {
      missing("Source-supplied expected goals (xG) for chance quality.");
      addEvidence(
        "limitingEvidence",
        "chance-quality-unavailable",
        "Shot count and normalized shot origins cannot establish chance quality; this source does not supply xG.",
        currentShots,
      );
    } else if (
      [...currentShots, ...previousShots].some(
        (event) => event.xg === undefined,
      )
    ) {
      missing(
        "Complete source-supplied xG for every shot in the assessed sample.",
      );
      addEvidence(
        "limitingEvidence",
        "chance-quality-incomplete",
        "The source supports xG but some assessed shots have no value; no complete chance-quality comparison is available.",
        [...currentShots, ...previousShots].filter(
          (event) => event.xg === undefined,
        ),
      );
    } else {
      const sum = (events: NormalizedEvent[]) =>
        events.reduce((total, event) => total + event.xg!, 0);
      measure(
        "current-xg",
        "Source-supplied xG total",
        sum(currentShots),
        "source xG",
        currentShots,
        comparison ? "current" : undefined,
      );
      if (comparison && previousShots.length) {
        measure(
          "previous-xg",
          "Previous source-supplied xG total",
          sum(previousShots),
          "source xG",
          previousShots,
          "previous",
        );
        if (
          currentShots.length > previousShots.length &&
          sum(currentShots) <= sum(previousShots)
        )
          addEvidence(
            "contradictoryEvidence",
            "shot-volume-without-xg-increase",
            "Shot volume rose but the source-supplied xG total did not. The larger shot count does not support an increase in aggregate chance quality.",
            [...previousShots, ...currentShots],
          );
      }
    }
    // A team's shot total is not a like-for-like counter to one player's sample.
    if (comparison && !assessedPlayer) {
      const opponent = visible.filter(
        (event) =>
          event.team !== candidate.team &&
          event.type === "shot" &&
          inWindow(event, currentWindow),
      );
      measure(
        "opponent-current-shots",
        "Opponent shots in the current window",
        opponent.length,
        "events",
        opponent,
        "current",
      );
      if (opponent.length >= currentShots.length)
        addEvidence(
          "contradictoryEvidence",
          "opponent-shot-response",
          `The opponent also recorded ${opponent.length} shots in the current window, against ${currentShots.length} for ${name}; one-sided control is not established by this sample.`,
          opponent,
        );
    }
  }
  const caveat =
    base.contradictoryEvidence.find(
      (item) => item.code === "shot-volume-without-xg-increase",
    ) ??
    base.contradictoryEvidence.find(
      (item) => item.code === "latest-rate-not-sustained",
    ) ??
    base.contradictoryEvidence.find(
      (item) => item.code === "opponent-shot-response",
    );
  if (caveat?.code === "shot-volume-without-xg-increase")
    base.whyItMatters +=
      " The source-supplied xG total did not rise, limiting a stronger chance-quality interpretation.";
  else if (caveat?.code === "latest-rate-not-sustained")
    base.whyItMatters +=
      " Activity slowed in the latest half of the current window, so the increase may be fading.";
  else if (caveat?.code === "opponent-shot-response")
    base.whyItMatters +=
      " The opponent matched or exceeded this shot count, so one-sided control is not established.";
  missing("Off-ball tracking, defensive pressure and player intentions.");
  addEvidence(
    "limitingEvidence",
    "tracking-unavailable",
    "Recorded events do not establish off-ball positioning, pressing intensity, intent or physical attacking direction.",
  );
  const referenced = new Set(
    [
      ...base.supportingEvidence,
      ...base.limitingEvidence,
      ...base.contradictoryEvidence,
      ...base.measurements,
    ].flatMap((item) => item.eventIds),
  );
  check(
    "assessment-event-identities",
    [...referenced].every(
      (id) => eventMap.has(id) && validIdentity(match, eventMap.get(id)!),
    ),
    "Every assessment measurement and counter-evidence reference is a visible event with valid identities.",
  );
  if (checks.some((item) => !item.passed)) {
    base.verificationStatus = "unsupported";
    base.whyItMatters =
      "Independent evidence checks failed; this claim is not fit for publication.";
    return base;
  }
  // A finished historical match is still replayed at intermediate cutoffs; only the cutoff ends monitoring.
  const remaining = match.duration - cutoff;
  const desiredWindow = comparison
    ? currentWindow.end - currentWindow.start
    : 300;
  const nextPeriod =
    period.end > cutoff
      ? period
      : match.periods.find((item) => item.start > cutoff);
  if (remaining > 0 && nextPeriod) {
    const startsAt = Math.max(cutoff, nextPeriod.start);
    const windowSeconds = Math.min(desiredWindow, nextPeriod.end - startsAt);
    if (nextPeriod.id !== period.id) {
      baseline = 0;
      target = 1;
      watchMetric = "new-period-recorded-activity";
      watchDescription = `${name}: begin a fresh sample in ${nextPeriod.id} and record at least one ${eventTypes.join(" or ")} event. Counts from the previous period are not a baseline for this new period.`;
    } else if (windowSeconds < desiredWindow) {
      watchDescription = `${watchDescription} Only ${durationLabel(windowSeconds)} remain in this period; a complete equal-window comparison will be unavailable.`;
      if (comparison) {
        target = 1;
        watchMetric = "additional-recorded-activity";
        watchDescription = `${name}: record at least one additional ${eventTypes.join(" or ")} event over the remaining ${durationLabel(windowSeconds)} in ${nextPeriod.id}. A complete equal-window comparison will be unavailable.`;
      }
    }
    base.watchNext = {
      description: watchDescription,
      metric: watchMetric,
      team: candidate.team,
      windowSeconds,
      startsAt,
      endsAt: startsAt + windowSeconds,
      period: nextPeriod.id,
      baseline,
      target,
      direction: "at-least",
      eventTypes,
      ...(watchPlayerId ? { playerId: watchPlayerId } : {}),
      ...(watchRecipientId ? { recipientId: watchRecipientId } : {}),
    };
  }
  return base;
}
