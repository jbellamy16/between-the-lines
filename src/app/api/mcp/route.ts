import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { clientAllowed } from "@/lib/ai/analyst/service";
import {
  clientKey,
  createMatchServer,
  demoMatch,
  mcpClientLimit,
  parseMatchTime,
} from "@/lib/mcp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rpcError = (status: number, code: number, message: string) =>
  Response.json(
    { jsonrpc: "2.0", id: null, error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );

/**
 * MCP over Streamable HTTP, stateless and read-only: the analyst's
 * deterministic match tools for the synthetic demo match, as of the match
 * time in `?t=` (seconds or "77:00"; full time when absent). No model calls.
 */
export async function POST(req: Request) {
  if (!clientAllowed(`mcp:${clientKey(req)}`, Date.now(), mcpClientLimit()))
    return rpcError(429, -32000, "Too many requests. Try again in a minute.");
  const match = demoMatch();
  const cutoff = parseMatchTime(new URL(req.url).searchParams.get("t"), match);
  if (cutoff === null)
    return rpcError(
      400,
      -32602,
      `Set the match time as ?t=<seconds> or ?t=<mm:ss>, up to ${match.duration} seconds.`,
    );
  const server = createMatchServer(match, cutoff);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

/** Stateless: no server-initiated stream and no sessions to end. */
const notAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: "POST" } });
export { notAllowed as GET, notAllowed as DELETE };
