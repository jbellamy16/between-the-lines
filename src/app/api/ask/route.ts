import { json, readInput } from "@/lib/ai/service";
import { SyntheticMatchSource } from "@/lib/sources/synthetic";
import {
  analystEnabled,
  askAnalyst,
  clientAllowed,
} from "@/lib/ai/analyst/service";
import {
  analystRequestSchema,
  type AnalystStreamLine,
} from "@/lib/ai/analyst/types";
import { offlineAnalyst } from "@/lib/ai/analyst/agent";
import { clientKey } from "@/lib/client-key";
export const runtime = "nodejs";

export async function GET() {
  return json({ enabled: analystEnabled() });
}

/**
 * Ask the Analyst. Streams NDJSON: one `step` line per agent action as it
 * happens, then a single `result` line.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  try {
    if (
      origin &&
      new URL(origin).host !==
        (req.headers.get("host") ?? new URL(req.url).host)
    )
      return json({ error: "Same-origin request required" }, 403);
  } catch {
    return json({ error: "Invalid origin" }, 403);
  }
  let input;
  try {
    input = await readInput(req, analystRequestSchema);
  } catch {
    return json({ error: "Invalid question" }, 400);
  }
  const match = new SyntheticMatchSource().read(input.scenario, {
    profile: input.profile,
  });
  if (input.time > match.duration)
    return json({ error: "Invalid cutoff" }, 400);
  const cutoff = Math.floor(input.time);
  const client = clientKey(req);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: AnalystStreamLine) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        } catch {
          /* client went away */
        }
      };
      try {
        const result =
          analystEnabled() && !clientAllowed(client)
            ? offlineAnalyst(
                match,
                cutoff,
                input.question,
                "unavailable",
                "You've asked a lot of questions in a short time. Try again in a few minutes.",
              )
            : await askAnalyst(match, cutoff, input.question, input.style, {
                signal: req.signal,
                onStep: (step) => send({ type: "step", step }),
              });
        send({ type: "result", result });
      } catch {
        /* aborted by the client */
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
