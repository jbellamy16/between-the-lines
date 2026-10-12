import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cases, buildCase } from "../eval/editorial-baselines/cases";
import {
  decodeInvestigationWire,
  scriptedPlan,
  type ScriptPacket,
} from "../eval/investigator/scripted";
import { investigationWire } from "../src/lib/ai/director/investigator-wire";
import {
  prepareInvestigation,
  verifyInvestigation,
  investigationMaterial,
  investigatorDigest,
  type InvestigationRead,
} from "../src/lib/ai/director/investigator-contract";
import { runEditorialBaseline } from "../src/lib/ai/director/editorial-baselines";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  for (const [key, value] of Object.entries({
    AI_ENABLED: "true",
    AI_PROVIDER: "foundry",
    FOUNDRY_ENDPOINT: "https://test.openai.azure.com",
    FOUNDRY_API_KEY: "test-only",
    FOUNDRY_DEPLOYMENT: "mock",
    AI_REDIS_URL: "",
    AI_USAGE_STORE: "memory",
    AI_TOKEN_MINUTE_LIMIT: "30000",
    AI_REQUEST_MINUTE_LIMIT: "30",
    AI_TOTAL_LIMIT: "100",
    AI_MINUTE_LIMIT: "4",
    AI_HOURLY_LIMIT: "30",
    AI_DAILY_LIMIT: "60",
  }))
    vi.stubEnv(key, value);
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
  vi.restoreAllMocks();
});
const message = (plan: unknown) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(plan) }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
  });
const call = (action: unknown) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "function_call",
        name: "select_evidence_option",
        call_id: "read",
        arguments: JSON.stringify(action),
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
  });
function transport(
  script: (
    packet: ScriptPacket,
    turn: number,
    body: Record<string, unknown>,
  ) => Response | Promise<Response>,
) {
  let turn = 0;
  const mock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("mock");
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBe(1800);
    expect(Buffer.byteLength(init.body as string)).toBeLessThanOrEqual(131072);
    return script(
      decodeInvestigationWire(JSON.parse(body.input[0].content)),
      turn++,
      body,
    );
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
async function drive<T>(promise: Promise<T>) {
  let done = false;
  promise.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    },
  );
  for (let i = 0; !done && i < 35; i++) await vi.advanceTimersByTimeAsync(2000);
  return promise;
}
async function run(
  c = buildCase(cases[0]),
  mode: "normal" | "evaluation" = "evaluation",
  signal?: AbortSignal,
) {
  const { runBoundedInvestigator } =
    await import("../src/lib/ai/director/investigator");
  return drive(
    runBoundedInvestigator(c.match, c.cutoff, c.context, { mode, signal }),
  );
}
function action(
  packet: ScriptPacket,
  option: ScriptPacket["index"]["options"][number],
  focalId = packet.baselineIds[0],
): InvestigationRead {
  return {
    indexId: packet.index.id,
    optionId: option.id,
    focalId,
    interpretationIds: [],
    purpose: option.purpose,
  };
}
const rows: unknown[] = [];
afterAll(() => {
  mkdirSync("artifacts/bounded-investigator", { recursive: true });
  writeFileSync(
    "artifacts/bounded-investigator/scripted.json",
    JSON.stringify(
      {
        kind: "scripted-orchestration-only",
        modelIntelligence: "unmeasured",
        humanPreference: "unmeasured",
        sourceHashes: Object.fromEntries(
          [
            "src/lib/ai/director/investigator.ts",
            "src/lib/ai/director/investigator-contract.ts",
            "src/lib/ai/director/investigator-wire.ts",
            "eval/investigator/scripted.ts",
            "src/lib/ai/director/editorial-baselines.ts",
            "eval/editorial-baselines/cases.ts",
            "tests/bounded-investigator.test.ts",
          ].map((path) => [
            path,
            investigatorDigest(readFileSync(path, "utf8")),
          ]),
        ),
        paidCalls: 0,
        extraFootballFacts: 0,
        rows,
      },
      null,
      2,
    ) + "\n",
  );
});
describe("bounded investigator, scripted transport and real local controls", () => {
  it.each(cases)("compares $id with unchanged B1 and B2", async (c) => {
    const fixture = buildCase(c);
    const mock = transport((p) => message(scriptedPlan(p)));
    const result = await run(fixture);
    const b1 = runEditorialBaseline(
      fixture.match,
      fixture.cutoff,
      "B1",
      fixture.context,
    );
    const b2 = runEditorialBaseline(
      fixture.match,
      fixture.cutoff,
      "B2",
      fixture.context,
    );
    expect(result.receipt.disposition).toBe("model-selection");
    expect(result.stories).toEqual(b2.stories);
    expect(result.answers).toEqual(b2.answers);
    expect(result.stories).toEqual(b1.stories);
    expect(result.receipt.stop).toMatchObject({
      origin: "model",
      reason: c.stop,
      voluntary: true,
    });
    expect(mock).toHaveBeenCalledTimes(1);
    rows.push({
      id: c.id,
      inputHash: investigatorDigest(fixture),
      expected: c.lead,
      B1: {
        ids: b1.stories.map((s) => s.storyId),
        reads: b1.metrics.localOptionReads,
      },
      B2: {
        ids: b2.stories.map((s) => s.storyId),
        reads: b2.metrics.localOptionReads,
      },
      scripted: { receipt: result.receipt, equalToB2: true },
    });
  });
  it("never dispatches in normal mode, including missing data", async () => {
    for (const c of cases) {
      const result = await run(buildCase(c), "normal");
      expect(result.receipt.attempts).toBe(0);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("encodes every fact and qualification losslessly, including tag-like source strings", () => {
    const c = buildCase(cases[0]);
    const p = prepareInvestigation(c.match, c.cutoff, c.context);
    const raw = {
      index: p.reader.index,
      baselineIds: p.baseline.stories.map((s) => s.storyId),
      bundles: p.initial,
    };
    expect(decodeInvestigationWire(investigationWire(raw))).toEqual(
      JSON.parse(JSON.stringify(raw)),
    );
    const weird = { value: ["r1", "s2", "v3", null, 0, false, {}, []] };
    expect(decodeInvestigationWire(investigationWire(weird))).toEqual(weird);
  });
  it("uses a model-selected counter-evidence read to select a different eligible story", async () => {
    let target = "";
    transport((p, turn) => {
      if (!turn) {
        const d = p.index.developments.find(
          (d) =>
            d.editorial.canLead &&
            !d.questions.length &&
            !p.baselineIds.includes(d.id),
        )!;
        expect(d).toBeDefined();
        target = d.id;
        return call(
          action(
            p,
            p.index.options.find(
              (o) =>
                o.developmentId === target && o.purpose === "inspect-challenge",
            )!,
            target,
          ),
        );
      }
      expect(p.bundles.some((b) => b.option.developmentId === target)).toBe(
        true,
      );
      return message(scriptedPlan(p, target));
    });
    const result = await run();
    expect(result.receipt.disposition, JSON.stringify(result.receipt)).toBe(
      "model-selection",
    );
    expect(result.receipt.finalIds).toEqual([target]);
    expect(result.receipt.trace[0].action.purpose).toBe("inspect-challenge");
  });
  it.each([0, 1])(
    "takes an evidence-dependent branch for temporal variant %i",
    async (variant) => {
      let chosenPurpose = "";
      transport((p, turn) => {
        if (turn) return message(scriptedPlan(p));
        const d = p.index.developments.find(
          (d) =>
            d.team === "harbor" &&
            d.questions.some((q) => q.intent === "fading-activity"),
        )!;
        const fading =
          d.questions.find((q) => q.intent === "fading-activity")!.verdict ===
          "lower";
        const focal = fading
          ? d
          : p.index.developments.find(
              (other) => other.team !== d.team && other.questions.length > 0,
            )!;
        const option = p.index.options.find((o) =>
          fading
            ? o.tool === "get_recorded_sequence" &&
              o.team === d.team &&
              !o.unavailable
            : o.tool === "compare_shot_routes" && o.team === focal.team,
        )!;
        chosenPurpose = option.purpose;
        return call(action(p, option, focal.id));
      });
      const result = await run(buildCase(cases[variant]));
      expect(result.receipt.disposition).toBe("model-selection");
      expect(chosenPurpose).toBe(
        variant ? "illustrate-sequence" : "distinguish-concentration",
      );
      expect(result.receipt.trace).toHaveLength(1);
      // Full summaries already contained the distinction. No discovery credit.
    },
  );
  it("foregrounds different competing descriptions while preserving every alternative and challenge", async () => {
    transport((p) => {
      const plan = scriptedPlan(p);
      plan.interpretationIds.reverse();
      return message(plan);
    });
    const result = await run();
    const full = result.answers.find((q) => q.comparison)!.comparison!;
    expect(full.interpretations).toHaveLength(3);
    expect(result.receipt.plan!.interpretationIds).toHaveLength(3);
    const c = buildCase(cases[0]);
    expect(result.answers).toEqual(
      runEditorialBaseline(c.match, c.cutoff, "B2", c.context).answers,
    );
  });
  it.each([
    "invented-id",
    "prose",
    "invented-statistic",
    "wrong-stop",
    "abstain",
    "missing-challenge",
    "duplicate-interpretation",
    "wrong-source",
  ])("rejects invalid plan: %s", async (attack) => {
    transport((p) => {
      const plan: Record<string, unknown> = { ...scriptedPlan(p) };
      if (attack === "invented-id") plan.focalId = "future-player";
      if (attack === "prose") plan.explanation = "They pressed and dominated";
      if (attack === "invented-statistic") plan.shots = 99;
      if (attack === "wrong-stop") plan.stop = "unresolved";
      if (attack === "abstain")
        Object.assign(plan, {
          focalId: null,
          interpretationIds: [],
          supportIds: [],
          challengeIds: [],
          stop: "no-material-gain",
        });
      if (attack === "missing-challenge") plan.challengeIds = [];
      if (attack === "duplicate-interpretation")
        plan.interpretationIds = ["both-teams", "both-teams"];
      if (attack === "wrong-source") plan.indexId = "0".repeat(64);
      return message(plan);
    });
    const result = await run();
    expect(result.receipt.stop.reason).toBe("invalid-plan");
    expect(result.receipt.disposition).toBe("fallback");
    expect(result.stories.length).toBe(1);
  });
  it("rejects a premature stop on an uninvestigated competing development", async () => {
    transport((p) => {
      const plan = scriptedPlan(p);
      plan.focalId = p.index.developments.find(
        (d) => !p.baselineIds.includes(d.id),
      )!.id;
      return message(plan);
    });
    expect((await run()).receipt.stop.reason).toBe("invalid-plan");
  });
  it.each([
    "unknown",
    "duplicate",
    "nested",
    "covered-routes",
    "purpose",
    "foreign-interpretation",
    "extra-arguments",
  ])("rejects invalid retrieval: %s", async (attack) => {
    transport((p) => {
      const option = p.index.options.find(
        (o) => o.tool === "compare_shot_routes",
      )!;
      const a: Record<string, unknown> = { ...action(p, option) };
      if (attack === "unknown") a.optionId = "invented-tool";
      if (attack === "duplicate")
        Object.assign(a, action(p, p.bundles[0].option));
      if (attack === "nested")
        Object.assign(
          a,
          action(
            p,
            p.index.options.find(
              (o) =>
                o.developmentId === p.baselineIds[0] &&
                o.intent === "chance-quality",
            )!,
          ),
        );
      if (attack === "covered-routes")
        Object.assign(
          a,
          action(
            p,
            p.index.options.find(
              (o) =>
                o.tool === "compare_shot_routes" &&
                o.team ===
                  p.index.developments.find((d) => d.id === p.baselineIds[0])!
                    .team,
            )!,
          ),
        );
      if (attack === "purpose") a.purpose = "check-quality";
      if (attack === "foreign-interpretation")
        a.interpretationIds = ["causal-pressure"];
      if (attack === "extra-arguments") a.start = 123;
      return call(a);
    });
    expect((await run()).receipt.stop.reason).toBe("invalid-plan");
  });
  it("cannot call for a third retrieval or repair after the final-only frontier", async () => {
    transport((p) =>
      call(
        action(
          p,
          p.index.options.find(
            (o) =>
              o.tool === "get_recorded_sequence" &&
              o.team ===
                p.index.developments.find((d) => d.id === p.baselineIds[0])!
                  .team &&
              !o.unavailable,
          )!,
        ),
      ),
    );
    const result = await run();
    expect(result.receipt.stop).toMatchObject({
      origin: "application",
      reason: "budget",
      voluntary: false,
    });
    expect(result.receipt.attempts).toBeLessThanOrEqual(3);
  });
  it("fits two adaptive retrieval rounds and a final decision inside one allowance", async () => {
    const mock = transport((p, turn) => {
      if (turn === 2) return message(scriptedPlan(p));
      const option = p.index.options.find((o) =>
        turn === 0
          ? o.tool === "get_match_context"
          : o.tool === "get_team_statistics" &&
            o.team ===
              p.index.developments.find((d) => d.id === p.baselineIds[0])!.team,
      )!;
      return call(action(p, option));
    });
    const result = await run(buildCase(cases[10]));
    expect(result.receipt.disposition, JSON.stringify(result.receipt)).toBe(
      "model-selection",
    );
    expect(result.receipt.attempts).toBe(3);
    expect(result.receipt.adaptiveRounds).toBe(2);
    expect(result.receipt.toolInvocations).toBe(3);
    expect(result.receipt.stop).toMatchObject({
      origin: "application",
      reason: "budget",
      voluntary: false,
    });
    expect(mock).toHaveBeenCalledTimes(3);
  });
  it("retains missing information and rejects a false sufficient stop", async () => {
    transport((p) => message({ ...scriptedPlan(p), stop: "sufficient" }));
    const result = await run(buildCase(cases[5]));
    expect(result.receipt.disposition).toBe("fallback");
    expect(
      result.answers.some(
        (q) => q.availability === "unavailable" && q.verdict === "unknown",
      ),
    ).toBe(true);
  });
  it.each(["disabled", "restricted", "missing-controls", "zero-attempts"])(
    "fails closed with %s",
    async (gate) => {
      const c = buildCase(cases[0]);
      if (gate === "disabled") vi.stubEnv("AI_ENABLED", "false");
      if (gate === "restricted")
        c.match.provenance.redistribution = "restricted";
      if (gate === "missing-controls") vi.stubEnv("AI_USAGE_STORE", "");
      if (gate === "zero-attempts") vi.stubEnv("AI_TOTAL_LIMIT", "0");
      const result = await run(c);
      expect(fetch).not.toHaveBeenCalled();
      expect(result.receipt.attempts).toBe(0);
    },
  );
  it("shares retry attempts and retains unknown usage rather than creating extra allowance", async () => {
    transport((p, turn) =>
      turn === 0
        ? new Response("secret", {
            status: 429,
            headers: { "retry-after": "1" },
          })
        : message(scriptedPlan(p)),
    );
    const result = await run();
    expect(result.receipt.attempts).toBe(2);
    expect(result.receipt.usage.complete).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("honors a lower shared request allowance after a successful follow-up", async () => {
    vi.stubEnv("AI_TOTAL_LIMIT", "1");
    transport((p) =>
      call(
        action(
          p,
          p.index.options.find((o) => o.tool === "get_match_context")!,
        ),
      ),
    );
    const result = await run();
    expect(result.receipt.attempts).toBe(1);
    expect(result.receipt.trace).toHaveLength(1);
    expect(result.receipt.stop).toMatchObject({
      origin: "application",
      reason: "budget",
      voluntary: false,
    });
  });
  it("retains unknown usage on a verified plan without pretending the charge is known", async () => {
    transport((p) =>
      Response.json({
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: JSON.stringify(scriptedPlan(p)) },
            ],
          },
        ],
      }),
    );
    const result = await run();
    expect(result.receipt.disposition).toBe("model-selection");
    expect(result.receipt.usage.complete).toBe(false);
  });
  it("falls back on a provider failure and does not cache it as success", async () => {
    const mock = transport(
      () => new Response("credential-secret", { status: 500 }),
    );
    const first = await run();
    expect(first.receipt.stop.reason).toBe("provider-failure");
    expect(first.receipt.usage.complete).toBe(false);
    await vi.advanceTimersByTimeAsync(61000);
    await run();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(first)).not.toContain("credential-secret");
  });
  it("caches only verified successes and separates exact rewind, preferences and revision", async () => {
    const mock = transport((p) => message(scriptedPlan(p)));
    const c = buildCase(cases[0]);
    const first = await run(c);
    const cached = await run(c);
    expect(first.receipt.cached).toBe(false);
    expect(cached.receipt.cached).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
    for (const change of [
      () => {
        c.cutoff -= 0.001;
      },
      () => {
        c.context.preferences.team = "riverside";
      },
      () => {
        c.match.provenance.revision = "new";
      },
    ]) {
      await vi.advanceTimersByTimeAsync(61000);
      change();
      expect((await run(c)).receipt.cached).toBe(false);
    }
    expect(mock).toHaveBeenCalledTimes(4);
  });
  it("rejects source revisions during an in-flight decision", async () => {
    const c = buildCase(cases[0]);
    transport((p) => {
      c.match.provenance.revision = "changed";
      return message(scriptedPlan(p));
    });
    expect((await run(c)).receipt.stop.reason).toBe("invalid-plan");
  });
  it("cancels before publication and never caches a late reply", async () => {
    const controller = new AbortController();
    transport((p) => {
      controller.abort();
      return message(scriptedPlan(p));
    });
    const result = await run(undefined, "evaluation", controller.signal);
    expect(result.stories).toEqual([]);
    expect(result.receipt.disposition).toBe("cancelled");
    await vi.advanceTimersByTimeAsync(61000);
    transport((p) => message(scriptedPlan(p)));
    expect((await run()).receipt.cached).toBe(false);
  });
  it("keeps another subscriber and its cached receipt safe when one viewer cancels", async () => {
    const controller = new AbortController();
    transport(
      (p) =>
        new Promise((resolve) =>
          setTimeout(() => {
            controller.abort();
            resolve(message(scriptedPlan(p)));
          }, 100),
        ),
    );
    const c = buildCase(cases[0]);
    const { runBoundedInvestigator } =
      await import("../src/lib/ai/director/investigator");
    const first = runBoundedInvestigator(c.match, c.cutoff, c.context, {
      mode: "evaluation",
      signal: controller.signal,
    });
    const second = runBoundedInvestigator(c.match, c.cutoff, c.context, {
      mode: "evaluation",
    });
    const [cancelled, completed] = await drive(Promise.all([first, second]));
    expect(cancelled.receipt.disposition).toBe("cancelled");
    expect(cancelled.stories).toEqual([]);
    expect(completed.receipt.disposition).toBe("model-selection");
    expect((await run(c)).receipt.disposition).toBe("model-selection");
    expect(cancelled.receipt.disposition).toBe("cancelled");
  });
  it("replays evidence and rejects edited receipt digests", async () => {
    transport((p) => message(scriptedPlan(p)));
    const result = await run();
    const c = buildCase(cases[0]);
    const envelope = { ...result.receipt, plan: result.receipt.plan! };
    expect(() =>
      verifyInvestigation(
        c.match,
        c.cutoff,
        { ...c.context, audience: "local" },
        { ...envelope, initialDigest: "forged" },
      ),
    ).toThrow("Stale");
    expect(() =>
      verifyInvestigation(
        c.match,
        c.cutoff - 0.001,
        { ...c.context, audience: "local" },
        envelope,
      ),
    ).toThrow("Stale");
  });
});
