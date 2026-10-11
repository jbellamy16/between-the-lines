import { afterEach, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { loadCases, verifyAndRender } from "../eval/foundry-study/cases";
import { DEPLOYMENT, digest } from "../eval/foundry-study/ledger";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([
  { rpm: 10, tpm: 10000, requests: 2, latencyMs: 6000 },
  { rpm: 30, tpm: 30000, requests: 3, latencyMs: 4000 },
])(
  "finishes counter-evidence investigation at $tpm TPM and preserves qualifications",
  async ({ rpm, tpm, requests, latencyMs }) => {
    vi.resetModules();
    vi.useFakeTimers();
    for (const [name, value] of Object.entries({
      AI_ENABLED: "true",
      AI_PROVIDER: "foundry",
      FOUNDRY_ENDPOINT: "https://example.openai.azure.com",
      FOUNDRY_DEPLOYMENT: DEPLOYMENT,
      FOUNDRY_API_KEY: "offline-test-only",
      AI_USAGE_STORE: "memory",
      AI_REDIS_URL: "",
      AI_MINUTE_LIMIT: "2",
      AI_HOURLY_LIMIT: "12",
      AI_DAILY_LIMIT: "12",
      AI_TOTAL_LIMIT: "12",
      AI_REQUEST_MINUTE_LIMIT: String(rpm),
      AI_TOKEN_MINUTE_LIMIT: String(tpm),
    }))
      vi.stubEnv(name, value);
    const c = loadCases()[0];
    const controls = await import("../src/lib/ai/request-controls");
    const actualReserve = controls.reserveProviderAttempt;
    const sizes: number[] = [];
    vi.spyOn(controls, "reserveProviderAttempt").mockImplementation(
      async (...args) => {
        sizes.push(args[0]);
        return actualReserve(...args);
      },
    );
    const bodies: string[] = [];
    const native = vi.fn(async (_url, init) => {
      bodies.push(String(init?.body));
      if (bodies.length === requests)
        return Response.json({
          status: "completed",
          usage: { input_tokens: 100, output_tokens: 20 },
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    decision: "publish",
                    stories: [
                      { claimId: "c0", form: "detail", emphasis: "comparison" },
                    ],
                  }),
                },
              ],
            },
          ],
        });
      return Response.json({
        status: "completed",
        usage: { input_tokens: 2003, output_tokens: 66 },
        output: [
          {
            type: "function_call",
            id: `fc_${"a".repeat(64)}`,
            call_id: `call_${(bodies.length === 1 ? "b" : "c").repeat(64)}`,
            status: "completed",
            name: "inspect_match_evidence",
            arguments: JSON.stringify({
              tool: "inspect_counter_evidence",
              matchId: c.match.id,
              start: 0,
              end: 1800,
              team: "harbor",
              playerId: null,
              eventId: "live-challenge-misleading-quality:4",
            }),
          },
        ],
      });
    });
    vi.stubGlobal("fetch", native);
    const { directMatch } = await import("../src/lib/ai/director/runner");
    const pending = directMatch(c.match, c.cutoff, "analyst", {});
    await vi.advanceTimersByTimeAsync(6500);
    const result = await pending;
    verifyAndRender(c, result);
    const diagnostic = {
      kind: "Offline regression using the saved tool query and scripted final plan; provider IDs reconstructed; no provider calls and no AI usefulness evidence",
      sizes,
      firstPayloadBytes: Buffer.byteLength(bodies[0]),
      firstPayloadDigest: digest(bodies[0]),
      requestBytes: bodies.map((s) => Buffer.byteLength(s)),
      requestDigests: bodies.map(digest),
      failure: result.failure,
      metrics: result.metrics,
    };
    if (tpm === 10000 && process.env.WRITE_FOUNDRY_DIAG === "1")
      writeFileSync(
        "docs/intelligence/foundry-bounded-2026-10-11-continuation-1/offline-regression-after-fix.json",
        JSON.stringify(diagnostic, null, 2) + "\n",
        { flag: "wx" },
      );
    expect(result.failure).toBeUndefined();
    expect(result.source).toBe("foundry");
    expect(native).toHaveBeenCalledTimes(requests);
    expect(result.metrics.toolInvocations).toBe(requests);
    expect(JSON.parse(bodies.at(-1)!).tools).toBeUndefined();
    expect(JSON.parse(bodies.at(-1)!).max_output_tokens).toBe(1800);
    expect(result.metrics.latencyMs).toBe(latencyMs); // actual shared pacing still applied
    if (tpm === 30000) {
      expect(JSON.parse(bodies[1]).tools).toHaveLength(1);
      expect(sizes.reduce((sum, n) => sum + n, 0)).toBeGreaterThan(10000);
    }
    expect(
      result.stories[0].hypothesis.contradictoryEvidence.map((e) => e.code),
    ).toContain("shot-volume-without-xg-increase");
    expect(sizes.reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(tpm);
  },
);

it("retains every counter-evidence measurement, qualification, window and check verdict in the selection projection", async () => {
  const { createInvestigation } = await import("../src/lib/ai/director/tools");
  const { evidenceWire } = await import("../src/lib/ai/director/evidence-wire");
  const c = loadCases()[0];
  const query = {
    matchId: c.match.id,
    start: 0,
    end: c.cutoff,
    team: "harbor",
    playerId: null,
    eventId: "live-challenge-misleading-quality:4",
  };
  const session = createInvestigation(c.match, c.cutoff, "analyst", {});
  const raw = session.execute("inspect_counter_evidence", query);
  const encode = evidenceWire();
  const projected = encode(raw, true);
  const decode = (refs: number[]) =>
    refs.map((ref) => projected.eventIdPrefix + projected.eventIds[ref]);
  const items = Reflect.get(projected, "assessments") as {
    claimId: string;
    assessment: Record<string, unknown>;
  }[];
  const originals = Reflect.get(raw, "assessments") as {
    claimId: string;
    assessment: import("../src/lib/ai/director/hypothesis").HypothesisAssessment;
  }[];
  for (const [i, item] of items.entries()) {
    const original = originals[i].assessment;
    expect(encode.canonical(item.claimId)).toBe(originals[i].claimId);
    expect(item.assessment.verificationStatus).toBe(
      original.verificationStatus,
    );
    expect(item.assessment.missingInformation).toEqual(
      original.missingInformation,
    );
    for (const name of [
      "supportingEvidence",
      "limitingEvidence",
      "contradictoryEvidence",
    ] as const)
      expect(
        (item.assessment[name] as [string, string, number[]][]).map(
          ([code, description, refs]) => ({
            code,
            description,
            eventIds: decode(refs),
          }),
        ),
      ).toEqual(original[name]);
    expect(
      (
        item.assessment.measurements as [
          string,
          string,
          number,
          string,
          number[],
          string | null,
        ][]
      ).map(([key, label, value, unit, refs, window]) => ({
        key,
        label,
        value,
        unit,
        eventIds: decode(refs),
        ...(window ? { window } : {}),
      })),
    ).toEqual(original.measurements);
    expect(item.assessment.windows).toEqual(
      original.windows.map((w) => [w.id, w.start, w.end, w.period, w.boundary]),
    );
    expect(
      (item.assessment.verificationChecks as [string, boolean, number[]][]).map(
        ([code, passed, refs]) => ({ code, passed, eventIds: decode(refs) }),
      ),
    ).toEqual(
      original.verificationChecks.map(({ detail: _detail, ...check }) => check),
    );
  }
});
