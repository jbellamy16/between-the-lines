import { afterEach, describe, expect, it, vi } from "vitest";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { observe } from "../src/lib/ai/director/observer";
import {
  createInvestigation,
  type ToolQuery,
} from "../src/lib/ai/director/tools";
import {
  packageStory,
  validateEditorialPlan,
} from "../src/lib/ai/director/story";
import { directMatch, investigate } from "../src/lib/ai/director/runner";
import { POST } from "../src/app/api/director/route";
import { configure } from "./ai-helpers";
const source = new SyntheticMatchSource();
const match = source.read("pressure"),
  cutoff = 4200;
const query: ToolQuery = {
  matchId: match.id,
  start: 3300,
  end: cutoff,
  team: null,
  playerId: null,
  eventId: null,
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Match Director evidence boundaries", () => {
  it("advertises sequence presentation for the live pre-substitution case and rejects a comparison", () => {
    const fixture = source.read("substitution");
    const time =
      Math.floor(fixture.events.find((e) => e.type === "substitution")!.time) -
      1;
    const session = createInvestigation(fixture, time, "analyst");
    const result = session.execute("get_match_context", {
      ...query,
      matchId: fixture.id,
      start: 2700,
      end: time,
    });
    const claim = result.claims.find(
      (c) => c.category === "shot-sequence" && c.team === "riverside",
    )!;
    expect(claim).toBeDefined();
    expect(claim.allowedEmphasis).toBe("sequence");
    const plan = {
      decision: "publish",
      stories: [
        { claimId: claim.id, form: "detail", emphasis: claim.allowedEmphasis },
      ],
    };
    expect(
      validateEditorialPlan(
        plan,
        session.candidates,
        new Set(session.claims.keys()),
      ).stories,
    ).toHaveLength(1);
    expect(() =>
      validateEditorialPlan(
        { ...plan, stories: [{ ...plan.stories[0], emphasis: "comparison" }] },
        session.candidates,
        new Set(session.claims.keys()),
      ),
    ).toThrow("Invalid comparison");
  });
  it("rejects other matches, future windows/events, unknown actors and tool names", () => {
    const session = createInvestigation(match, cutoff, "fan");
    for (const q of [
      { ...query, matchId: "another" },
      { ...query, end: cutoff + 1 },
      { ...query, start: -1 },
      { ...query, start: NaN },
      { ...query, playerId: "invented" },
      { ...query, eventId: match.events.at(-1)!.id },
      { ...query, sql: "DROP" },
    ])
      expect(() => session.execute("get_match_events", q)).toThrow();
    expect(() => session.execute("write_match", query)).toThrow();
  });
  it("bounds outputs and excludes raw data and future related IDs", () => {
    const session = createInvestigation(match, cutoff, "analyst");
    const result = session.execute("get_match_events", query);
    expect(result.events.length).toBeLessThanOrEqual(40);
    expect(result.truncated).toBe(true);
    expect(
      result.events.every(
        (e) =>
          e.time <= cutoff &&
          e.relatedEvents.every(
            (id) => match.events.find((e) => e.id === id)!.time <= cutoff,
          ),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain('"raw":');
    expect(JSON.stringify(result)).not.toContain('"finalScore":');
    for (let i = 0; i < 3; i++) session.execute("get_match_context", query);
    expect(() => session.execute("get_match_context", query)).toThrow("budget");
  });
  it("refuses unequal/incomplete cross-period comparisons and unsupported possessions", () => {
    expect(() =>
      createInvestigation(match, cutoff, "fan").execute(
        "compare_time_windows",
        query,
      ),
    ).toThrow("equal complete");
    const noPossessions = structuredClone(match);
    noPossessions.capabilities.possession = "unavailable";
    expect(
      observe(noPossessions, cutoff).some((c) =>
        ["recovery-shot", "shot-sequence"].includes(c.category),
      ),
    ).toBe(false);
    expect(() =>
      createInvestigation(noPossessions, cutoff, "fan").execute(
        "get_recorded_sequence",
        {
          ...query,
          eventId: match.events.findLast(
            (e) => e.type === "shot" && e.time <= cutoff,
          )!.id,
        },
      ),
    ).toThrow("unsupported");
  });
  it("honors source capabilities and known actor identities", () => {
    const m = structuredClone(match);
    m.capabilities.ballRecoveries = false;
    m.capabilities.passRecipients = false;
    m.capabilities.substitutions = false;
    expect(
      observe(m, cutoff).every(
        (c) =>
          !["recovery-shot", "passing-pair", "substitute-involvement"].includes(
            c.category,
          ),
      ),
    ).toBe(true);
  });
  it("requires actual retrieved claims and rejects fabricated prose, duplicates and invalid comparisons", () => {
    const candidates = observe(match, cutoff),
      c = candidates.find(
        (candidate) => candidate.category === "recovery-shot",
      )!;
    const plan = {
      decision: "publish",
      stories: [{ claimId: c.id, form: "brief", emphasis: "sequence" }],
    };
    expect(() => validateEditorialPlan(plan, candidates, new Set())).toThrow(
      "Uninvestigated",
    );
    expect(() =>
      validateEditorialPlan(
        { ...plan, headline: "They switched to a 4-4-2" },
        candidates,
        new Set([c.id]),
      ),
    ).toThrow();
    expect(() =>
      validateEditorialPlan(
        { ...plan, stories: [{ ...plan.stories[0], claimId: "invented" }] },
        candidates,
        new Set(["invented"]),
      ),
    ).toThrow();
    expect(() =>
      validateEditorialPlan(
        { ...plan, stories: [{ ...plan.stories[0], emphasis: "comparison" }] },
        candidates,
        new Set([c.id]),
      ),
    ).toThrow("comparison");
    expect(() =>
      validateEditorialPlan(
        { ...plan, stories: [...plan.stories, ...plan.stories] },
        candidates,
        new Set([c.id]),
      ),
    ).toThrow("duplicate");
    expect(
      validateEditorialPlan(
        { decision: "abstain", stories: [] },
        candidates,
        new Set(),
      ).decision,
    ).toBe("abstain");
  });
  it("keeps episode IDs stable while cutoff and evidence grow, and downranks seen evidence", () => {
    const current = observe(match, cutoff),
      next = observe(match, cutoff + 1);
    expect(current.map((c) => c.id)).toEqual(next.map((c) => c.id));
    const seen = observe(match, cutoff, "fan", {
      seenEvidenceIds: current[0].evidenceIds,
    });
    expect(seen[0]?.id).not.toBe(current[0].id);
  });
  it("provides distinct audience rendering and verified broadcast coordinates", () => {
    const c = observe(match, cutoff)[0];
    const fan = packageStory(c, match, cutoff, "fan", "offline"),
      analyst = packageStory(c, match, cutoff, "analyst", "offline");
    expect(fan.explanation).not.toBe(analyst.explanation);
    expect(
      fan.coordinates.every(
        (p) =>
          fan.evidenceEventIds.includes(p.eventId) &&
          match.events.some(
            (event) =>
              event.id === p.eventId &&
              event.time <= cutoff &&
              event.position?.x === p.x &&
              event.position?.y === p.y,
          ),
      ),
    ).toBe(true);
    expect(() =>
      packageStory(c, match, c.timestamp - 1, "fan", "offline"),
    ).toThrow();
  });
});
function scriptedProvider(abstain = false, invalid = false) {
  const session = createInvestigation(match, cutoff, "fan");
  session.execute("get_match_events", query);
  const c = session.candidates.find(
    (c) => session.claims.has(c.id) && c.category === "recovery-shot",
  )!;
  const plan = {
    decision: abstain ? "abstain" : "publish",
    stories: abstain
      ? []
      : [
          {
            claimId: invalid ? "fabricated" : c.id,
            form: "brief",
            emphasis: "sequence",
          },
        ],
  };
  return vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        status: "completed",
        usage: { input_tokens: 100, output_tokens: 30 },
        output: [
          {
            type: "function_call",
            name: "get_match_events",
            call_id: "call1",
            arguments: JSON.stringify(query),
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        status: "completed",
        usage: { input_tokens: 300, output_tokens: 50 },
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(plan) }],
          },
        ],
      }),
    );
}
describe("bounded provider integration (scripted transport, not quality evidence)", () => {
  it.each(["fan", "analyst"] as const)(
    "constrains %s story count at provider generation, not only after spending",
    async (mode) => {
      configure("foundry");
      const transport = scriptedProvider();
      vi.stubGlobal("fetch", transport);
      await investigate(match, cutoff, mode, {}, "foundry");
      for (const [index, call] of (
        transport.mock.calls as unknown as [string, RequestInit][]
      ).entries()) {
        const request = JSON.parse(String(call[1].body));
        expect(request.text.format.schema.properties.stories.maxItems).toBe(
          index === 0 ? 0 : mode === "fan" ? 2 : 3,
        );
        if (!index) {
          expect(request.text.format.schema.properties.decision.const).toBe(
            "abstain",
          );
          expect(request.tool_choice).toEqual({
            type: "function",
            name: "get_match_events",
          });
          expect(request.tools).toHaveLength(1);
          expect(request.tools[0].parameters.properties.start.enum).toEqual([
            2700,
          ]);
          expect(request.tools[0].parameters.properties.end.enum).toEqual([
            cutoff,
          ]);
          expect(request.tools[0].parameters.properties.team).toEqual({
            type: "null",
          });
        }
        if (index) {
          const retrieved = JSON.parse(
            request.input.find(
              (item: { type: string }) => item.type === "function_call_output",
            ).output,
          ).claims.map((c: { id: string }) => c.id);
          expect(
            request.text.format.schema.properties.stories.items.properties
              .claimId.enum,
          ).toEqual(retrieved);
        }
      }
    },
  );
  it.each(["openai", "foundry"] as const)(
    "investigates with %s and keeps actual provenance",
    async (provider) => {
      configure(provider);
      const transport = scriptedProvider();
      vi.stubGlobal("fetch", transport);
      const result = await investigate(match, cutoff, "fan", {}, provider);
      expect(result.source).toBe(provider);
      expect(result.metrics.requests).toBe(2);
      expect(result.trace).toHaveLength(1);
      expect(result.stories[0].provider).toBe(provider);
      expect(result.provenance.usage?.inputTokens).toBe(400);
      expect(transport.mock.calls[0][0]).toContain(
        provider === "openai" ? "api.openai.com" : "example.openai.azure.com",
      );
    },
  );
  it("abstains without removing score context", async () => {
    configure();
    vi.stubGlobal("fetch", scriptedProvider(true));
    const result = await investigate(match, cutoff, "fan", {}, "openai");
    expect(result.decision).toBe("abstain");
    expect(result.stories).toEqual([]);
    expect(result.provenance.contextFactIds).toContain("score");
  });
  it("recovers from a cross-half comparison without admitting rejected evidence or adding a model turn", async () => {
    configure();
    const successful = scriptedProvider();
    const transport = vi
      .fn()
      .mockImplementationOnce(successful)
      .mockResolvedValueOnce(
        Response.json({
          status: "completed",
          output: [
            {
              type: "function_call",
              name: "compare_time_windows",
              call_id: "invalid-comparison",
              arguments: JSON.stringify(query),
            },
          ],
        }),
      )
      .mockImplementationOnce(successful);
    vi.stubGlobal("fetch", transport);
    const result = await investigate(match, cutoff, "fan", {}, "openai");
    expect(result.source).toBe("openai");
    expect(result.stories).toHaveLength(1);
    expect(result.trace.map((entry) => entry.tool)).toEqual([
      "get_match_events",
    ]);
    expect(result.metrics.toolInvocations).toBe(2);
    expect(transport).toHaveBeenCalledTimes(3);
    const lastRequest = JSON.parse(transport.mock.calls[2][1].body);
    const rejected = JSON.parse(lastRequest.input.at(-1).output);
    expect(rejected.error).toContain("equal complete windows");
    expect(rejected.claims).toBeUndefined();
    expect(
      rejected.availablePeriods.every((p: { end: number }) => p.end <= cutoff),
    ).toBe(true);
    for (const period of rejected.availablePeriods) {
      if (!period.comparisonExample) continue;
      const { previous, current } = period.comparisonExample;
      expect(previous[0]).toBeGreaterThanOrEqual(period.start);
      expect(previous[1]).toBe(current[0]);
      expect(current[1]).toBeLessThanOrEqual(period.end);
      expect(previous[1] - previous[0]).toBe(current[1] - current[0]);
      expect(current[1] - current[0]).toBeLessThanOrEqual(900);
    }
    expect(lastRequest.tools).toBeUndefined();
  });
  it("rejects unsupported generated claims without another paid retry", async () => {
    configure();
    const transport = scriptedProvider(false, true);
    vi.stubGlobal("fetch", transport);
    await expect(
      investigate(match, cutoff, "fan", {}, "openai"),
    ).rejects.toThrow("Uninvestigated");
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])(
    "handles repeated final messages and rejects conflicts: %s",
    async (conflicting) => {
      configure();
      const successful = scriptedProvider(true);
      const transport = vi
        .fn()
        .mockImplementationOnce(successful)
        .mockImplementationOnce(async () => {
          const response = await successful();
          const body = await response.json();
          const duplicate = structuredClone(body.output[0]);
          if (conflicting)
            duplicate.content[0].text = JSON.stringify({
              decision: "publish",
              stories: [],
            });
          body.output.push(duplicate);
          return Response.json(body);
        });
      vi.stubGlobal("fetch", transport);
      const result = investigate(match, cutoff, "fan", {}, "openai");
      if (conflicting)
        await expect(result).rejects.toThrow("conflicting editorial");
      else expect((await result).decision).toBe("abstain");
      expect(transport).toHaveBeenCalledTimes(2);
    },
  );
  it("never calls a model for offline, restricted evidence, empty candidates or cancelled work", async () => {
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    vi.stubEnv("AI_ENABLED", "false");
    expect((await directMatch(match, cutoff, "fan")).source).toBe("offline");
    configure();
    expect((await directMatch(match, 0, "fan")).decision).toBe("abstain");
    const restricted = structuredClone(match);
    restricted.provenance.redistribution = "restricted";
    expect((await directMatch(restricted, cutoff, "fan")).source).toBe(
      "offline",
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      directMatch(match, cutoff, "fan", {}, controller.signal),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("caches verified results by exact cutoff, mode and model context", async () => {
    configure();
    const transport = scriptedProvider();
    vi.stubGlobal("fetch", transport);
    const first = await directMatch(match, cutoff, "fan", { team: "harbor" });
    const second = await directMatch(match, cutoff, "fan", { team: "harbor" });
    expect(first.source).toBe("openai");
    expect(second.metrics.cached).toBe(true);
    expect(second.metrics.requests).toBe(0);
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("validates API inputs, returns offline packages, and never trusts client events", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const post = (body: unknown) =>
      POST(
        new Request("http://localhost/api/director", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    expect(
      (
        await post({
          scenario: "pressure",
          time: 4200,
          mode: "fan",
          events: [],
        })
      ).status,
    ).toBe(400);
    expect(
      (await post({ scenario: "pressure", time: 6000, mode: "fan" })).status,
    ).toBe(400);
    const response = await post({
      scenario: "pressure",
      time: 4200,
      mode: "analyst",
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.stories[0].schemaVersion).toBe("1.1.0");
    expect(result.metrics.requests).toBe(0);
  });
});

it("investigation-selected player windows compute new claims beyond the observer shortlist", () => {
  const session = createInvestigation(match, cutoff, "analyst");
  const actor = match.players.find(
    (p) =>
      p.team === "harbor" &&
      match.events.filter(
        (e) =>
          e.actorId === p.id &&
          e.time > 3300 &&
          e.time <= cutoff &&
          e.type === "pass",
      ).length >= 5,
  )!;
  const initialIds = new Set(session.candidates.map((c) => c.id));
  const result = session.execute("get_player_involvement", {
    ...query,
    playerId: actor.id,
    team: "harbor",
  });
  const derived = result.claims.find(
    (c) => c.category === "player-involvement",
  )!;
  expect(derived).toBeDefined();
  expect(initialIds.has(derived.id)).toBe(false);
  const plan = validateEditorialPlan(
    {
      decision: "publish",
      stories: [
        { claimId: derived.id, form: "detail", emphasis: "contribution" },
      ],
    },
    session.candidates,
    new Set(session.claims.keys()),
  );
  expect(plan.stories[0].claimId).toBe(derived.id);
  const verifier = createInvestigation(match, cutoff, "analyst");
  verifier.execute("get_player_involvement", {
    ...query,
    playerId: actor.id,
    team: "harbor",
  });
  const { allowedEmphasis, editorialGroup, incompatibleClaimIds, ...rawClaim } =
    derived;
  expect(verifier.claims.get(derived.id)).toEqual(rawClaim);
  expect(allowedEmphasis).toBe("contribution");
  expect(editorialGroup).toBe("harbor:player-involvement");
  expect(incompatibleClaimIds.every((id) => session.claims.has(id))).toBe(true);
});
it("disabled categories suppress candidate investigations", () => {
  expect(observe(match, cutoff, "fan", { categories: [] })).toEqual([]);
});
it("unsuccessful ball-winning attempts never become recovery-to-shot claims", () => {
  const m = structuredClone(match);
  for (const event of m.events)
    if (["recovery", "interception", "tackle"].includes(event.type))
      event.success = false;
  expect(observe(m, cutoff).some((c) => c.category === "recovery-shot")).toBe(
    false,
  );
});
it("compares shot origins only with enough located shots in equal windows", () => {
  const m = structuredClone(match);
  for (const e of m.events)
    if (e.type === "shot" && e.position && e.time > 3600)
      e.position.x = e.time > 4500 ? 95 : 55;
  const candidates = observe(m, 5400, "analyst");
  const location = candidates.find((c) => c.category === "shot-location");
  expect(location).toBeDefined();
  expect(location!.detail).toContain("not shot quality");
  expect(location!.statistics[0].value).toBe(95);
  expect(location!.statistics[1].value).toBe(55);
});
it("stops a provider that keeps requesting tools at the third response", async () => {
  configure();
  const transport = vi.fn(async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "get_match_events",
          call_id: "again",
          arguments: JSON.stringify(query),
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", transport);
  await expect(investigate(match, cutoff, "fan", {}, "openai")).rejects.toThrow(
    "budget",
  );
  expect(transport).toHaveBeenCalledTimes(3);
});
