import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  requestDirector,
  cachedDirectorResult,
} from "../src/lib/ai/director/client-cache";
import type { DirectorResult } from "../src/lib/ai/director/runner";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  vi.stubEnv("AI_REDIS_URL", "");
  vi.stubEnv("AI_USAGE_STORE", "memory");
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_PROVIDER", "foundry");
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://example.openai.azure.com");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  vi.stubEnv("FOUNDRY_DEPLOYMENT", "test-deployment");
  vi.stubEnv("AI_MINUTE_LIMIT", "4");
  vi.stubEnv("AI_HOURLY_LIMIT", "30");
  vi.stubEnv("AI_DAILY_LIMIT", "60");
  vi.stubEnv("AI_TOTAL_LIMIT", "100");
  vi.stubEnv("AI_REQUEST_MINUTE_LIMIT", "10");
  vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", "10000");
  return {
    ...(await import("../src/lib/ai/providers")),
    ...(await import("../src/lib/ai/request-controls")),
    ...(await import("../src/lib/ai/controls")),
  };
}
const completed = () =>
  Response.json({
    status: "completed",
    output: [],
    usage: { input_tokens: 12, output_tokens: 2 },
  });
const options = () => ({ deadline: Date.now() + 55000, maxAttempts: 2 });
const tick = () => vi.advanceTimersByTimeAsync(0);

describe("per-attempt controls with mocked transport and real local accounting", () => {
  it("uses the increased allocation by default, clamps overrides and preserves lower limits", async () => {
    const api = await setup();
    vi.stubEnv("AI_REQUEST_MINUTE_LIMIT", undefined);
    vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", undefined);
    expect(api.requestLimits()).toEqual({ rpm: 30, tpm: 30000 });
    vi.stubEnv("AI_REQUEST_MINUTE_LIMIT", "100");
    vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", "100000");
    expect(api.requestLimits()).toEqual({ rpm: 100, tpm: 100000 });
    vi.stubEnv("AI_REQUEST_MINUTE_LIMIT", "1000");
    vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", "1000000");
    expect(api.requestLimits()).toEqual({ rpm: 300, tpm: 300000 });
    vi.stubEnv("AI_REQUEST_MINUTE_LIMIT", "10");
    vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", "10000");
    expect(api.requestLimits()).toEqual({ rpm: 10, tpm: 10000 });
  });
  it("fits three substantial requests at the new capacity while retaining token and durable budget limits", async () => {
    const api = await setup();
    vi.stubEnv("AI_REQUEST_MINUTE_LIMIT", undefined);
    vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", undefined);
    vi.stubEnv("AI_TOTAL_LIMIT", "3");
    const times: number[] = [];
    const transport = vi.fn(async () => {
      times.push(Date.now());
      return completed();
    });
    vi.stubGlobal("fetch", transport);
    const body = { input: "a".repeat(20000) };
    const estimated = api.estimateRequestTokens(
      api.providerPayload("foundry", body),
    );
    expect(estimated * 3).toBeGreaterThan(10000);
    expect(estimated * 3).toBeLessThanOrEqual(30000);
    expect(estimated * 4).toBeGreaterThan(30000);
    for (let i = 0; i < 3; i++) {
      const pending = api.providerResponse("foundry", body);
      await vi.advanceTimersByTimeAsync(2000);
      await pending;
    }
    expect(times).toHaveLength(3);
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(2000);
    await expect(api.providerResponse("foundry", body)).rejects.toMatchObject({
      category: "budget",
    });
    vi.stubEnv("AI_TOTAL_LIMIT", "4"); // Test-only allowance to isolate the rolling ceiling.
    await expect(api.providerResponse("foundry", body)).rejects.toMatchObject({
      category: "capacity",
    });
    expect(transport).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60000);
    vi.stubEnv("AI_TOTAL_LIMIT", "3");
    await expect(api.providerResponse("foundry", body)).rejects.toMatchObject({
      category: "budget",
    });
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it("honors the longest Retry-After guidance and charges both attempts", async () => {
    const api = await setup();
    vi.stubEnv("AI_TOTAL_LIMIT", "2");
    const times: number[] = [];
    const transport = vi.fn(async () => {
      times.push(Date.now());
      return times.length === 1
        ? new Response("secret provider text", {
            status: 429,
            headers: { "retry-after-ms": "7200", "retry-after": "8" },
          })
        : completed();
    });
    vi.stubGlobal("fetch", transport);
    const promise = api.providerResponse("foundry", {}, undefined, options());
    await tick();
    expect(transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(7999);
    expect(transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(252);
    expect((await promise).attempts).toBe(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(8000);
    await expect(api.providerResponse("foundry", {})).rejects.toMatchObject({
      category: "budget",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("preserves safe failure status/guidance without reading sensitive text into errors", async () => {
    const api = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("secret api-key private error", {
            status: 429,
            headers: { "retry-after": "120" },
          }),
      ),
    );
    const error = await api
      .providerResponse("foundry", {}, undefined, options())
      .catch((e) => e);
    expect(error).toMatchObject({
      category: "rate_limit",
      status: 429,
      retryAfterMs: 120000,
    });
    expect(String(error)).not.toMatch(/secret|api-key|private/);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    await expect(api.providerResponse("foundry", {})).rejects.toMatchObject({
      category: "capacity",
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 400, 500, 503])(
    "does not retry ambiguous or permanent HTTP %i",
    async (status) => {
      const api = await setup();
      const transport = vi.fn(async () => new Response("secret", { status }));
      vi.stubGlobal("fetch", transport);
      await expect(
        api.providerResponse("foundry", {}, undefined, options()),
      ).rejects.toMatchObject({ status });
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it("does not retry an exhausted provider billing quota", async () => {
    const api = await setup();
    const transport = vi.fn(async () =>
      Response.json(
        { error: { code: "insufficient_quota", message: "private" } },
        { status: 429 },
      ),
    );
    vi.stubGlobal("fetch", transport);
    await expect(
      api.providerResponse("foundry", {}, undefined, options()),
    ).rejects.toMatchObject({ category: "quota" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("bounds repeated 429s and retains the unknown-usage reservations", async () => {
    const api = await setup();
    vi.stubEnv("AI_TOTAL_LIMIT", "2");
    const transport = vi.fn(async () => new Response("", { status: 429 }));
    vi.stubGlobal("fetch", transport);
    const outcome = api
      .providerResponse("foundry", {}, undefined, options())
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(6500);
    expect(await outcome).toMatchObject({ category: "rate_limit" });
    expect(transport).toHaveBeenCalledTimes(2);
    await expect(api.providerResponse("foundry", {})).rejects.toMatchObject({
      category: "budget",
    });
  });
  it("never replays a dropped connection or incomplete response and never refunds it", async () => {
    const api = await setup();
    vi.stubEnv("AI_TOTAL_LIMIT", "1");
    const transport = vi.fn().mockRejectedValue(new Error("ambiguous secret"));
    vi.stubGlobal("fetch", transport);
    await expect(
      api.providerResponse("foundry", {}, undefined, options()),
    ).rejects.toMatchObject({ category: "transport" });
    await expect(api.providerResponse("foundry", {})).rejects.toMatchObject({
      category: "budget",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("honors the token ceiling including unchanged output allowance before sending", async () => {
    const api = await setup();
    const transport = vi.fn(async () => completed());
    vi.stubGlobal("fetch", transport);
    const body = { input: "a".repeat(18000) };
    expect(
      JSON.parse(api.providerPayload("foundry", body)).max_output_tokens,
    ).toBe(1800);
    await api.providerResponse("foundry", body);
    await expect(api.providerResponse("foundry", body)).rejects.toMatchObject({
      category: "capacity",
    });
    expect(transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    await api.providerResponse("foundry", body);
    expect(transport).toHaveBeenCalledTimes(2);
    await expect(
      api.providerResponse("foundry", { input: "a".repeat(31000) }),
    ).rejects.toMatchObject({ category: "budget" });
  });
  it("paces concurrent workflows and reserves tokens atomically", async () => {
    const api = await setup();
    const times: number[] = [];
    const transport = vi.fn(async () => {
      times.push(Date.now());
      return completed();
    });
    vi.stubGlobal("fetch", transport);
    const tasks = Array.from({ length: 5 }, () =>
      api.providerResponse("foundry", {}).catch((e) => e),
    );
    await vi.advanceTimersByTimeAsync(37000);
    const outcomes = await Promise.all(tasks);
    // At least 2056 estimated tokens per request, so five cannot fit in 10k.
    expect(transport).toHaveBeenCalledTimes(4);
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(6000);
    expect(outcomes.filter((x) => x.category === "capacity")).toHaveLength(1);
  });
  it("cancels a rate wait without sending another HTTP attempt", async () => {
    const api = await setup();
    const controller = new AbortController();
    const transport = vi.fn(
      async () =>
        new Response("", { status: 429, headers: { "retry-after": "20" } }),
    );
    vi.stubGlobal("fetch", transport);
    const result = api
      .providerResponse("foundry", {}, controller.signal, options())
      .catch((e) => e);
    await tick();
    controller.abort();
    await tick();
    expect((await result).name).toBe("AbortError");
    await vi.advanceTimersByTimeAsync(30000);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("stops a timed out in-flight request without a retry", async () => {
    const api = await setup();
    // AbortSignal.timeout uses the platform clock: replace just that primitive
    // with an aborting timer so virtual time covers the transport deadline.
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const c = new AbortController();
      setTimeout(
        () => c.abort(new DOMException("Timed out", "TimeoutError")),
        ms,
      );
      return c.signal;
    });
    const transport = vi.fn(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason),
            { once: true },
          ),
        ),
    );
    vi.stubGlobal("fetch", transport);
    const result = api
      .providerResponse("foundry", {}, new AbortController().signal, options())
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(18001);
    expect(await result).toMatchObject({ category: "timeout" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("fails closed for unavailable controls, invalid limits and insufficient deadline", async () => {
    const api = await setup();
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", "invalid");
    await expect(api.providerResponse("foundry", {})).rejects.toMatchObject({
      category: "budget",
    });
    vi.stubEnv("NODE_ENV", "production");
    await expect(api.providerResponse("foundry", {})).rejects.toMatchObject({
      category: "controls",
    });
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AI_TOKEN_MINUTE_LIMIT", "10000");
    await expect(
      api.providerResponse("foundry", {}, undefined, {
        deadline: Date.now() + 17000,
      }),
    ).rejects.toMatchObject({ category: "capacity" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("parses seconds, HTTP dates and millisecond headers conservatively", async () => {
    const { retryAfter } = await setup();
    expect(
      retryAfter(
        new Headers({
          "retry-after": new Date(Date.now() + 15000).toUTCString(),
        }),
      ),
    ).toBe(15000);
    expect(
      retryAfter(
        new Headers({ "retry-after": "2", "x-ms-retry-after-ms": "4500" }),
      ),
    ).toBe(4500);
    expect(
      retryAfter(new Headers({ "retry-after": "garbage" })),
    ).toBeUndefined();
  });
});

it("coalesces server subscribers, isolates cancellation and releases failed locks", async () => {
  const api = await setup();
  let finish!: (value: string) => void;
  const generate = vi.fn(
    (signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        finish = resolve;
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  );
  const a = new AbortController(),
    b = new AbortController();
  const first = api
    .controlledNarration("same", generate, a.signal)
    .catch((e) => e);
  const second = api.controlledNarration("same", generate, b.signal);
  await tick();
  a.abort();
  await tick();
  finish("verified");
  expect((await first).name).toBe("AbortError");
  expect((await second).result).toBe("verified");
  expect(generate).toHaveBeenCalledTimes(1);
  expect((await api.controlledNarration("same", generate)).cached).toBe(true);
  const cancelled = new AbortController();
  const third = api
    .controlledNarration("cancelled", generate, cancelled.signal)
    .catch((e) => e);
  await tick();
  cancelled.abort();
  await third;
  await tick();
  await vi.advanceTimersByTimeAsync(5001);
  expect(
    (await api.controlledNarration("cancelled", async () => "recovered"))
      .result,
  ).toBe("recovered");
});

it("returns accurate transient fallback, then recovers the same server context without caching the failure", async () => {
  const api = await setup();
  const { directMatch } = await import("../src/lib/ai/director/runner");
  const m = new SyntheticMatchSource().read("pressure");
  const transport = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("private", {
        status: 429,
        headers: { "retry-after": "60" },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: '{"decision":"abstain","stories":[]}',
              },
            ],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", transport);
  const failed = await directMatch(m, 4200, "fan");
  expect(failed.source).toBe("offline");
  expect(failed.failure).toMatchObject({
    category: "rate_limit",
    retryAfterMs: 60000,
  });
  expect(failed.metrics).toMatchObject({ requests: 1, estimatedCostUsd: null });
  expect(failed.stories[0].validation).toBe("verified");
  expect(failed.notice).toContain("rate-limited");
  expect(JSON.stringify(failed)).not.toContain("private");
  await vi.advanceTimersByTimeAsync(61000);
  const result = await directMatch(m, 4200, "fan");
  expect(result.source).toBe("foundry");
  expect(result.metrics.requests).toBe(1);
  expect((await directMatch(m, 4200, "fan")).metrics.cached).toBe(true);
  expect(transport).toHaveBeenCalledTimes(2);
  expect(api.requestLimits()).toEqual({ rpm: 10, tpm: 10000 });
});

const clientMatch = () =>
  structuredClone(new SyntheticMatchSource().read("pressure"));
const clientResult = (source = "foundry", context = "model-1") =>
  ({
    source,
    cacheContext: context,
    stories: [],
    provenance: { cutoff: 4200 },
  }) as unknown as DirectorResult;
it("evicts client fallbacks and rejected requests while reusing success and separating model contexts", async () => {
  const m = clientMatch();
  let context = "model-1",
    attempt = 0;
  const transport = vi.fn(async (url) =>
    url === "/api/insights"
      ? Response.json({ directorContext: context })
      : ++attempt === 1
        ? Response.json({
            ...clientResult("offline"),
            failure: { category: "rate_limit" },
          })
        : attempt === 2
          ? new Response("", { status: 503 })
          : Response.json(clientResult("foundry", context)),
  );
  vi.stubGlobal("fetch", transport);
  expect((await requestDirector(m, 4200, "fan", {})).source).toBe("offline");
  expect(cachedDirectorResult(m, 4200, "fan", {}, context)).toBeNull();
  await expect(requestDirector(m, 4200, "fan", {})).rejects.toThrow();
  expect((await requestDirector(m, 4200, "fan", {})).source).toBe("foundry");
  await requestDirector(m, 4200, "fan", {});
  expect(attempt).toBe(3);
  context = "model-2";
  await requestDirector(m, 4200, "fan", {});
  expect(attempt).toBe(4);
});
it("shares a browser request while one subscriber leaves, and retries after all subscribers cancel", async () => {
  const m = clientMatch();
  let release!: () => void;
  const transport = vi.fn((url, init) =>
    url === "/api/insights"
      ? Promise.resolve(Response.json({ directorContext: "model-1" }))
      : new Promise<Response>((resolve, reject) => {
          release = () => resolve(Response.json(clientResult()));
          init.signal.addEventListener(
            "abort",
            () => reject(init.signal.reason),
            { once: true },
          );
        }),
  );
  vi.stubGlobal("fetch", transport);
  const a = new AbortController(),
    b = new AbortController();
  const first = requestDirector(m, 4200, "fan", {}, a.signal).catch((e) => e),
    second = requestDirector(m, 4200, "fan", {}, b.signal);
  await tick();
  a.abort();
  release();
  expect((await first).name).toBe("AbortError");
  expect((await second).source).toBe("foundry");
  expect(
    transport.mock.calls.filter(([url]) => url === "/api/director"),
  ).toHaveLength(1);
  const next = new AbortController();
  const cancelled = requestDirector(m, 4200, "analyst", {}, next.signal).catch(
    (e) => e,
  );
  await tick();
  next.abort();
  await cancelled;
  await tick();
  const retry = requestDirector(m, 4200, "analyst", {});
  await tick();
  release();
  expect((await retry).source).toBe("foundry");
  expect(
    transport.mock.calls.filter(([url]) => url === "/api/director"),
  ).toHaveLength(3);
});

it("the workflow counts retry attempts in its three-request ceiling and never treats recovered unknown usage as free", async () => {
  await setup();
  const controls = await import("../src/lib/ai/request-controls");
  // This test isolates the workflow ceiling; timing/accounting have separate
  // real-control tests above. Every HTTP response below is a fixture.
  vi.spyOn(controls, "reserveProviderAttempt").mockResolvedValue();
  vi.spyOn(controls, "providerCooldown").mockResolvedValue();
  const { investigate } = await import("../src/lib/ai/director/runner");
  const match = new SyntheticMatchSource().read("pressure");
  let turn = 0;
  const transport = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    turn++;
    if (turn === 1) return new Response("", { status: 429 });
    if (turn === 2)
      return Response.json({
        status: "completed",
        usage: { input_tokens: 50, output_tokens: 20 },
        output: [
          {
            type: "function_call",
            name: "inspect_match_evidence",
            call_id: "followup",
            arguments: JSON.stringify({
              tool: "get_match_context",
              matchId: match.id,
              start: 2700,
              end: 4200,
              team: null,
              playerId: null,
              eventId: null,
            }),
          },
        ],
      });
    expect(body.tools).toBeUndefined();
    const claim = JSON.parse(body.input[0].content).evidence.claims.find(
      (c: { category: string }) => c.category === "recovery-shot",
    );
    return Response.json({
      status: "completed",
      usage: { input_tokens: 70, output_tokens: 20 },
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                decision: "publish",
                stories: [
                  {
                    claimId: claim.id,
                    form: "brief",
                    emphasis: claim.allowedEmphasis,
                  },
                ],
              }),
            },
          ],
        },
      ],
    });
  });
  vi.stubGlobal("fetch", transport);
  const result = await investigate(match, 4200, "fan", {}, "foundry");
  expect(result.source).toBe("foundry");
  expect(result.metrics.requests).toBe(3);
  expect(result.provenance.usage?.complete).toBe(false);
  expect(result.metrics.estimatedCostUsd).toBeNull();
  expect(result.stories[0].validation).toBe("verified");
  expect(transport).toHaveBeenCalledTimes(3);
  expect(controls.reserveProviderAttempt).toHaveBeenCalledTimes(3);
});

it("expires the whole workflow inside its lock lease even if generation does not settle", async () => {
  const api = await setup();
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const c = new AbortController();
    setTimeout(
      () => c.abort(new DOMException("Timed out", "TimeoutError")),
      ms,
    );
    return c.signal;
  });
  const result = api
    .controlledNarration("deadline", () => new Promise(() => {}))
    .catch((e) => e);
  await vi.advanceTimersByTimeAsync(55001);
  expect((await result).name).toBe("TimeoutError");
  await vi.advanceTimersByTimeAsync(5001);
  expect(
    (await api.controlledNarration("deadline", async () => "recovered")).result,
  ).toBe("recovered");
});

it.each([JSON.stringify({ status: "incomplete", output: [] }), "not json"])(
  "rejects incomplete/malformed output without retry or refund: %s",
  async (body) => {
    const api = await setup();
    vi.stubEnv("AI_TOTAL_LIMIT", "1");
    const transport = vi.fn(async () => new Response(body));
    vi.stubGlobal("fetch", transport);
    await expect(
      api.providerResponse("foundry", {}, undefined, options()),
    ).rejects.toMatchObject({ category: "invalid_response" });
    await expect(api.providerResponse("foundry", {})).rejects.toMatchObject({
      category: "budget",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  },
);
