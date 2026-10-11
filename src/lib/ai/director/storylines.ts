import {
  matchClock,
  type MatchData,
  type NormalizedEvent,
} from "../../sources/model";

export const STORYLINE_WINDOW_SECONDS = 300;
export const STORYLINE_HISTORY_LIMIT = 8;
export const STORYLINE_WINDOW_EVIDENCE_LIMIT = 120;

export type StorylineMetric = "shots" | "attacking-third-recoveries";
export type StorylineState =
  "emerging" | "developing" | "sustained" | "weakening" | "resolved";
export type StorylineWindow = {
  start: number;
  end: number;
  /** The opening window includes period start; later windows are (start, end]. */
  startInclusive: boolean;
  count: number;
  evidenceIds: string[];
  /** Counts always include every event; extremely dense windows retain a sample. */
  evidenceTruncated: boolean;
};
export type StorylineObservation = {
  id: string;
  storylineId: string;
  timestamp: number;
  state: StorylineState;
  baseline: StorylineWindow;
  previous: StorylineWindow;
  current: StorylineWindow;
  confirmsBaseline: boolean;
  qualifyingWindowStreak: number;
  nonQualifyingWindowStreak: number;
  evidenceIds: string[];
  reason: string;
};
export type StorylineRelationship = {
  from: string;
  to: string;
  kind: "measured-by" | "supported-by" | "follows-observation";
};
export type TemporalStoryline = {
  id: string;
  matchId: string;
  cutoff: number;
  team: NormalizedEvent["team"];
  teamId: string;
  period: NormalizedEvent["period"];
  metric: StorylineMetric;
  label: string;
  state: StorylineState;
  firstObservedAt: number;
  episodeStartedAt: number;
  episode: number;
  updatedAt: number;
  /** Monotonic assessment count for this storyline, independent of seeking. */
  revision: number;
  baseline: StorylineWindow;
  previous: StorylineWindow;
  current: StorylineWindow;
  evidenceIds: string[];
  observations: StorylineObservation[];
  historyTruncated: boolean;
  relationships: StorylineRelationship[];
  criterion: string;
  summary: string;
  watchNext: string;
  limitations: string[];
};

const METRICS: Record<StorylineMetric, { label: string; minimum: number }> = {
  shots: { label: "shots", minimum: 3 },
  "attacking-third-recoveries": {
    label: "recoveries in the attacking third",
    minimum: 2,
  },
};

type Bucket = { count: number; evidenceIds: string[] };
type Series = {
  team: NormalizedEvent["team"];
  metric: StorylineMetric;
  buckets: Map<number, Bucket>;
};

function qualifies(current: number, baseline: number, minimum: number) {
  return (
    current >= minimum && current - baseline >= 2 && current >= baseline * 1.5
  );
}

function windowAt(
  series: Series,
  index: number,
  start: number,
): StorylineWindow {
  const bucket = series.buckets.get(index);
  return {
    start: start + index * STORYLINE_WINDOW_SECONDS,
    end: start + (index + 1) * STORYLINE_WINDOW_SECONDS,
    startInclusive: index === 0,
    count: bucket?.count ?? 0,
    evidenceIds: bucket?.evidenceIds ?? [],
    evidenceTruncated: (bucket?.count ?? 0) > STORYLINE_WINDOW_EVIDENCE_LIMIT,
  };
}

/**
 * Reconstruct measured story state from the visible event prefix. Events are
 * canonical (validated, ordered) MatchData; no cached state or final score is read.
 *
 * The cadence is anchored to period start, never to the caller's seek position.
 * First onset requires an increase between adjacent complete five-minute windows.
 * The onset's prior window then stays the baseline for that episode: continuing
 * at an elevated count can sustain a story without requiring exponential growth.
 * One/two/three consecutive qualifying windows mean emerging/developing/sustained.
 * One/two subsequent below-threshold windows mean weakening/resolved. Resolved
 * stories reopen only after a fresh adjacent-window increase, with a new baseline.
 * These editorial thresholds are descriptive, not statistical significance.
 *
 * O(events + completed five-minute windows), with a single event pass. Each
 * series stores bounded evidence per window and the last eight observations.
 */
export function reconstructStorylines(
  match: MatchData,
  cutoff: number,
): TemporalStoryline[] {
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > match.duration)
    throw new Error("Invalid storyline cutoff");
  const periods = new Map(
    match.periods
      .filter((p) => p.start <= cutoff && p.id !== "PS")
      .map((period) => {
        const series: Series[] = [];
        for (const team of ["harbor", "riverside"] as const) {
          series.push({ team, metric: "shots", buckets: new Map() });
          if (match.capabilities.ballRecoveries)
            series.push({
              team,
              metric: "attacking-third-recoveries",
              buckets: new Map(),
            });
        }
        return [period.id, { period, series }] as const;
      }),
  );
  for (const event of match.events) {
    if (event.time > cutoff) break;
    const group = periods.get(event.period);
    if (!group) continue;
    const metric: StorylineMetric | undefined =
      event.type === "shot"
        ? "shots"
        : event.type === "recovery" &&
            event.success !== false &&
            (event.position?.x ?? -1) >= 66.7
          ? "attacking-third-recoveries"
          : undefined;
    if (!metric) continue;
    const series = group.series.find(
      (s) => s.team === event.team && s.metric === metric,
    );
    if (!series) continue;
    const index = Math.max(
      0,
      Math.ceil((event.time - group.period.start) / STORYLINE_WINDOW_SECONDS) -
        1,
    );
    const bucket = series.buckets.get(index) ?? { count: 0, evidenceIds: [] };
    bucket.count++;
    if (bucket.evidenceIds.length < STORYLINE_WINDOW_EVIDENCE_LIMIT)
      bucket.evidenceIds.push(event.id);
    series.buckets.set(index, bucket);
  }

  const result: TemporalStoryline[] = [];
  for (const { period, series } of periods.values()) {
    const windows = Math.floor(
      (Math.min(cutoff, period.end) - period.start) / STORYLINE_WINDOW_SECONDS,
    );
    for (const item of series) {
      const config = METRICS[item.metric];
      const id = `${match.id}:storyline:${period.id}:${item.team}:${item.metric}`;
      let baseline: StorylineWindow | undefined;
      let state: StorylineState | undefined;
      let streak = 0,
        below = 0,
        revision = 0,
        firstObservedAt = 0,
        episodeStartedAt = 0,
        episode = 0;
      const observations: StorylineObservation[] = [];
      for (let index = 1; index < windows; index++) {
        const previous = windowAt(item, index - 1, period.start);
        const current = windowAt(item, index, period.start);
        if (!state || state === "resolved") {
          if (!qualifies(current.count, previous.count, config.minimum))
            continue;
          baseline = previous;
          episodeStartedAt = current.end;
          episode++;
          if (!state) firstObservedAt = current.end;
          streak = 0;
          below = 0;
        }
        const confirmsBaseline = qualifies(
          current.count,
          baseline!.count,
          config.minimum,
        );
        if (confirmsBaseline) {
          streak++;
          below = 0;
          state =
            streak >= 3
              ? "sustained"
              : streak === 2
                ? "developing"
                : "emerging";
        } else {
          streak = 0;
          below++;
          state = below >= 2 ? "resolved" : "weakening";
        }
        const evidenceIds = [
          ...new Set([
            ...baseline!.evidenceIds,
            ...previous.evidenceIds,
            ...current.evidenceIds,
          ]),
        ];
        const reason = confirmsBaseline
          ? `${streak} consecutive complete five-minute ${streak === 1 ? "window meets" : "windows meet"} the increase threshold against the episode baseline of ${baseline!.count}.`
          : `${below} consecutive complete five-minute ${below === 1 ? "window is" : "windows are"} below the increase threshold against the episode baseline of ${baseline!.count}.`;
        observations.push({
          id: `${id}:observation:${current.end}`,
          storylineId: id,
          timestamp: current.end,
          state,
          baseline: baseline!,
          previous,
          current,
          confirmsBaseline,
          qualifyingWindowStreak: streak,
          nonQualifyingWindowStreak: below,
          evidenceIds,
          reason,
        });
        revision++;
        if (observations.length > STORYLINE_HISTORY_LIMIT) observations.shift();
      }
      const latest = observations.at(-1);
      if (!latest || !baseline || !state) continue;
      const baselineThreshold = Math.max(
        config.minimum,
        baseline.count + 2,
        Math.ceil(baseline.count * 1.5),
      );
      const nextAssessment = latest.timestamp + STORYLINE_WINDOW_SECONDS;
      const completedPeriod = cutoff >= period.end;
      const watchNext =
        cutoff >= match.duration
          ? "The match has ended. Revisit the recorded comparison windows and supporting events to inspect how this storyline changed."
          : completedPeriod
            ? "This period has ended. A later period needs its own two complete five-minute windows before a new comparison."
            : state === "resolved"
              ? `A fresh increase needs at least ${config.minimum} ${config.label}, at least two more and at least 1.5 times the preceding five-minute count.`
              : nextAssessment > period.end
                ? "There is no further complete five-minute window in this period; the next period starts a separate comparison."
                : `In the next complete five-minute window ending at ${matchClock(match, nextAssessment)}, ${baselineThreshold} or more ${config.label} would meet the episode's increase threshold.`;
      const relationships: StorylineRelationship[] = [];
      observations.forEach((observation, index) => {
        relationships.push({
          from: id,
          to: observation.id,
          kind: "measured-by",
        });
        if (index > 0)
          relationships.push({
            from: observation.id,
            to: observations[index - 1].id,
            kind: "follows-observation",
          });
        for (const eventId of observation.evidenceIds)
          relationships.push({
            from: observation.id,
            to: eventId,
            kind: "supported-by",
          });
      });
      const limitations = [
        "States describe recorded event counts, not pressing intensity, tactical intent, chance quality or causation.",
        "Five-minute thresholds are editorial rules, not tests of statistical significance; an absent event means no event was recorded.",
      ];
      if (item.metric === "attacking-third-recoveries")
        limitations.push(
          "Only successful or outcome-unspecified recoveries with recorded normalized x ≥ 66.7 count; unsuccessful attempts and missing positions are excluded.",
        );
      if (
        observations.some((observation) =>
          [
            observation.baseline,
            observation.previous,
            observation.current,
          ].some((window) => window.evidenceTruncated),
        )
      )
        limitations.push(
          `Counts use all recorded events; evidence lists are capped at ${STORYLINE_WINDOW_EVIDENCE_LIMIT} events per window.`,
        );
      result.push({
        id,
        matchId: match.id,
        cutoff,
        team: item.team,
        teamId: match.teams[item.team].id,
        period: period.id,
        metric: item.metric,
        label: config.label,
        state,
        firstObservedAt,
        episodeStartedAt,
        episode,
        updatedAt: latest.timestamp,
        revision,
        baseline,
        previous: latest.previous,
        current: latest.current,
        evidenceIds: latest.evidenceIds,
        observations,
        historyTruncated: revision > observations.length,
        relationships,
        criterion: `Each complete five-minute window needs at least ${config.minimum} ${config.label}, at least two more and at least 1.5 times the episode's baseline count. One qualifying window is emerging; two consecutive windows are developing; three or more are sustained. One below-threshold window is weakening; two are resolved.`,
        summary: `${match.teams[item.team].short} recorded ${latest.current.count} ${config.label} from ${matchClock(match, latest.current.start)} to ${matchClock(match, latest.current.end)}, versus ${latest.previous.count} in the preceding five minutes. The episode baseline is ${baseline.count}.`,
        watchNext,
        limitations,
      });
    }
  }
  return result.sort(
    (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
  );
}
