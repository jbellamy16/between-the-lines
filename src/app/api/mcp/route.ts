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
export { notAllowed as DELETE };

/**
 * MCP clients get the same bare 405 as before. A person who opens the address
 * in a browser gets a short page saying what it is and how to connect.
 */
export function GET(req?: Request) {
  if (!req?.headers.get("accept")?.includes("text/html")) return notAllowed();
  // The server only sees its own bind address (Next rewrites Host and
  // X-Forwarded-Host), so the page fills in the address the visitor used.
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Between the Lines MCP server</title><style>body{margin:0;background:#0b0f14;color:#f8fafc;font:16px/1.55 system-ui,sans-serif}main{max-width:640px;margin:48px auto;padding:0 20px}h1{font-size:24px;margin:0 0 8px}p,li{color:#cbd5e1}code{background:#1d2936;padding:2px 6px;border-radius:6px;color:#f8fafc;word-break:break-all}a{color:#4ade80}</style></head><body><main><h1>Between the Lines MCP server</h1><p>This address is for AI agents, not browsers. It serves the match analyst's read-only evidence tools over the Model Context Protocol (Streamable HTTP, POST).</p><p>Connect from any MCP client. In VS Code, run <strong>MCP: Add Server</strong>, choose HTTP, and enter:</p><p><code id="endpoint">/api/mcp?t=77:00</code></p><script>document.getElementById("endpoint").textContent=location.origin+"/api/mcp?t=77:00"</script><p>Then ask GitHub Copilot in agent mode to catch you up on the match. <code>?t=</code> pins the match time (seconds or mm:ss); tools can't see anything later.</p><p><a href="/">Open the match centre</a></p></main></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
