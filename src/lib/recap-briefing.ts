import { observe, claimEmphasis, type Candidate } from "./ai/director/observer";
import { packageStory, type BroadcastStory } from "./ai/director/story";
import {
  reconstructStorylines,
  type TemporalStoryline,
} from "./ai/director/storylines";
import type { ObservationWindow } from "./ai/director/hypothesis";
import {
  recordedScore,
  matchClock as sourceMatchClock,
  periodAt,
  type MatchData,
  type NormalizedEvent,
} from "./sources/model";
import { clock } from "./match";
export const briefingClock = (match: MatchData, time: number) =>
  match.kind === "synthetic" ? clock(time) : sourceMatchClock(match, time);
const matchClock = briefingClock;
import type { StoryPreferences } from "./intelligence";

export const BRIEFING_VERSION = "briefing-1.0.0";
export const durationLabel = (seconds: number) => {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}m${rounded % 60 ? ` ${rounded % 60}s` : ""}`;
};
export type BriefingMetric = {
  id: string;
  label: string;
  team: string;
  current: number;
  previous: number;
  currentLabel: string;
  previousLabel: string;
  windows: ObservationWindow[];
  evidenceIds: string[];
};
export type Briefing = {
  cutoff: number;
  since: number | null;
  score: ReturnType<typeof recordedScore>;
  headline: string;
  narrative: string;
  expanded: string[];
  qualifications: string[];
  metrics: BriefingMetric[];
  moments: { event: NormalizedEvent; label: string }[];
  stories: BroadcastStory[];
  storylines: TemporalStoryline[];
  watch: {
    headline: string;
    text: string;
    evidenceIds: string[];
    criterion: string;
  } | null;
  evidenceIds: string[];
  source: "offline" | "foundry" | "openai";
};
const person = (match: MatchData, id: string | null | undefined) =>
  match.players.find((p) => p.id === id)?.name ?? "An unidentified player";
const scored = (event: NormalizedEvent) =>
  event.period !== "PS" && !!event.scoringTeam;

export function momentLabel(match: MatchData, event: NormalizedEvent) {
  const who = person(match, event.playerId);
  if (scored(event))
    return event.ownGoal
      ? `${who} scores an own goal.`
      : `${who} scores for ${match.teams[event.scoringTeam!].short}.`;
  if (event.type === "substitution")
    return `${who} replaces ${person(match, event.outgoingId)}.`;
  if (event.type === "shot")
    return `${who}${event.outcome === "saved" ? " has a shot saved" : event.outcome === "wide" ? " shoots off target" : " takes a shot"}.`;
  if (event.type === "card") return `${who} receives a card.`;
  return `${who} · ${event.type.replaceAll("_", " ")}`;
}
function measuredMetric(
  match: MatchData,
  story: BroadcastStory,
): BriefingMetric | null {
  const h = story.hypothesis;
  const current = h.measurements.find((m) => m.key === "current-count");
  const previous = h.measurements.find((m) => m.key === "previous-count");
  const a = h.windows.find((w) => w.id === "current");
  const b = h.windows.find((w) => w.id === "previous");
  if (!current || !previous || !a || !b || a.end - a.start !== b.end - b.start)
    return null;
  const team = match.events.find(
    (e) => e.id === (current.eventIds[0] ?? story.evidenceEventIds[0]),
  )?.team;
  const range = (w: ObservationWindow) =>
    `${matchClock(match, w.start)}–${matchClock(match, w.end)}`;
  return {
    id: story.storyId,
    label: current.label
      .replace(/^Current /, "")
      .replace(
        "recoveries in the attacking third",
        "Attacking-third recoveries",
      ),
    team: team ? match.teams[team].short : "",
    current: current.value,
    previous: previous.value,
    currentLabel: range(a),
    previousLabel: range(b),
    windows: [b, a],
    evidenceIds: [...new Set([...current.eventIds, ...previous.eventIds])],
  };
}
function validStory(match: MatchData, cutoff: number, story: BroadcastStory) {
  const visible = new Set(
    match.events.filter((e) => e.time <= cutoff).map((e) => e.id),
  );
  return (
    story.matchId === match.id &&
    story.cutoff === cutoff &&
    story.validation === "verified" &&
    ["confirmed-observation", "supported-interpretation"].includes(
      story.hypothesis.verificationStatus,
    ) &&
    story.hypothesis.timestamp === cutoff &&
    story.hypothesis.verificationChecks.every((c) => c.passed) &&
    story.hypothesis.windows.every((w) => w.start >= 0 && w.end <= cutoff) &&
    [
      ...story.evidenceEventIds,
      ...story.hypothesis.measurements.flatMap((m) => m.eventIds),
    ].every((id) => visible.has(id))
  );
}
function importance(candidate: Candidate) {
  if (candidate.category === "activity-change")
    return candidate.statistics[0]?.label === "shots" ? 50 : 40;
  return (
    {
      "recovery-shot": 35,
      "substitute-involvement": 30,
      "shot-sequence": 25,
      "shot-location": 20,
      "passing-pair": 10,
      "player-involvement": 15,
      "window-comparison": 40,
    }[candidate.category] ?? 0
  );
}
/** Controlled editorial grammar over independently verified intelligence. No model prose or final-score metadata is rendered. */
export function buildBriefing(
  match: MatchData,
  cutoff: number,
  options: {
    since?: number | null;
    preferences?: StoryPreferences;
    /** Only the existing server-verified Director result may supply these stories. */
    stories?: BroadcastStory[];
  } = {},
): Briefing {
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > match.duration)
    throw new Error("Invalid briefing cutoff");
  const since =
    typeof options.since === "number" &&
    Number.isFinite(options.since) &&
    options.since >= 0 &&
    options.since < cutoff
      ? options.since
      : null;
  const visible = match.events.filter(
    (e) => e.time <= cutoff && e.period !== "PS",
  );
  const interval = visible.filter((e) => since === null || e.time > since);
  const score = recordedScore(visible);
  const candidates = observe(match, cutoff, "fan", options.preferences)
    .filter((c) => since === null || c.timestamp > since)
    .sort((a, b) => importance(b) - importance(a) || b.rank - a.rank);
  const local: BroadcastStory[] = [];
  const groups = new Set<string>();
  for (const c of candidates) {
    const group = `${c.team}:${c.category}:${c.category === "activity-change" ? c.statistics[0].label : ""}`;
    if (groups.has(group)) continue;
    if (
      c.category === "activity-change" &&
      local.filter((s) => s.category === "activity-change").length >= 3
    )
      continue;
    try {
      local.push(
        packageStory(
          c,
          match,
          cutoff,
          "fan",
          "offline",
          "brief",
          claimEmphasis[c.category],
        ),
      );
      groups.add(group);
    } catch {
      /* Independent verification fails closed; plain recorded context remains. */
    }
    if (local.length === 5) break;
  }
  const selected = (options.stories ?? []).filter(
    (s) =>
      validStory(match, cutoff, s) && (since === null || s.timestamp > since),
  );
  const stories = [
    ...selected,
    ...local.filter((s) => !selected.some((p) => p.storyId === s.storyId)),
  ].slice(0, 6);
  const lead = stories[0];
  const team =
    lead && match.events.find((e) => e.id === lead.evidenceEventIds[0])?.team;
  const name = team ? match.teams[team].short : "";
  const metrics = stories
    .map((s) => measuredMetric(match, s))
    .filter((m): m is BriefingMetric => !!m);
  const uniqueMetrics = metrics.filter(
    (m, i) =>
      metrics.findIndex(
        (p) =>
          p.team === m.team &&
          p.label === m.label &&
          p.currentLabel === m.currentLabel &&
          p.previousLabel === m.previousLabel,
      ) === i,
  );
  const mainMetric = lead ? measuredMetric(match, lead) : null;
  const goals = visible.filter(scored);
  const newGoals = interval.filter(scored);
  const latestGoal = newGoals.at(-1);
  const leader =
    score.harbor === score.riverside
      ? null
      : score.harbor > score.riverside
        ? "harbor"
        : "riverside";
  const scoreText = `${score.harbor}–${score.riverside}`;
  const leaderScore =
    leader === "riverside" ? `${score.riverside}–${score.harbor}` : scoreText;
  let context = leader
    ? `${match.teams[leader].name} lead ${leaderScore}.`
    : `The sides are level at ${scoreText}.`;
  if (cutoff >= match.duration)
    context = leader
      ? `${match.teams[leader].name} finish ${leaderScore} winners.`
      : `The match finishes level at ${scoreText}.`;
  else if (latestGoal)
    context = `${person(match, latestGoal.playerId)}${latestGoal.ownGoal ? "'s own goal" : "'s goal"} at ${matchClock(match, latestGoal.time)} ${leader ? `leaves ${match.teams[leader].name} leading ${leaderScore}` : `leaves the sides level at ${scoreText}`}.`;
  else if (since !== null)
    context += ` No goals have been recorded since ${matchClock(match, since)}.`;
  let headline = leader
    ? `${match.teams[leader].short} hold the advantage.`
    : "All square so far.";
  let development = "";
  if (lead && mainMetric) {
    const metric = mainMetric.label.toLowerCase();
    headline =
      metric === "shots"
        ? `${name} are getting more shots away.`
        : metric === "attacking-third recoveries"
          ? `${name} are regaining the ball more often upfield.`
          : `${name}'s ${metric} are increasing.`;
    const currentWindow = mainMetric.windows[1];
    const spell =
      currentWindow.end === cutoff
        ? `in the latest ${durationLabel(currentWindow.end - currentWindow.start)}`
        : `from ${matchClock(match, currentWindow.start)} to ${matchClock(match, currentWindow.end)}`;
    if (currentWindow.end < cutoff)
      headline = `${name}'s earlier rise in ${metric}.`;
    development = `${name} have recorded ${mainMetric.current} ${metric} ${spell}, against ${mainMetric.previous} in the preceding equal spell.`;
    if (metric === "shots") {
      const outcome = lead.hypothesis.measurements.find(
        (m) => m.key === "current-shot-goal-outcomes",
      );
      development +=
        outcome?.value === 0
          ? " Those attempts have yet to bring a goal in this spell."
          : " That is an increase in attempts, without necessarily meaning better chances.";
    } else if (metric === "attacking-third recoveries")
      development +=
        " The next question is whether those regains are followed by shots.";
    else development += " This shows a change in recorded on-ball activity.";
    const regains = uniqueMetrics.find(
      (m) => m.team === name && m.label === "Attacking-third recoveries",
    );
    if (metric === "shots" && regains && regains.current > regains.previous)
      development += " Their recoveries upfield have also increased.";
  } else if (lead?.category === "player-involvement") {
    const actions = lead.hypothesis.measurements.find(
      (m) => m.key === "involvements",
    );
    const shots = lead.hypothesis.measurements.find(
      (m) => m.key === "player-shots",
    );
    const first = visible.find((e) => e.id === actions?.eventIds[0]);
    const window = lead.hypothesis.windows[0];
    if (actions && shots && first && window) {
      const who = person(match, first.actorId);
      headline = `${who}'s involvement in focus.`;
      development = `${who} has ${actions.value} recorded on-ball actions, including ${shots.value} shots, from ${matchClock(match, window.start)} to ${matchClock(match, window.end)}. This describes their contribution on the ball, without establishing an effect on team performance.`;
    }
  } else if (
    lead &&
    [
      "recovery-shot",
      "shot-sequence",
      "substitute-involvement",
      "passing-pair",
      "player-involvement",
    ].includes(lead.category)
  ) {
    // The Director's brief is already constrained and independently checked. Use one, never concatenate overlapping claims.
    const candidate = candidates.find((c) => c.id === lead.storyId);
    development = candidate?.brief ?? "";
    if (development)
      headline =
        lead.category === "recovery-shot"
          ? `A ball win precedes ${name}'s shot.`
          : lead.headline;
  }
  if (!development) {
    const shots = interval.filter((e) => e.type === "shot");
    if (shots.length)
      development = `${match.teams.harbor.short} have recorded ${shots.filter((e) => e.team === "harbor").length} shots and ${match.teams.riverside.short} ${shots.filter((e) => e.team === "riverside").length}${since === null ? " so far" : " since your last viewing position"}. The available evidence does not establish a clear change in activity.`;
    else
      development = interval.length
        ? "There is not enough attacking evidence yet to identify a developing pattern."
        : "No match developments to highlight yet.";
  }
  if (cutoff >= match.duration) {
    const decisive =
      leader &&
      newGoals.findLast((goal) => {
        if (goal.scoringTeam !== leader) return false;
        const before = recordedScore(
          visible.filter((e) => e.order < goal.order),
        );
        return before.harbor === before.riverside;
      });
    const shots = interval.filter((e) => e.type === "shot");
    development = [
      decisive
        ? `${person(match, decisive.playerId)}${decisive.ownGoal ? "'s own goal" : "'s goal"} at ${matchClock(match, decisive.time)} put ${match.teams[leader!].short} ahead for the last time.`
        : "",
      shots.length
        ? `${match.teams.harbor.short} recorded ${shots.filter((e) => e.team === "harbor").length} shots to ${match.teams.riverside.short}'s ${shots.filter((e) => e.team === "riverside").length}${since === null ? " across the match" : " since your last viewing position"}.`
        : "No further attempts were recorded in this interval.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const storylines = reconstructStorylines(match, cutoff).filter(
    (s) =>
      s.period === periodAt(match, cutoff).id &&
      (since === null || s.updatedAt > since),
  );
  const line =
    storylines.find(
      (s) =>
        s.team === team &&
        (mainMetric?.label.toLowerCase() === "shots"
          ? s.metric === "shots"
          : s.metric === "attacking-third-recoveries"),
    ) ?? storylines.find((s) => s.state !== "resolved");
  const qualifications: string[] = [];
  if (lead) {
    for (const e of lead.hypothesis.contradictoryEvidence) {
      if (e.code === "latest-rate-not-sustained")
        qualifications.push(
          "The increase has eased in the latest part of that spell.",
        );
      if (e.code === "opponent-shot-response")
        qualifications.push(
          "The opposition have matched or exceeded that shot count, so this is not one-way traffic.",
        );
      if (e.code === "shot-volume-without-xg-increase")
        qualifications.push(
          "More shots have not raised the total expected goals in this comparison.",
        );
    }
  }
  if (
    line &&
    line.team === team &&
    ["weakening", "resolved"].includes(line.state) &&
    ((mainMetric?.label.toLowerCase() === "shots" && line.metric === "shots") ||
      (mainMetric?.label === "Attacking-third recoveries" &&
        line.metric === "attacking-third-recoveries"))
  ) {
    headline = `${match.teams[line.team].short}'s earlier ${line.metric === "shots" ? "shooting surge" : "rise in high recoveries"} has eased.`;
    qualifications.push(
      line.state === "resolved"
        ? "Two completed five-minute spells no longer support the earlier increase."
        : "The latest completed five-minute spell no longer supports the earlier increase.",
    );
  }
  if (latestGoal && cutoff - latestGoal.time <= 300) {
    const before = recordedScore(
      visible.filter((e) => e.order < latestGoal.order),
    );
    headline = !leader
      ? "A goal brings the sides level."
      : before[leader] <= before[leader === "harbor" ? "riverside" : "harbor"]
        ? `${match.teams[leader].short} take the lead.`
        : latestGoal.scoringTeam === leader
          ? `${match.teams[leader].short} extend their advantage.`
          : `${match.teams[latestGoal.scoringTeam!].short} cut the deficit.`;
  }
  if (cutoff >= match.duration)
    headline = leader
      ? `${match.teams[leader].short} see it through.`
      : "Nothing separates the sides at full time.";
  if (!visible.length) headline = "The story is still to come.";
  // If the lead has no comparison, show genuinely recorded totals over the requested interval.
  if (!mainMetric || cutoff >= match.duration) {
    const shots = interval.filter((e) => e.type === "shot");
    if (shots.length)
      uniqueMetrics.unshift({
        id: "shots-in-briefing",
        label: "Shots",
        team:
          since === null ? "Match so far" : `Since ${matchClock(match, since)}`,
        current: shots.filter((e) => e.team === "harbor").length,
        previous: shots.filter((e) => e.team === "riverside").length,
        currentLabel: match.teams.harbor.short,
        previousLabel: match.teams.riverside.short,
        windows: [],
        evidenceIds: shots.map((e) => e.id),
      });
  }
  const support = new Set(stories.flatMap((s) => s.evidenceEventIds));
  const significance = (e: NormalizedEvent) =>
    scored(e)
      ? 1000
      : e.type === "card"
        ? 200
        : e.type === "shot"
          ? (e.time >= cutoff - 900 ? 140 : 40) +
            (e.outcome === "saved" ? 25 : 0) +
            (support.has(e.id) ? 20 : 0)
          : e.type === "substitution"
            ? e.time >= cutoff - 900
              ? 130
              : 70
            : 0;
  const moments = interval
    .filter(
      (e) =>
        significance(e) > 0 &&
        !(e.type === "shot" && e.outcome === "goal" && !scored(e)),
    )
    .sort((a, b) => significance(b) - significance(a) || b.time - a.time)
    .filter(
      (event, index, ranked) =>
        event.type !== "shot" ||
        scored(event) ||
        !ranked
          .slice(0, index)
          .some(
            (prior) =>
              prior.type === "shot" &&
              !scored(prior) &&
              prior.actorId === event.actorId,
          ),
    )
    .slice(0, 8)
    .map((event) => ({ event, label: momentLabel(match, event) }));
  let watch: Briefing["watch"] = null;
  if (
    cutoff < match.duration &&
    line &&
    line.state !== "resolved" &&
    line.updatedAt + 300 <= periodAt(match, cutoff).end
  ) {
    const target = Math.max(
      line.metric === "shots" ? 3 : 2,
      line.baseline.count + 2,
      Math.ceil(line.baseline.count * 1.5),
    );
    const label =
      line.metric === "shots" ? "shots" : "attacking-third recoveries";
    watch = {
      headline: `Can ${match.teams[line.team].short} ${line.state === "weakening" ? "revive" : "sustain"} this spell?`,
      text: `${target} or more ${label} in the five-minute spell ending at ${matchClock(match, line.updatedAt + 300)} would support the earlier increase. Fewer would ${line.state === "weakening" ? "end that measured run" : "weaken the pattern"}.`,
      evidenceIds: line.evidenceIds,
      criterion: line.criterion,
    };
  } else if (
    cutoff < match.duration &&
    lead?.hypothesis.watchNext &&
    !line &&
    mainMetric
  ) {
    const next = lead.hypothesis.watchNext;
    const label = mainMetric.label.toLowerCase();
    const comparable =
      next.windowSeconds ===
        mainMetric.windows[1].end - mainMetric.windows[1].start &&
      next.metric !== "additional-recorded-activity" &&
      next.metric !== "new-period-recorded-activity";
    if (comparable)
      watch = {
        headline: `Does ${name}'s increase continue?`,
        text: `${next.target} or more ${label} from ${matchClock(match, next.startsAt)} to ${matchClock(match, next.endsAt)} would support another elevated spell; fewer would weaken that reading.`,
        evidenceIds: lead.evidenceEventIds,
        criterion: next.description,
      };
  }
  const expanded: string[] = [];
  if (since !== null)
    expanded.push(
      `The score includes the whole match; the briefing highlights developments after ${matchClock(match, since)}. Comparison baselines may reach further back and are labelled below.`,
    );
  const firstGoal = goals[0];
  if (
    firstGoal &&
    firstGoal !== latestGoal &&
    (since === null || firstGoal.time > since)
  )
    expanded.push(
      `${person(match, firstGoal.playerId)} ${firstGoal.ownGoal ? "put the ball into their own net" : "opened the scoring"} at ${matchClock(match, firstGoal.time)}.`,
    );
  const sequence = stories.find(
    (s) => s !== lead && s.category === "recovery-shot",
  );
  const sequenceCandidate =
    sequence && candidates.find((c) => c.id === sequence.storyId);
  if (sequenceCandidate && !development.includes(sequenceCandidate.brief))
    expanded.push(sequenceCandidate.brief);
  if (!expanded.length && lead)
    expanded.push(
      "Explore the measured comparisons and recorded passages below to see where the change occurred.",
    );
  return {
    cutoff,
    since,
    score,
    headline,
    narrative: `${context} ${development}`,
    expanded,
    qualifications:
      cutoff >= match.duration ? [] : [...new Set(qualifications)],
    metrics: uniqueMetrics.slice(0, 6),
    moments,
    stories,
    storylines,
    watch,
    evidenceIds: [
      ...new Set([
        ...goals.map((e) => e.id),
        ...stories.flatMap((s) => s.evidenceEventIds),
        ...uniqueMetrics.flatMap((m) => m.evidenceIds),
      ]),
    ],
    source: selected[0]?.provider ?? "offline",
  };
}
