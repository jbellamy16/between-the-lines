import "server-only";
import { z } from "zod";
import { providerCooldown, reserveProviderAttempt } from "./request-controls";
export type Provider = "openai" | "foundry";
export type ProviderMode = Provider | "offline";
export function configuredProvider(): ProviderMode {
  const selected =
    process.env.AI_PROVIDER ??
    (process.env.FOUNDRY_ENABLED === "true" ? "foundry" : "offline");
  const enabled =
    process.env.AI_ENABLED === "true" ||
    (process.env.AI_ENABLED === undefined &&
      selected === "foundry" &&
      process.env.FOUNDRY_ENABLED === "true");
  if (!enabled) return "offline";
  if (selected === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (
    selected === "foundry" &&
    process.env.FOUNDRY_ENDPOINT &&
    process.env.FOUNDRY_API_KEY &&
    process.env.FOUNDRY_DEPLOYMENT
  )
    return "foundry";
  return "offline";
}
export function modelFor(provider: Provider) {
  return provider === "openai"
    ? process.env.OPENAI_MODEL || "gpt-5.4-mini"
    : process.env.FOUNDRY_DEPLOYMENT || "";
}
export function foundryUrl() {
  const endpoint = new URL(process.env.FOUNDRY_ENDPOINT!);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.port && endpoint.port !== "443") ||
    !["/", "/openai/v1", "/openai/v1/"].includes(endpoint.pathname) ||
    !/(\.openai\.azure\.com|\.services\.ai\.azure\.com)$/.test(
      endpoint.hostname,
    )
  )
    throw new Error("Expected an Azure Foundry endpoint");
  return (
    endpoint.href.replace(/\/$/, "").replace(/\/openai\/v1$/, "") +
    "/openai/v1/responses"
  );
}
const responseSchema = z.object({
  status: z.literal("completed").optional(),
  output: z.array(
    z
      .object({
        type: z.string(),
        name: z.string().nullish(),
        call_id: z.string().nullish(),
        arguments: z.string().nullish(),
        content: z
          .array(z.object({ type: z.string(), text: z.string().nullish() }))
          .nullish(),
      })
      .passthrough(),
  ),
  usage: z
    .object({
      input_tokens: z.number().nonnegative(),
      output_tokens: z.number().nonnegative(),
      input_tokens_details: z
        .object({ cached_tokens: z.number().nonnegative() })
        .optional(),
    })
    .optional(),
});
export const OUTPUT_ALLOWANCE = 1800;
/** Conservative sizing heuristic, not tokenizer output or billable usage.
 * Includes the entire serialized payload, a framing margin and full output. */
export function estimateRequestTokens(payload: string) {
  return (
    Math.ceil(Buffer.byteLength(payload, "utf8") / 3) + 256 + OUTPUT_ALLOWANCE
  );
}
export function providerPayload(
  provider: Provider,
  body: Record<string, unknown>,
) {
  return JSON.stringify({
    ...body,
    model: modelFor(provider),
    store: false,
    max_output_tokens: OUTPUT_ALLOWANCE,
    ...(provider === "openai" ? { reasoning: { effort: "low" } } : {}),
  });
}
export class ProviderFailure extends Error {
  constructor(
    readonly category:
      | "rate_limit"
      | "quota"
      | "authentication"
      | "configuration"
      | "unavailable"
      | "transport"
      | "timeout"
      | "invalid_request"
      | "invalid_response",
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(`Provider unavailable (${category})`);
  }
}
export function retryAfter(
  headers: Headers,
  now = Date.now(),
): number | undefined {
  const delays: number[] = [];
  for (const name of ["retry-after-ms", "x-ms-retry-after-ms", "retry-after"]) {
    const raw = headers.get(name)?.trim();
    if (!raw) continue;
    const number = Number(raw);
    const delay = Number.isFinite(number)
      ? number * (name === "retry-after" ? 1000 : 1)
      : name === "retry-after"
        ? Date.parse(raw) - now
        : NaN;
    // Larger guidance is never shortened. Unsafe numeric values prevent an
    // in-workflow retry by reserving a long cooldown, rather than becoming zero.
    if (Number.isFinite(delay) && delay >= 0)
      delays.push(Math.min(Math.ceil(delay), Number.MAX_SAFE_INTEGER - now));
  }
  return delays.length ? Math.max(...delays) : undefined;
}
export async function providerResponse(
  provider: Provider,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  options: {
    deadline?: number;
    maxAttempts?: number;
    onAttempt?: () => void;
  } = {},
) {
  const payload = providerPayload(provider, body);
  if (Buffer.byteLength(payload, "utf8") > 131072)
    throw new ProviderFailure("invalid_request");
  let url: string;
  try {
    url =
      provider === "openai"
        ? "https://api.openai.com/v1/responses"
        : foundryUrl();
  } catch {
    throw new ProviderFailure("configuration");
  }
  const deadline = Math.min(options.deadline ?? Infinity, Date.now() + 55000);
  const wholeSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(Math.max(0, deadline - Date.now())),
  ]);
  const maxAttempts = Math.max(1, Math.min(2, options.maxAttempts ?? 1));
  const transportAllowance = signal ? 18000 : 25000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await reserveProviderAttempt(
      estimateRequestTokens(payload),
      deadline,
      wholeSignal,
      transportAllowance,
    );
    wholeSignal.throwIfAborted();
    let res: Response;
    const transportSignal = AbortSignal.any([
      wholeSignal,
      AbortSignal.timeout(transportAllowance),
    ]);
    try {
      options.onAttempt?.();
      res = await fetch(url, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(provider === "openai"
            ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
            : { "api-key": process.env.FOUNDRY_API_KEY! }),
        },
        body: payload,
        signal: transportSignal,
      });
    } catch {
      signal?.throwIfAborted();
      // An interrupted/ambiguous request may be billable. Never retry it.
      throw new ProviderFailure(
        transportSignal.aborted ? "timeout" : "transport",
      );
    }
    if (!res.ok) {
      const guidance = retryAfter(res.headers);
      let quota = false;
      if (res.status === 429) {
        try {
          const value = await res.json();
          quota = ["insufficient_quota", "billing_hard_limit_reached"].includes(
            value?.error?.code,
          );
        } catch {
          /* Only allow-listed categories are retained; never error text. */
        }
      } else {
        await res.body?.cancel().catch(() => {});
      }
      const failure = new ProviderFailure(
        res.status === 429
          ? quota
            ? "quota"
            : "rate_limit"
          : [401, 403].includes(res.status)
            ? "authentication"
            : res.status >= 500
              ? "unavailable"
              : "invalid_request",
        res.status,
        guidance,
      );
      if (res.status === 429) {
        // Shared cooldown applies to every instance, even when this workflow
        // cannot retry. Pacing/accounting is rechecked before the next attempt.
        const delay =
          Math.max(guidance ?? 2000, 1000) + Math.floor(Math.random() * 251);
        await providerCooldown(delay);
        if (
          !quota &&
          attempt < maxAttempts &&
          Date.now() + delay + transportAllowance <= deadline
        )
          continue;
      }
      throw failure;
    }
    let value: unknown;
    try {
      value = await res.json();
    } catch {
      signal?.throwIfAborted();
      throw new ProviderFailure(
        transportSignal.aborted ? "timeout" : "invalid_response",
      );
    }
    const parsed = responseSchema.safeParse(value);
    if (!parsed.success) throw new ProviderFailure("invalid_response");
    wholeSignal.throwIfAborted();
    return { ...parsed.data, attempts: attempt };
  }
  throw new ProviderFailure("unavailable");
}
