import type { BroadcastStory } from "./ai/director/story";
import type { HypothesisAssessment } from "./ai/director/hypothesis";
import { evaluateHypothesis } from "./ai/director/hypothesis";
import { observe } from "./ai/director/observer";
import { detectInsights, type Insight } from "./intelligence";
import type { Provenance } from "./ai/service";
import {
  eventClock,
  matchClock,
  recordedScore,
  periodAt,
  type MatchData,
} from "./sources/model";
import { durationLabel, BALL_WIN_DEFINITION } from "./sources/metrics";

export type ExplanationStyle = "plain" | "analysis";
export const parseExplanationStyle = (value: unknown): ExplanationStyle =>
  value === "analysis" ? "analysis" : "plain";
export type StoryWording = {
  headline: string;
  explanation: string;
  why: string;
  watch: string;
  qualifications: { code: string; text: string }[];
};
const value = (h: HypothesisAssessment, key: string) =>
  h.measurements.find((m) => m.key === key)?.value;
const person = (match: MatchData, id: string | null | undefined) =>
  match.players.find((p) => p.id === id)?.name ?? "An unidentified player";
export const metricWording = (metric: string, style: ExplanationStyle) =>
  style === "analysis"
    ? metric
    : ((
        {
          "ball wins in the attacking third":
            "ball wins near the opponent’s goal",
          "attacking-third actions":
            "passes, runs with the ball and shots near the opponent’s goal",
          "forward passes": "passes towards the opponent’s goal",
          "pass attempts": "attempted passes",
        } as Record<string, string>
      )[metric] ?? metric);

function countedMetric(
  count: number | undefined,
  metric: string,
  style: ExplanationStyle,
) {
  const singular: Record<string, string> = {
    shots: "shot",
    "pass attempts": style === "plain" ? "attempted pass" : "pass attempt",
    "ball wins in the attacking third":
      style === "plain"
        ? "ball win near the opponent’s goal"
        : "ball win in the attacking third",
    "forward passes":
      style === "plain" ? "pass towards the opponent’s goal" : "forward pass",
    "attacking-third actions":
      style === "plain"
        ? "pass, run with the ball or shot near the opponent’s goal"
        : "attacking-third action",
  };
  return `${count} ${count === 1 ? (singular[metric] ?? metricWording(metric, style)) : metricWording(metric, style)}`;
}

/** Keep every material counter-observation, including unfamiliar future codes. */
export function hypothesisQualifications(
  h: HypothesisAssessment,
  style: ExplanationStyle,
): StoryWording["qualifications"] {
  const analysis = style === "analysis";
  const metric =
    h.measurements.find((m) => m.key === "current-count")?.label ?? "actions";
  const later = countedMetric(
    value(h, "current-second-half-count"),
    metric,
    style,
  );
  const variants: Record<string, string> = {
    "latest-rate-not-sustained": analysis
      ? `The rate declined within the current window: ${later} in its second half versus ${value(h, "current-first-half-count")} in its first. The increase may be fading.`
      : `The increase has eased: ${later} in the later half of this spell, after ${value(h, "current-first-half-count")} in the first half.`,
    "shot-volume-without-xg-increase": analysis
      ? `Shot volume increased, but total source xG did not: ${value(h, "current-xg")} versus ${value(h, "previous-xg")}. This does not support higher aggregate chance quality.`
      : `More shots have not meant better chances overall in the recorded ratings: ${value(h, "current-xg")} expected goals, compared with ${value(h, "previous-xg")}. Expected goals estimates how likely shots are to score.`,
    "opponent-shot-response": analysis
      ? `The opponent recorded ${countedMetric(value(h, "opponent-current-shots"), "shots", style)} in the current window, matching or exceeding this team's count. One-sided control is not established.`
      : `The other team also took ${countedMetric(value(h, "opponent-current-shots"), "shots", style)} in this spell—at least as many. This has not been one-way traffic.`,
  };
  const result = h.contradictoryEvidence.map((e) => ({
    code: e.code,
    text: variants[e.code] ?? e.description,
  }));
  for (const e of h.limitingEvidence) {
    const limits: Record<string, string> = {
      "chance-quality-unavailable": analysis
        ? "The source supplies no xG; shot count and shot origins cannot establish chance quality."
        : "This feed has no chance-quality ratings, so the number or starting places of shots cannot tell us how good the chances were.",
      "chance-quality-incomplete": analysis
        ? "Some assessed shots lack source xG; a complete chance-quality comparison is unavailable."
        : "Some shots are missing chance-quality ratings, so we cannot fully compare how good the chances were.",
      "minute-precision": analysis
        ? "At least one source time has minute precision; elapsed seconds are not established."
        : "At least one time is approximate to the minute, so we cannot say exactly how many seconds separated the actions.",
    };
    if (limits[e.code]) result.push({ code: e.code, text: limits[e.code] });
  }
  return result;
}

function comparisonWording(
  match: MatchData,
  h: Pick<HypothesisAssessment, "measurements" | "windows">,
  subject: string,
  style: ExplanationStyle,
  cutoff: number,
) {
  const current = h.measurements.find((m) => m.key === "current-count")!;
  const previous = h.measurements.find((m) => m.key === "previous-count")!;
  const a = h.windows.find((w) => w.id === "current")!;
  const b = h.windows.find((w) => w.id === "previous")!;
  const metric = metricWording(current.label, style);
  const range = (w: typeof a) =>
    `${matchClock(match, w.start)}–${matchClock(match, w.end)}`;
  const high = current.label === "ball wins in the attacking third";
  const shots = current.label === "shots";
  return {
    headline:
      a.end < cutoff
        ? `${subject}'s earlier rise in ${metric}.`
        : style === "analysis"
          ? `${subject}: more ${current.label}`
          : shots
            ? `${subject} are getting more shots away.`
            : high
              ? `${subject} are winning the ball near the opponent’s goal more often.`
              : `${subject}: more ${metric}.`,
    explanation:
      style === "analysis"
        ? `${subject}: ${current.value} ${metric} (${range(a)}) versus ${previous.value} (${range(b)}). Equal ${durationLabel(a.end - a.start)} windows in the same half.`
        : `${subject} recorded ${current.value} ${metric} ${a.end === cutoff ? `in the last ${durationLabel(a.end - a.start)}` : `from ${range(a)}`}, up from ${previous.value} in the previous equal spell.`,
    why: shots
      ? style === "analysis"
        ? "Shot volume has increased; chance quality needs separate evidence."
        : "More shots need not mean better chances."
      : high
        ? style === "analysis"
          ? "More attacking-third regains give starting points to examine for subsequent same-possession shots. They do not establish pressing intensity."
          : "These ball wins leave less ground to cover before reaching goal. They do not guarantee a shot or tell us how hard the team pressed."
        : style === "analysis"
          ? "The change describes recorded on-ball activity, not possession time, ball speed or causation."
          : "The team is doing more with the ball in this sample. Counts do not tell us why that changed or how long they had the ball.",
  };
}

/** Pure presentation over a verified story. Never participates in selection, cache identity or transport. */
export function presentStory(
  story: BroadcastStory,
  match: MatchData,
  style: ExplanationStyle,
): StoryWording {
  const h = story.hypothesis;
  const events = match.events.filter(
    (e) => e.time <= story.cutoff && story.highlightedEventIds.includes(e.id),
  );
  const team = h.watchNext?.team ?? events[0]?.team ?? "harbor";
  const name = match.teams[team].short;
  // Query-derived IDs encode the selected actor. Unlike a watch-next target,
  // that identity also exists when the match has finished.
  const comparisonPlayer =
    story.category === "window-comparison"
      ? match.players.find(
          (p) =>
            p.team === team &&
            story.storyId.startsWith(
              `${match.id}:window-comparison:${team}:${p.id}:`,
            ),
        )
      : undefined;
  const subject = comparisonPlayer?.name ?? name;
  const analysis = style === "analysis";
  let headline = story.headline;
  let explanation =
    h.supportingEvidence.find((e) => e.code === "recorded-observation")
      ?.description ?? story.explanation;
  let why = h.whyItMatters;
  const qualifications = hypothesisQualifications(h, style);
  if (h.measurements.some((m) => m.key === "current-count")) {
    ({ headline, explanation, why } = comparisonWording(
      match,
      h,
      subject,
      style,
      story.cutoff,
    ));
    const goals = value(h, "current-shot-goal-outcomes");
    if (goals !== undefined)
      explanation +=
        goals === 0
          ? " None scored."
          : ` Those shots included ${goals} recorded goal ${goals === 1 ? "outcome" : "outcomes"}.`;
  } else if (
    story.category === "full-time" ||
    story.category === "score-change"
  ) {
    const goals = events.filter((e) => e.scoringTeam && e.period !== "PS");
    const score = recordedScore(goals);
    const last = goals.at(-1);
    const scoreline = `${match.teams.harbor.short} ${score.harbor}–${score.riverside} ${match.teams.riverside.short}`;
    headline = `${story.category === "full-time" ? "Full time" : "Goal"}: ${scoreline}`;
    explanation = last
      ? `${person(match, last.playerId)} ${last.ownGoal ? "scored an own goal" : "scored"} at ${eventClock(match, last)}. ${scoreline}.`
      : "No goals were recorded. The match finished level at 0–0.";
    why =
      story.category === "full-time"
        ? "The result is settled. Revisit the goals to see how the score changed."
        : "The goal changes the score. Watch how the next passage develops.";
    if (analysis)
      explanation +=
        " Scoring events through this cutoff determine the score; penalty shootouts are excluded.";
  } else if (
    story.category === "recovery-shot" ||
    story.category === "shot-sequence"
  ) {
    const shot = events.at(-1)!;
    const first = events[0];
    const seconds = value(h, "recovery-shot-seconds");
    if (story.category === "recovery-shot") {
      headline = analysis
        ? `${name}: ball win to shot in the same possession`
        : `${name} win the ball, then get a shot away.`;
      explanation = `${name} won the ball at ${eventClock(match, first)} before ${person(match, shot.actorId)} shot at ${eventClock(match, shot)}, ${analysis ? "in the same recorded possession" : "in the same spell with the ball"}.${seconds !== undefined ? ` The recorded gap was ${seconds} seconds.` : ""}`;
    } else {
      headline = analysis
        ? `${name}: completed passing sequence to shot`
        : `${name} put passes together before a shot.`;
      explanation = `${name} completed ${value(h, "completed-passes")} passes before ${person(match, shot.actorId)} shot at ${eventClock(match, shot)}, ${analysis ? "within one recorded possession" : "in the same spell with the ball"}.`;
    }
    why = analysis
      ? "The on-ball sequence links the recorded actions. It establishes neither causation nor off-ball movement."
      : "This shows the actions leading up to the attempt. It does not explain why the chance happened or show players moving without the ball.";
  } else if (story.category === "shot-location") {
    const a = value(h, "current-mean-x")!,
      b = value(h, "previous-mean-x")!;
    headline = analysis
      ? `${name}: shot origins shifted`
      : `${name} are shooting from ${a > b ? "farther up" : "farther back on"} the pitch.`;
    explanation = analysis
      ? `Mean shot-origin x: ${a} versus ${b} on the normalized 0–100 pitch.`
      : `The average starting point of their shots moved from ${b} to ${a} on a pitch scale where 100 is the opponent’s goal line.`;
    explanation += ` Samples: ${h.windows.map((w) => `${matchClock(match, w.start)}–${matchClock(match, w.end)}`).join(" and ")}.`;
    why = analysis
      ? "Longitudinal origin is not distance to goal or chance quality; angle and defensive pressure remain unmeasured."
      : "This tells us where shots started along the pitch, not their distance from goal or how good the chances were.";
  } else if (story.category === "passing-pair") {
    const first = events[0];
    const window = h.windows[0];
    headline = analysis
      ? `${name}: repeated directional passing pair`
      : `${person(match, first.actorId)} keeps finding ${person(match, first.recipientId)}.`;
    explanation = `${person(match, first.actorId)} completed ${value(h, "pair-completions")} passes to ${person(match, first.recipientId)} from ${matchClock(match, window.start)} to ${matchClock(match, window.end)}.`;
    why = analysis
      ? "This identifies an on-ball connection; receiving space and off-ball movement are not measured."
      : "It is a passing link to watch. The feed cannot show how the receiver found space.";
  } else if (
    story.category === "substitute-involvement" ||
    story.category === "player-involvement"
  ) {
    const sub = story.category === "substitute-involvement" ? events[0] : null;
    const who = person(match, sub?.playerId ?? events[0]?.actorId);
    const window = h.windows[0];
    headline = `${who}: ${analysis ? "recorded on-ball involvement" : "involvement"}${sub ? " after coming on" : " in this spell"}`;
    explanation = `${who} has ${value(h, "involvements")} recorded ${analysis ? "on-ball actions" : "actions with the ball"}, including ${countedMetric(value(h, "player-shots"), "shots", style)}, ${sub ? `since coming on at ${eventClock(match, sub)}` : `from ${matchClock(match, window.start)} to ${matchClock(match, window.end)}`}.`;
    why = analysis
      ? "Observed contribution does not isolate a substitution effect, off-ball influence or change in team performance."
      : "This shows how the player has been involved, but does not tell us whether they made the team play better.";
  }
  if (
    events.some((e) => e.source.precision === "minute") &&
    !qualifications.some((q) => q.code === "minute-precision")
  )
    qualifications.push({
      code: "minute-precision",
      text: analysis
        ? "Times marked ~ have source minute precision; exact seconds are unavailable."
        : "A ~ before a time means the source gives only an approximate minute.",
    });
  if (
    h.contradictoryEvidence.some((e) => e.code === "latest-rate-not-sustained")
  ) {
    const metric =
      h.measurements.find((m) => m.key === "current-count")?.label ??
      "activity";
    headline = `${subject}'s increase in ${metricWording(metric, style)} has eased within this spell.`;
  }
  const line = story.storyline;
  if (
    line &&
    ["activity-change", "window-comparison"].includes(story.category) &&
    ["weakening", "resolved"].includes(line.state)
  ) {
    headline = `${name}'s earlier ${line.metric === "shots" ? "rise in shots" : "rise in ball recoveries"} has eased.`;
    qualifications.push({
      code: "storyline-eased",
      text: `${line.state === "resolved" ? "Two completed five-minute spells no longer support" : "The latest completed five-minute spell no longer supports"} the earlier increase.${analysis ? " This fixed five-minute history is a separate comparison." : " This checks shorter spells separately."}`,
    });
  }
  const next = h.watchNext;
  const watch = !next
    ? story.watchNext
    : analysis
      ? next.description
      : [
            "shots",
            "pass attempts",
            "ball wins in the attacking third",
            "attacking-third actions",
            "forward passes",
          ].includes(next.metric)
        ? `Watch for at least ${next.target} ${metricWording(next.metric, style)} from ${matchClock(match, next.startsAt)} to ${matchClock(match, next.endsAt)}. That would match the count in this spell; fewer would weaken the reading.`
        : next.metric === "recovery-shot-links"
          ? "Watch whether another ball win is followed by a shot before the team loses the ball. The next events will tell us."
          : next.metric === "passing-shot-sequences"
            ? "Watch for another spell of at least four completed passes followed by a shot."
            : next.metric === "player-involvements"
              ? "Watch for the player’s next recorded action with the ball."
              : next.metric === "pair-completions"
                ? "Watch for another completed pass between these players, in the same direction."
                : next.metric === "located-shots"
                  ? "Watch where the next three shots start, then compare them with this spell."
                  : "Watch the next recorded actions. There is not enough time in this half for another complete comparison.";
  return { headline, explanation, why, watch, qualifications };
}

/** Legacy Insights use the same checked windows/qualification grammar as Director stories. */
export function presentInsight(
  insight: Insight,
  match: MatchData,
  style: ExplanationStyle,
): StoryWording {
  const metric =
    insight.category === "pressure"
      ? "ball wins in the attacking third"
      : insight.metric.toLowerCase();
  const candidate = observe(
    match,
    insight.end,
    "analyst",
    {},
    { unranked: true },
  ).find(
    (c) =>
      c.category === "activity-change" &&
      c.team === insight.team &&
      c.statistics[0]?.label === metric &&
      c.statistics[0].value === insight.current &&
      c.statistics[1]?.value === insight.previous,
  );
  const h = candidate && evaluateHypothesis(match, insight.end, candidate);
  if (h && h.verificationStatus !== "unsupported") {
    const text = comparisonWording(
      match,
      h,
      match.teams[insight.team].short,
      style,
      insight.end,
    );
    return {
      ...text,
      watch:
        style === "analysis"
          ? (h.watchNext?.description ?? "Revisit the recorded evidence.")
          : insight.category === "pressure"
            ? "Watch whether these ball wins are followed by shots."
            : insight.category === "chances"
              ? "Watch how good the next chances are, as well as how many shots there are."
              : "Watch whether the next passes take the team nearer to goal.",
      qualifications: hypothesisQualifications(h, style),
    };
  }
  // Insights may contain more than the Director's 120-event publication cap.
  // Recheck dense passing samples through their original detector, without
  // changing Director eligibility, truncating evidence or weakening its checks.
  if (insight.category === "rhythm" && metric === "pass attempts") {
    const period = periodAt(match, insight.end);
    const checked = detectInsights(match.events, insight.end, {
      teams: match.teams,
      periodStart: period.start,
      ballRecoveries: match.capabilities.ballRecoveries,
    }).find((i) => i.id === insight.id);
    if (checked && JSON.stringify(checked) === JSON.stringify(insight)) {
      const width = insight.end - insight.start;
      const text = comparisonWording(
        match,
        {
          measurements: [
            {
              key: "current-count",
              label: metric,
              value: insight.current,
              unit: "events",
              eventIds: insight.evidenceIds,
            },
            {
              key: "previous-count",
              label: metric,
              value: insight.previous,
              unit: "events",
              eventIds: insight.baselineIds,
            },
          ],
          windows: [
            {
              id: "current",
              start: insight.start,
              end: insight.end,
              period: period.id,
              boundary: "(start,end]",
            },
            {
              id: "previous",
              start: insight.start - width,
              end: insight.start,
              period: period.id,
              boundary: "(start,end]",
            },
          ],
        },
        match.teams[insight.team].short,
        style,
        insight.end,
      );
      const early = match.events.filter(
        (e) =>
          insight.evidenceIds.includes(e.id) &&
          e.time <= insight.start + width / 2,
      ).length;
      const late = insight.current - early;
      return {
        ...text,
        headline:
          late < early
            ? `${match.teams[insight.team].short}'s rise in ${metricWording(metric, style)} has eased.`
            : text.headline,
        watch:
          style === "analysis"
            ? "Watch the next equal window of recorded pass attempts; counts do not measure possession time or ball speed."
            : "Watch whether the next passes take the team nearer to goal.",
        qualifications:
          late < early
            ? [
                {
                  code: "latest-rate-not-sustained",
                  text:
                    style === "analysis"
                      ? `The rate declined within the current window: ${late} pass attempts in its second half versus ${early} in its first. The increase may be fading.`
                      : `The increase has eased: ${late} attempted passes in the later half of this spell, after ${early} in the first half.`,
                },
              ]
            : [],
      };
    }
  }
  // Fail closed for a legacy sample that no longer matches a verified comparison.
  return {
    headline: "Recorded comparison",
    explanation: "This comparison needs a fresh evidence check.",
    why: "Explore the source actions before drawing a conclusion.",
    watch: "",
    qualifications: [],
  };
}

export function storyDefinition(story: BroadcastStory) {
  if (story.category === "passing-pair")
    return "Completed passes from the same passer to the same recipient; the direction of the pass pairing matters. Receiving space and off-ball movement are not measured.";
  if (["substitute-involvement", "player-involvement"].includes(story.category))
    return "Recorded involvements count passes, carries, shots, recoveries and interceptions by the named player in this sample. For a substitute, only actions ordered after the substitution count.";
  if (story.category === "shot-location")
    return "Mean shot-origin x is the average starting coordinate along a normalized 0–100 pitch, where 100 is the attacking goal line. It is not distance to goal or chance quality.";
  if (["score-change", "full-time"].includes(story.category))
    return "The score counts visible scoring events, credits own goals to the scoring side, and excludes penalty shootouts. Final-score metadata is not used.";
  if (story.category === "recovery-shot")
    return "A successful recovery, interception or tackle followed by a shot by the same team in the same period and possession, within 30 recorded seconds. Minute-only times support order, not exact elapsed seconds.";
  if (story.category === "shot-sequence")
    return "At least four completed passes before a shot in the same team's recorded possession and period. Missing actions or off-ball movement are not reconstructed.";
  const metric = story.hypothesis.measurements.find(
    (m) => m.key === "current-count",
  )?.label;
  if (metric === "ball wins in the attacking third") return BALL_WIN_DEFINITION;
  if (metric === "forward passes")
    return "Passes with an end x more than five points beyond their start x on the normalized 0–100 pitch; attempts include incomplete passes.";
  if (metric === "attacking-third actions")
    return "Passes, carries and shots starting at x ≥ 66.7 on the normalized 0–100 pitch.";
  if (metric === "pass attempts")
    return "All recorded pass attempts, including incomplete passes; not possession time or ball speed.";
  return "Shots are recorded attempts; scoring events determine the score. Source xG, when complete, estimates scoring likelihood and is separate from shot count.";
}

/** Preserve the server's accepted fact selection while rendering known fact types locally. */
export function presentSupportingFact(
  fact: Provenance["facts"][number],
  insight: Insight,
  match: MatchData,
  style: ExplanationStyle,
) {
  const events = match.events.filter(
    (e) => e.time <= insight.end && fact.evidenceIds.includes(e.id),
  );
  if (style === "analysis") return fact.text;
  if (fact.id === "contributors") {
    const actors = [...new Set(events.map((e) => e.actorId).filter(Boolean))];
    return `${events.length} supporting actions involve ${actors.length} players: ${actors.map((id) => person(match, id)).join(", ")}. This only describes their actions with the ball.`;
  }
  if (fact.id === "contributor" && events.length)
    return `${person(match, events[0].actorId)} contributed ${events.length} recorded actions in this sample. This does not measure what they did without the ball.`;
  if (fact.id === "comparison-caution")
    return insight.previous === 0
      ? "There were no matching actions in the earlier spell. Compare the counts; a percentage increase would be misleading."
      : "The two spells last equally long. The change in counts does not prove the team will keep playing this way.";
  if (fact.id === "follow-through") {
    const wins = events.filter((e) => insight.evidenceIds.includes(e.id));
    const followed = wins.filter((win) =>
      events.some(
        (e) =>
          e.type === "shot" &&
          e.team === win.team &&
          e.possessionId === win.possessionId &&
          e.time > win.time,
      ),
    );
    return `${followed.length} of these ${wins.length} ball wins near the opponent’s goal were followed by a shot in the same spell with the ball. This records the sequence, not why it happened.`;
  }
  // Already verified, controlled factual wording, never model-authored prose.
  return fact.text;
}
