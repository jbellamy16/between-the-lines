import { z } from "zod";
import {
  recordedScore,
  matchClock,
  type MatchData,
  type NormalizedEvent,
} from "../../sources/model";
import {
  EVIDENCE_LIMITS,
  claimEmphasis,
  observe,
  possessionBefore,
  visibleEvents,
  type Claim,
  type Candidate,
} from "./observer";
import type { Mode, StoryPreferences } from "../../intelligence";
import { editorialGroup, evidenceOverlaps } from "./editorial";
import { evaluateHypothesis } from "./hypothesis";

export const toolNames = [
  "get_match_events",
  "get_team_statistics",
  "get_player_involvement",
  "compare_time_windows",
  "get_recorded_sequence",
  "get_shot_locations",
  "get_match_context",
  "inspect_counter_evidence",
] as const;
export type ToolName = (typeof toolNames)[number];
export class EvidenceQueryError extends Error {}
const querySchema = z
  .object({
    matchId: z.string().min(1).max(160),
    start: z.number().finite().nonnegative(),
    end: z.number().finite().nonnegative(),
    team: z.enum(["harbor", "riverside"]).nullable(),
    playerId: z.string().max(160).nullable(),
    eventId: z.string().max(200).nullable(),
  })
  .strict();
export type ToolQuery = z.infer<typeof querySchema>;
export function toolDefinitions(matchId: string, cutoff: number) {
  return toolNames.map((name) => ({
    type: "function",
    name,
    strict: true,
    description: `${name.replaceAll("_", " ")}. Read-only, at or before ${cutoff}. Choose a window of at most 1800 seconds. Windows are (start,end]. compare_time_windows compares this interval with the immediately preceding equal interval in one period. get_recorded_sequence requires eventId; get_player_involvement requires playerId. inspect_counter_evidence independently evaluates hypotheses and counter-evidence only when the complete assessment evidence falls in the query; optional eventId selects claims containing that event. Null means no filter. Results capped at 40 events, with full aggregate counts and explicit truncation.`,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        matchId: { type: "string", enum: [matchId] },
        start: { type: "number", minimum: 0, maximum: cutoff },
        end: { type: "number", minimum: 0, maximum: cutoff },
        team: { type: ["string", "null"], enum: ["harbor", "riverside", null] },
        playerId: { type: ["string", "null"] },
        eventId: { type: ["string", "null"] },
      },
      required: ["matchId", "start", "end", "team", "playerId", "eventId"],
    },
  }));
}
/** Never serialize source.raw, finalScore, future-related IDs, or full-match metadata. */
export function publicEvent(
  e: NormalizedEvent,
  allowed: Set<string>,
  match: MatchData,
) {
  return {
    id: e.id,
    time: e.time,
    period: e.period,
    team: e.team,
    actorId: e.actorId,
    playerName: match.players.find((p) => p.id === e.actorId)?.name ?? null,
    type: e.type,
    position: e.position,
    end: e.end,
    success: e.success,
    recipientId: match.capabilities.passRecipients ? e.recipientId : undefined,
    possessionId:
      match.capabilities.possession === "unavailable" ? null : e.possessionId,
    relatedEvents: e.relatedEvents.filter((id) => allowed.has(id)),
    source: {
      provider: e.source.provider,
      eventId: e.source.eventId,
      precision: e.source.precision,
    },
  };
}
function counts(events: NormalizedEvent[]) {
  const passes = events.filter((e) => e.type === "pass");
  return {
    actions: events.length,
    shots: events.filter((e) => e.type === "shot").length,
    passes: passes.length,
    completedPasses: passes.filter((e) => e.success === true).length,
    knownPassOutcomes: passes.filter((e) => e.success !== undefined).length,
  };
}
export function createInvestigation(
  match: MatchData,
  cutoff: number,
  mode: Mode,
  preferences: StoryPreferences = {},
) {
  const visible = visibleEvents(match, cutoff),
    allowed = new Set(visible.map((e) => e.id));
  const candidates = observe(match, cutoff, mode, preferences);
  const claims = new Map<string, Claim>();
  const trace: {
    tool: ToolName;
    query: ToolQuery;
    eventIds: string[];
    claimIds: string[];
    truncated: boolean;
  }[] = [];
  function execute(name: string, raw: unknown) {
    if (!(toolNames as readonly string[]).includes(name))
      throw new EvidenceQueryError("Unknown evidence tool");
    if (trace.length >= 4) throw new Error("Tool budget exhausted");
    const query = querySchema.parse(raw);
    if (
      query.matchId !== match.id ||
      query.end > cutoff ||
      query.start > query.end ||
      query.end - query.start > 1800
    )
      throw new EvidenceQueryError("Invalid evidence window");
    if (
      query.playerId &&
      !match.players.some(
        (p) =>
          p.id === query.playerId && (!query.team || p.team === query.team),
      )
    )
      throw new EvidenceQueryError("Unknown player identity");
    if (query.eventId && !visible.some((e) => e.id === query.eventId))
      throw new EvidenceQueryError("Unknown or future event");
    let events = visible.filter(
      (e) =>
        e.time > query.start &&
        e.time <= query.end &&
        (!query.team || e.team === query.team) &&
        (!query.playerId || e.actorId === query.playerId),
    );
    let extra: Record<string, unknown> = {};
    const derived: Candidate[] = [];
    const addDerived = (
      category: Candidate["category"],
      team: Candidate["team"],
      support: NormalizedEvent[],
      headline: string,
      brief: string,
      detail: string,
      statistics: Claim["statistics"],
      suffix: string,
    ) => {
      if (
        !support.length ||
        support.length > 120 ||
        support.at(-1)!.time < cutoff - 900
      )
        return;
      const id = `${match.id}:${category}:${team}:${query.playerId ?? "team"}:${query.start}:${query.end}:${suffix}`;
      derived.push({
        id,
        category,
        team,
        timestamp: support.at(-1)!.time,
        importance: "pattern",
        rank: 6,
        headline,
        brief,
        detail,
        statistics,
        evidenceIds: support.map((e) => e.id),
        limitations: [
          ...EVIDENCE_LIMITS,
          "Investigation-selected sample; descriptive evidence, not a statistical test.",
        ],
      });
    };
    if (name === "get_recorded_sequence") {
      const selected = visible.find((e) => e.id === query.eventId);
      if (
        !selected ||
        selected.time > query.end ||
        selected.time < query.start ||
        (query.team && selected.team !== query.team)
      )
        throw new EvidenceQueryError("Invalid sequence anchor");
      if (
        match.capabilities.possession === "unavailable" ||
        selected.possessionId === null
      )
        throw new EvidenceQueryError(
          "Possession sequences unsupported by source",
        );
      events = possessionBefore(match, visible, selected);
      extra = {
        sequenceKind: match.capabilities.possession,
        anchor: selected.id,
      };
    }
    if (name === "get_player_involvement" && !query.playerId)
      throw new EvidenceQueryError("Player required");
    if (name === "get_shot_locations")
      events = events.filter((e) => e.type === "shot");
    if (name === "compare_time_windows") {
      const width = query.end - query.start;
      const period = match.periods.find(
        (p) => query.start - width >= p.start && query.end <= p.end,
      );
      if (!width || !period)
        throw new EvidenceQueryError(
          "Comparison requires equal complete windows in one period",
        );
      const prior = visible.filter(
        (e) =>
          e.time > query.start - width &&
          e.time <= query.start &&
          (!query.team || e.team === query.team) &&
          (!query.playerId || e.actorId === query.playerId),
      );
      extra = {
        current: counts(events),
        previous: counts(prior),
        windows: [
          [query.start - width, query.start],
          [query.start, query.end],
        ],
        period: period.id,
      };
      if (query.team) {
        const actor = query.playerId
          ? match.players.find((p) => p.id === query.playerId)!.name
          : match.teams[query.team].short;
        for (const type of ["shot", "pass"] as const) {
          const current = events.filter((e) => e.type === type),
            previous = prior.filter((e) => e.type === type);
          if (
            current.length >= (type === "shot" ? 2 : 8) &&
            current.length - previous.length >= (type === "shot" ? 2 : 5)
          ) {
            const label = type === "shot" ? "shots" : "pass attempts";
            addDerived(
              "window-comparison",
              query.team,
              [...previous, ...current],
              `${actor}: ${label} in focus`,
              `${actor} recorded ${current.length} ${label} from ${matchClock(match, query.start)} to ${matchClock(match, query.end)}, compared with ${previous.length} in the preceding equal window.`,
              `${actor}: ${current.length} ${label} from ${matchClock(match, query.start)} to ${matchClock(match, query.end)}, versus ${previous.length} from ${matchClock(match, query.start - width)} to ${matchClock(match, query.start)}. Each window is ${width} seconds in ${period.id}. Selection is exploratory; this is not statistical significance or causation.`,
              [
                {
                  label: `Current ${label}`,
                  value: current.length,
                  unit: `events / ${width} seconds`,
                },
                {
                  label: `Previous ${label}`,
                  value: previous.length,
                  unit: `events / ${width} seconds`,
                },
              ],
              type,
            );
          }
        }
      }
      events = [...prior, ...events];
    }
    if (name === "get_match_context")
      extra = {
        score: recordedScore(visible),
        capabilities: match.capabilities,
        clockSeconds: cutoff,
      };
    if (name === "get_team_statistics" || name === "get_player_involvement")
      extra = {
        statistics: counts(events),
        window: [query.start, query.end],
        passCompletionDenominator:
          "Only passes with known success values; unknown outcomes are excluded.",
      };
    if (name === "get_player_involvement" && query.playerId) {
      const actor = match.players.find((p) => p.id === query.playerId)!;
      const support = events.filter((e) =>
        ["pass", "carry", "shot", "recovery", "interception"].includes(e.type),
      );
      const shots = support.filter((e) => e.type === "shot").length,
        passes = support.filter((e) => e.type === "pass").length;
      if (support.length >= 4 && (shots > 0 || passes >= 5))
        addDerived(
          "player-involvement",
          actor.team,
          support,
          `${actor.name}: recorded contributions`,
          `${actor.name} recorded ${passes} pass ${passes === 1 ? "attempt" : "attempts"} and ${shots} ${shots === 1 ? "shot" : "shots"} from ${matchClock(match, query.start)} to ${matchClock(match, query.end)}.`,
          `${actor.name} recorded ${support.length} passes, carries, shots, recoveries or interceptions from ${matchClock(match, query.start)} to ${matchClock(match, query.end)}, including ${passes} pass ${passes === 1 ? "attempt" : "attempts"} and ${shots} ${shots === 1 ? "shot" : "shots"}. This counts recorded actions, not touches, time in possession or off-ball influence.`,
          [
            { label: "Pass attempts", value: passes, unit: "events" },
            { label: "Shots", value: shots, unit: "events" },
          ],
          "actions",
        );
    }
    for (const c of derived)
      if (!candidates.some((prior) => prior.id === c.id)) candidates.push(c);
    const returned = events.slice(-40),
      retrieved = new Set(events.map((e) => e.id));
    // Claim registry only admits computations whose entire evidence was examined by this query.
    let supported = candidates.filter(
      (c) =>
        c.evidenceIds.every((id) => retrieved.has(id)) &&
        (name !== "inspect_counter_evidence" ||
          !query.eventId ||
          c.evidenceIds.includes(query.eventId)),
    );
    if (name === "inspect_counter_evidence") {
      const eligibleAssessments = supported
        .map((candidate) => ({
          claimId: candidate.id,
          assessment: evaluateHypothesis(match, cutoff, candidate),
        }))
        .filter(({ assessment }) =>
          [
            ...assessment.supportingEvidence,
            ...assessment.limitingEvidence,
            ...assessment.contradictoryEvidence,
            ...assessment.measurements,
            ...assessment.verificationChecks,
          ].every((item) => item.eventIds.every((id) => retrieved.has(id))),
        );
      // Whole assessments are kept intact; select an anchor to inspect an omitted one.
      // The event list and claims still share the same bounded response budget.
      const assessments: typeof eligibleAssessments = [];
      let assessmentBytes = 0;
      for (const item of eligibleAssessments) {
        const bytes = JSON.stringify(item).length;
        if (assessments.length >= 2 || assessmentBytes + bytes > 20000)
          continue;
        assessments.push(item);
        assessmentBytes += bytes;
      }
      const assessed = new Set(assessments.map((item) => item.claimId));
      supported = supported.filter((candidate) => assessed.has(candidate.id));
      extra = {
        assessments,
        totalAssessments: eligibleAssessments.length,
        assessmentsTruncated: assessments.length < eligibleAssessments.length,
        assessmentSelection:
          "At most two complete assessments within 20000 characters. Use eventId to select an omitted claim's evidence anchor.",
      };
    }
    supported.forEach((c) => claims.set(c.id, c));
    const entry = {
      tool: name as ToolName,
      query,
      eventIds: returned.map((e) => e.id),
      claimIds: supported.map((c) => c.id),
      truncated: events.length > 40,
    };
    trace.push(entry);
    const output = {
      matchId: match.id,
      cutoff,
      source: {
        provider: match.provenance.provider,
        revision: match.provenance.revision,
        adapterVersion: match.provenance.adapterVersion,
        attribution: match.attribution,
      },
      totalEvents: events.length,
      truncated: entry.truncated,
      events: returned.map((e) => publicEvent(e, allowed, match)),
      claims: supported.map((claim) => ({
        ...claim,
        allowedEmphasis: claimEmphasis[claim.category],
        editorialGroup: editorialGroup(claim),
        incompatibleClaimIds: candidates
          .filter(
            (other) =>
              other.id !== claim.id &&
              claims.has(other.id) &&
              (editorialGroup(other) === editorialGroup(claim) ||
                evidenceOverlaps(claim, other)),
          )
          .map((other) => other.id),
      })),
      ...extra,
      limitations: [...match.limitations, ...EVIDENCE_LIMITS],
    };
    if (JSON.stringify(output).length > 48000)
      throw new Error("Evidence response too large");
    return output;
  }
  return { execute, claims, trace, candidates };
}
