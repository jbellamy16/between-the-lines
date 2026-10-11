import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CAPS,
  DEPLOYMENT,
  ENVELOPE,
  StudyLedger,
  digest,
} from "../eval/foundry-study/ledger";
import { studyTransport } from "../eval/foundry-study/transport";
import {
  allowanceBlockers,
  quotaSnapshot,
} from "../eval/foundry-study/preflight";
import {
  loadCases,
  fixtureEvidence,
  verifyAndRender,
} from "../eval/foundry-study/cases";
import { createInvestigation } from "../src/lib/ai/director/tools";
import { canLead } from "../src/lib/ai/director/editorial";
import { periodAt } from "../src/lib/sources/model";

const directories: string[] = [],
  ledgers: StudyLedger[] = [];
const destination = "https://example.openai.azure.com/openai/v1/responses";
const manifest = digest("offline-test-manifest");
const payload = JSON.stringify({
  model: DEPLOYMENT,
  input: [],
  parallel_tool_calls: false,
  store: false,
  max_output_tokens: 1800,
});
const usage = {
  input_tokens: 100,
  output_tokens: 10,
  input_tokens_details: { cached_tokens: 50 },
};
const init = (signal = new AbortController().signal) =>
  ({
    method: "POST",
    body: payload,
    redirect: "error",
    cache: "no-store",
    signal,
  }) as RequestInit;
function ledger() {
  const directory = mkdtempSync(join(tmpdir(), "foundry-study-"));
  directories.push(directory);
  const l = new StudyLedger(join(directory, "ledger.jsonl"), manifest);
  ledgers.push(l);
  return l;
}
function settled(l: StudyLedger, reported = usage) {
  const r = l.reserve(payload);
  l.dispatch(r.id);
  l.settle(r.id, { responseStatus: "completed", status: 200, usage: reported });
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  ledgers.forEach((l) => l.close());
  directories.forEach((d) => rmSync(d, { recursive: true, force: true }));
  directories.length = 0;
  ledgers.length = 0;
});

describe("durable bounded study accounting (no network)", () => {
  it("fsyncs a full-context reserve before HTTP and reports discounted usage separately", async () => {
    const l = ledger();
    l.begin("first");
    const native = vi.fn(async () => {
      const text = readFileSync(l.path, "utf8");
      expect(text).toContain('"kind":"reserve"');
      expect(text).toContain('"kind":"dispatch"');
      expect(l.totalNanoUsd()).toBe(ENVELOPE.nanoUsd);
      return Response.json({ status: "completed", usage, output: [] });
    });
    await studyTransport(l, destination, native).fetch(destination, init());
    expect(l.dispatched).toBe(1);
    expect(l.totalNanoUsd()).toBe(120000);
    expect(l.settlements[0].reportedRateNanoUsd).toBe(86250);
    l.end("completed");
    l.close();
    const reopened = new StudyLedger(l.path, manifest);
    ledgers.push(reopened);
    expect(reopened.totalNanoUsd()).toBe(120000);
  });
  it("enforces six distinct workflows and completion-to-start spacing", () => {
    const l = ledger();
    let time = Date.now();
    for (let i = 0; i < 6; i++) {
      l.begin(`case-${i}`, time);
      l.end("abstained", time + 2000);
      time += 67000;
    }
    expect(() => l.begin("seventh", time)).toThrow();
    expect(l.stopped?.reason).toBe("workflow_limit");
  });
  it("refuses duplicates, overlapping workflows and insufficient spacing", () => {
    const l = ledger(),
      now = Date.now();
    l.begin("one", now);
    expect(() => l.begin("two", now)).toThrow();
    l.end("abstained", now + 800);
    expect(() => l.begin("one", now + 70000)).toThrow();
    expect(() => l.begin("two", now + 65000)).toThrow();
    l.begin("two", now + 65800);
  });
  it("enforces twelve attempts across workflows including retries", () => {
    const l = ledger();
    let at = Date.now();
    for (let i = 0; i < 4; i++) {
      l.begin(`c${i}`, at);
      for (let j = 0; j < 3; j++) settled(l);
      l.end("completed", at);
      at += 65000;
    }
    l.begin("c4", at);
    expect(() => l.reserve(payload)).toThrow();
    expect(l.dispatched).toBe(CAPS.attempts);
    expect(l.stopped?.reason).toBe("attempt_limit");
  });
  it("enforces the unchanged three-attempt workflow ceiling", () => {
    const l = ledger();
    l.begin("one");
    for (let i = 0; i < 3; i++) settled(l);
    expect(() => l.reserve(payload)).toThrow();
    expect(l.stopped?.reason).toBe("workflow_attempt_limit");
  });
  it("retains unknown usage and refuses spending above fifty cents", async () => {
    const l = ledger();
    l.begin("one");
    const native = vi.fn(async () =>
      Response.json(
        { error: { code: "rate_limit_exceeded" } },
        { status: 429 },
      ),
    );
    const guarded = studyTransport(l, destination, native);
    await guarded.fetch(destination, init());
    expect(l.totalNanoUsd()).toBe(ENVELOPE.nanoUsd);
    await expect(guarded.fetch(destination, init())).rejects.toThrow();
    expect(l.stopped?.reason).toBe("spend_limit");
    expect(native).toHaveBeenCalledTimes(1);
  });
  it("fails closed on concurrent writers, changed manifest, corruption and unfinished work", () => {
    const l = ledger();
    expect(() => new StudyLedger(l.path, manifest)).toThrow();
    l.begin("one");
    l.reserve(payload);
    l.close();
    expect(() => new StudyLedger(l.path, manifest)).toThrow(/Unresolved/);
    expect(() => new StudyLedger(l.path, digest("other"))).toThrow();
    writeFileSync(
      l.path,
      readFileSync(l.path, "utf8").replace(
        '"nanoUsd":308100000',
        '"nanoUsd":1',
      ),
    );
    expect(() => new StudyLedger(l.path, manifest)).toThrow();
  });
  it.each(["missing", "invalid", "incomplete", "500", "transport"])(
    "stops on %s without a replay and retains numeric receipts only",
    async (kind) => {
      const l = ledger();
      l.begin("one");
      const native = vi.fn(async () => {
        if (kind === "transport") throw new Error("sensitive-transport-body");
        return Response.json(
          {
            status: kind === "incomplete" ? "incomplete" : "completed",
            usage:
              kind === "missing"
                ? undefined
                : kind === "invalid"
                  ? { input_tokens: -1, output_tokens: 0 }
                  : usage,
            output: [],
            privateReasoning: "do-not-save",
            error: { message: "do-not-save" },
          },
          { status: kind === "500" ? 500 : 200 },
        );
      });
      const guarded = studyTransport(l, destination, native);
      await guarded.fetch(destination, init()).catch(() => {});
      expect(l.stopped).toBeDefined();
      expect(guarded.pending()).toBe(0);
      await expect(guarded.fetch(destination, init())).rejects.toThrow();
      expect(native).toHaveBeenCalledTimes(1);
      expect(readFileSync(l.path, "utf8")).not.toMatch(
        /sensitive|do-not-save|privateReasoning/,
      );
      if (["missing", "invalid", "transport"].includes(kind))
        expect(l.totalNanoUsd()).toBe(ENVELOPE.nanoUsd);
    },
  );
  it("cancels before dispatch without spending and retains an in-flight unknown reservation", async () => {
    const l = ledger();
    l.begin("one");
    const controller = new AbortController();
    let rejectFetch!: (reason: unknown) => void;
    const native = vi.fn(
      () =>
        new Promise<Response>((_, reject) => {
          rejectFetch = reject;
        }),
    );
    const guarded = studyTransport(l, destination, native);
    const pending = guarded.fetch(destination, init(controller.signal));
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(l.totalNanoUsd()).toBe(ENVELOPE.nanoUsd);
    expect(l.stopped?.reason).toBe("cancelled");
    expect(guarded.pending()).toBeGreaterThan(0); // detect transport ignoring cancellation
    rejectFetch(controller.signal.reason);
    await Promise.resolve();
    expect(guarded.pending()).toBe(0);
    await expect(
      guarded.fetch(destination, init(controller.signal)),
    ).rejects.toThrow();
    expect(native).toHaveBeenCalledTimes(1);
    const other = ledger();
    other.begin("two");
    await expect(
      studyTransport(other, destination, native).fetch(
        destination,
        init(controller.signal),
      ),
    ).rejects.toThrow();
    expect(other.reservations).toHaveLength(0);
  });
  it("refuses a foreign destination or paid built-in tool before dispatch", async () => {
    const l = ledger();
    l.begin("one");
    const native = vi.fn();
    await expect(
      studyTransport(l, destination, native).fetch(
        "https://elsewhere.example",
        init(),
      ),
    ).rejects.toThrow();
    expect(native).not.toHaveBeenCalled();
    const other = ledger();
    other.begin("two");
    expect(() =>
      other.reserve(
        JSON.stringify({
          ...JSON.parse(payload),
          tools: [{ type: "web_search" }],
        }),
      ),
    ).toThrow();
  });
  it("stops on a transport deadline, retains the reserve and refuses a later dispatch", async () => {
    const l = ledger();
    l.begin("timeout");
    const controller = new AbortController();
    const native = vi.fn(
      async (_url, opts) =>
        new Promise<Response>((_resolve, reject) => {
          opts?.signal?.addEventListener(
            "abort",
            () => reject(opts.signal.reason),
            { once: true },
          );
        }),
    );
    const guarded = studyTransport(l, destination, native);
    const pending = guarded.fetch(destination, init(controller.signal));
    controller.abort(new DOMException("deadline", "TimeoutError"));
    await expect(pending).rejects.toThrow();
    expect(l.stopped?.reason).toBe("timeout");
    expect(l.totalNanoUsd()).toBe(ENVELOPE.nanoUsd);
    expect(guarded.pending()).toBe(0);
    await expect(guarded.fetch(destination, init())).rejects.toThrow();
    expect(native).toHaveBeenCalledTimes(1);
  });
  it("does not treat fresh memory or disabled/insufficient quotas as remaining allowance", () => {
    const limits = quotaSnapshot({
      AI_MINUTE_LIMIT: "2",
      AI_HOURLY_LIMIT: "2",
      AI_DAILY_LIMIT: "2",
      AI_TOTAL_LIMIT: "2",
    });
    expect(
      allowanceBlockers({
        limits,
        store: "memory",
        remainingWorkflows: null,
        remainingAttempts: null,
      }),
    ).toHaveLength(2);
    expect(
      allowanceBlockers({
        limits: [0, 0, 0, 0, 10, 10000],
        store: "shared",
        remainingWorkflows: 0,
        remainingAttempts: 0,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      allowanceBlockers({
        limits: [4, 30, 60, 100, 10, 10000],
        store: "shared",
        remainingWorkflows: 6,
        remainingAttempts: 12,
      }),
    ).toEqual([]);
  });
});

async function runtime() {
  vi.resetModules();
  for (const [name, value] of Object.entries({
    AI_ENABLED: "true",
    AI_PROVIDER: "foundry",
    FOUNDRY_ENDPOINT: "https://example.openai.azure.com",
    FOUNDRY_DEPLOYMENT: DEPLOYMENT,
    FOUNDRY_API_KEY: "offline-test-only",
    AI_REDIS_URL: "",
    AI_USAGE_STORE: "memory",
    AI_MINUTE_LIMIT: "4",
    AI_HOURLY_LIMIT: "30",
    AI_DAILY_LIMIT: "60",
    AI_TOTAL_LIMIT: "100",
    AI_REQUEST_MINUTE_LIMIT: "10",
    AI_TOKEN_MINUTE_LIMIT: "10000",
  }))
    vi.stubEnv(name, value);
  return import("../src/lib/ai/director/runner");
}
describe("unchanged runtime under the study transport", () => {
  it("counts a bounded 429 retry in both real application accounting and the ledger", async () => {
    vi.useFakeTimers();
    await runtime();
    const { providerResponse } = await import("../src/lib/ai/providers");
    const l = ledger();
    l.begin("retry");
    const native = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            usage: { input_tokens: 0, output_tokens: 0 },
            error: { code: "rate_limit_exceeded" },
          },
          {
            status: 429,
            headers: { "retry-after": "1", "x-ms-retry-after-ms": "2000" },
          },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({ status: "completed", output: [], usage }),
      );
    vi.stubGlobal("fetch", studyTransport(l, destination, native).fetch);
    const promise = providerResponse(
      "foundry",
      { input: [], parallel_tool_calls: false },
      new AbortController().signal,
      { maxAttempts: 2 },
    );
    await vi.advanceTimersByTimeAsync(6500);
    expect((await promise).attempts).toBe(2);
    expect(l.dispatched).toBe(2);
    expect(l.settlements[0].retryAfterMs).toBe(2000);
  });
  it("keeps a terminal 429 and permits no later case after the runtime failure", async () => {
    await runtime();
    const { providerResponse } = await import("../src/lib/ai/providers");
    const l = ledger();
    l.begin("terminal");
    const native = vi.fn(async () =>
      Response.json(
        { error: { code: "rate_limit_exceeded" } },
        { status: 429, headers: { "retry-after": "120" } },
      ),
    );
    vi.stubGlobal("fetch", studyTransport(l, destination, native).fetch);
    await expect(
      providerResponse(
        "foundry",
        { input: [], parallel_tool_calls: false },
        new AbortController().signal,
        { maxAttempts: 2 },
      ),
    ).rejects.toMatchObject({ category: "rate_limit" });
    l.stop("runtime_failure");
    l.end("failed");
    expect(() => l.begin("next", Date.now() + 130000)).toThrow();
    expect(l.dispatched).toBe(1);
  });
  for (const c of loadCases())
    it(`replays and renders ${c.id} through directMatch, analyst mode, with zero live calls`, async () => {
      fixtureEvidence(c);
      const { directMatch } = await runtime();
      const l = ledger();
      l.begin(c.id);
      const session = createInvestigation(c.match, c.cutoff, "analyst", {});
      const packet = session.execute("get_match_events", {
        matchId: c.match.id,
        start: Math.max(periodAt(c.match, c.cutoff).start, c.cutoff - 1800),
        end: c.cutoff,
        team: null,
        playerId: null,
        eventId: null,
      });
      const candidate = packet.claims.find(canLead);
      const plan = candidate
        ? {
            decision: "publish",
            stories: [
              {
                claimId: `c${packet.claims.indexOf(candidate)}`,
                form: "detail",
                emphasis: candidate.allowedEmphasis,
              },
            ],
          }
        : { decision: "abstain", stories: [] };
      const native = vi.fn(async () =>
        Response.json({
          status: "completed",
          usage,
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(plan) }],
            },
          ],
        }),
      );
      const guarded = studyTransport(l, destination, native);
      vi.stubGlobal("fetch", guarded.fetch);
      const result = await directMatch(c.match, c.cutoff, "analyst", {});
      expect(result.failure).toBeUndefined();
      expect(result.source).toBe(
        c.eligibility === "eligible" ? "foundry" : "offline",
      );
      verifyAndRender(c, result);
      const calls = native.mock.calls.length;
      if (result.source === "foundry") {
        const cached = await directMatch(c.match, c.cutoff, "analyst", {});
        expect(cached.metrics.cached).toBe(true);
      }
      expect(native).toHaveBeenCalledTimes(calls);
      expect(guarded.pending()).toBe(0);
    });
});
