import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { entryGate, measure } from "../eval/investigator-feasibility/run";
import {
  authorizationSchema,
  checkDurability,
  durableStore,
} from "../eval/investigator-feasibility/store";
import { guardedTransport } from "../eval/investigator-feasibility/transport";
import {
  DIRECTORY,
  digest,
  DESTINATION,
  fixture,
  frozenContent,
  proposal,
} from "../eval/investigator-feasibility/plan";
import {
  decodeInvestigationWire,
  scriptedPlan,
} from "../eval/investigator/scripted";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  for (const [k, v] of Object.entries({
    AI_ENABLED: "true",
    AI_PROVIDER: "foundry",
    AI_USAGE_STORE: "memory",
    AI_REDIS_URL: "",
    FOUNDRY_ENDPOINT: "https://josh-5098-resource.openai.azure.com",
    FOUNDRY_DEPLOYMENT: proposal.deployment,
    FOUNDRY_API_KEY: "mock-only",
    AI_MINUTE_LIMIT: "4",
    AI_HOURLY_LIMIT: "30",
    AI_DAILY_LIMIT: "60",
    AI_TOTAL_LIMIT: "100",
    AI_REQUEST_MINUTE_LIMIT: "30",
    AI_TOKEN_MINUTE_LIMIT: "30000",
  }))
    vi.stubEnv(k, v);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unscripted network forbidden");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function drive<T>(p: Promise<T>) {
  let done = false;
  p.finally(() => {
    done = true;
  }).catch(() => {});
  for (let i = 0; !done && i < 40; i++) await vi.advanceTimersByTimeAsync(2000);
  return p;
}
const response = (
  body: Record<string, unknown>,
  usage: unknown = { input_tokens: 100, output_tokens: 50 },
) => Response.json({ status: "completed", ...body, usage });
const final = (plan: unknown) => ({
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(plan) }],
    },
  ],
});
function fakeStore(maxNanoUsd: number = proposal.maxNanoUsd) {
  let attempts = 0,
    accounted = 0,
    pending = 0,
    stopped = false;
  const events: unknown[] = [];
  const store = vi.fn(
    async (action: string, event: Record<string, unknown> = {}) => {
      if (action === "reserve") {
        if (
          stopped ||
          pending ||
          attempts >= 2 ||
          accounted + proposal.reserveNanoUsd > maxNanoUsd
        )
          throw new Error("limited");
        pending = ++attempts;
        accounted += proposal.reserveNanoUsd;
      }
      if (action === "settle") {
        if (pending !== event.id) throw new Error("bad settlement");
        accounted += Number(event.accountedNanoUsd) - proposal.reserveNanoUsd;
        pending = 0;
        stopped = !!event.stop;
      }
      if (action === "stop") stopped = true;
      events.push({ action, event });
      return null;
    },
  );
  return { store, events, total: () => accounted };
}
async function runScript(
  fn: (
    packet: ReturnType<typeof decodeInvestigationWire>,
    turn: number,
  ) => Response,
  maxHttpAttempts = 2,
) {
  const journal = fakeStore();
  let turn = 0;
  const native = vi.fn(async (_url: unknown, init?: RequestInit) =>
    fn(
      decodeInvestigationWire(
        JSON.parse(JSON.parse(init!.body as string).input[0].content),
      ),
      turn++,
    ),
  );
  const guard = guardedTransport(journal.store, native);
  vi.stubGlobal("fetch", guard.fetch);
  const { runBoundedInvestigator } =
    await import("../src/lib/ai/director/investigator");
  const c = fixture();
  const result = await drive(
    runBoundedInvestigator(c.match, c.cutoff, c.context, {
      mode: "evaluation",
      maxHttpAttempts,
    }),
  );
  return { result, journal, native, guard };
}
describe("frozen feasibility preparation", () => {
  it("reproduces the frozen scenario and full unchanged B2 output", () => {
    const frozen = JSON.parse(readFileSync(`${DIRECTORY}/frozen.json`, "utf8"));
    expect({ proposal: frozen.proposal, cases: frozen.cases }).toEqual(
      JSON.parse(JSON.stringify(frozenContent())),
    );
    expect(frozen.cases[0].baseline.stories[0].headline).toBe(
      "Riverside: more shots",
    );
    expect(frozen.cases[0].baseline.decision.work.optionReads).toBe(2);
    expect(frozen.cases[1].baseline.stories).toEqual([]);
  });
  it("preserves the PR #41 freeze and requires a new candidate after the offline renderer entry is added", () => {
    const original = readFileSync(`${DIRECTORY}/frozen.json`, "utf8");
    expect(digest(original)).toBe(
      "33aef062567387734bad6bd0f80ecbf8f50c51465e87481109d576ca3b85dfbf",
    );
    const frozen = JSON.parse(original);
    const changed = Object.entries(frozen.sourceHashes)
      .filter(([path, hash]) => digest(readFileSync(path, "utf8")) !== hash)
      .map(([path]) => path);
    // The original live runner rejects this exact source drift before authorization,
    // preflight or Redis access. Do not refresh the historical freeze to make it pass.
    expect(changed).toEqual(
      expect.arrayContaining([
        "package.json",
        "src/lib/ai/director/investigator.ts",
        "src/lib/ai/providers.ts",
      ]),
    );
    // B2 and its independent verification are still byte-identical.
    for (const path of [
      "src/lib/ai/director/editorial-baselines.ts",
      "src/lib/ai/director/investigator-contract.ts",
    ])
      expect(digest(readFileSync(path, "utf8"))).toBe(
        frozen.sourceHashes[path],
      );
    const restoredPackage = readFileSync("package.json", "utf8")
      .split("\n")
      .filter((line) => !line.includes('"eval:investigator:editorial"'))
      .join("\n");
    expect(digest(restoredPackage)).toBe(frozen.sourceHashes["package.json"]);
  });
  it("keeps the quiet control deterministic even with provider credentials", async () => {
    const { runBoundedInvestigator } =
      await import("../src/lib/ai/director/investigator");
    const c = fixture(true);
    const result = await runBoundedInvestigator(c.match, c.cutoff, c.context, {
      mode: "normal",
    });
    expect(result.receipt.attempts).toBe(0);
    expect(result.stories).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { CI: "true" },
    { GITHUB_ACTIONS: "true" },
    { VITEST: "true" },
    { NODE_ENV: "test" },
  ])(
    "rejects ordinary CI/tests even with authorization arguments: %j",
    (env) => {
      expect(() =>
        entryGate(["--authorization-file", "approved.json"], env, true, true),
      ).toThrow();
    },
  );
  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])("requires both interactive terminals (%s,%s)", (a, b) => {
    expect(() =>
      entryGate(["--authorization-file", "approved.json"], {}, a, b),
    ).toThrow();
  });
  it.each([
    { args: [] },
    { args: ["--live"] },
    { args: ["--authorization-file", "x", "--force"] },
  ])("rejects accidental launch arguments %j", ({ args }) => {
    expect(() => entryGate(args, {}, true, true)).toThrow();
  });
  it("rejects missing durability and incomplete authorizations", () => {
    expect(() => checkDurability({}, "")).toThrow();
    expect(() => authorizationSchema.parse({})).toThrow();
    expect(() => durableStore({} as never, {})).toThrow();
  });
  it("records actual structured decisions and distinguishes parity from gain", async () => {
    const { result, guard, native, journal } = await runScript((p) => {
      const plan = scriptedPlan(p);
      plan.challengeIds = ["challenge:opponent-shot-response"];
      return response(final(plan));
    });
    expect(native).toHaveBeenCalledTimes(1);
    expect(guard.rows[0].actualDecisions).toHaveLength(1);
    expect(result.receipt.stop.voluntary).toBe(true);
    expect(measure(result)).toMatchObject({
      competingInterpretationRelevant: true,
      counterEvidenceRelevant: true,
      sameStoriesAsB2: true,
      sameAnswersAsB2: true,
      beyondB2Established: false,
      editorialImprovementHumanReview: null,
    });
    expect(journal.total()).toBe(300000);
  });
  it("forces the second request final-only without a third HTTP attempt", async () => {
    const { result, native } = await runScript((p, turn) => {
      if (turn) return response(final(scriptedPlan(p)));
      const option = p.index.options.find(
        (o) => o.tool === "get_match_context",
      )!;
      return response({
        output: [
          {
            type: "function_call",
            name: "select_evidence_option",
            call_id: "1",
            arguments: JSON.stringify({
              indexId: p.index.id,
              optionId: option.id,
              focalId: p.baselineIds[0],
              interpretationIds: [],
              purpose: option.purpose,
            }),
          },
        ],
      });
    });
    expect(native).toHaveBeenCalledTimes(2);
    expect(result.receipt.verification).toBe("passed");
    expect(result.receipt.stop.voluntary).toBe(false);
    expect(
      JSON.parse((native.mock.calls[1][1] as RequestInit).body as string).tools,
    ).toBeUndefined();
  });
  it("blocks a second retrieval and never dispatches a third call", async () => {
    const { result, native } = await runScript((p) =>
      response({
        output: [
          {
            type: "function_call",
            name: "select_evidence_option",
            call_id: "1",
            arguments: JSON.stringify({
              indexId: p.index.id,
              optionId: p.index.options.find(
                (o) => o.tool === "get_match_context",
              )!.id,
              focalId: p.baselineIds[0],
              interpretationIds: [],
              purpose: "resolve-priority",
            }),
          },
        ],
      }),
    );
    expect(native.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.receipt.stop.voluntary).toBe(false);
  });
  it.each([
    undefined,
    { input_tokens: -1, output_tokens: 1 },
    { input_tokens: 1, output_tokens: 1801 },
  ])(
    "retains full reservation and stops on missing/invalid usage %j",
    async (usage) => {
      const { result, journal, native } = await runScript((p) =>
        Response.json({
          status: "completed",
          ...final(scriptedPlan(p)),
          usage,
        }),
      );
      expect(native).toHaveBeenCalledTimes(1);
      expect(journal.total()).toBe(proposal.reserveNanoUsd);
      expect(result.receipt.disposition).toBe("fallback");
    },
  );
  it.each([401, 429, 500])(
    "stops HTTP %i with full unknown reservation; no retries",
    async (status) => {
      const { result, journal, native } = await runScript(() =>
        Response.json({ error: { code: "unknown" } }, { status }),
      );
      expect(native).toHaveBeenCalledTimes(1);
      expect(journal.total()).toBe(proposal.reserveNanoUsd);
      expect(result.receipt.stop.voluntary).toBe(false);
    },
  );
  it("retains invalid raw decisions while verified B2 fallback stays safe", async () => {
    const { result, guard } = await runScript((p) =>
      response(
        final({
          ...scriptedPlan(p),
          focalId: "invented",
          explanation: "unsupported domination",
        }),
      ),
    );
    expect(result.receipt.verification).toBe("rejected");
    expect(JSON.stringify(guard.rows)).toContain("unsupported domination");
    expect(measure(result)).toMatchObject({
      rejectedDecision: true,
      unsupportedPublishedConclusions: 0,
      beyondB2Established: false,
    });
  });
  it.each([0, NaN, -1])(
    "fails closed with invalid/lowered attempt cap %s",
    async (cap) => {
      const { native, result } = await runScript(
        (p) => response(final(scriptedPlan(p))),
        cap,
      );
      expect(native).not.toHaveBeenCalled();
      expect(result.receipt.attempts).toBe(0);
    },
  );
  it("preserves a lower application attempt allowance", async () => {
    vi.stubEnv("AI_TOTAL_LIMIT", "0");
    const { native } = await runScript((p) => response(final(scriptedPlan(p))));
    expect(native).not.toHaveBeenCalled();
  });
  it("reservation failure cannot reach native transport", async () => {
    const journal = fakeStore(1),
      native = vi.fn();
    const guard = guardedTransport(journal.store, native);
    vi.stubGlobal("fetch", guard.fetch);
    const { runBoundedInvestigator } =
      await import("../src/lib/ai/director/investigator");
    const c = fixture();
    await drive(
      runBoundedInvestigator(c.match, c.cutoff, c.context, {
        mode: "evaluation",
        maxHttpAttempts: 2,
      }),
    );
    expect(native).not.toHaveBeenCalled();
  });
  it("forbids other destinations, redirects and non-text requests", async () => {
    const journal = fakeStore(),
      native = vi.fn(),
      guard = guardedTransport(journal.store, native);
    await expect(
      guard.fetch("https://example.com", { method: "POST" }),
    ).rejects.toThrow();
    await expect(
      guard.fetch(DESTINATION, { method: "POST", redirect: "follow" }),
    ).rejects.toThrow();
    expect(native).not.toHaveBeenCalled();
  });
});
