import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/investigate/route";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { runBoundedInvestigator } from "../src/lib/ai/director/investigator";
import { configuredProvider, providerResponse } from "../src/lib/ai/providers";
import { UsageFailure } from "../src/lib/ai/request-controls";

beforeEach(() => {
  vi.stubEnv("AI_ENABLED", "false");
  vi.stubEnv("AI_INVESTIGATOR_ENABLED", "false");
  vi.stubEnv("AI_REDIS_URL", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Real inference forbidden in unit tests");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = (body: unknown, origin = "http://localhost") =>
  new Request("http://localhost/api/investigate", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
const input = {
  action: "investigate-with-microsoft-foundry",
  scenario: "pressure",
  time: 3804,
};
it("explicit action returns real deterministic B2 evidence when disabled, never model labels", async () => {
  const res = await POST(request(input));
  const data = await res.json();
  expect(res.status).toBe(200);
  expect(data.receipt.stop.reason).toBe("disabled");
  expect(data.receipt.attempts).toBe(0);
  expect(data.receipt.verification).toBe("not-run");
  expect(data.stories.length).toBeGreaterThan(0);
  expect(data.initialEvidence.length).toBeGreaterThan(0);
  expect(data.investigatedEvidence).toEqual([]);
  expect(data.spending.reservedUsd).toBe(0);
  expect(data.receipt.cutoff).toBe(3804);
  expect(fetch).not.toHaveBeenCalled();
});
it("enabled action fails closed without TLS durable accounting even with credentials and memory enabled", async () => {
  vi.stubEnv("AI_INVESTIGATOR_ENABLED", "true");
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://test.openai.azure.com");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  vi.stubEnv("AI_USAGE_STORE", "memory");
  const data = await (await POST(request(input))).json();
  expect(data.receipt.stop.reason).toBe("controls");
  expect(data.stories.length).toBeGreaterThan(0);
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  { ...input, matchId: "2499719" },
  { ...input, action: "automatic" },
  { ...input, time: 9000 },
  { ...input, evidence: [] },
])(
  "rejects historical, automatic and arbitrary evidence requests",
  async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("rejects cross-origin requests", async () => {
  expect((await POST(request(input, "https://other.test"))).status).toBe(403);
});
it("runner cannot enter explicit inference without the spend callback", async () => {
  vi.stubEnv("AI_INVESTIGATOR_ENABLED", "true");
  const result = await runBoundedInvestigator(
    new SyntheticMatchSource().read("pressure"),
    3804,
    {},
    { mode: "explicit" },
  );
  expect(result.receipt.stop.reason).toBe("disabled");
  expect(fetch).not.toHaveBeenCalled();
});
it("dollar reservation rejection prevents provider dispatch after request reservation", async () => {
  vi.stubEnv("AI_USAGE_STORE", "memory");
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://test.openai.azure.com");
  const reserve = vi.fn(async () => {
    throw new UsageFailure("budget");
  });
  await expect(
    providerResponse("foundry", { input: "test" }, undefined, {
      beforeAttempt: reserve,
    }),
  ).rejects.toThrow("budget");
  expect(reserve).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

it("explicit mode keeps legacy and proactive inference offline even if old flags are on", () => {
  vi.stubEnv("AI_INVESTIGATOR_ENABLED", "true");
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_PROVIDER", "foundry");
  vi.stubEnv("FOUNDRY_ENABLED", "true");
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://test.openai.azure.com");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  vi.stubEnv("FOUNDRY_DEPLOYMENT", "test-only");
  expect(configuredProvider()).toBe("offline");
});

it("explicit route connects to the bounded runner and publishes only a verified plan (mock transport, not AI evidence)", async () => {
  const budgetModule = await import("../src/lib/ai/investigation-budget");
  const reserve = vi.fn(async () => {}),
    release = vi.fn(async () => {});
  const budget = vi
    .spyOn(budgetModule, "investigationBudget")
    .mockResolvedValue({ reserve, release, reservedUsd: () => 0.31 });
  const { decodeInvestigationWire, scriptedPlan } =
    await import("../eval/investigator/scripted");
  vi.stubEnv("AI_INVESTIGATOR_ENABLED", "true");
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://test.openai.azure.com");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  vi.stubEnv("FOUNDRY_DEPLOYMENT", "between-the-lines-gpt54-mini");
  vi.stubEnv("AI_USAGE_STORE", "memory");
  // Only this unit test supplies a script. The application imports no scripted decisions.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      expect(reserve).toHaveBeenCalledOnce();
      expect(init.headers).toMatchObject({ "api-key": "test-only" });
      const body = JSON.parse(init.body as string);
      const packet = decodeInvestigationWire(JSON.parse(body.input[0].content));
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(scriptedPlan(packet)),
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    }),
  );
  try {
    const data = await (await POST(request(input))).json();
    expect(data.receipt.disposition).toBe("model-selection");
    expect(data.receipt.verification).toBe("passed");
    expect(data.receipt.stop.origin).toBe("model");
    expect(data.receipt.attempts).toBe(1);
    expect(data.spending.reservedUsd).toBe(0.31);
    expect(release).toHaveBeenCalledOnce();
  } finally {
    budget.mockRestore();
  }
});

it("explicit model-selected retrieval binds metadata deterministically and still verifies the final plan (mock transport)", async () => {
  vi.resetModules();
  const { runBoundedInvestigator: run } =
    await import("../src/lib/ai/director/investigator");
  const { decodeInvestigationWire, scriptedPlan } =
    await import("../eval/investigator/scripted");
  const fixture = {
    match: new SyntheticMatchSource().read("pressure", { profile: "demo" }),
    cutoff: 3600,
    context: {},
  };
  vi.stubEnv("AI_INVESTIGATOR_ENABLED", "true");
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://test.openai.azure.com");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  vi.stubEnv("FOUNDRY_DEPLOYMENT", "between-the-lines-gpt-6-luna-1");
  vi.stubEnv("AI_USAGE_STORE", "memory");
  let turn = 0,
    target = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.reasoning).toEqual({ effort: "low" });
      const packet = decodeInvestigationWire(JSON.parse(body.input[0].content));
      if (turn++ === 0) {
        expect(body.tools[0].parameters.required).toEqual(["selectionId"]);
        const menu = JSON.parse(body.input[0].content);
        const reads = body.tools[0].parameters.properties.selectionId
          .enum as string[];
        expect(
          reads.every(
            (id) =>
              !packet.bundles.some((b) =>
                id.startsWith(
                  `read-${packet.index.options.findIndex((o) => o.id === b.option.id)}-`,
                ),
              ),
          ),
        ).toBe(true);
        for (const id of reads) {
          const [, oi, fi] = id.split("-").map(Number);
          expect(menu.readOptions[oi]).toEqual({
            label: packet.index.options[oi].label,
            tool: packet.index.options[oi].tool,
          });
          expect(menu.readFocuses[fi]).toBe(
            packet.index.developments[fi].headline,
          );
        }
        const development = packet.index.developments.find((d) =>
          packet.baselineIds.includes(d.id),
        )!;
        target = development.id;
        const option = packet.index.options.find(
          (o) => o.tool === "get_match_context",
        )!;
        return Response.json({
          status: "completed",
          output: [
            {
              type: "function_call",
              name: "select_evidence_option",
              call_id: "test-read",
              arguments: JSON.stringify({
                selectionId: reads.find(
                  (id) =>
                    id ===
                    `read-${packet.index.options.indexOf(option)}-${packet.index.developments.indexOf(development)}`,
                )!,
              }),
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        });
      }
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(scriptedPlan(packet, target)),
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    }),
  );
  const result = await run(fixture.match, fixture.cutoff, fixture.context, {
    mode: "explicit",
    maxHttpAttempts: 2,
    beforeAttempt: async () => {},
  });
  expect(result.receipt.verification).toBe("passed");
  expect(result.receipt.finalIds).toEqual([target]);
  expect(result.receipt.trace).toHaveLength(1);
  expect(result.receipt.trace[0].action).toMatchObject({
    indexId: result.receipt.indexId,
    purpose: "resolve-priority",
    interpretationIds: [],
  });
  expect(result.receipt.stop.origin).toBe("application");
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each(["foreign option", "extra purpose", "already supplied option"])(
  "explicit reads reject %s rather than repairing model selections",
  async (attack) => {
    vi.resetModules();
    const { runBoundedInvestigator: run } =
      await import("../src/lib/ai/director/investigator");
    vi.stubEnv("AI_INVESTIGATOR_ENABLED", "true");
    vi.stubEnv("FOUNDRY_ENDPOINT", "https://test.openai.azure.com");
    vi.stubEnv("FOUNDRY_API_KEY", "test-only");
    vi.stubEnv("FOUNDRY_DEPLOYMENT", "between-the-lines-gpt-6-luna-1");
    vi.stubEnv("AI_USAGE_STORE", "memory");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        const { decodeInvestigationWire } =
          await import("../eval/investigator/scripted");
        const packet = decodeInvestigationWire(
          JSON.parse(body.input[0].content),
        );
        const duplicate = `read-${packet.index.options.findIndex((o) => o.id === packet.bundles[0].option.id)}-${packet.index.developments.findIndex((d) => d.id === packet.baselineIds[0])}`;
        const valid = body.tools[0].parameters.properties.selectionId.enum[0];
        return Response.json({
          status: "completed",
          output: [
            {
              type: "function_call",
              name: "select_evidence_option",
              call_id: "test-read",
              arguments: JSON.stringify({
                selectionId:
                  attack === "foreign option"
                    ? "unknown"
                    : attack === "already supplied option"
                      ? duplicate
                      : valid,
                ...(attack === "extra purpose"
                  ? { purpose: "resolve-priority" }
                  : {}),
              }),
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        });
      }),
    );
    const result = await run(
      new SyntheticMatchSource().read("pressure", { profile: "demo" }),
      3600,
      {},
      { mode: "explicit", maxHttpAttempts: 2, beforeAttempt: async () => {} },
    );
    expect(result.receipt.verification).toBe("rejected");
    expect(result.receipt.trace).toEqual([]);
    expect(result.receipt.toolInvocations).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);
