import { z } from "zod";
import { untilAborted } from "../../src/lib/ai/wait";
import { costs, usageSchema } from "../guided-study/ledger";
import { proposal, DESTINATION, digest } from "./plan";
import type { Store } from "./store";
const bodySchema = z
  .object({
    instructions: z.string(),
    input: z
      .array(
        z.object({ role: z.literal("user"), content: z.string() }).strict(),
      )
      .length(1),
    model: z.literal(proposal.deployment),
    store: z.literal(false),
    max_output_tokens: z.literal(1800),
    parallel_tool_calls: z.literal(false),
    text: z
      .object({
        format: z
          .object({
            type: z.literal("json_schema"),
            name: z.literal("bounded_investigation_plan"),
            strict: z.literal(true),
            schema: z.record(z.string(), z.unknown()),
          })
          .strict(),
      })
      .strict(),
    tools: z
      .array(
        z
          .object({
            type: z.literal("function"),
            name: z.literal("select_evidence_option"),
            description: z.string(),
            strict: z.literal(true),
            parameters: z.record(z.string(), z.unknown()),
          })
          .strict(),
      )
      .length(1)
      .optional(),
    tool_choice: z.literal("auto").optional(),
  })
  .strict();
export function decisions(value: unknown) {
  const output = (value as { output?: unknown[] })?.output;
  if (!Array.isArray(output)) return [];
  return output.slice(0, 10).flatMap((item) => {
    const o = item as {
      type?: string;
      name?: string;
      arguments?: string;
      content?: { type: string; text?: string }[];
    };
    if (o.type === "function_call")
      return [
        {
          kind: "read",
          name: o.name?.slice(0, 100),
          raw: o.arguments?.slice(0, 16000),
        },
      ];
    if (o.type === "message" && Array.isArray(o.content))
      return o.content
        .filter((c) => c.type === "output_text")
        .slice(0, 3)
        .map((c) => ({ kind: "plan", raw: c.text?.slice(0, 16000) }));
    return [];
  });
}
export function guardedTransport(
  store: Store,
  native: typeof fetch,
  maxAttempts = 2,
) {
  let stopped = false,
    attempts = 0,
    pending = false;
  const rows: Record<string, unknown>[] = [];
  const guarded: typeof fetch = async (url, init) => {
    if (stopped || pending || attempts >= Math.min(maxAttempts, 2))
      throw new Error("Evaluation dispatch stopped");
    if (
      String(url) !== DESTINATION ||
      init?.method !== "POST" ||
      init.redirect !== "error" ||
      init.cache !== "no-store" ||
      typeof init.body !== "string" ||
      !init.signal ||
      Buffer.byteLength(init.body) > 131072
    )
      throw new Error("Unexpected evaluation request");
    bodySchema.parse(JSON.parse(init.body));
    init.signal.throwIfAborted();
    pending = true;
    let reserved = false,
      settled = false;
    const started = performance.now();
    const id = attempts + 1;
    try {
      await store("reserve", {
        id,
        payloadDigest: digest(init.body),
        bytes: Buffer.byteLength(init.body),
        reservedNanoUsd: proposal.reserveNanoUsd,
      });
      reserved = true;
      init.signal.throwIfAborted();
      attempts++;
      const dispatchStarted = performance.now();
      const response = await untilAborted(native(url, init), init.signal);
      const value = await untilAborted(response.json(), init.signal);
      const parsed = usageSchema.safeParse(value?.usage);
      const usage = parsed.success ? costs(parsed.data) : null;
      // Unknown usage retains the full reservation. Any HTTP/parse failure ends
      // this run: never turn an uncertain bill into another paid attempt.
      const stop = !response.ok || value?.status !== "completed" || !usage;
      const row = {
        id,
        status: response.status,
        latencyMs: performance.now() - dispatchStarted,
        wallMs: performance.now() - started,
        actualDecisions: decisions(value),
        accountedNanoUsd: usage?.accountedNanoUsd ?? proposal.reserveNanoUsd,
        reportedRateNanoUsd: usage?.reportedRateNanoUsd ?? null,
        usage: usage?.usage ?? null,
        stop,
      };
      rows.push(row);
      await store("settle", row);
      settled = true;
      if (stop) {
        stopped = true;
        throw new Error("Evaluation response rejected");
      }
      return new Response(JSON.stringify(value), {
        status: response.status,
        headers: response.headers,
      });
    } catch {
      stopped = true;
      if (reserved && !settled) {
        // If settlement committed but its acknowledgement was lost, this fails
        // closed rather than rewriting a prior charge or retrying inference.
        const unknown = {
          id,
          usage: null,
          accountedNanoUsd: proposal.reserveNanoUsd,
          reportedRateNanoUsd: null,
          wallMs: performance.now() - started,
          stop: true,
        };
        rows.push(unknown);
        await store("settle", unknown).catch(() => {});
      }
      await store("stop", { reason: "transport-or-accounting" }).catch(
        () => {},
      );
      throw new Error("Evaluation stopped; retain durable reservations");
    } finally {
      pending = false;
    }
  };
  return {
    fetch: guarded,
    rows,
    attempts: () => attempts,
    stopped: () => stopped,
  };
}
