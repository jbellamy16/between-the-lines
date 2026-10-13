import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configure } from "./ai-helpers";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  addText,
  collectFacts,
  emptyFacts,
  verifyGrounding,
} from "../src/lib/ai/analyst/grounding";
import { runAnalyst, describeToolCall } from "../src/lib/ai/analyst/agent";
import { askAnalyst, clientAllowed } from "../src/lib/ai/analyst/service";
import {
  attemptMicros,
  reserveSpend,
  resetLocalSpendLedger,
} from "../src/lib/ai/spend-ledger";
import { UsageFailure } from "../src/lib/ai/request-controls";
import { createInvestigation } from "../src/lib/ai/director/tools";

const match = new SyntheticMatchSource().read("pressure", { profile: "demo" });
const CUTOFF = 3804; // 63:24
const roster = match.players;

function reply(output: unknown[]) {
  return Response.json({
    status: "completed",
    usage: { input_tokens: 1000, output_tokens: 100 },
    output,
  });
}
const toolCall = (name: string, args: Record<string, unknown>, id = name) => ({
  type: "function_call",
  name,
  call_id: id,
  arguments: JSON.stringify({
    matchId: match.id,
    team: null,
    playerId: null,
    eventId: null,
    ...args,
  }),
});
const answer = (value: unknown) => ({
  type: "message",
  content: [{ type: "output_text", text: JSON.stringify(value) }],
});
const surge = toolCall("compare_time_windows", {
  start: 3252,
  end: 3804,
  team: "harbor",
});

describe("grounding check", () => {
  const facts = collectFacts({
    window: { from: "54:12", to: "63:24" },
    counts: { shots: 4, previous: 0, xg: 0.12, passCompletionPct: 81 },
    events: [{ clock: "59:09", player: "Theo March", type: "shot" }],
  });
  it("accepts numbers, times and names that appear in evidence", () => {
    const result = verifyGrounding(
      "Harbor had 4 shots from 54:12 to 63:24 after 0 before; Theo March shot at 59:09 (0.12 xG, 81% passing).",
      facts,
      roster,
    );
    expect(result.issues).toEqual([]);
    expect(result.passed).toBe(true);
  });
  it("accepts football minute phrasing for a recorded time", () => {
    expect(
      verifyGrounding("A shot in the 60th minute.", facts, roster).passed,
    ).toBe(true);
  });
  it("rejects an invented count", () => {
    const result = verifyGrounding("Harbor had 7 shots.", facts, roster);
    expect(result.passed).toBe(false);
    expect(result.issues[0]).toContain('"7"');
  });
  it("ties counts to what was counted", () => {
    expect(
      verifyGrounding("Harbor had four shots.", facts, roster).passed,
    ).toBe(true);
    const wrongThing = verifyGrounding("Harbor made 4 passes.", facts, roster);
    expect(wrongThing.passed).toBe(false);
    expect(wrongThing.issues[0]).toContain("pass count");
  });
  it("accepts a baseline count stated elsewhere in the same sentence", () => {
    const headline = collectFacts({
      summary:
        "Harbor recorded 4 shots in the last 9 min 12 sec, up from 0 in the previous equal spell.",
    });
    expect(
      verifyGrounding("4 shots after 0 shots before.", headline, roster).passed,
    ).toBe(true);
    // Durations in that sentence are not shot counts.
    expect(
      verifyGrounding("Harbor took 9 shots.", headline, roster).passed,
    ).toBe(false);
  });
  it("lets a decline name what it can't judge", () => {
    const decline =
      "Recorded events can't say who will win or whether anyone is angry.";
    expect(verifyGrounding(decline, facts, roster).passed).toBe(false);
    expect(
      verifyGrounding(decline, facts, roster, "", { declining: true }).passed,
    ).toBe(true);
  });
  it("rejects an invented number word", () => {
    expect(
      verifyGrounding("Harbor had nine shots.", facts, roster).passed,
    ).toBe(false);
  });
  it("rejects an invented time", () => {
    expect(verifyGrounding("They scored at 61:02.", facts, roster).passed).toBe(
      false,
    );
  });
  it("rejects a player who is not in the evidence", () => {
    const other = roster.find((p) => p.name !== "Theo March")!;
    const result = verifyGrounding(
      `${other.name} drove the surge.`,
      facts,
      roster,
    );
    expect(result.passed).toBe(false);
    expect(result.issues.join(" ")).toContain(other.name);
  });
  it("allows values the viewer supplied in the question", () => {
    expect(
      verifyGrounding(
        "Over the last ten minutes the evidence shows 4 shots.",
        facts,
        roster,
        "What changed in the last ten minutes?",
      ).passed,
    ).toBe(true);
  });
  it("rejects predictions and claims about feelings", () => {
    expect(
      verifyGrounding("Harbor will score soon.", facts, roster).passed,
    ).toBe(false);
    expect(verifyGrounding("Riverside look tired.", facts, roster).passed).toBe(
      false,
    );
  });
  it("rejects event refs written into the answer text", () => {
    const result = verifyGrounding(
      "Theo March shot at 59:09, with Harbor on e2, e4 and E7.",
      facts,
      roster,
    );
    expect(result.passed).toBe(false);
    expect(result.issues.join(" ")).toContain("event refs (e2, e4, E7)");
    // Words that merely contain the pattern are fine.
    expect(
      verifyGrounding(
        "Harbor took 4 shots between 54:12 and 63:24.",
        facts,
        roster,
      ).passed,
    ).toBe(true);
  });
  it("collects clocks from free text", () => {
    const f = emptyFacts();
    addText(f, "Shot at 45+2:10");
    expect(f.clocks.has("45+2:10")).toBe(true);
  });
});

describe("analyst agent", () => {
  beforeEach(() => {
    configure("foundry");
    resetLocalSpendLedger();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses tools, then publishes a grounded answer with its trace", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply([surge]))
      .mockResolvedValueOnce(
        reply([
          answer({
            status: "answered",
            answer:
              "Harbor took 4 shots between 54:12 and 63:24, after 0 in the equal spell before.",
            citations: ["e1"],
          }),
        ]),
      );
    vi.stubGlobal("fetch", fetch);
    const steps: string[] = [];
    const result = await runAnalyst(
      match,
      CUTOFF,
      "What changed recently?",
      "fan",
      "foundry",
      { onStep: (s) => steps.push(s.kind) },
    );
    expect(result.status).toBe("answered");
    expect(result.citedEventIds).toHaveLength(1);
    expect(match.events.some((e) => e.id === result.citedEventIds[0])).toBe(
      true,
    );
    expect(steps).toEqual(["plan", "tool", "verify"]);
    expect(result.metrics.requests).toBe(2);
    expect(result.metrics.toolCalls).toBe(1);
    expect(result.metrics.estimatedCostUsd).toBeGreaterThan(0);
    // The tool call was replayed statelessly, with the projected evidence.
    const second = JSON.parse(fetch.mock.calls[1][1].body);
    expect(second.input[1]).toMatchObject({
      type: "function_call",
      call_id: "compare_time_windows",
    });
    const evidence = JSON.parse(second.input[2].output);
    expect(evidence.currentWindow.shots).toBe(4);
    expect(evidence.previousWindow.shots).toBe(0);
  });

  it("traces a build-up from a ref the agent was shown", async () => {
    let shotRef = "";
    const fetch = vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      if (fetch.mock.calls.length === 1)
        return reply([
          toolCall("get_shot_locations", {
            start: 3252,
            end: 3804,
            team: "harbor",
          }),
        ]);
      if (fetch.mock.calls.length === 2) {
        // The agent only ever sees refs, so it traces with one.
        const shown = JSON.parse(body.input.at(-1).output);
        shotRef = shown.events.at(-1).ref;
        return reply([
          toolCall("get_recorded_sequence", {
            start: 3252,
            end: 3804,
            team: "harbor",
            eventId: shotRef,
          }),
        ]);
      }
      return reply([
        answer({
          status: "answered",
          answer: "Theo March shot at 62:50.",
          citations: [shotRef],
        }),
      ]);
    });
    vi.stubGlobal("fetch", fetch);
    const steps: { kind: string; label: string }[] = [];
    const result = await runAnalyst(
      match,
      CUTOFF,
      "How did the last shot come about?",
      "fan",
      "foundry",
      { onStep: (s) => steps.push(s) },
    );
    expect(shotRef).toMatch(/^e\d+$/);
    expect(steps.map((s) => s.kind)).toEqual([
      "plan",
      "tool",
      "tool",
      "verify",
    ]);
    expect(steps[2].label).toBe("Traced the build-up to the 62:50 shot");
    const traced = JSON.parse(
      JSON.parse(fetch.mock.calls[2][1].body).input.at(-1).output,
    );
    expect(traced.error).toBeUndefined();
    expect(traced.totalEvents).toBeGreaterThan(1);
    expect(result.status).toBe("answered");
  });

  it("traces a build-up named by its match time, even in the first turn", async () => {
    const fetch = vi
      .fn()
      // Parallel calls, before any refs exist: the agent can only name times.
      .mockResolvedValueOnce(
        reply([
          toolCall(
            "get_recorded_sequence",
            { start: 3252, end: 3804, team: "harbor", eventId: "62:50" },
            "a",
          ),
          toolCall(
            "get_recorded_sequence",
            { start: 3252, end: 3804, team: null, eventId: "70:00" },
            "b",
          ),
        ]),
      )
      .mockResolvedValueOnce(
        reply([
          answer({
            status: "answered",
            answer: "Theo March shot at 62:50.",
            citations: ["e1"],
          }),
        ]),
      );
    vi.stubGlobal("fetch", fetch);
    const steps: { kind: string; label: string }[] = [];
    await runAnalyst(
      match,
      CUTOFF,
      "How did the 62:50 shot come about?",
      "fan",
      "foundry",
      {
        onStep: (s) => steps.push(s),
      },
    );
    expect(steps.map((s) => s.label)).toContain(
      "Traced the build-up to the 62:50 shot",
    );
    // 70:00 is after the 63:24 cutoff: nothing there yet, so still refused.
    const outputs = JSON.parse(fetch.mock.calls[1][1].body)
      .input.filter((i: { type?: string }) => i.type === "function_call_output")
      .map((i: { output: string }) => JSON.parse(i.output));
    expect(outputs[0].totalEvents).toBeGreaterThan(1);
    expect(outputs[1]).toEqual({ error: "Unknown or future event" });
  });

  it("revises once when the verifier finds an invented number", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply([surge]))
        .mockResolvedValueOnce(
          reply([
            answer({
              status: "answered",
              answer: "Harbor took 17 shots.",
              citations: ["e1"],
            }),
          ]),
        )
        .mockResolvedValueOnce(
          reply([
            answer({
              status: "answered",
              answer: "Harbor took 4 shots from 54:12 to 63:24.",
              citations: ["e1"],
            }),
          ]),
        ),
    );
    const kinds: string[] = [];
    const result = await runAnalyst(
      match,
      CUTOFF,
      "How many shots?",
      "plain",
      "foundry",
      { onStep: (s) => kinds.push(s.kind) },
    );
    expect(result.status).toBe("answered");
    expect(kinds).toEqual(["plan", "tool", "verify", "revise", "verify"]);
    expect(result.steps[2]).toMatchObject({ passed: false });
  });

  it("never shows an answer that fails verification twice", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply([surge]))
        .mockImplementation(async () =>
          reply([
            answer({
              status: "answered",
              answer: "Harbor took 17 shots.",
              citations: ["e1"],
            }),
          ]),
        ),
    );
    const result = await runAnalyst(
      match,
      CUTOFF,
      "How many shots?",
      "plain",
      "foundry",
    );
    expect(result.status).toBe("unverified");
    expect(result.answer).toBeNull();
  });

  it("asks the agent to fix a malformed reply instead of failing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply([surge]))
        .mockResolvedValueOnce(
          reply([
            {
              type: "message",
              content: [{ type: "output_text", text: "Harbor took 4 shots." }],
            },
          ]),
        )
        .mockResolvedValueOnce(
          reply([
            answer({
              status: "answered",
              answer: "Harbor took 4 shots from 54:12 to 63:24.",
              citations: ["e1", "e1", "e2", "e3", "e4", "e5", "e6", "e7"],
            }),
          ]),
        ),
    );
    const result = await runAnalyst(match, CUTOFF, "Shots?", "fan", "foundry");
    expect(result.status).toBe("answered");
    expect(result.citedEventIds).toHaveLength(6);
    expect(result.steps.map((s) => s.kind)).toContain("revise");
  });

  it("gives the agent the goals so far", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      reply([
        answer({
          status: "cannot_answer",
          answer: "Nothing to add.",
          citations: [],
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetch);
    await runAnalyst(match, CUTOFF, "Who scored?", "fan", "foundry");
    const first = JSON.parse(
      JSON.parse(fetch.mock.calls[0][1].body).input[0].content,
    );
    expect(first.context.now.goals).toEqual([
      { clock: "01:00", team: "Harbor", scorer: "Arlo Hayes" },
    ]);
  });

  it("declines gracefully even when the decline cites nothing real", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        reply([
          answer({
            status: "cannot_answer",
            answer: "Recorded events can't say who will win.",
            citations: ["e1"],
          }),
        ]),
      ),
    );
    const result = await runAnalyst(
      match,
      CUTOFF,
      "Who is going to win?",
      "fan",
      "foundry",
    );
    expect(result.status).toBe("declined");
    expect(result.citedEventIds).toEqual([]);
  });

  it("retries once when the model times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("socket hang up"))
        .mockResolvedValueOnce(reply([surge]))
        .mockResolvedValueOnce(
          reply([
            answer({
              status: "answered",
              answer: "Harbor took 4 shots from 54:12 to 63:24.",
              citations: ["e1"],
            }),
          ]),
        ),
    );
    const result = await runAnalyst(match, CUTOFF, "Shots?", "fan", "foundry");
    expect(result.status).toBe("answered");
  });

  it("rejects citations that no tool returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply([surge]))
        .mockImplementation(async () =>
          reply([
            answer({
              status: "answered",
              answer: "Harbor took 4 shots.",
              citations: ["e999"],
            }),
          ]),
        ),
    );
    const result = await runAnalyst(match, CUTOFF, "Shots?", "fan", "foundry");
    expect(result.status).toBe("unverified");
  });

  it("declines questions the events can't answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        reply([
          answer({
            status: "cannot_answer",
            answer:
              "Recorded events can't show how the manager feels. They can show where Harbor's shots came from.",
            citations: [],
          }),
        ]),
      ),
    );
    const result = await runAnalyst(
      match,
      CUTOFF,
      "Is the manager angry?",
      "plain",
      "foundry",
    );
    expect(result.status).toBe("declined");
    expect(result.answer).toContain("can't");
  });

  it("feeds invalid queries back to the agent instead of failing", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        reply([toolCall("get_team_statistics", { start: 0, end: 9999 })]),
      )
      .mockResolvedValueOnce(reply([surge]))
      .mockResolvedValueOnce(
        reply([
          answer({
            status: "answered",
            answer: "Harbor took 4 shots from 54:12 to 63:24.",
            citations: ["e1"],
          }),
        ]),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await runAnalyst(match, CUTOFF, "Shots?", "fan", "foundry");
    expect(result.status).toBe("answered");
    expect(result.steps.map((s) => s.kind)).toContain("rejected-query");
    // A refused query reads as the agent refining, not as an error.
    const refused = result.steps.find((s) => s.kind === "rejected-query")!;
    expect(refused.label).toBe("Refining the time window");
  });

  it.each([
    [
      "at full time, over the whole match",
      5400,
      0,
      ["01:00", "74:35", "77:33"],
    ],
    ["at 80:00, over the second half so far", 4800, 2700, ["74:35", "77:33"]],
  ])(
    "answers %s from one long window, with every goal citable",
    async (_, cutoff, start, goalClocks) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          reply([toolCall("get_match_events", { start, end: cutoff })]),
        )
        .mockImplementationOnce(async (_url, init: RequestInit) => {
          // Cite whatever goals the tool returned, the way the model would.
          const body = JSON.parse(init.body as string);
          const evidence = JSON.parse(body.input.at(-1).output);
          const goals = evidence.events.filter(
            (e: { goal?: boolean }) => e.goal,
          );
          return reply([
            answer({
              status: "answered",
              answer: `Goals at ${goals.map((g: { clock: string }) => g.clock).join(", ")}.`,
              citations: goals.map((g: { ref: string }) => g.ref),
            }),
          ]);
        });
      vi.stubGlobal("fetch", fetch);
      const result = await runAnalyst(
        match,
        cutoff,
        "How was this match decided?",
        "fan",
        "foundry",
      );
      expect(result.steps.map((s) => s.kind)).toEqual([
        "plan",
        "tool",
        "verify",
      ]);
      expect(result.steps[0].label).toBe(
        cutoff === match.duration
          ? "Reading the match at full time"
          : "Reading the match at 80:00",
      );
      expect(result.status).toBe("answered");
      expect(result.answer).toBe(`Goals at ${goalClocks.join(", ")}.`);
      expect(result.citedEventIds).toHaveLength(goalClocks.length);
      // The Director's own investigations keep their 30-minute bound.
      expect(() =>
        createInvestigation(match, cutoff, "fan").execute("get_match_events", {
          matchId: match.id,
          start,
          end: cutoff,
          team: null,
          playerId: null,
          eventId: null,
        }),
      ).toThrow("Invalid evidence window");
    },
  );

  it("labels tool calls in plain words", () => {
    expect(
      describeToolCall(match, "compare_time_windows", {
        matchId: match.id,
        start: 3252,
        end: 3804,
        team: "harbor",
        playerId: null,
        eventId: null,
      }),
    ).toBe("Compared Harbor 45:00–54:12 with 54:12–63:24");
  });

  it("stays offline without spending when AI is disabled", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await askAnalyst(match, CUTOFF, "Shots?", "plain");
    expect(result.status).toBe("offline");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back without an answer when the dollar ceiling is reached", async () => {
    vi.stubEnv("AI_SPEND_CEILING_USD", "0.000001");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const result = await askAnalyst(
      match,
      CUTOFF,
      "Any shots lately?",
      "plain",
    );
    expect(result.status).toBe("unavailable");
    expect(result.answer).toBeNull();
    expect(result.notice).toContain("usage limit");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("spend ledger", () => {
  beforeEach(() => resetLocalSpendLedger());
  afterEach(() => vi.unstubAllEnvs());

  it("prices the worst case at one token per byte plus full output", () => {
    // (20,000 + 256) bytes x $0.75/M + 1,800 x $4.50/M = $0.023292
    expect(attemptMicros(20000, 1800)).toBe(23292);
  });
  it("stops reserving at the ceiling and never refunds", async () => {
    vi.stubEnv("AI_SPEND_CEILING_USD", "0.05");
    vi.stubEnv("AI_SPEND_LEDGER", "test");
    await reserveSpend(20000, 1800);
    await reserveSpend(20000, 1800);
    await expect(reserveSpend(20000, 1800)).rejects.toBeInstanceOf(
      UsageFailure,
    );
  });
  it("keeps ledgers separate", async () => {
    vi.stubEnv("AI_SPEND_CEILING_USD", "0.03");
    vi.stubEnv("AI_SPEND_LEDGER", "test");
    await reserveSpend(20000, 1800);
    vi.stubEnv("AI_SPEND_LEDGER", "production");
    await expect(reserveSpend(20000, 1800)).resolves.toBeTruthy();
  });
  it("fails closed in production without a ceiling", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(reserveSpend(100, 10)).rejects.toBeInstanceOf(UsageFailure);
  });
  it("is a no-op in development without a ceiling", async () => {
    await expect(reserveSpend(100, 10)).resolves.toBeNull();
  });
});

describe("per-client courtesy limit", () => {
  it("allows a burst, then pauses that client only", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(clientAllowed("a", now, 3)).toBe(true);
    expect(clientAllowed("a", now, 3)).toBe(false);
    expect(clientAllowed("b", now, 3)).toBe(true);
    expect(clientAllowed("a", now + 11 * 60 * 1000, 3)).toBe(true);
  });
});
