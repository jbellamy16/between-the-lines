import "server-only";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { limit } from "./ai/controls";
export { clientKey } from "./client-key";
import { SyntheticMatchSource } from "./sources/synthetic";
import { matchClock, type MatchData } from "./sources/model";
import {
  analystBriefing,
  analystToolset,
  refusalMessage,
} from "./ai/analyst/toolset";

export const MCP_VERSION = "1.0.0";
export const BRIEFING_TOOL = "get_match_briefing";

/** Requests per client per 10 minutes; a three-question agent demo uses ~25. */
export const mcpClientLimit = () => limit("MCP_PER_CLIENT_LIMIT", 120, 1000);

/** The synthetic demo match, the only match the endpoint serves. */
export const demoMatch = () =>
  new SyntheticMatchSource().read("pressure", { profile: "demo" });

/**
 * The connection's match time from `?t=`: seconds ("4620") or a match clock
 * ("77:00"). Absent means full time; unreadable or past full time is null.
 */
export function parseMatchTime(value: string | null, match: MatchData) {
  if (value === null || value.trim() === "") return match.duration;
  const text = value.trim();
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  const seconds = clock
    ? Number(clock[1]) * 60 + Number(clock[2])
    : /^\d{1,5}$/.test(text)
      ? Number(text)
      : NaN;
  return Number.isSafeInteger(seconds) && seconds <= match.duration
    ? seconds
    : null;
}

const instructions = (match: MatchData, cutoff: number) =>
  `Read-only match intelligence for one synthetic football match (${match.teams.harbor.name} v ${match.teams.riverside.name}), frozen at ${matchClock(match, cutoff)} (${cutoff} seconds from kickoff). Nothing after that moment exists here: windows must end at or before ${cutoff}, and later events are refused, not hidden.
Start with ${BRIEFING_TOOL}: the score, goals, substitutions, periods, roster IDs, the lead story with its checked answers, and suggested equal windows. Times are seconds from kickoff (the second half starts at 2700). compare_time_windows and compare_shot_routes compare [start,end] with the equal window just before it inside one half; compare_shot_routes windows span at most 1800 seconds. Omit team, playerId and eventId when you do not need them; get_recorded_sequence needs an eventId from an earlier result.
Every result is computed from recorded events, with no model in the loop. A refusal comes back as an error explaining which bound was hit; adjust the query and try again. Counts describe what happened, not why.`;

/** One MCP server for one request, pinned to the match at `cutoff`. */
export function createMatchServer(match: MatchData, cutoff: number) {
  const server = new Server(
    { name: "between-the-lines", version: MCP_VERSION },
    {
      capabilities: { tools: { listChanged: false } },
      instructions: instructions(match, cutoff),
    },
  );
  const annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  server.setRequestHandler(ListToolsRequestSchema, () => {
    // Same tools, descriptions and bounds the analyst gets. The match is
    // fixed by the connection, so matchId is supplied server-side and the
    // filters the analyst must send as null are optional here.
    const definitions = analystToolset(match, cutoff, {
      maxTools: 1,
      eventKey: "id",
    }).definitions;
    const { matchId: _matchId, ...properties } =
      definitions[0].parameters.properties;
    void _matchId;
    return {
      tools: [
        {
          name: BRIEFING_TOOL,
          title: "Match briefing",
          description: `Start here. The match as of ${matchClock(match, cutoff)}: score, goals, substitutions, periods, roster IDs for filters, the lead story with its checked answers, and the latest equal windows to compare.`,
          inputSchema: {
            type: "object" as const,
            properties: {},
            additionalProperties: false,
          },
          annotations,
        },
        ...definitions.map((d) => ({
          name: d.name,
          description: d.description,
          inputSchema: {
            type: "object" as const,
            properties,
            required: ["start", "end"],
            additionalProperties: false,
          },
          annotations,
        })),
      ],
    };
  });
  server.setRequestHandler(CallToolRequestSchema, (request): CallToolResult => {
    const { name, arguments: args = {} } = request.params;
    if (name === BRIEFING_TOOL)
      return text(analystBriefing(match, cutoff, "analysis").context);
    try {
      const { output } = analystToolset(match, cutoff, {
        maxTools: 1,
        eventKey: "id",
      }).run(name, {
        matchId: match.id,
        team: null,
        playerId: null,
        eventId: null,
        ...args,
      });
      return text(output);
    } catch (error) {
      // The analyst's refusal, word for word, as data the agent can act on.
      return { ...text({ error: refusalMessage(error) }), isError: true };
    }
  });
  return server;
}

const text = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});
