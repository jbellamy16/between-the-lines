import { z } from "zod";
import type { MatchData, NormalizedEvent } from "../../sources/model";
import { matchClock } from "../../sources/model";
import { isHighBallWin, durationLabel } from "../../sources/metrics";
import { metricWording, type ExplanationStyle } from "../../explanation";
import { observe, type Candidate } from "./observer";
import { isMatchState, selectLeadCandidate } from "./editorial";
import {
  evaluateHypothesis,
  validIdentity,
  type ObservationWindow,
} from "./hypothesis";

export const QUESTION_VERSION = "guided-1.0.0";
export const questionIntentSchema = z.enum([
  "chance-quality",
  "opponent-improvement",
  "fading-activity",
]);
export type QuestionIntent = z.infer<typeof questionIntentSchema>;
export const questionSchema = z
  .object({ intent: questionIntentSchema, storyId: z.string().min(1).max(500) })
  .strict();
export type Question = z.infer<typeof questionSchema>;
export const questionLabels: Record<QuestionIntent, string> = {
  "chance-quality": "Are these chances actually better?",
  "opponent-improvement": "Is the other team improving too?",
  "fading-activity": "Has this increase already faded?",
};
export type QuestionMeasurement = {
  id: string;
  team: Candidate["team"];
  metric: string;
  value: number | null;
  window: string;
  eventIds: string[];
};
export type QuestionEvidence = {
  version: typeof QUESTION_VERSION;
  question: Question;
  matchId: string;
  cutoff: number;
  storyHeadline: string;
  team: Candidate["team"];
  metric: string;
  availability: "available" | "unavailable";
  reason: string | null;
  verdict: "higher" | "lower" | "level" | "unknown";
  windows: ObservationWindow[];
  measurements: QuestionMeasurement[];
  qualifications: string[];
  eventIds: string[];
};
export type GuidedQuestion = {
  intent: QuestionIntent;
  label: string;
  unavailable: string | null;
};
const inside = (e: NormalizedEvent, w: ObservationWindow) =>
  e.period === w.period && e.time > w.start && e.time <= w.end;
const predicates: Record<string, (e: NormalizedEvent) => boolean> = {
  shots: (e) => e.type === "shot",
  "ball wins in the attacking third": isHighBallWin,
  "attacking-third actions": (e) =>
    ["pass", "carry", "shot"].includes(e.type) && (e.position?.x ?? -1) >= 66.7,
  "forward passes": (e) =>
    e.type === "pass" && !!e.position && !!e.end && e.end.x > e.position.x + 5,
};
function sourceCandidate(match: MatchData, cutoff: number, storyId: string) {
  const candidates = observe(match, cutoff, "fan", {}, { unranked: true });
  // Decisive moments and quiet spells retain their editorial priority.
  const lead = selectLeadCandidate(candidates);
  if (!lead || isMatchState(lead)) return null;
  return (
    candidates.find(
      (c) =>
        c.id === storyId &&
        ["activity-change", "shot-location"].includes(c.category),
    ) ?? null
  );
}

/** This same reconstruction runs independently after the model's plan. No model numbers or prose enter an answer. */
export function questionEvidence(
  match: MatchData,
  cutoff: number,
  question: Question,
): QuestionEvidence | null {
  questionSchema.parse(question);
  const candidate = sourceCandidate(match, cutoff, question.storyId);
  if (!candidate) return null;
  const h = evaluateHypothesis(match, cutoff, candidate);
  if (
    h.verificationStatus === "unsupported" ||
    h.verificationChecks.some((c) => !c.passed)
  )
    return null;
  const previous = h.windows.find((w) => w.id === "previous"),
    current = h.windows.find((w) => w.id === "current");
  if (
    !previous ||
    !current ||
    current.end - current.start !== previous.end - previous.start ||
    previous.end !== current.start ||
    previous.period !== current.period
  )
    return null;
  const metric =
    candidate.category === "shot-location"
      ? "shots"
      : candidate.statistics[0].label;
  const predicate = predicates[metric];
  if (!predicate) return null;
  if (
    question.intent !== "chance-quality" &&
    candidate.category !== "activity-change"
  )
    return null;
  const base: QuestionEvidence = {
    version: QUESTION_VERSION,
    question,
    matchId: match.id,
    cutoff,
    storyHeadline: candidate.headline,
    team: candidate.team,
    metric,
    availability: "available",
    reason: null,
    verdict: "unknown",
    windows: [previous, current],
    measurements: [],
    qualifications: [],
    eventIds: [],
  };
  const visible = match.events.filter((e) => e.time <= cutoff);
  const sample = (
    team: Candidate["team"],
    window: ObservationWindow,
    filter = predicate,
  ) => visible.filter((e) => e.team === team && inside(e, window) && filter(e));
  const add = (
    id: string,
    team: Candidate["team"],
    metric: string,
    window: ObservationWindow,
    events: NormalizedEvent[],
    value: number | null = events.length,
  ) => {
    if (events.some((e) => !validIdentity(match, e)))
      throw new Error("Question evidence identity violation");
    base.measurements.push({
      id,
      team,
      metric,
      window: window.id,
      eventIds: events.map((e) => e.id),
      value,
    });
  };
  const ownA = sample(candidate.team, previous),
    ownB = sample(candidate.team, current);
  add("own-previous", candidate.team, metric, previous, ownA);
  add("own-current", candidate.team, metric, current, ownB);
  if (question.intent === "chance-quality") {
    const a = sample(candidate.team, previous, (e) => e.type === "shot"),
      b = sample(candidate.team, current, (e) => e.type === "shot");
    if (!b.length) return null;
    const complete = (events: NormalizedEvent[]) =>
      match.capabilities.xg &&
      events.every(
        (e) =>
          e.xg !== undefined && Number.isFinite(e.xg) && e.xg >= 0 && e.xg <= 1,
      );
    for (const [prefix, w, shots] of [
      ["previous", previous, a],
      ["current", current, b],
    ] as const) {
      const total = complete(shots)
        ? shots.reduce((sum, e) => sum + e.xg!, 0)
        : null;
      add(`${prefix}-shots`, candidate.team, "shots", w, shots);
      add(`${prefix}-xg`, candidate.team, "source xG total", w, shots, total);
      add(
        `${prefix}-mean-xg`,
        candidate.team,
        "source xG per shot",
        w,
        shots,
        total === null || !shots.length ? null : total / shots.length,
      );
      add(
        `${prefix}-rated-shots`,
        candidate.team,
        "shots with source xG",
        w,
        shots.filter((e) => match.capabilities.xg && e.xg !== undefined),
      );
    }
    if (!match.capabilities.xg || !complete(a) || !complete(b) || !a.length) {
      base.availability = "unavailable";
      base.reason = !match.capabilities.xg
        ? "This source has no chance-quality ratings (xG). Shot counts and locations cannot tell us whether the chances were better."
        : !a.length
          ? "There were no shots in the earlier window, so average chance quality cannot be compared."
          : "Some shots lack source xG. Missing ratings are unknown, not zero; a complete quality comparison is unavailable.";
    } else {
      const mean = (events: NormalizedEvent[]) =>
        events.reduce((sum, e) => sum + e.xg!, 0) / events.length;
      base.verdict =
        mean(b) > mean(a) ? "higher" : mean(b) < mean(a) ? "lower" : "level";
    }
    base.qualifications.push(
      "Source-model xG estimates scoring likelihood; it is not a guarantee or proof of a tactical change.",
    );
  } else if (question.intent === "opponent-improvement") {
    const opponent = candidate.team === "harbor" ? "riverside" : "harbor";
    const a = sample(opponent, previous),
      b = sample(opponent, current);
    add("opponent-previous", opponent, metric, previous, a);
    add("opponent-current", opponent, metric, current, b);
    base.verdict =
      b.length > a.length ? "higher" : b.length < a.length ? "lower" : "level";
    base.qualifications.push(
      "This compares recorded activity, not overall performance or control of the match.",
    );
  } else {
    const midpoint = (current.start + current.end) / 2;
    const early = { ...current, id: "early", end: midpoint },
      late = { ...current, id: "late", start: midpoint };
    base.windows.push(early, late);
    const a = sample(candidate.team, early),
      b = sample(candidate.team, late);
    add("early-count", candidate.team, metric, early, a);
    add("late-count", candidate.team, metric, late, b);
    base.verdict =
      b.length < a.length ? "lower" : b.length > a.length ? "higher" : "level";
    base.qualifications.push(
      "The two recent halves sit inside the wider current window. A slowdown does not erase its increase or predict what happens next.",
    );
  }
  if (
    visible.some((e) =>
      inside(e, previous) || inside(e, current)
        ? e.source.precision === "minute"
        : false,
    )
  )
    base.qualifications.push(
      "Source times are approximate to the minute; window assignment follows recorded times, not exact second-level timing.",
    );
  base.qualifications.push(
    ...h.contradictoryEvidence.map((e) => e.description),
    ...h.limitingEvidence
      .filter((e) =>
        ["chance-quality-unavailable", "chance-quality-incomplete"].includes(
          e.code,
        ),
      )
      .map((e) => e.description),
  );
  base.qualifications.push(...match.limitations);
  base.eventIds = [...new Set(base.measurements.flatMap((m) => m.eventIds))];
  return base;
}
export function guidedQuestions(
  match: MatchData,
  cutoff: number,
  storyId: string,
): GuidedQuestion[] {
  return questionIntentSchema.options.flatMap((intent) => {
    const evidence = questionEvidence(match, cutoff, { intent, storyId });
    return evidence
      ? [
          {
            intent,
            label: questionLabels[intent],
            unavailable: evidence.reason,
          },
        ]
      : [];
  });
}
export function presentQuestion(
  e: QuestionEvidence,
  match: MatchData,
  style: ExplanationStyle,
) {
  const value = (id: string) => e.measurements.find((m) => m.id === id)?.value;
  const number = (id: string) => {
    const n = value(id);
    return n === null || n === undefined
      ? "unknown"
      : Number(n.toFixed(3)).toString();
  };
  const name = match.teams[e.team].short;
  const metric = metricWording(e.metric, style);
  const previous = e.windows[0],
    current = e.windows[1];
  const range = (w: ObservationWindow) =>
    `${matchClock(match, w.start)}–${matchClock(match, w.end)}`;
  let answer: string, measurement: string;
  if (e.question.intent === "chance-quality") {
    answer =
      e.reason ??
      (e.verdict === "higher"
        ? "Yes, the average shot has a higher source-model chance rating."
        : e.verdict === "lower"
          ? "No. The average shot has a lower source-model chance rating."
          : "No increase: the average shot rating is unchanged.");
    measurement = `${name}: ${number("current-shots")} shots versus ${number("previous-shots")}; ${number("current-xg")} total xG versus ${number("previous-xg")}; ${number("current-mean-xg")} xG per shot versus ${number("previous-mean-xg")}.`;
    if (style === "plain")
      measurement +=
        " Expected goals (xG) estimates how likely a shot is to score. Per-shot ratings separate chance quality from the number of attempts.";
  } else if (e.question.intent === "opponent-improvement") {
    const opponent =
      match.teams[e.team === "harbor" ? "riverside" : "harbor"].short;
    answer =
      e.verdict === "higher"
        ? `Yes—${opponent} also increased their ${metric}.`
        : e.verdict === "lower"
          ? `No—${opponent} recorded fewer ${metric}.`
          : `${opponent}'s ${metric} stayed level.`;
    measurement = `${opponent}: ${number("opponent-previous")} → ${number("opponent-current")}; ${name}: ${number("own-previous")} → ${number("own-current")} ${metric}, across the same two windows.`;
  } else {
    answer =
      e.verdict === "lower"
        ? "Yes, the increase has eased in the latest half of this spell."
        : "No recent weakening appears in these counts.";
    measurement = `${name}: ${number("own-previous")} → ${number("own-current")} ${metric} across the wider windows; within the current window, ${number("early-count")} → ${number("late-count")}. Each recent half lasts ${durationLabel((current.end - current.start) / 2)} (${range(e.windows[2])}, then ${range(e.windows[3])}).`;
  }
  return {
    answer,
    measurement,
    windows: `Earlier ${range(previous)}; current ${range(current)}. Each lasts ${durationLabel(current.end - current.start)} in ${current.period}. ${style === "analysis" ? "Windows use (start, end]: start excluded, end included." : "Each window includes its end time and excludes its start."}`,
    qualifications: [...new Set(e.qualifications)],
  };
}
