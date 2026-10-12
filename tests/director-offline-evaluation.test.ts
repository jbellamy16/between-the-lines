import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  cases,
  buildCase,
  referenceFacts,
} from "../eval/director-offline/cases";
import { factsFor, score } from "../eval/director-offline/scoring";
import { scriptedTransport, type Policy } from "../eval/director-offline/mock";
import { observe } from "../src/lib/ai/director/observer";
import { evaluateHypothesis } from "../src/lib/ai/director/hypothesis";
import {
  questionEvidence,
  presentQuestion,
  type QuestionEvidence,
} from "../src/lib/ai/director/questions";
import {
  answerQuestion,
  deterministicQuestion,
  type QuestionResult,
} from "../src/lib/ai/director/question-runner";
import { configure } from "./ai-helpers";
import * as requestControls from "../src/lib/ai/request-controls";

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rows: any[] = [],
  attacks: any[] = [],
  transcripts: any[] = [];
const arms = [
  "A-existing-deterministic",
  "B-strengthened-deterministic",
  "C-fixed-mock",
  "D-adaptive-mock",
] as const;
let offset = 0;
beforeEach(() => {
  // Guard before any provider configuration. Never retain or call native fetch.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network prohibited in offline evaluation");
    }),
  );
  configure("foundry");
  const now = Date.now.bind(Date);
  offset += 86400000; // isolate in-memory quotas; pacing is mocked, not benchmarked
  vi.spyOn(Date, "now").mockImplementation(() => now() + offset);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function context(c: (typeof cases)[number]) {
  const match = buildCase(c);
  const candidate = observe(match, 1800, "fan", {}, { unranked: true }).find(
    (v) =>
      v.category === "activity-change" &&
      v.team === "harbor" &&
      v.statistics[0].label === "shots" &&
      v.statistics[0].value > (v.statistics[1]?.value ?? Infinity),
  );
  // Select from production candidates without precomputing the new comparison for arm A.
  const question = candidate
    ? { storyId: candidate.id, intent: "shot-surge-explanations" as const }
    : null;
  return {
    match,
    candidate,
    question,
  };
}
function baseline(match: ReturnType<typeof buildCase>, storyId: string) {
  return (
    ["chance-quality", "opponent-improvement", "fading-activity"] as const
  ).map((intent) => questionEvidence(match, 1800, { storyId, intent })!);
}

describe("paired offline Director evaluation", () => {
  for (const c of cases)
    for (const arm of arms)
      it(`${c.id} / ${arm}`, async () => {
        const mock = scriptedTransport(
          arm === "C-fixed-mock" ? "fixed" : "adaptive",
        );
        vi.stubGlobal("fetch", mock.fetch);
        let reservation = 0;
        const reservationAttempts: number[] = [];
        vi.mocked(requestControls.reserveProviderAttempt).mockImplementation(
          async (tokens) => {
            reservationAttempts.push(tokens);
            if (reservation + tokens > 30000)
              throw new requestControls.UsageFailure("capacity");
            reservation += tokens;
          },
        );
        const start = performance.now();
        const { match, candidate, question } = context(c);
        let answers: QuestionEvidence[] = [],
          result: QuestionResult | undefined;
        const oldAnswers = question ? baseline(match, question.storyId) : [];
        const assessment =
          question && candidate
            ? evaluateHypothesis(match, 1800, candidate)
            : undefined;
        if (question) {
          if (arm.startsWith("A-")) answers = oldAnswers;
          else {
            // Avoid cross-arm cache reuse without altering canonical event data.
            match.provenance.revision += `:${arm}`;
            result = arm.startsWith("B-")
              ? deterministicQuestion(match, 1800, question)
              : await answerQuestion(match, 1800, question);
            answers = [...oldAnswers, result.evidence];
          }
        }
        const latencyMs = performance.now() - start;
        const oldFacts = factsFor(oldAnswers, assessment),
          facts = factsFor(answers, assessment);
        const attemptedQueries = mock.transcript.flatMap((r) =>
          (
            r.response as { output: { type: string; arguments?: string }[] }
          ).output
            .filter((o) => o.type === "function_call")
            .map((o) => {
              const {
                tool,
                purpose: _purpose,
                ...query
              } = JSON.parse(o.arguments!);
              return { tool, query };
            }),
        );
        const metrics = score(
          c,
          match,
          facts,
          answers,
          oldFacts,
          result,
          attemptedQueries,
        );
        const retrievedIds = new Set(
          mock.transcript.flatMap((r) =>
            r.request.input
              .filter((i: any) => i.type === "function_call_output")
              .flatMap(
                (i: any) =>
                  JSON.parse(i.output).evidence.routes?.facts.map(
                    (f: any) => f.id,
                  ) ?? [],
              ),
          ),
        );
        const retrievedAdditionalUsefulVsA =
          metrics.usefulEvidence.additionalVsA.filter((id) =>
            retrievedIds.has(id),
          );
        const row = {
          caseId: c.id,
          family: c.family,
          category: c.category,
          arm,
          inputDigest: digest({ match: buildCase(c), cutoff: 1800 }),
          eligible: c.eligible,
          disposition: !question
            ? "no-surge-question"
            : result?.failure
              ? "fallback"
              : result?.source === "foundry"
                ? "verified-script"
                : "deterministic",
          failure: result?.failure ?? null,
          metrics,
          attemptedQueries,
          retrievedAdditionalUsefulVsA,
          latencyMs,
          reservationAttempts,
          requests: mock.transcript.length,
          tokenEstimate: {
            input: mock.transcript.reduce((s, r) => s + r.inputEstimate, 0),
            scriptedOutput: mock.transcript.reduce(
              (s, r) => s + r.outputEstimate,
              0,
            ),
            reservation: mock.transcript.reduce(
              (s, r) => s + r.reservedEstimate,
              0,
            ),
          },
          providerUsage: null,
          costUsd: 0,
          facts,
          interpretations: result?.evidence.comparison?.interpretations ?? [],
          assessment: assessment
            ? {
                whyItMatters: assessment.whyItMatters,
                supportingEvidence: assessment.supportingEvidence,
                contradictoryEvidence: assessment.contradictoryEvidence,
              }
            : null,
          answers: answers.map((a) => ({
            intent: a.question.intent,
            plain: presentQuestion(a, match, "plain"),
            analysis: presentQuestion(a, match, "analysis"),
          })),
          trace: result?.trace ?? [],
          supplements: result?.supplements ?? [],
          transcriptDigest: digest(mock.transcript),
        };
        rows.push(row);
        transcripts.push({ caseId: c.id, arm, ...mock, fetch: undefined });
        expect(Boolean(question), "focus-question availability").toBe(
          c.statuses !== null,
        );
        if (result)
          expect(result.evidence.comparison?.eligible).toBe(c.eligible);
        expect(metrics.incorrectFacts).toEqual([]);
        expect(metrics.incorrectInterpretations).toEqual([]);
        // Preserve the discovered baseline defect in the report, not a false clean score.
        expect(metrics.incorrectVerdicts).toEqual(
          c.statuses && c.missing !== "xg"
            ? [{ intent: "chance-quality", actual: "lower", expected: "level" }]
            : [],
        );
        expect(metrics.invalidReferences).toEqual([]);
        expect(metrics.incorrectCitations).toEqual([]);
        expect(metrics.missingCaveats).toEqual([]);
        if (result?.failure) expect(result.failure.category).toBe("capacity");
        if (!c.eligible || arm.startsWith("A-") || arm.startsWith("B-"))
          expect(mock.fetch).not.toHaveBeenCalled();
        else {
          expect(result?.source).toBe(result?.failure ? "offline" : "foundry");
          expect(mock.transcript.length).toBeGreaterThanOrEqual(2);
        }
        expect(mock.transcript.length).toBeLessThanOrEqual(3);
        expect(row.tokenEstimate.reservation).toBeLessThanOrEqual(30000);
      });
});

const attackPolicies: Policy[] = [
  "invented-reference",
  "wrong-status",
  "omit-challenge",
  "causal-prose",
  "future-replay",
];
for (const c of cases.filter((c) => c.eligible))
  for (const policy of attackPolicies)
    it(`rejects ${policy} / ${c.id}`, async () => {
      const mock = scriptedTransport(policy);
      vi.stubGlobal("fetch", mock.fetch);
      const { match, question } = context(c);
      match.provenance.revision += `:${policy}`;
      const start = performance.now();
      const result = await answerQuestion(match, 1800, question!);
      const expected = deterministicQuestion(match, 1800, question!);
      attacks.push({
        caseId: c.id,
        policy,
        rejected: result.failure?.category === "verification",
        source: result.source,
        requests: mock.transcript.length,
        latencyMs: performance.now() - start,
        fallbackPreserved:
          JSON.stringify(result.evidence) === JSON.stringify(expected.evidence),
        tokenEstimate: mock.transcript.reduce(
          (s, r) => s + r.reservedEstimate,
          0,
        ),
        transcriptDigest: digest(mock.transcript),
      });
      transcripts.push({
        caseId: c.id,
        arm: policy,
        transcript: mock.transcript,
      });
      expect(result.failure?.category).toBe("verification");
      expect(result.source).toBe("offline");
      expect(result.evidence).toEqual(expected.evidence);
      expect(mock.fetch).toHaveBeenCalledTimes(2);
    });

it("accepts a scripted no-added-insight stop without credit for discovery", async () => {
  const c = cases[0],
    { match, question } = context(c),
    mock = scriptedTransport("stop");
  vi.stubGlobal("fetch", mock.fetch);
  const result = await answerQuestion(match, 1800, question!);
  expect(result.evidence.comparison?.decision).toBe("no-added-insight");
  expect(result.supplements).toEqual([]);
  expect(result.trace.map((t) => t.tool)).toEqual(["get_team_statistics"]);
  expect(mock.fetch).toHaveBeenCalledTimes(1);
});

it("reference arithmetic has hand-checked grouping, timing and missing-data anchors", () => {
  expect(referenceFacts(cases[0])).toMatchObject({
    "own-previous": 2,
    "own-current": 6,
    "current:linkedShots": 4,
    "current:linkedPossessions": 2,
    "current:largestPossession": 3,
    "early-count": 5,
    "late-count": 1,
    "opponent-current": 5,
  });
  expect(referenceFacts(cases[1])).toMatchObject({
    "own-current": 6,
    "current:linkedShots": 4,
    "current:linkedPossessions": 4,
    "current:largestPossession": 1,
    "early-count": 3,
    "late-count": 3,
  });
  expect(
    referenceFacts(cases.find((c) => c.id === "missing-possession")!)[
      "current:linkedPossessions"
    ],
  ).toBeNull();
});

it("the scorer penalizes wrong facts, unsupported statuses, bad references and irrelevant queries", () => {
  const c = cases[0],
    { match, question } = context(c);
  const result = deterministicQuestion(match, 1800, question!);
  const answers = [result.evidence],
    original = factsFor(answers);
  const facts = structuredClone(original);
  facts[0].value = 999;
  facts[0].eventIds = ["invented"];
  result.evidence.comparison!.interpretations[0].status = "limited";
  result.trace.push({
    tool: "get_recorded_sequence",
    query: {
      matchId: match.id,
      start: 900,
      end: 1800,
      team: "harbor",
      playerId: null,
      eventId: match.events.find((e) => e.time === 1710)!.id,
    },
    eventIds: [],
    claimIds: [],
    truncated: false,
  });
  const scored = score(c, match, facts, answers, original, result);
  expect(scored.factualAccuracy).toBeLessThan(1);
  expect(scored.unsupportedPublishedConclusions).toBe(1);
  expect(scored.invalidReferences).toEqual(["invented"]);
  expect(scored.incorrectCitations).toContain(facts[0].id);
  expect(scored.investigationRelevance).toEqual({
    relevant: 0,
    attempted: 1,
    precision: 0,
  });
  expect(scored.usefulEvidence.additionalVsA).toEqual([]);
});

it("the transport refuses non-mock destinations even with provider-shaped input", async () => {
  await expect(
    scriptedTransport("adaptive").fetch("https://api.openai.com/v1/responses", {
      body: "{}",
    }),
  ).rejects.toThrow("refused");
});

it("freezes the corpus and includes all requested scenario categories", () => {
  expect(digest(cases)).toBe(
    "2e0894c3e0fa54de48886bd15283175a317d6b14a2fa103029e5768fa71ec8df",
  );
  expect(cases.filter((c) => c.eligible)).toHaveLength(8);
  expect(new Set(cases.map((c) => c.family)).size).toBe(7);
});

it("scores guided conclusions and mandatory caveats, not only displayed numbers", () => {
  const c = cases[0],
    { match, question } = context(c);
  const answers = baseline(match, question!.storyId);
  const facts = factsFor(answers);
  answers.forEach((a) => {
    a.qualifications = [];
    a.reason = null;
  });
  const result = score(c, match, facts, answers, facts);
  expect(result.incorrectVerdicts).toEqual([
    { intent: "chance-quality", actual: "lower", expected: "level" },
  ]);
  expect(result.missingCaveats).toEqual([
    "descriptive-only",
    "fading-activity",
  ]);
});

afterAll(() => {
  const percentile = (values: number[], p: number) =>
    [...values].sort((a, b) => a - b)[
      Math.max(0, Math.ceil(values.length * p) - 1)
    ] ?? null;
  const summary = arms.map((arm) => {
    const selected = rows.filter((r) => r.arm === arm);
    const count = (fn: (r: any) => number) =>
      selected.reduce((s, r) => s + fn(r), 0);
    return {
      arm,
      states: selected.length,
      verifiedScripts: selected.filter(
        (r) => r.disposition === "verified-script",
      ).length,
      failures: selected.filter((r) => r.failure).length,
      assertions: count((r) => r.metrics.assertions),
      correctAssertions: count((r) => r.metrics.correctAssertions),
      unsupportedPublishedConclusions: count(
        (r) => r.metrics.unsupportedPublishedConclusions,
      ),
      invalidReferences: count((r) => r.metrics.invalidReferences.length),
      incorrectCitations: count((r) => r.metrics.incorrectCitations.length),
      missingCaveats: count((r) => r.metrics.missingCaveats.length),
      usefulFacts: count((r) => r.metrics.usefulEvidence.covered.length),
      usefulFactsAvailable: count((r) => r.metrics.usefulEvidence.available),
      additionalUsefulFactsVsA: count(
        (r) => r.metrics.usefulEvidence.additionalVsA.length,
      ),
      retrievedAdditionalUsefulFactsVsA: count(
        (r) => r.retrievedAdditionalUsefulVsA.length,
      ),
      additionalUsefulFactsVsB: count(
        (r) =>
          r.metrics.usefulEvidence.covered.filter(
            (id: string) =>
              !rows
                .find(
                  (b) =>
                    b.caseId === r.caseId &&
                    b.arm === "B-strengthened-deterministic",
                )
                ?.metrics.usefulEvidence.covered.includes(id),
          ).length,
      ),
      relevantQueries: count((r) => r.metrics.investigationRelevance.relevant),
      followupQueries: count((r) => r.metrics.investigationRelevance.attempted),
      requests: count((r) => r.requests),
      estimatedInputTokens: count((r) => r.tokenEstimate.input),
      estimatedScriptedOutputTokens: count(
        (r) => r.tokenEstimate.scriptedOutput,
      ),
      reservationTokens: count((r) => r.tokenEstimate.reservation),
      localLatencyMs: {
        n: selected.length,
        median: percentile(
          selected.map((r) => r.latencyMs),
          0.5,
        ),
        p95: percentile(
          selected.map((r) => r.latencyMs),
          0.95,
        ),
      },
    };
  });
  const sourcePaths = [
    "eval/director-offline/cases.ts",
    "eval/director-offline/scoring.ts",
    "eval/director-offline/mock.ts",
    "tests/director-offline-evaluation.test.ts",
    "src/lib/ai/director/questions.ts",
    "src/lib/ai/director/shot-routes.ts",
    "src/lib/ai/director/surge-runner.ts",
    "src/lib/ai/director/hypothesis.ts",
    "src/lib/ai/director/observer.ts",
    "src/lib/ai/director/question-runner.ts",
    "src/lib/ai/providers.ts",
    "src/lib/ai/request-controls.ts",
    "src/lib/ai/director/evidence-wire.ts",
    "src/lib/ai/director/tools.ts",
    "package-lock.json",
  ];
  const report = {
    schemaVersion: 1,
    kind: "offline diagnostic comparison; scripted transports, no model quality evidence",
    baselineRef: "78b1530edddb25d460935f28521cd836f82c7af4",
    implementationRef: "5b76572970bff58de74965ad130d8eb38285c0a9",
    manifestDigest: digest(cases),
    sourceHashes: Object.fromEntries(
      sourcePaths.map((p) => [
        p,
        createHash("sha256").update(readFileSync(p)).digest("hex"),
      ]),
    ),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    cases: cases.map((c) => ({ ...c, referenceFacts: referenceFacts(c) })),
    summary,
    attacks,
    rows,
    gates: {
      publishedConclusionSafetyPassed: summary.every(
        (s) => s.unsupportedPublishedConclusions === 0,
      ),
      allCanonicalCitationsCorrect: summary.every(
        (s) => s.invalidReferences === 0 && s.incorrectCitations === 0,
      ),
      injectedPlansRejected: attacks.filter(
        (a) => a.rejected && a.fallbackPreserved,
      ).length,
      injectedPlansAttempted: attacks.length,
      actualAiImprovementEstablished: false,
    },
    liveModelQuality: null,
    humanPreference: null,
    actualModelRequests: 0,
    actualCostUsd: 0,
    methodology: {
      latency:
        "One local end-to-end sample per state/arm; includes fixture construction, evidence computation, serialization and verification. Excludes real network, inference and production pacing. One-minute token capacity is simulated using the production payload estimator and 30,000-token ceiling; over-cap attempts fail without dispatch. Nearest-rank median/p95. Never compare with live latency gates.",
      tokens:
        "Input = ceil(serialized request UTF-8 bytes/3)+256 framing; scripted output = ceil(output bytes/3). Reservation includes full 1800 output tokens per request. Repeated history is counted each turn. No tokenizer or provider usage; not an invoice.",
      baseline:
        "A runs the complete existing assessment and three pre-surge guided questions on current code; it is a feature ablation, not a historical binary. B adds deterministic route comparison. C/D run the same production answerQuestion/provider/verification path with fixed/adaptive scripts, copying the registry supplied to every model. No private gold labels reach scripts.",
      attribution:
        "Only hand-labelled useful facts absent from A receive additional-evidence credit. All such facts in these cases are deterministic route arithmetic. Queries and replay illustrations alone receive no new-fact credit. C/D gain versus B is measured against the same useful-fact rubric, not inferred from request success. Attempted follow-up queries include capacity-fallback runs. Relevance means an exact in-scope aggregate or a hand-labelled diagnostic replay anchor; it is not a human utility rating. Presentation safety is checked through typed verdicts, registered interpretations, exact numeric/citation oracles and required caveat text; unrestricted prose is not judged by a model.",
      scope:
        "14 authored synthetic diagnostics in 7 correlated families. No held-out recorded-match or blinded-human study; proposal generalization, live completion, human preference and live cost/latency gates remain unmet.",
    },
  };
  expect(rows).toHaveLength(cases.length * arms.length);
  expect(attacks).toHaveLength(
    cases.filter((c) => c.eligible).length * attackPolicies.length,
  );
  mkdirSync("artifacts/director-offline", { recursive: true });
  const compact = {
    ...report,
    rows: rows.map(
      ({
        facts: _facts,
        assessment: _assessment,
        answers: _answers,
        trace: _trace,
        interpretations: _interpretations,
        ...row
      }) => row,
    ),
  };
  writeFileSync(
    "artifacts/director-offline/summary.json",
    JSON.stringify(compact, null, 2) + "\n",
  );
  writeFileSync(
    "artifacts/director-offline/results.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(
    "artifacts/director-offline/transcripts.json",
    JSON.stringify(transcripts, null, 2) + "\n",
  );
});
