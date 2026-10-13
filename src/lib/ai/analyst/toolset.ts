import "server-only";
import {
  matchClock,
  periodAt,
  recordedScore,
  type MatchData,
  type NormalizedEvent,
} from "../../sources/model";
import { visibleEvents, observe, claimEmphasis } from "../director/observer";
import { selectLeadCandidate } from "../director/editorial";
import { packageStory } from "../director/story";
import {
  guidedQuestions,
  presentQuestion,
  questionEvidence,
} from "../director/questions";
import { presentStory } from "../../explanation";
import { z } from "zod";
import {
  createInvestigation,
  EvidenceQueryError,
  toolDefinitions,
  type ToolName,
  type ToolQuery,
} from "../director/tools";
import type { AnalystStyle } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

function windowCounts(events: NormalizedEvent[]) {
  const passes = events.filter((e) => e.type === "pass");
  const known = passes.filter((e) => e.success !== undefined);
  const completed = known.filter((e) => e.success === true).length;
  const shots = events.filter((e) => e.type === "shot");
  const tally = (type: NormalizedEvent["type"]) =>
    events.filter((e) => e.type === type).length;
  return {
    actions: events.filter((e) => e.type !== "possession").length,
    shots: shots.length,
    goals: events.filter((e) => e.scoringTeam).length,
    shotXg: round2(shots.reduce((s, e) => s + (e.xg ?? 0), 0)),
    passes: passes.length,
    completedPasses: completed,
    passCompletionPct: known.length
      ? Math.round((completed / known.length) * 100)
      : null,
    recoveries: tally("recovery"),
    tackles: tally("tackle"),
    interceptions: tally("interception"),
    corners: tally("corner"),
    fouls: tally("foul"),
  };
}

const CLOCK_ARG = /^\d{1,3}(?:\+\d{1,2})?:\d{2}$/;

type Execution = ReturnType<ReturnType<typeof createInvestigation>["execute"]>;

/**
 * The analyst's evidence tools over one match at one cutoff: the bounded
 * investigation session (every window, player and event check, and every
 * refusal) plus the compact projection the analyst reads. Ask the Analyst and
 * the MCP endpoint both use this, so they see the same results and the same
 * refusals, and nothing after the cutoff is visible to either.
 */
export function analystToolset(
  match: MatchData,
  cutoff: number,
  options: { maxTools: number; eventKey: "ref" | "id" },
) {
  const visible = visibleEvents(match, cutoff);
  const byId = new Map(visible.map((e) => [e.id, e]));
  const session = createInvestigation(
    match,
    cutoff,
    "fan",
    {},
    {
      maxTools: options.maxTools,
      // Any window from kickoff: "how was this match decided?" at full time
      // needs the whole match, and "the second half" is longer than 30 minutes.
      maxSpan: cutoff,
    },
  );

  // Short, per-question references keep payloads small and citations checkable.
  // A stateless caller gets the canonical event IDs instead.
  const refs = new Map<string, string>(),
    canonical = new Map<string, string>();
  const ref = (id: string) => {
    let r = refs.get(id);
    if (!r) {
      r = `e${refs.size + 1}`;
      refs.set(id, r);
      canonical.set(r, id);
    }
    return r;
  };
  const playerName = (id: string | null | undefined) =>
    id ? (match.players.find((p) => p.id === id)?.name ?? null) : null;
  const projectEvent = (e: NormalizedEvent) => ({
    ...(options.eventKey === "ref" ? { ref: ref(e.id) } : { id: e.id }),
    clock: matchClock(match, e.time),
    team: match.teams[e.team].short,
    player: playerName(e.actorId),
    type: e.type,
    ...(e.success === undefined ? {} : { success: e.success }),
    ...(e.outcome ? { outcome: e.outcome } : {}),
    ...(e.scoringTeam ? { goal: true } : {}),
    ...(e.xg === undefined ? {} : { xg: round2(e.xg) }),
  });

  // Window tools list events from the whole window, not just the tool's
  // latest-40 sample, so goals early in a long window stay citable.
  const inWindow = (query: ToolQuery, a: number, b: number) =>
    visible.filter(
      (e) =>
        e.time > a &&
        e.time <= b &&
        (!query.team || e.team === query.team) &&
        (!query.playerId || e.actorId === query.playerId),
    );
  const windowTools: ToolName[] = [
    "get_match_events",
    "get_team_statistics",
    "get_player_involvement",
    "get_shot_locations",
    "get_match_context",
  ];

  function project(tool: ToolName, query: ToolQuery, output: Execution) {
    const pool =
      tool === "compare_time_windows"
        ? inWindow(query, 2 * query.start - query.end, query.end)
        : windowTools.includes(tool)
          ? inWindow(query, query.start, query.end).filter(
              (e) => tool !== "get_shot_locations" || e.type === "shot",
            )
          : output.events
              .map((e) => byId.get(e.id))
              .filter((e): e is NormalizedEvent => !!e);
    // Possession markers are bookkeeping, not actions a viewer would recognise.
    const events = pool.filter((e) => e.type !== "possession");
    // The latest 16 actions, plus every goal in the window wherever it falls.
    const latest = new Set(events.slice(-16));
    const shown = events.filter((e) => latest.has(e) || e.scoringTeam);
    const span = {
      from: matchClock(match, query.start),
      to: matchClock(match, query.end),
    };
    const extra = output as Record<string, unknown>;
    const summary: Record<string, unknown> = {};
    if (tool === "compare_time_windows") {
      const width = query.end - query.start;
      // Counts use the full windows, not the truncated event list.
      summary.previousWindow = {
        from: matchClock(match, query.start - width),
        to: span.from,
        ...windowCounts(inWindow(query, query.start - width, query.start)),
      };
      summary.currentWindow = {
        ...span,
        ...windowCounts(inWindow(query, query.start, query.end)),
      };
      summary.windowLength = `${Math.floor(width / 60)} min ${Math.round(width % 60)} sec`;
    } else if (
      tool === "get_team_statistics" ||
      tool === "get_player_involvement" ||
      tool === "get_match_events" ||
      tool === "get_shot_locations"
    ) {
      // Counts use the full retrieved window, not the truncated event list.
      const all = inWindow(query, query.start, query.end);
      summary.window = span;
      summary.counts = windowCounts(
        tool === "get_shot_locations"
          ? all.filter((e) => e.type === "shot")
          : all,
      );
      if (!query.team && !query.playerId)
        summary.byTeam = {
          [match.teams.harbor.short]: windowCounts(
            all.filter((e) => e.team === "harbor"),
          ),
          [match.teams.riverside.short]: windowCounts(
            all.filter((e) => e.team === "riverside"),
          ),
        };
    } else if (tool === "get_match_context") {
      const score = recordedScore(visible);
      summary.score = {
        [match.teams.harbor.short]: score.harbor,
        [match.teams.riverside.short]: score.riverside,
      };
      summary.clock = matchClock(match, cutoff);
    } else if (tool === "compare_shot_routes" && extra.routes) {
      const routes = extra.routes as {
        previous: Record<string, unknown>;
        current: Record<string, unknown>;
      };
      const pick = (w: Record<string, unknown>) => ({
        shots: w.shots,
        shotsAfterHighRecovery: w.linkedShots,
        separatePossessionsWithShots: w.shotPossessions,
        largestShotGroup: w.largestPossession,
        firstHalfOfWindow: w.early,
        secondHalfOfWindow: w.late,
      });
      summary.previousWindow = pick(routes.previous);
      summary.currentWindow = pick(routes.current);
    } else if (tool === "inspect_counter_evidence" && extra.assessments) {
      summary.assessments = (
        extra.assessments as {
          assessment: {
            hypothesis: { description: string };
            verificationStatus: string;
            supportingEvidence: { description: string }[];
            limitingEvidence: { description: string }[];
            contradictoryEvidence: { description: string }[];
          };
        }[]
      ).map(({ assessment: a }) => ({
        reading: a.hypothesis.description,
        status: a.verificationStatus,
        supports: a.supportingEvidence.map((e) => e.description).slice(0, 4),
        limits: a.limitingEvidence.map((e) => e.description).slice(0, 4),
        contradicts: a.contradictoryEvidence
          .map((e) => e.description)
          .slice(0, 4),
      }));
    }
    return {
      tool,
      ...summary,
      totalEvents: output.totalEvents,
      events: shown.map(projectEvent),
      ...(events.length > shown.length
        ? { eventsOmitted: events.length - shown.length }
        : {}),
      verifiedObservations: output.claims.slice(0, 4).map((c) => ({
        headline: c.headline,
        summary: c.brief,
      })),
    };
  }

  /** Run one tool. Throws on a refused or invalid query; see refusalMessage. */
  // An event the agent names by its match time ("59:09"): the action
  // recorded at that clock, preferring a goal or shot. Visible events only,
  // so a future time finds nothing and is refused as before.
  function eventAtClock(clock: string) {
    const at = visible.filter(
      (e) => e.type !== "possession" && matchClock(match, e.time) === clock,
    );
    return (
      at.findLast((e) => e.type === "goal" || e.type === "shot") ?? at.at(-1)
    )?.id;
  }
  function run(name: string, args: unknown) {
    // The analyst sees refs ("e4") and match times, never event IDs. Map a
    // known ref, or a time with a recorded action, to its ID; anything else
    // passes through unchanged and is refused as before.
    const a = args as Record<string, unknown> | null;
    if (
      options.eventKey === "ref" &&
      a &&
      typeof a === "object" &&
      typeof a.eventId === "string"
    ) {
      const id =
        canonical.get(a.eventId) ??
        (CLOCK_ARG.test(a.eventId) ? eventAtClock(a.eventId) : undefined);
      if (id) args = { ...a, eventId: id };
    }
    const executed = session.execute(name, args);
    const tool = name as ToolName;
    const query = session.trace.at(-1)!.query;
    return {
      tool,
      query,
      totalEvents: executed.totalEvents,
      output: project(tool, query, executed),
    };
  }
  return {
    definitions: toolDefinitions(match.id, cutoff),
    run,
    /** Per-question ref ("e4") to canonical event ID. */
    canonical,
  };
}

/** What a refused or failed tool call hands back to the caller, as data. */
export function refusalMessage(error: unknown) {
  return error instanceof EvidenceQueryError
    ? error.message
    : error instanceof z.ZodError || error instanceof SyntaxError
      ? "Invalid arguments. Check matchId, seconds and null filters."
      : "That query returned too much or failed. Try a narrower window.";
}

/**
 * What the analyst knows before any tool call: the match, the clock, the
 * score, the goals so far and the story card with its checked answers, all
 * as of the cutoff. `grounded` is the part whose facts the answer may use.
 */
export function analystBriefing(
  match: MatchData,
  cutoff: number,
  style: AnalystStyle,
) {
  const visible = visibleEvents(match, cutoff);
  const playerName = (id: string | null | undefined) =>
    id ? (match.players.find((p) => p.id === id)?.name ?? null) : null;
  // Context: score, clock, periods and current verified headlines.
  const score = recordedScore(visible);
  const period = periodAt(match, cutoff);
  const headlines = observe(match, cutoff, "fan")
    .slice()
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map((c) => ({ headline: c.headline, summary: c.brief }));
  // The largest equal pair of windows (up to 10 minutes each) inside this half.
  const width = Math.floor(Math.min(600, (cutoff - period.start) / 2));
  const latestEqualWindows =
    width >= 60
      ? {
          previous: {
            startSeconds: cutoff - 2 * width,
            endSeconds: cutoff - width,
            from: matchClock(match, cutoff - 2 * width),
            to: matchClock(match, cutoff - width),
          },
          current: {
            startSeconds: cutoff - width,
            endSeconds: cutoff,
            from: matchClock(match, cutoff - width),
            to: matchClock(match, cutoff),
          },
        }
      : null;
  const goals = visible
    .filter((e) => e.scoringTeam && e.period !== "PS")
    .map((e) => ({
      clock: matchClock(match, e.time),
      team: match.teams[e.scoringTeam!].short,
      scorer: playerName(e.actorId),
      ...(e.ownGoal ? { ownGoal: true } : {}),
    }));
  // The story card and its checked answers, exactly as the viewer sees them.
  let storyCard: Record<string, unknown> | null = null;
  try {
    const lead = selectLeadCandidate(observe(match, cutoff, "fan"));
    if (lead) {
      const story = packageStory(
        lead,
        match,
        cutoff,
        "fan",
        "offline",
        "brief",
        claimEmphasis[lead.category],
      );
      const wording = presentStory(story, match, style);
      storyCard = {
        headline: wording.headline,
        whatChanged: wording.explanation,
        whyItMatters: wording.why,
        checkedAnswers: guidedQuestions(match, cutoff, lead.id)
          .filter((q) => !q.unavailable)
          .flatMap((q) => {
            const evidence = questionEvidence(match, cutoff, {
              intent: q.intent,
              storyId: lead.id,
            });
            if (!evidence) return [];
            const shown = presentQuestion(evidence, match, style);
            return [
              {
                question: q.label,
                answer: shown.answer,
                measurement: shown.measurement,
                windows: shown.windows,
              },
            ];
          }),
      };
    }
  } catch {
    storyCard = null; // Context only; the agent can still investigate.
  }
  const substitutions = visible
    .filter((e) => e.type === "substitution")
    .map((e) => ({
      clock: matchClock(match, e.time),
      team: match.teams[e.team].short,
      on: playerName(e.playerId),
      off: playerName(e.actorId),
    }));
  const groundedContext = {
    storyCard,
    now: {
      goals,
      substitutions,
      cutoffSeconds: cutoff,
      clock: matchClock(match, cutoff),
      period: period.id,
      periodStartSeconds: period.start,
      latestEqualWindows,
      score: {
        [match.teams.harbor.short]: score.harbor,
        [match.teams.riverside.short]: score.riverside,
      },
    },
    currentHeadlines: headlines,
  };
  const context = {
    matchId: match.id,
    competition: match.competition,
    teams: {
      harbor: {
        name: match.teams.harbor.name,
        short: match.teams.harbor.short,
      },
      riverside: {
        name: match.teams.riverside.name,
        short: match.teams.riverside.short,
      },
    },
    periods: match.periods.map((p) => ({
      id: p.id,
      startSeconds: p.start,
      endSeconds: p.end,
      clockAtStart: matchClock(match, p.start),
    })),
    // IDs for tool filters only; a name here is not evidence of involvement.
    roster: match.players.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
    })),
    ...groundedContext,
  };
  return { grounded: groundedContext, context };
}
