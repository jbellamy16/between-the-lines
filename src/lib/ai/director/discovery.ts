import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Mode, StoryPreferences } from "../../intelligence";
import {
  periodAt,
  recordedScore,
  type MatchData,
  type NormalizedEvent,
} from "../../sources/model";
import { canLead, editorialGroup, evidenceOverlaps } from "./editorial";
import { comparisonWindow } from "../../sources/metrics";
import {
  DIRECTOR_VERSION,
  EVIDENCE_LIMITS,
  observe,
  possessionBefore,
  visibleEvents,
  type Candidate,
  type ObservationOmission,
} from "./observer";
import {
  evaluateHypothesis,
  validIdentity,
  type ObservationWindow,
} from "./hypothesis";
import {
  QUESTION_VERSION,
  questionEvidence,
  questionIntentSchema,
  questionLabels,
  type Question,
  type QuestionEvidence,
} from "./questions";
import {
  createInvestigation,
  EvidenceQueryError,
  publicEvent,
  type ToolName,
  type ToolQuery,
} from "./tools";
import {
  assessmentEventIds,
  deliveryCoverage,
  sourceCoverage,
} from "./discovery-coverage";

export const DISCOVERY_VERSION = "evidence-discovery-1.1.0";
export const DISCOVERY_LIMITS = Object.freeze({
  developments: 24,
  options: 96,
  playersPerTeam: 8,
  sequencesPerTeam: 6,
  characters: 48000,
  displayedEvents: 40,
});
export type DiscoveryContext = {
  audience?: "local" | "external";
  mode?: Mode;
  preferences?: StoryPreferences;
};
type Purpose =
  | "resolve-priority"
  | "distinguish-concentration"
  | "challenge-continuation"
  | "check-opponent"
  | "check-quality"
  | "inspect-challenge"
  | "illustrate-sequence";
type Action =
  | { kind: "tool"; tool: ToolName; query: ToolQuery }
  | { kind: "question"; question: Question };
type RegisteredOption = {
  id: string;
  developmentId: string | null;
  hypothesisId: string | null;
  purpose: Purpose;
  label: string;
  action: Action;
  windows: ObservationWindow[];
  unavailable: string | null;
};
/** Scopes are interned once; raw queries remain server-owned. */
export type DiscoveryOption = Omit<RegisteredOption, "action" | "windows"> & {
  tool: ToolName | "guided_question";
  intent: Question["intent"] | null;
  team: Candidate["team"] | null;
  playerId: string | null;
  eventId: string | null;
  windowRefs: number[];
};
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requestSchema = z
  .object({
    indexId: z.string().length(64),
    optionId: z.string().min(1).max(80),
  })
  .strict();
export type DiscoveryRequest = z.infer<typeof requestSchema>;

function snapshot(input: MatchData, cutoff: number, context: DiscoveryContext) {
  if (
    context.audience !== undefined &&
    !["local", "external"].includes(context.audience)
  )
    throw new EvidenceQueryError("Unknown discovery audience");
  if (
    context.audience !== "local" &&
    input.provenance.redistribution === "restricted"
  )
    throw new EvidenceQueryError(
      "External evidence discovery is disabled for restricted sources",
    );
  const visible = visibleEvents(input, cutoff);
  const period = periodAt(input, cutoff);
  if (!period || cutoff < period.start || cutoff > period.end)
    throw new EvidenceQueryError(
      "Discovery cutoff must lie inside a recorded period",
    );
  if (
    new Set(visible.map((e) => e.id)).size !== visible.length ||
    visible.some((e) => !validIdentity(input, e))
  )
    throw new EvidenceQueryError("Invalid canonical evidence identity");
  const allowed = new Set(visible.map((e) => e.id));
  // Neither hidden future records nor arbitrary provider metadata influence the index identity.
  return structuredClone({
    ...input,
    status: cutoff === input.duration ? "finished" : "in_progress",
    finalScore: recordedScore(visible),
    provenance: { ...input.provenance, raw: {} },
    events: visible.map((e) => ({
      ...e,
      qualifiers: {},
      source: { ...e.source, raw: {} },
      relatedEvents: e.relatedEvents.filter((id) => allowed.has(id)),
    })),
  }) as MatchData;
}
function questionSummary(e: QuestionEvidence) {
  return {
    intent: e.question.intent,
    availability: e.availability,
    reason: e.reason,
    verdict: e.verdict,
    windows: e.windows,
    measurements: e.measurements.map(({ eventIds, ...m }) => ({
      ...m,
      evidenceCount: eventIds.length,
    })),
    qualifications: e.qualifications,
    interpretations: e.comparison?.interpretations ?? [],
    routeComplete: e.comparison?.routes.complete ?? null,
    // Preserve already computed baseline verdicts, including unknown quality.
    baseline:
      e.comparison?.baseline.map((b) => ({
        intent: b.question.intent,
        availability: b.availability,
        verdict: b.verdict,
        reason: b.reason,
      })) ?? [],
  };
}
function catalogue(
  input: MatchData,
  cutoff: number,
  context: DiscoveryContext,
) {
  const match = snapshot(input, cutoff, context);
  const source = {
    provider: match.provenance.provider,
    sourceMatchId: match.provenance.sourceMatchId,
    revision: match.provenance.revision,
    adapterVersion: match.provenance.adapterVersion,
    redistribution: match.provenance.redistribution,
    attribution: match.attribution,
  };
  const mode = context.mode ?? "fan";
  const preferences = structuredClone(context.preferences ?? {});
  const audience = context.audience ?? "external";
  const prefixDigest = hash({
    matchId: match.id,
    source,
    capabilities: match.capabilities,
    periods: match.periods,
    duration: match.duration,
    teams: match.teams,
    players: match.players,
    limitations: match.limitations,
    events: match.events,
  });
  const id = hash({
    version: DISCOVERY_VERSION,
    director: DIRECTOR_VERSION,
    questions: QUESTION_VERSION,
    prefixDigest,
    cutoff,
    audience,
    mode,
    preferences,
  });
  const omissions: ObservationOmission[] = [];
  // Preferences affect the existing shortlist, never the available evidence universe.
  const candidates = observe(
    match,
    cutoff,
    "fan",
    {},
    { unranked: true, onOmission: (item) => omissions.push(item) },
  ).sort(
    (a, b) =>
      b.rank - a.rank || b.timestamp - a.timestamp || a.id.localeCompare(b.id),
  );
  const shortlistIds = observe(match, cutoff, mode, preferences).map(
    (c) => c.id,
  );
  const options: RegisteredOption[] = [];
  const questions = new Map<string, QuestionEvidence>();
  const add = (option: Omit<RegisteredOption, "id">) => {
    const optionId = `option:${hash(option.action).slice(0, 32)}`;
    if (!options.some((item) => item.id === optionId))
      options.push({ id: optionId, ...option });
    return optionId;
  };
  const period = periodAt(match, cutoff);
  const window: ObservationWindow = {
    id: "recent",
    start: Math.max(period.start, cutoff - 900),
    end: cutoff,
    period: period.id,
    boundary: "(start,end]",
  };
  const baseQuery: ToolQuery = {
    matchId: match.id,
    start: window.start,
    end: cutoff,
    team: null,
    playerId: null,
    eventId: null,
  };
  const addTool = (
    tool: ToolName,
    query: ToolQuery,
    windows: ObservationWindow[],
    label: string,
    purpose: Purpose = "resolve-priority",
    unavailable: string | null = null,
    candidate?: Candidate,
  ) =>
    add({
      developmentId: candidate?.id ?? null,
      hypothesisId: candidate ? `${candidate.id}:hypothesis` : null,
      purpose,
      label,
      action: { kind: "tool", tool, query },
      windows,
      unavailable,
    });
  addTool(
    "get_match_context",
    baseQuery,
    [window],
    "Visible score and source context",
  );
  const scopeOmissions = { players: 0, sequences: 0 };
  for (const team of ["harbor", "riverside"] as const) {
    const query = { ...baseQuery, team };
    addTool(
      "get_team_statistics",
      query,
      [window],
      `${team}: recorded activity`,
    );
    addTool(
      "get_shot_locations",
      query,
      [window],
      `${team}: recorded shot origins`,
      "resolve-priority",
    );
    const { width, start, previousStart } = comparisonWindow(
      cutoff,
      period.start,
    );
    const windows: ObservationWindow[] = [
      { ...window, id: "previous", start: previousStart, end: start },
      { ...window, id: "current", start, end: cutoff },
    ];
    const comparisonUnavailable =
      width < 300
        ? "Two complete same-period windows of at least 300 seconds are not yet available."
        : null;
    addTool(
      "compare_time_windows",
      { ...query, start },
      windows,
      `${team}: equal-window activity`,
      "resolve-priority",
      comparisonUnavailable,
    );
    addTool(
      "compare_shot_routes",
      { ...query, start },
      windows,
      `${team}: shot routes and concentration`,
      "distinguish-concentration",
      comparisonUnavailable,
    );
    const recent = match.events.filter(
      (e) =>
        e.period === period.id &&
        e.team === team &&
        e.time > window.start &&
        e.time <= cutoff,
    );
    const players = [
      ...new Set(
        [...recent].reverse().flatMap((e) => (e.actorId ? [e.actorId] : [])),
      ),
    ];
    scopeOmissions.players += Math.max(
      0,
      players.length - DISCOVERY_LIMITS.playersPerTeam,
    );
    for (const playerId of players.slice(0, DISCOVERY_LIMITS.playersPerTeam))
      addTool(
        "get_player_involvement",
        { ...query, playerId },
        [window],
        `${playerId}: recorded involvement`,
      );
    const shots = recent.filter((e) => e.type === "shot");
    scopeOmissions.sequences += Math.max(
      0,
      shots.length - DISCOVERY_LIMITS.sequencesPerTeam,
    );
    for (const shot of shots.slice(-DISCOVERY_LIMITS.sequencesPerTeam)) {
      const sequence = possessionBefore(match, match.events, shot);
      const start = sequence[0]?.time ?? shot.time;
      const unavailable =
        match.capabilities.possession === "unavailable" ||
        shot.possessionId === null
          ? "Source possession identity is unavailable."
          : shot.time - start > 1800
            ? "Complete possession exceeds the 1800-second query bound."
            : null;
      addTool(
        "get_recorded_sequence",
        { ...query, start, end: shot.time, eventId: shot.id },
        [
          {
            id: "possession",
            start,
            end: shot.time,
            period: shot.period,
            boundary: "[start,end]",
          },
        ],
        `Possession ending at ${shot.id}`,
        "illustrate-sequence",
        unavailable,
      );
    }
  }
  const rejectedDevelopmentIds: string[] = [];
  const developments = candidates.flatMap((candidate) => {
    const assessment = evaluateHypothesis(match, cutoff, candidate);
    if (
      assessment.verificationStatus === "unsupported" ||
      assessment.verificationChecks.some((c) => !c.passed)
    ) {
      rejectedDevelopmentIds.push(candidate.id);
      return [];
    }
    const refs = new Set(assessmentEventIds(assessment));
    const evidence = match.events.filter((e) => refs.has(e.id));
    const start = Math.min(
      cutoff,
      ...assessment.windows.map((w) => w.start),
      ...evidence.map((e) => e.time),
    );
    const end = Math.max(
      start,
      ...assessment.windows.map((w) => w.end),
      ...evidence.map((e) => e.time),
    );
    const assessmentSize = JSON.stringify({
      claimId: candidate.id,
      assessment,
    }).length;
    const unavailable =
      end - start > 1800
        ? "Complete assessment requires more than the 1800-second query bound."
        : assessmentSize > 20000
          ? "Complete assessment exceeds the 20000-character assessment bound."
          : null;
    const optionIds = [
      addTool(
        "inspect_counter_evidence",
        {
          ...baseQuery,
          start,
          end,
          claimId: candidate.id,
          boundary: "[start,end]",
        },
        assessment.windows,
        "Complete support and challenges for this development",
        "inspect-challenge",
        unavailable,
        candidate,
      ),
    ];
    const answers: ReturnType<typeof questionSummary>[] = [];
    for (const intent of questionIntentSchema.options) {
      const question: Question = { intent, storyId: candidate.id };
      const answer = questionEvidence(match, cutoff, question);
      if (!answer) continue;
      const purpose: Purpose =
        intent === "shot-surge-explanations"
          ? "distinguish-concentration"
          : intent === "chance-quality"
            ? "check-quality"
            : intent === "opponent-improvement"
              ? "check-opponent"
              : "challenge-continuation";
      const optionId = add({
        developmentId: candidate.id,
        hypothesisId: assessment.hypothesis.id,
        purpose,
        label: questionLabels[intent],
        action: { kind: "question", question },
        windows: answer.windows,
        unavailable: null,
      });
      questions.set(optionId, answer);
      optionIds.push(optionId);
      answers.push(questionSummary(answer));
    }
    // Questions often reuse the same measurements and mandatory qualifications.
    // Intern whole values instead of spending the index budget on repeated prose.
    const measurements: ReturnType<typeof questionSummary>["measurements"] = [];
    const qualifications: string[] = [];
    const questionSummaries = answers.map(
      ({ measurements: values, qualifications: text, ...answer }) => ({
        ...answer,
        measurementRefs: values.map((value) => {
          const existing = measurements.findIndex(
            (m) => JSON.stringify(m) === JSON.stringify(value),
          );
          return existing < 0 ? measurements.push(value) - 1 : existing;
        }),
        qualificationRefs: text.map((value) => {
          const existing = qualifications.indexOf(value);
          return existing < 0 ? qualifications.push(value) - 1 : existing;
        }),
      }),
    );
    return [
      {
        id: candidate.id,
        category: candidate.category,
        team: candidate.team,
        timestamp: candidate.timestamp,
        headline: candidate.headline,
        statistics: candidate.statistics,
        editorial: {
          canLead: canLead(candidate),
          group: editorialGroup(candidate),
          incompatibleIds: candidates
            .filter(
              (other) =>
                other.id !== candidate.id &&
                (editorialGroup(other) === editorialGroup(candidate) ||
                  evidenceOverlaps(candidate, other)),
            )
            .map((other) => other.id),
          seenCount: candidate.evidenceIds.filter((id) =>
            preferences.seenEvidenceIds?.includes(id),
          ).length,
          preferredPlayerEvidenceCount: candidate.evidenceIds.filter((id) =>
            match.events.some(
              (e) => e.id === id && e.actorId === preferences.player,
            ),
          ).length,
        },
        evidence: {
          count: candidate.evidenceIds.length,
          firstEventId: candidate.evidenceIds[0] ?? null,
          lastEventId: candidate.evidenceIds.at(-1) ?? null,
        },
        inShortlist: shortlistIds.includes(candidate.id),
        hypothesisId: assessment.hypothesis.id,
        verificationStatus: assessment.verificationStatus,
        windows: assessment.windows,
        supportingEvidence: assessment.supportingEvidence.map(
          ({ eventIds, code }) => ({
            code,
            evidenceCount: eventIds.length,
          }),
        ),
        limitingEvidence: assessment.limitingEvidence.map(
          ({ eventIds, code }) => ({
            code,
            evidenceCount: eventIds.length,
          }),
        ),
        contradictoryEvidence: assessment.contradictoryEvidence.map(
          ({ eventIds, ...item }) => ({
            ...item,
            evidenceCount: eventIds.length,
          }),
        ),
        missingInformation: assessment.missingInformation,
        assessmentReferences: deliveryCoverage(refs.size, evidence.length),
        evidenceDelivery:
          "summary; retrieve a whole assessment or question bundle" as const,
        measurements,
        qualifications,
        questions: questionSummaries,
        optionIds,
        optionCoverage: deliveryCoverage(optionIds.length, optionIds.length),
      },
    ];
  });
  // Whole entries are removed, never individual mandatory qualifications.
  const selected = developments.slice(0, DISCOVERY_LIMITS.developments);
  const windows: ObservationWindow[] = [];
  const summaries = new Map(
    options.map(({ action, windows: scopes, ...option }) => [
      option.id,
      {
        ...option,
        tool:
          action.kind === "tool" ? action.tool : ("guided_question" as const),
        intent: action.kind === "question" ? action.question.intent : null,
        team:
          action.kind === "tool"
            ? action.query.team
            : candidates.find((c) => c.id === option.developmentId)!.team,
        playerId: action.kind === "tool" ? action.query.playerId : null,
        eventId: action.kind === "tool" ? action.query.eventId : null,
        windowRefs: scopes.map((window) => {
          const existing = windows.findIndex(
            (w) => JSON.stringify(w) === JSON.stringify(window),
          );
          return existing < 0 ? windows.push(window) - 1 : existing;
        }),
      },
    ]),
  );
  const index = {
    version: DISCOVERY_VERSION,
    id,
    prefixDigest,
    matchId: match.id,
    cutoff,
    source,
    audience,
    mode,
    preferences: {
      ...preferences,
      seenEvidenceIds: undefined,
      seenEvidenceCount: preferences.seenEvidenceIds?.length ?? 0,
      seenEvidenceDigest: hash(preferences.seenEvidenceIds ?? []),
    },
    capabilities: match.capabilities,
    score: recordedScore(match.events),
    sourceCoverage: sourceCoverage(match, match.events),
    limits: DISCOVERY_LIMITS,
    limitations: [
      ...match.limitations,
      ...EVIDENCE_LIMITS,
      "This finite catalogue is not an exhaustive account of play. Missing source observations remain unknown.",
      "Sequence context may precede an observation window; its exact possession bounds are returned separately.",
    ],
    coverage: {
      developments: deliveryCoverage(developments.length, selected.length),
      omittedDevelopmentIds: [] as string[],
      rejectedDevelopmentIds,
      options: deliveryCoverage(options.length, 0),
      observerOmissions: omissions,
      scopeOmissions,
    },
    developments: selected,
    windows,
    options: [] as DiscoveryOption[],
  };
  const refresh = () => {
    const included = new Set(index.developments.map((d) => d.id));
    index.options = options
      .filter((o) => o.developmentId === null || included.has(o.developmentId))
      .slice(0, DISCOVERY_LIMITS.options)
      .map((o) => summaries.get(o.id)!);
    const includedOptions = new Set(index.options.map((o) => o.id));
    index.developments = index.developments.map((d) => ({
      ...d,
      optionIds: d.optionIds.filter((id) => includedOptions.has(id)),
      optionCoverage: deliveryCoverage(
        d.optionCoverage.eligible,
        d.optionIds.filter((id) => includedOptions.has(id)).length,
      ),
    }));
    index.coverage.developments = deliveryCoverage(
      developments.length,
      index.developments.length,
    );
    index.coverage.omittedDevelopmentIds = developments
      .filter((d) => !included.has(d.id))
      .map((d) => d.id);
    index.coverage.options = deliveryCoverage(
      options.length,
      index.options.length,
    );
  };
  refresh();
  while (
    JSON.stringify(index).length > DISCOVERY_LIMITS.characters &&
    index.developments.length
  ) {
    index.developments.pop();
    refresh();
  }
  while (
    JSON.stringify(index).length > DISCOVERY_LIMITS.characters &&
    index.options.length
  ) {
    index.options.pop();
    index.coverage.options = deliveryCoverage(
      options.length,
      index.options.length,
    );
  }
  if (JSON.stringify(index).length > DISCOVERY_LIMITS.characters)
    throw new EvidenceQueryError(
      "Discovery metadata exceeds the response bound",
    );
  return { index, match, questions, options };
}

/** Shared policy-neutral catalogue. No provider, transport, cache, or agent runner. */
export function buildEvidenceIndex(
  match: MatchData,
  cutoff: number,
  context: DiscoveryContext = {},
) {
  return catalogue(match, cutoff, context).index;
}
export type EvidenceIndex = ReturnType<typeof buildEvidenceIndex>;

/** Resolve only an advertised option against a freshly reconstructed exact prefix. */
export function executeEvidenceOption(
  input: MatchData,
  cutoff: number,
  raw: unknown,
  context: DiscoveryContext = {},
) {
  return executeCatalogue(catalogue(input, cutoff, context), raw);
}

/** Request-local memoization shared by offline policies; no provider or allowance ledger.
 * The snapshot and cached bundles are private and copies cross the boundary.
 * Verification must construct a new reader from the canonical source.
 */
export function createEvidenceReader(
  input: MatchData,
  cutoff: number,
  context: DiscoveryContext = {},
) {
  const state = catalogue(input, cutoff, context);
  const cache = new Map<string, ReturnType<typeof executeCatalogue>>();
  return {
    index: structuredClone(state.index),
    read(raw: unknown) {
      const request = requestSchema.parse(raw);
      if (request.indexId !== state.index.id)
        throw new EvidenceQueryError("Stale discovery index");
      let result = cache.get(request.optionId);
      if (!result) {
        result = executeCatalogue(state, request);
        cache.set(request.optionId, result);
      }
      return structuredClone(result);
    },
  };
}

function executeCatalogue(state: ReturnType<typeof catalogue>, raw: unknown) {
  const request = requestSchema.parse(raw);
  const { index, match, questions, options } = state;
  const cutoff = index.cutoff;
  if (request.indexId !== index.id)
    throw new EvidenceQueryError(
      "Stale discovery index or changed source/cutoff/context",
    );
  const summary = index.options.find((o) => o.id === request.optionId);
  if (!summary)
    throw new EvidenceQueryError("Unknown or omitted discovery option");
  const option = options.find((o) => o.id === summary.id)!;
  if (option.unavailable) throw new EvidenceQueryError(option.unavailable);
  const visible = new Map(match.events.map((e) => [e.id, e]));
  const allowed = new Set(visible.keys());
  let payload: Record<string, unknown>;
  let events: NormalizedEvent[];
  let bundleStatus: "complete" | "partial" | "unavailable" = "complete";
  let missingInformation: string[] = [];
  let routeReferences: {
    eligible: number;
    returned: number;
    omitted: number;
  } | null = null;
  if (option.action.kind === "question") {
    const evidence = questions.get(option.id)!;
    routeReferences = evidence.comparison?.routes.referenceCoverage ?? null;
    events = evidence.eventIds.map((id) => visible.get(id)!);
    bundleStatus = evidence.comparison?.routes.suppressed
      ? "unavailable"
      : evidence.availability === "unavailable" ||
          evidence.comparison?.routes.complete === false ||
          evidence.comparison?.baseline.some(
            (e) => e.availability === "unavailable",
          )
        ? "partial"
        : "complete";
    missingInformation = [
      ...new Set([
        ...(evidence.reason ? [evidence.reason] : []),
        ...(evidence.comparison
          ? [
              ...evidence.comparison.routes.previous.unavailable,
              ...evidence.comparison.routes.current.unavailable,
              ...evidence.comparison.baseline.flatMap((e) =>
                e.reason ? [e.reason] : [],
              ),
            ]
          : []),
      ]),
    ];
    payload = { question: evidence };
  } else {
    const { tool, query } = option.action;
    const result = createInvestigation(
      match,
      cutoff,
      "fan",
      {},
      { unranked: true },
    ).execute(tool, query);
    const { events: _displayed, ...rest } = result;
    payload = rest;
    const routes = payload.routes as
      import("./shot-routes").ShotRoutes | undefined;
    const assessments = payload.assessments as
      | { claimId: string; assessment: ReturnType<typeof evaluateHypothesis> }[]
      | undefined;
    if (routes) {
      routeReferences = routes.referenceCoverage;
      const refs = new Set(routes.eventIds);
      events = match.events.filter((e) => refs.has(e.id));
      bundleStatus = routes.suppressed
        ? "unavailable"
        : routes.complete
          ? "complete"
          : "partial";
      missingInformation = [
        ...routes.previous.unavailable,
        ...routes.current.unavailable,
      ];
    } else if (tool === "get_recorded_sequence") {
      events = possessionBefore(
        match,
        match.events,
        visible.get(query.eventId!)!,
      );
    } else {
      const start =
        tool === "compare_time_windows"
          ? query.start - (query.end - query.start)
          : query.start;
      events = match.events.filter(
        (e) =>
          (query.boundary === "[start,end]"
            ? e.time >= start
            : e.time > start) &&
          e.time <= query.end &&
          (!query.team || e.team === query.team) &&
          (!query.playerId || e.actorId === query.playerId) &&
          (tool !== "get_shot_locations" || e.type === "shot"),
      );
    }
    if (assessments) {
      if (!assessments.length) bundleStatus = "unavailable";
      missingInformation = assessments.flatMap(
        (a) => a.assessment.missingInformation,
      );
    }
  }
  if (events.some((e) => !e))
    throw new EvidenceQueryError("Missing canonical evidence");
  const displayed = events.slice(-DISCOVERY_LIMITS.displayedEvents);
  const result = {
    version: DISCOVERY_VERSION,
    indexId: index.id,
    prefixDigest: index.prefixDigest,
    matchId: match.id,
    cutoff,
    source: index.source,
    option: summary,
    resolvedAction: option.action,
    windows: option.windows,
    coverage: {
      bundle: bundleStatus,
      routeReferences,
      eventDetails: deliveryCoverage(events.length, displayed.length),
      source: sourceCoverage(match, events),
      missingInformation: [...new Set(missingInformation)],
    },
    payload,
    events: displayed.map((e) => ({
      ...publicEvent(e, allowed, match),
      order: e.order,
      periodSeconds: e.periodSeconds,
      source: {
        ...publicEvent(e, allowed, match).source,
        matchId: e.source.matchId,
        teamId: e.source.teamId,
      },
    })),
    limitations: index.limitations,
  };
  if (JSON.stringify(result).length > DISCOVERY_LIMITS.characters)
    throw new EvidenceQueryError(
      "Complete discovery evidence exceeds the response bound",
    );
  return result;
}
