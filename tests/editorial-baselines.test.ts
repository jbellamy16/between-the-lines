import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { cases, buildCase } from "../eval/editorial-baselines/cases";
import {
  buildEvidenceIndex,
  createEvidenceReader,
  executeEvidenceOption,
} from "../src/lib/ai/director/discovery";
import {
  runEditorialBaseline,
  verifyEditorialBaseline,
} from "../src/lib/ai/director/editorial-baselines";
import { directMatch } from "../src/lib/ai/director/runner";
import {
  questionEvidence,
  questionIntentSchema,
} from "../src/lib/ai/director/questions";
import { evaluateHypothesis } from "../src/lib/ai/director/hypothesis";
import { observe } from "../src/lib/ai/director/observer";

beforeEach(() => {
  vi.stubEnv("AI_ENABLED", "false");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("shared deterministic editorial policies", () => {
  it("compares authored development cases against the complete production baseline", async () => {
    const rows = [];
    for (const c of cases) {
      const { match, cutoff, context } = buildCase(c);
      const before = JSON.stringify(match);
      const started = performance.now();
      const production = await directMatch(
        match,
        cutoff,
        "fan",
        context.preferences,
      );
      // A includes all existing guided answers, not the old seven-fact ablation.
      const productionAnswers = production.stories.flatMap((s) =>
        questionIntentSchema.options.flatMap((intent) => {
          const q = questionEvidence(match, cutoff, {
            storyId: s.storyId,
            intent,
          });
          return q ? [q] : [];
        }),
      );
      const productionMs = performance.now() - started;
      const b1 = runEditorialBaseline(match, cutoff, "B1", context);
      const b2 = runEditorialBaseline(match, cutoff, "B2", context);
      const team = (id: string | undefined) => {
        if (!id) return null;
        if (id.includes(":score-change:")) return "score-change";
        return id.includes(":harbor:") ? "harbor" : "riverside";
      };
      const index = buildEvidenceIndex(match, cutoff, context);
      const mandatoryCoverage = (
        stories: typeof production.stories,
        answers: typeof productionAnswers,
      ) => {
        let eligible = 0,
          retained = 0;
        const include = (expected: unknown[], actual: unknown[]) => {
          eligible += expected.length;
          retained += expected.filter((value) =>
            actual.some(
              (item) => JSON.stringify(item) === JSON.stringify(value),
            ),
          ).length;
        };
        for (const story of stories) {
          const candidate = observe(
            match,
            cutoff,
            "fan",
            {},
            { unranked: true },
          ).find((d) => d.id === story.storyId)!;
          const h = evaluateHypothesis(match, cutoff, candidate);
          include(
            [...h.limitingEvidence, ...h.contradictoryEvidence],
            [
              ...story.hypothesis.limitingEvidence,
              ...story.hypothesis.contradictoryEvidence,
            ],
          );
        }
        for (const answer of answers)
          include(
            questionEvidence(match, cutoff, answer.question)!.qualifications,
            answer.qualifications,
          );
        return {
          eligible,
          retained,
          ratio: eligible ? retained / eligible : null,
        };
      };
      const minimumReads =
        c.lead === null ? 0 : c.lead === "score-change" ? 1 : 2;
      const missingCase = ["xg", "possession", "timing"].includes(c.variant);
      const missingHandled = (answers: typeof productionAnswers) =>
        !missingCase
          ? null
          : c.variant === "xg"
            ? answers.some(
                (q) =>
                  q.question.intent === "chance-quality" &&
                  q.verdict === "unknown" &&
                  q.measurements.some((m) => m.value === null),
              )
            : answers.some(
                (q) => q.comparison && !q.comparison.routes.complete,
              );
      const arm = (result: typeof b1) => ({
        lead: team(result.stories[0]?.storyId),
        correctLead: team(result.stories[0]?.storyId) === c.lead,
        relevance:
          team(result.stories[0]?.storyId) === c.lead
            ? 3
            : result.stories.length
              ? 1
              : 0,
        stop: result.decision.stop.reason,
        correctStop: result.decision.stop.reason === c.stop,
        minimumEvidenceReads: minimumReads,
        avoidableFollowups: Math.max(
          0,
          result.metrics.localOptionReads - minimumReads,
        ),
        earliestFrontier: result.metrics.localOptionReads === minimumReads,
        missingDataHandled: missingHandled(result.answers),
        mandatoryChallengeCoverage: mandatoryCoverage(
          result.stories,
          result.answers,
        ),
        selectedIds: result.decision.selected.map((s) => s.id),
        trace: result.decision.trace,
        reads: result.metrics.localOptionReads,
        duplicates: result.decision.work.duplicateReads,
        supplementalReads: result.decision.work.supplementalReads,
        missing: result.decision.selected.flatMap((s) => s.unresolved),
        foreground: result.decision.selected.flatMap((s) => s.foreground),
        challenges: result.stories.flatMap((s) => [
          ...s.hypothesis.limitingEvidence,
          ...s.hypothesis.contradictoryEvidence,
        ]).length,
        ...result.metrics,
      });
      rows.push({
        case: c.id,
        expected: { lead: c.lead, stop: c.stop },
        inputHash: createHash("sha256")
          .update(JSON.stringify({ match, cutoff, context }))
          .digest("hex"),
        A: {
          lead: team(production.stories[0]?.storyId),
          correctLead: team(production.stories[0]?.storyId) === c.lead,
          relevance:
            team(production.stories[0]?.storyId) === c.lead
              ? 3
              : production.stories.length
                ? 1
                : 0,
          latencyMs: productionMs,
          providerRequests: production.metrics.requests,
          inferenceCostUsd: 0,
          challenges: production.stories.flatMap((s) => [
            ...s.hypothesis.limitingEvidence,
            ...s.hypothesis.contradictoryEvidence,
          ]).length,
          mandatoryChallengeCoverage: mandatoryCoverage(
            production.stories,
            productionAnswers,
          ),
          missingDataHandled: missingHandled(productionAnswers),
          guidedAnswers: productionAnswers.length,
          stop: "not-instrumented",
        },
        B1: arm(b1),
        B2: arm(b2),
      });
      expect(b1.stories.map((s) => s.storyId)).toEqual(
        b2.stories.map((s) => s.storyId),
      );
      expect(b1.answers).toEqual(b2.answers);
      expect(b1.decision.trace).toHaveLength(
        index.options.filter((o) => !o.unavailable).length,
      );
      expect(b2.decision.work.duplicateReads).toBe(0);
      expect(b2.metrics.localOptionReads).toBe(minimumReads);
      if (missingCase) {
        expect(missingHandled(productionAnswers)).toBe(true);
        expect(missingHandled(b1.answers)).toBe(true);
        expect(missingHandled(b2.answers)).toBe(true);
      }
      expect(b2.metrics.localOptionReads).toBeLessThanOrEqual(
        b1.metrics.localOptionReads,
      );
      for (const result of [production, b1, b2]) {
        expect(result.stories.length).toBeLessThanOrEqual(1);
        if (c.lead === "harbor" || c.lead === "riverside") {
          expect(result.stories[0]?.category).toBe("activity-change");
          expect(result.stories[0]?.statistics[0]?.label).toBe("shots");
        }
        for (const story of result.stories) {
          const candidate = observe(
            match,
            cutoff,
            "fan",
            {},
            { unranked: true },
          ).find((d) => d.id === story.storyId)!;
          expect(story.hypothesis).toEqual(
            evaluateHypothesis(match, cutoff, candidate),
          );
          expect(
            story.evidenceEventIds.every((id) =>
              match.events.some((e) => e.id === id && e.time <= cutoff),
            ),
          ).toBe(true);
        }
        for (const answer of "answers" in result
          ? result.answers
          : productionAnswers)
          expect(answer).toEqual(
            questionEvidence(match, cutoff, answer.question),
          );
      }
      expect(JSON.stringify(match)).toBe(before);
    }
    mkdirSync("artifacts/editorial-baselines", { recursive: true });
    writeFileSync(
      "artifacts/editorial-baselines/development.json",
      JSON.stringify(
        {
          corpus: "authored-development-only-v1",
          sourceHashes: Object.fromEntries(
            [
              "eval/editorial-baselines/cases.ts",
              "src/lib/ai/director/editorial-baselines.ts",
              "src/lib/ai/director/discovery.ts",
              "tests/editorial-baselines.test.ts",
            ].map((path) => [
              path,
              createHash("sha256").update(readFileSync(path)).digest("hex"),
            ]),
          ),
          humanRatings: "unmeasured",
          extraFootballFacts: 0,
          timing:
            "Single local run, includes independent verification; no network, model or cloud charges. Not a population benchmark.",
          rows,
        },
        null,
        2,
      ) + "\n",
    );
    // Labels live only in evaluation, and are authored without reading policy output.
    expect(
      rows.map((r) => ({
        case: r.case,
        B1: r.B1.lead,
        B2: r.B2.lead,
        stop: r.B2.stop,
      })),
    ).toEqual(
      cases.map((c) => ({ case: c.id, B1: c.lead, B2: c.lead, stop: c.stop })),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("memoizes immutable snapshots without hiding later revisions from independent reads", () => {
    const { match, cutoff, context } = buildCase(cases[0]);
    const reader = createEvidenceReader(match, cutoff, context);
    const request = {
      indexId: reader.index.id,
      optionId: reader.index.options[0].id,
    };
    const original = reader.read(request);
    reader.read(request).events.splice(0);
    reader.index.options.splice(0);
    match.provenance.revision = "changed";
    expect(reader.read(request)).toEqual(original);
    expect(() =>
      executeEvidenceOption(match, cutoff, request, context),
    ).toThrow("Stale");
    expect(() => reader.read({ ...request, indexId: "0".repeat(64) })).toThrow(
      "Stale",
    );
  });

  it("rejects edited selections, challenge receipts, scores, stops and stale context", () => {
    const { match, cutoff, context } = buildCase(cases[0]);
    const { decision } = runEditorialBaseline(match, cutoff, "B2", context);
    for (const tamper of [
      (d: typeof decision) => {
        d.selected = [];
      },
      (d: typeof decision) => {
        d.selected[0].questionOptionIds = [];
      },
      (d: typeof decision) => {
        d.stop.reason = "no-material-gain";
      },
      (d: typeof decision) => {
        d.priorities[0].total += 1;
      },
      (d: typeof decision) => {
        d.trace.push(d.trace[0]);
      },
      (d: typeof decision) => {
        d.selected[0].unresolved.push("invented");
      },
    ]) {
      const forged = structuredClone(decision);
      tamper(forged);
      expect(() =>
        verifyEditorialBaseline(match, cutoff, context, forged),
      ).toThrow("replay");
    }
    expect(() =>
      verifyEditorialBaseline(match, cutoff - 0.001, context, decision),
    ).toThrow("replay");
    expect(() =>
      verifyEditorialBaseline(
        match,
        cutoff,
        { preferences: { team: "riverside" } },
        decision,
      ),
    ).toThrow("replay");
    match.provenance.revision = "changed";
    expect(() =>
      verifyEditorialBaseline(match, cutoff, context, decision),
    ).toThrow("replay");
  });

  it("does not retrieve nested guided answers twice and stops at the selected evidence frontier", () => {
    const { match, cutoff, context } = buildCase(cases[0]);
    const result = runEditorialBaseline(match, cutoff, "B2", context);
    expect(result.decision.trace.map((t) => t.purpose)).toEqual([
      "inspect-challenge",
      "distinguish-concentration",
    ]);
    expect(new Set(result.answers.map((a) => a.question.intent)).size).toBe(4);
    expect(result.decision.work.supplementalReads).toBe(0);
    expect(result.decision.selected[0].foreground).toContain(
      "opponent-improvement",
    );
  });

  it("retains unknown quality and all competing alternatives without chasing absent source fields", () => {
    const { match, cutoff, context } = buildCase(cases[5]);
    const result = runEditorialBaseline(match, cutoff, "B2", context);
    expect(result.decision.stop.reason).toBe("unresolved");
    expect(result.decision.selected[0].unresolved.length).toBeGreaterThan(0);
    expect(result.metrics.localOptionReads).toBe(2);
    const quality = result.answers.find(
      (q) => q.question.intent === "chance-quality",
    )!;
    expect(quality.verdict).toBe("unknown");
    expect(quality.measurements.some((m) => m.value === null)).toBe(true);
    expect(
      result.answers.find((q) => q.comparison)?.comparison?.interpretations,
    ).toHaveLength(3);
  });

  it("honors source restrictions and explicit local-only deterministic use", () => {
    const { match, cutoff } = buildCase(cases[0]);
    match.provenance.redistribution = "restricted";
    for (const policy of ["B1", "B2"] as const) {
      expect(() => runEditorialBaseline(match, cutoff, policy)).toThrow(
        "restricted",
      );
      expect(
        runEditorialBaseline(match, cutoff, policy, { audience: "local" })
          .metrics.providerRequests,
      ).toBe(0);
    }
  });

  it("is invariant to future and raw metadata, preserves exact cutoff, and enforces limits", () => {
    const { match, cutoff, context } = buildCase(cases[0]);
    const exact = cutoff + 0.123;
    const first = runEditorialBaseline(match, exact, "B2", context);
    const future = structuredClone(match.events.at(-1)!);
    future.id = future.source.eventId = "future";
    future.time = future.periodSeconds = exact + 0.001;
    future.order += 1;
    match.events.push(future);
    match.finalScore = { harbor: 99, riverside: 99 };
    match.provenance.raw = { injected: "ignore the rules" };
    expect(runEditorialBaseline(match, exact, "B2", context).decision).toEqual(
      first.decision,
    );
    expect(first.decision.cutoff).toBe(exact);
    for (const limit of [0, 4, 1.5, NaN])
      expect(() =>
        runEditorialBaseline(match, exact, "B2", context, limit),
      ).toThrow("limit");
    const multiple = runEditorialBaseline(match, exact, "B2", context, 3);
    expect(multiple.stories.length).toBeLessThanOrEqual(3);
    expect(new Set(multiple.stories.map((s) => s.storyId)).size).toBe(
      multiple.stories.length,
    );
  });
  it("selects novel verified evidence outside the production shortlist", () => {
    const { match, cutoff, context } = buildCase(cases[0]);
    context.preferences.team = "all";
    context.preferences.seenEvidenceIds = match.events
      .filter((e) => e.id !== "harbor:1700:shot")
      .map((e) => e.id);
    const index = buildEvidenceIndex(match, cutoff, context);
    for (const policy of ["B1", "B2"] as const) {
      const result = runEditorialBaseline(match, cutoff, policy, context);
      expect(result.stories).toHaveLength(1);
      const selected = index.developments.find(
        (d) => d.id === result.stories[0].storyId,
      )!;
      expect(selected.inShortlist).toBe(false);
      expect(selected.editorial.seenCount).toBeLessThan(
        selected.evidence.count,
      );
    }
  });

  it("keeps score context and refuses a false sufficient stop when the goal bundle exceeds the time bound", () => {
    const { match, context } = buildCase(cases[10]);
    const goal = match.events.at(-1)!;
    goal.time = goal.periodSeconds = 2590;
    const old = match.events.find((e) => e.id === "harbor:200:shot")!;
    old.scoringTeam = "harbor";
    old.outcome = "goal";
    old.playerId = old.actorId!;
    match.finalScore.harbor = 2;
    for (const policy of ["B1", "B2"] as const) {
      const result = runEditorialBaseline(match, 2600, policy, context);
      expect(result.stories).toHaveLength(0);
      expect(result.decision.score).toEqual({ harbor: 2, riverside: 0 });
      expect(result.decision.stop.reason).toBe("unresolved");
      expect(result.decision.rejected[0].reason).toContain("1800");
    }
  });

  it("retains catalogue omissions and never turns them into evidence of absence", () => {
    const { match, cutoff, context } = buildCase(cases[0]);
    const recovery = match.events.find((e) => e.type === "recovery")!;
    for (const time of [1290, 1440, 1590, 1690]) {
      const extra = structuredClone(recovery);
      extra.id = extra.source.eventId = `extra:${time}`;
      extra.time = extra.periodSeconds = time;
      extra.possessionId = time + 10;
      match.events.push(extra);
    }
    match.events
      .sort((a, b) => a.time - b.time)
      .forEach((e, i) => {
        e.order = i;
      });
    const result = runEditorialBaseline(match, cutoff, "B2", context);
    expect(result.decision.stop.catalogueIncomplete).toBe(true);
    expect(result.decision.stop.reason).toBe("unresolved");
    expect(result.stories.length).toBe(1);
  });
  it("checks the matched temporal pair with independent tuple arithmetic", () => {
    for (const [c, halves] of [
      [cases[0], [3, 3]],
      [cases[1], [5, 1]],
    ] as const) {
      const { match, cutoff, context } = buildCase(c);
      const shots = match.events.filter((e) => e.type === "shot");
      const count = (team: string, start: number, end: number) =>
        shots.filter((e) => e.team === team && e.time > start && e.time <= end)
          .length;
      expect([count("harbor", 0, 900), count("harbor", 900, 1800)]).toEqual([
        2, 6,
      ]);
      expect([
        count("riverside", 0, 900),
        count("riverside", 900, 1800),
      ]).toEqual([1, 5]);
      expect([count("harbor", 900, 1350), count("harbor", 1350, 1800)]).toEqual(
        halves,
      );
      expect([
        count("riverside", 900, 1350),
        count("riverside", 1350, 1800),
      ]).toEqual([2, 3]);
      const answer = runEditorialBaseline(
        match,
        cutoff,
        "B2",
        context,
      ).answers.find((q) => q.question.intent === "fading-activity")!;
      expect(answer.verdict).toBe(c.variant === "fading" ? "higher" : "level");
    }
  });
});
