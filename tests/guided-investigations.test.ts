import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCases } from "../eval/foundry-study/cases";
import { observe } from "../src/lib/ai/director/observer";
import {
  guidedQuestions,
  questionEvidence,
  presentQuestion,
  type QuestionIntent,
} from "../src/lib/ai/director/questions";
import {
  answerQuestion,
  deterministicQuestion,
  investigateQuestion,
} from "../src/lib/ai/director/question-runner";
import { configure } from "./ai-helpers";
const cases = loadCases();
function fixture(index = 0, intent: QuestionIntent = "chance-quality") {
  const c = cases[index];
  const story = observe(c.match, c.cutoff).find(
    (c) =>
      c.category === "activity-change" && c.statistics[0].label === "shots",
  )!;
  if (!story) throw new Error(`No story in fixture ${index}`);
  return { ...c, question: { intent, storyId: story.id } };
}
const response = (plan: unknown) =>
  Response.json({
    status: "completed",
    usage: { input_tokens: 100, output_tokens: 20 },
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(plan) }],
      },
    ],
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("typed guided questions", () => {
  it("separates per-shot quality, total xG and volume on misleading evidence in both styles", () => {
    const c = fixture();
    const e = questionEvidence(c.match, c.cutoff, c.question)!;
    expect(e.verdict).toBe("lower");
    expect(e.availability).toBe("available");
    for (const style of ["plain", "fan", "analysis"] as const) {
      const text = presentQuestion(e, c.match, style);
      expect(text.answer).toMatch(/^No\./);
      expect(text.measurement).toContain("xG per shot");
      expect(text.qualifications.join(" ")).toContain("Shot volume rose");
      expect(text.windows).toContain("30:00");
    }
  });
  it("compares corresponding opponent windows and separates the two recent halves", () => {
    const c = fixture(2, "opponent-improvement");
    for (const intent of ["opponent-improvement", "fading-activity"] as const) {
      const e = questionEvidence(c.match, c.cutoff, { ...c.question, intent })!;
      expect(e.windows[0].period).toBe(e.windows[1].period);
      for (const m of e.measurements) {
        const w = e.windows.find((w) => w.id === m.window)!;
        const count = c.match.events.filter(
          (v) =>
            v.team === m.team &&
            v.type === "shot" &&
            v.time > w.start &&
            v.time <= w.end &&
            v.period === w.period,
        ).length;
        expect(m.value).toBe(count);
      }
      if (intent === "fading-activity") {
        expect(e.verdict).toBe("lower");
        expect(e.windows).toHaveLength(4);
        expect(presentQuestion(e, c.match, "plain").answer).toMatch(/^Yes/);
      }
    }
  });
  it("retains missing ratings as null and explains unsupported questions without HTTP", async () => {
    configure("foundry");
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    const c = fixture();
    for (const missing of ["all", "one", "prior"] as const) {
      const match = structuredClone(c.match);
      if (missing === "all") match.capabilities.xg = false;
      else if (missing === "one")
        delete match.events.find((e) => e.type === "shot")!.xg;
      else
        match.events = match.events
          .filter((e) => e.type !== "shot" || e.time > 900)
          .map((e, order) => ({ ...e, order }));
      const story = observe(match, c.cutoff).find(
        (s) =>
          s.category === "activity-change" && s.statistics[0].label === "shots",
      )!;
      const q = { ...c.question, storyId: story.id };
      const result = await answerQuestion(match, c.cutoff, q);
      expect(result.evidence.availability).toBe("unavailable");
      expect(result.source).toBe("offline");
      expect(
        guidedQuestions(match, c.cutoff, story.id).find(
          (q) => q.intent === "chance-quality",
        )?.unavailable,
      ).toBeTruthy();
      expect(result.evidence.measurements.some((m) => m.value === null)).toBe(
        true,
      );
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it("restrains quiet, resolved, decisive and nonexistent stories", () => {
    const c = cases[3];
    expect(guidedQuestions(c.match, c.cutoff, "invented")).toEqual([]);
    for (const story of observe(c.match, c.match.duration))
      expect(guidedQuestions(c.match, c.match.duration, story.id)).toEqual([]);
    expect(() =>
      deterministicQuestion(c.match, c.cutoff, {
        intent: "fading-activity",
        storyId: "future",
      }),
    ).toThrow();
  });
  it.each([
    "chance-quality",
    "opponent-improvement",
    "fading-activity",
  ] as const)(
    "carries %s through retrieval, verification and rendering",
    async (intent) => {
      configure("foundry");
      const c = fixture(0, intent),
        baseline = deterministicQuestion(c.match, c.cutoff, c.question);
      const transport = vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        expect(JSON.parse(body.input[0].content).question.question.intent).toBe(
          intent,
        );
        return response({
          intent,
          verdict: baseline.evidence.verdict,
          supplementIds: [],
        });
      });
      vi.stubGlobal("fetch", transport);
      const result = await investigateQuestion(
        c.match,
        c.cutoff,
        c.question,
        "foundry",
      );
      expect(result.evidence).toEqual(baseline.evidence);
      expect(result.source).toBe("foundry");
      expect(result.trace[0].tool).toBe(
        intent === "opponent-improvement"
          ? "compare_time_windows"
          : "get_team_statistics",
      );
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it("lets the model select a meaningful counter-evidence follow-up without requiring one", async () => {
    configure("foundry");
    const c = fixture(1, "opponent-improvement"),
      baseline = deterministicQuestion(c.match, c.cutoff, c.question);
    const [previous, current] = baseline.evidence.windows;
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "completed",
          usage: { input_tokens: 100, output_tokens: 20 },
          output: [
            {
              type: "function_call",
              call_id: "one",
              name: "inspect_match_evidence",
              arguments: JSON.stringify({
                tool: "inspect_counter_evidence",
                matchId: c.match.id,
                start: previous.start,
                end: current.end,
                team: null,
                playerId: null,
                eventId: observe(c.match, c.cutoff)
                  .find((s) => s.id === c.question.storyId)!
                  .evidenceIds.at(-1),
              }),
            },
          ],
        }),
      )
      .mockImplementationOnce(async (_url, init) => {
        const body = JSON.parse(init.body),
          result = JSON.parse(body.input.at(-1).output);
        expect(result.intent).toBe(c.question.intent);
        const ids = result.availableSupplements.map(
          (s: { id: string }) => s.id,
        );
        expect(ids).toContain("current-shot-outcomes");
        return response({
          intent: c.question.intent,
          verdict: baseline.evidence.verdict,
          supplementIds: ["current-shot-outcomes"],
        });
      });
    vi.stubGlobal("fetch", transport);
    const result = await investigateQuestion(
      c.match,
      c.cutoff,
      c.question,
      "foundry",
    );
    expect(result.supplements[0].eventIds.length).toBeGreaterThan(0);
    expect(result.metrics.requests).toBe(2);
  });
  it("rejects an incorrect conclusion, wrong intent, unqueried facts and future prose", async () => {
    configure("foundry");
    const c = fixture();
    for (const plan of [
      { intent: c.question.intent, verdict: "higher", supplementIds: [] },
      { intent: "opponent-improvement", verdict: "lower", supplementIds: [] },
      {
        intent: c.question.intent,
        verdict: "lower",
        supplementIds: ["invented"],
      },
      {
        intent: c.question.intent,
        verdict: "lower",
        supplementIds: [],
        answer: "They will score next",
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response(plan)),
      );
      await expect(
        investigateQuestion(c.match, c.cutoff, c.question, "foundry"),
      ).rejects.toThrow();
    }
  });
  it("preserves source restrictions, failure recovery, successful reuse and separate intent identity", async () => {
    vi.resetModules();
    configure("foundry");
    vi.stubEnv("AI_MINUTE_LIMIT", "10");
    const { answerQuestion: answer } =
      await import("../src/lib/ai/director/question-runner");
    const c = fixture();
    const transport = vi.fn(async (_url, init) => {
      const e = JSON.parse(JSON.parse(init.body).input[0].content).question;
      return response({
        intent: e.question.intent,
        verdict: e.verdict,
        supplementIds: [],
      });
    });
    vi.stubGlobal("fetch", transport);
    const restricted = structuredClone(c.match);
    restricted.provenance.redistribution = "restricted";
    expect((await answer(restricted, c.cutoff, c.question)).source).toBe(
      "offline",
    );
    expect(transport).not.toHaveBeenCalled();
    const [a, b] = await Promise.all([
      answer(c.match, c.cutoff, c.question),
      answer(c.match, c.cutoff, c.question),
    ]);
    expect(a.source).toBe("foundry");
    expect(b.evidence).toEqual(a.evidence);
    expect(transport).toHaveBeenCalledTimes(1);
    expect((await answer(c.match, c.cutoff, c.question)).metrics.cached).toBe(
      true,
    );
    await answer(c.match, c.cutoff, {
      ...c.question,
      intent: "fading-activity",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
