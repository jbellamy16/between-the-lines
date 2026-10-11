import { contextFacts } from "../ai/context";
import { eventLabel } from "../event-label";
import { matchContext } from "./context";
import { evidenceEvent } from "./evidence-view";
import { calculateStatistics } from "./analytics";
import {
  detectInsights,
  rankInsights,
  type Insight,
  type Mode,
} from "../intelligence";
import type { EvidencePacket, Fact } from "../ai/evidence";
import {
  periodAt,
  eventClock,
  matchClock,
  recordedScore,
  type MatchData,
  type NormalizedEvent,
} from "./model";
import type { TeamId } from "../match";
export function historicalInsights(match: MatchData, time: number) {
  return detectInsights(match.events, time, {
    teams: match.teams,
    periodStart: periodAt(match, time).start,
    ballRecoveries: match.capabilities.ballRecoveries,
  });
}
export function historicalStats(events: NormalizedEvent[], team: TeamId) {
  return calculateStatistics(events)[team];
}

export function eventDescription(match: MatchData, e: NormalizedEvent) {
  const who =
    match.players.find((p) => p.id === e.playerId)?.name ??
    "Unidentified player";
  if (e.type === "substitution")
    return `${who} on for ${match.players.find((p) => p.id === e.outgoingId)?.name ?? "unidentified player"}${e.source.precision === "minute" ? " (minute precision)" : ""}`;
  if (e.scoringTeam)
    return `${e.ownGoal ? "Own goal" : "Goal"} by ${who} · ${match.teams[e.scoringTeam].name}`;
  return `${eventLabel(e.source.eventType)} · ${who}`;
}
/** A contiguous recorded passage, deliberately not labelled a possession. */
export function historicalSequence(
  match: MatchData,
  selected: NormalizedEvent,
  cutoff: number,
) {
  if (selected.time > cutoff) return [];
  if (
    selected.possessionId !== null &&
    match.capabilities.possession !== "unavailable"
  )
    return match.events.filter(
      (e) =>
        e.order <= selected.order &&
        e.time <= cutoff &&
        e.period === selected.period &&
        e.possessionId === selected.possessionId &&
        e.team === selected.team &&
        ["pass", "carry", "shot", "goal", "touch"].includes(e.type),
    );
  const preceding = match.events.filter(
    (e) =>
      e.time <= cutoff &&
      e.order <= selected.order &&
      e.period === selected.period,
  );
  const index = preceding.findIndex((e) => e.id === selected.id);
  if (index < 0) return [];
  // Chronological context may include both teams and stoppages. It is not a possession.
  const passage = [selected];
  for (let i = index - 1; i >= 0 && passage.length < 12; i--) {
    const event = preceding[i];
    if (selected.time - event.time > 30) break;
    passage.unshift(event);
  }
  return passage;
}
export function historicalEvidence(
  match: MatchData,
  time: number,
  mode: Mode,
  selectedId?: string,
): EvidencePacket {
  if (!Number.isFinite(time) || time < 0 || time > match.duration)
    throw new Error("Invalid replay timestamp");
  const visible = match.events.filter((e) => e.time <= time);
  const detected = historicalInsights(match, time);
  const selected = selectedId
    ? detected.find((i) => i.id === selectedId)
    : undefined;
  if (selectedId && !selected)
    throw new Error("No verified pattern at this timestamp");
  const comparisons = selected ? [selected] : detected;
  const ranking = rankInsights(comparisons, visible, mode);
  const facts: Fact[] = ranking.map(({ insight: i }, n) => ({
    id: i.id,
    kind: "pattern",
    priority: 8 - n,
    text:
      mode === "fan"
        ? `${i.headline}. ${i.explanation}`
        : `${match.teams[i.team].name}: ${i.analyst}`,
    evidenceIds: [...i.evidenceIds, ...i.baselineIds],
    why: i.why,
    watch: i.watch,
  }));
  if (!selected) {
    const score = recordedScore(visible),
      goals = visible.filter((e) => e.scoringTeam);
    facts.unshift({
      id: "score",
      kind: "score",
      priority: 10,
      text: `At ${matchClock(match, time)}, ${match.teams.harbor.name} ${score.harbor}–${score.riverside} ${match.teams.riverside.name}.`,
      evidenceIds: goals.map((e) => e.id),
      why: "Scoring actions reconcile with the published match result; failed saves are not counted as additional goals.",
      watch: "Watch how the next recorded passage develops.",
    });
    facts.push(
      ...contextFacts(matchContext(match, time), (event) =>
        eventClock(match, event),
      ).filter((f) => (comparisons.length ? f.kind !== "abstention" : true)),
    );
  }
  // Descriptive context derived at the same cutoff. No full-match totals enter an AI packet.
  const recent = visible.filter((e) => e.time > time - 900);
  const contributorEvents = selected
    ? visible.filter((e) => selected.evidenceIds.includes(e.id))
    : recent.filter((e) => e.type === "shot");
  const counts = new Map<string, NormalizedEvent[]>();
  contributorEvents
    .filter((e) => e.playerId !== "0")
    .forEach((e) =>
      counts.set(e.playerId, [...(counts.get(e.playerId) ?? []), e]),
    );
  const leader = [...counts].sort((a, b) => b[1].length - a[1].length)[0];
  if (leader)
    facts.push({
      id: "contributor",
      kind: "context",
      priority: 5,
      text: `${match.players.find((p) => p.id === leader[0])?.name ?? "Unidentified player"} contributed ${leader[1].length} ${selected ? selected.metric.toLowerCase() : "shots"} in this sample.`,
      evidenceIds: leader[1].map((e) => e.id),
      why: "Recorded involvements do not measure off-ball influence.",
      watch: "Watch the player's next recorded involvement.",
    });
  const ids = new Set(facts.flatMap((f) => f.evidenceIds));
  if ([...ids].some((id) => !visible.some((e) => e.id === id)))
    throw new Error("Evidence cutoff violation");
  return {
    id: selected?.id ?? `historical-${match.id}-recap-${time}`,
    time,
    mode,
    facts,
    // A goal stays a shot in normalized data; the evidence view marks scoring actions for requiredContext.
    events: visible.filter((e) => ids.has(e.id)).map(evidenceEvent),
    comparisons,
    ranking: ranking.map(({ insight, ...rest }) => ({
      ...rest,
      insight: { id: insight.id },
    })),
    limitations: [match.attribution, ...match.limitations],
    fullTime: time >= match.duration,
  };
}

// Provider-independent entrypoints; historical names remain compatibility aliases.
export const matchInsights = historicalInsights;
export const matchEvidence = historicalEvidence;
export const matchSequence = historicalSequence;
