import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  DIRECTORY,
  frozenContent,
  digest,
  proposal,
  STUDY,
} from "../eval/frozen-editorial/plan";
import { verifyFreeze, type Freeze } from "../eval/frozen-editorial/freeze";
import { entryGate, validateAuthorization } from "../eval/frozen-editorial/run";
import {
  authorizationSchema,
  durableStore,
  CLAIM,
  STORE_SCRIPT,
} from "../eval/frozen-editorial/store";
import {
  STORE_SCRIPT as originalScript,
  CLAIM as originalClaim,
} from "../eval/investigator-feasibility/store";
import { mockStore, mockEnvironment } from "../eval/frozen-editorial/mock";
import { writeReview } from "../eval/frozen-editorial/review";
import {
  decodeInvestigationWire,
  scriptedPlan,
} from "../eval/investigator/scripted";
import {
  investigationMaterial,
  prepareInvestigation,
} from "../src/lib/ai/director/investigator-contract";
import { fixture } from "../eval/frozen-editorial/plan";
const frozen = () =>
  JSON.parse(readFileSync(`${DIRECTORY}/frozen.json`, "utf8")) as Freeze;
const final = (
  plan: unknown,
  usage: unknown = { input_tokens: 100, output_tokens: 50 },
) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(plan) }],
      },
    ],
    usage,
  });
type Packet = ReturnType<typeof decodeInvestigationWire>;
async function drive<T>(promise: Promise<T>) {
  let done = false;
  promise
    .finally(() => {
      done = true;
    })
    .catch(() => {});
  for (let i = 0; !done && i < 50; i++) await vi.advanceTimersByTimeAsync(2000);
  return promise;
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  for (const [k, v] of Object.entries(mockEnvironment)) vi.stubEnv(k, v);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Real network forbidden");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function run(
  reply: (
    p: Packet,
    turn: number,
    signal: AbortSignal,
  ) => Response | Promise<Response>,
  options: { cap?: number; money?: number; controller?: AbortController } = {},
) {
  const events: Record<string, unknown>[] = [];
  const controller = options.controller ?? new AbortController();
  const journal = mockStore(options.money);
  let turn = 0;
  const native = vi.fn(async (_url: unknown, init?: RequestInit) =>
    reply(
      decodeInvestigationWire(
        JSON.parse(JSON.parse(init!.body as string).input[0].content),
      ),
      turn++,
      init!.signal!,
    ),
  );
  const { experiment } = await import("../eval/frozen-editorial/experiment");
  const result = await drive(
    experiment(
      journal.store,
      native,
      options.cap ?? 2,
      controller.signal,
      "mock",
      (event) => events.push(event),
    ),
  );
  return { result, events, native, journal };
}
describe("new frozen editorial candidate", () => {
  it("reproduces every input, complete evidence, baseline and rendered view and pins its source inventory", () => {
    const f = frozen();
    expect({ proposal: f.proposal, cases: f.cases }).toEqual(
      JSON.parse(JSON.stringify(frozenContent())),
    );
    expect(() => verifyFreeze(f)).not.toThrow();
    expect(f.proposal.presentation.version).toBe("offline-editorial-1");
    expect(f.cases[0].baseline.stories[0].headline).toBe("Harbor: more shots");
    expect(f.cases[0].presentations).toHaveLength(6);
    expect(f.cases[0].availableEvidence.length).toBe(
      f.cases[0].index.options.filter((o) => !o.unavailable).length,
    );
    const c = fixture(),
      p = prepareInvestigation(c.match, c.cutoff, c.context);
    const m = investigationMaterial(
      p.reader.index,
      p.initial,
      p.baseline.stories[0].storyId,
    );
    expect(
      m.interpretations
        .filter((i) => i.status === "supported")
        .map((i) => i.id),
    ).toEqual(["repeated-route", "both-teams"]);
    expect(f.cases[1].baseline.stories).toEqual([]);
  });
  it("rejects scenario, renderer hash and source inventory drift", () => {
    const f = frozen();
    f.cases[0].fixture.cutoff++;
    expect(() => verifyFreeze(f)).toThrow(/drift/);
    const h = frozen();
    h.sourceHashes["eval/investigator-editorial/render.ts"] = "0".repeat(64);
    expect(() => verifyFreeze(h)).toThrow(/source drift/);
    const m = frozen();
    delete m.sourceHashes["eval/frozen-editorial/run.ts"];
    expect(() => verifyFreeze(m)).toThrow(/inventory drift/);
  });
  it("retains the original atomic gates with a distinct permanent claim and study identity", () => {
    expect(STORE_SCRIPT).toBe(originalScript);
    expect(CLAIM).not.toBe(originalClaim);
    expect(CLAIM).toContain(STUDY);
    expect(() => durableStore({} as never, {})).toThrow();
  });
  it("requires a new, expiring authorization bound to exact manifest and commit with lower caps", () => {
    const f = frozen();
    const auth = {
      study: STUDY as typeof STUDY,
      manifest: digest(JSON.stringify(f)),
      commit: "a".repeat(40),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      redisIdentitySha256: "b".repeat(64),
      existingOwnerKey: "{second-look-ai}:owner",
      existingOwnerIdentity: "owner",
      maxAttempts: 1,
      maxNanoUsd: 400000000,
    };
    expect(validateAuthorization(auth, f, auth.commit)).toMatchObject({
      maxAttempts: 1,
      maxNanoUsd: 400000000,
    });
    for (const change of [
      { study: "investigator-feasibility-2026-10-12" },
      { manifest: "c".repeat(64) },
      { commit: "d".repeat(40) },
      { expiresAt: new Date(Date.now() - 1).toISOString() },
      { maxAttempts: 3 },
      { maxNanoUsd: 500000001 },
      { maxAttempts: 0 },
    ])
      expect(() =>
        validateAuthorization({ ...auth, ...change }, f, auth.commit),
      ).toThrow();
    expect(() => authorizationSchema.parse({})).toThrow();
    expect(() =>
      durableStore(
        { ...auth, existingOwnerKey: "{second-look-ai}:study:old" },
        { AI_USAGE_STORE: "redis", AI_REDIS_URL: "redis://127.0.0.1:16379" },
      ),
    ).toThrow();
  });
  it.each([
    { CI: "true" },
    { GITHUB_ACTIONS: "true" },
    { VITEST: "true" },
    { NODE_ENV: "test" },
  ])("blocks CI/test entry even with supplied authorization: %j", (env) => {
    expect(() =>
      entryGate(["--authorization-file", "anything"], env, true, true),
    ).toThrow();
  });
  it("normal CI commands cannot invoke paid entry; accidental live invocation rejects before config", () => {
    const config = readFileSync("vitest.config.ts", "utf8");
    expect(config).toContain('include: ["tests/**/*.test.ts"]');
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(JSON.stringify(pkg.scripts)).not.toContain("run-frozen-editorial");
    for (const f of readdirSync(".github/workflows"))
      expect(readFileSync(`.github/workflows/${f}`, "utf8")).not.toContain(
        "run-frozen-editorial",
      );
    const child = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/run-frozen-editorial.ts",
        "--authorization-file",
        "/nonexistent",
      ],
      { encoding: "utf8", env: { ...process.env, CI: "true" }, timeout: 10000 },
    );
    expect(child.status).toBe(1);
    expect(child.stderr).toContain("blocked or stopped");
  });
  it("uses mocked responses end to end, retaining requests, raw output and all canonical evidence in blinded views", async () => {
    const { result, native, events } = await run((p) => {
      const plan = scriptedPlan(p);
      plan.interpretationIds = [
        "both-teams",
        "repeated-route",
        "concentrated-attempts",
      ];
      return final(plan);
    });
    expect(native).toHaveBeenCalledTimes(1);
    expect(result.noCall.receipt.attempts).toBe(0);
    expect(result.result?.receipt.verification).toBe("passed");
    expect(result).toMatchObject({
      operationallyValid: true,
      accountingReconciled: true,
      actualHttpAttempts: 1,
      paidCalls: 0,
      conservativelyAccountedUsd: 0.0003,
      humanReview: null,
      beyondB2Established: false,
    });
    expect(events.map((e) => e.kind)).toEqual([
      "no-call",
      "dispatch-intent",
      "response",
      "accounting",
      "investigator-result",
    ]);
    for (const r of result.comparisons) {
      expect(r.comparison.kind).toBe("editorial-emphasis-change");
      expect(r.comparison.sameInformation).toBe(true);
      expect(r.b2.mandatory).toEqual(r.investigator.mandatory);
      expect(r.audit.initialEvidence).toEqual(
        frozen().cases[0].initialEvidence,
      );
      expect(r.audit.actualModelSelectedDecisions).toBeNull();
      expect(r.b2.limit).toBe(r.investigator.limit);
    }
    const dir = mkdtempSync(join(tmpdir(), "frozen-review-"));
    mkdirSync(join(dir, "private"));
    expect(writeReview(dir, result.comparisons, "frozen-test-seed")).toBe(6);
    const key = JSON.parse(readFileSync(join(dir, "private/key.json"), "utf8"));
    expect(
      key.assignments.filter((p: { A: string }) => p.A === "B2"),
    ).toHaveLength(3);
    for (const a of key.assignments) {
      const html = readFileSync(
        join(dir, `review/pair-${a.pairId}.html`),
        "utf8",
      );
      expect(html).not.toMatch(/B2|investigator|mock|focalId|api-key/);
      expect(digest(JSON.stringify(html))).toBe(a.artifactDigest);
    }
    expect(() => writeReview(dir, result.comparisons)).toThrow();
  });
  it.each([
    { focalId: "invented" },
    { supportIds: [] },
    { challengeIds: [] },
    { interpretationIds: ["invented"] },
    { explanation: "99 shots prove domination" },
    { stop: "unresolved" },
  ])(
    "preserves rejected plan %j, safe fallback and no model credit",
    async (mutation) => {
      const { result } = await run((p) =>
        final({ ...scriptedPlan(p), ...mutation }),
      );
      expect(result.operationallyValid).toBe(false);
      expect(result.result?.receipt.verification).toBe("rejected");
      expect(result.attempts[0]).toHaveProperty("actualOutput");
      for (const r of result.comparisons) {
        expect(r.investigator).toEqual(r.b2);
        expect(r.audit.disposition).toBe("B2-fallback");
      }
    },
  );
  it("preserves a selected read and full response, forces the second request final-only", async () => {
    const { result, native } = await run((p, turn) => {
      if (turn) return final(scriptedPlan(p));
      const o = p.index.options.find((o) => o.tool === "get_match_context")!;
      return Response.json({
        status: "completed",
        output: [
          {
            type: "function_call",
            name: "select_evidence_option",
            call_id: "1",
            arguments: JSON.stringify({
              indexId: p.index.id,
              optionId: o.id,
              focalId: p.baselineIds[0],
              interpretationIds: [],
              purpose: o.purpose,
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });
    expect(native).toHaveBeenCalledTimes(2);
    expect(result.result?.receipt.trace).toHaveLength(1);
    expect(result.result?.receipt.trace[0]).toHaveProperty("evidenceIds");
    expect(result.voluntaryStop).toBe(false);
    expect(
      JSON.parse((native.mock.calls[1][1] as RequestInit).body as string).tools,
    ).toBeUndefined();
  });
  it("blocks missing usage at one request and retains the entire conservative reservation", async () => {
    const { result, journal, native } = await run((p) =>
      final(scriptedPlan(p), null),
    );
    expect(native).toHaveBeenCalledTimes(1);
    expect(journal.accounted()).toBe(proposal.reserveNanoUsd);
    expect(result.actualEstimatedCostUsd).toBeNull();
    expect(result.operationallyValid).toBe(false);
  });
  it.each([401, 429, 500])(
    "stops HTTP %i without paid retries",
    async (status) => {
      const { native, result } = await run(() =>
        Response.json({ error: { code: "test" } }, { status }),
      );
      expect(native).toHaveBeenCalledTimes(1);
      expect(result.operationallyValid).toBe(false);
      expect(result.conservativelyAccountedUsd).toBe(0.3081);
    },
  );
  it("honors lower money and application ceilings before dispatch", async () => {
    const first = await run((p) => final(scriptedPlan(p)), { money: 1 });
    expect(first.native).not.toHaveBeenCalled();
    vi.resetModules();
    vi.stubEnv("AI_TOTAL_LIMIT", "0");
    const second = await run((p) => final(scriptedPlan(p)));
    expect(second.native).not.toHaveBeenCalled();
  });
  it("with a one-attempt cap a final-only answer earns no voluntary-stop credit", async () => {
    const { native, result } = await run((p) => final(scriptedPlan(p)), {
      cap: 1,
    });
    expect(native).toHaveBeenCalledTimes(1);
    expect(result.voluntaryStop).toBe(false);
    expect(
      JSON.parse((native.mock.calls[0][1] as RequestInit).body as string).tools,
    ).toBeUndefined();
  });
  it("pre-cancellation performs neither a provider request nor blinded publication", async () => {
    const controller = new AbortController();
    controller.abort();
    const { native, result } = await run((p) => final(scriptedPlan(p)), {
      controller,
    });
    expect(native).not.toHaveBeenCalled();
    expect(result.comparisons).toEqual([]);
  });
  it("in-flight cancellation retains request accounting, suppresses late output and reviewer artifacts", async () => {
    const controller = new AbortController();
    const { native, result, journal, events } = await run(
      async (p) => {
        controller.abort();
        await new Promise((resolve) => setTimeout(resolve, 20000));
        return final(scriptedPlan(p));
      },
      { controller },
    );
    expect(native).toHaveBeenCalledTimes(1);
    expect(result.result?.receipt.disposition).toBe("cancelled");
    expect(result.comparisons).toEqual([]);
    expect(journal.accounted()).toBe(proposal.reserveNanoUsd);
    expect(events.some((e) => e.kind === "dispatch-intent")).toBe(true);
    expect(result.operationallyValid).toBe(false);
  });
});
