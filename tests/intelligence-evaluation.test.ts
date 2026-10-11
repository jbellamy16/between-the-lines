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
import {
  baselineCases,
  digest,
  ORIGINAL_INTELLIGENCE_REF,
} from "../scripts/evaluate-intelligence-baseline";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  validateMatch,
  type MatchData,
  type NormalizedEvent,
} from "../src/lib/sources/model";
import { observe, type Candidate } from "../src/lib/ai/director/observer";
import { evaluateHypothesis } from "../src/lib/ai/director/hypothesis";
import { reconstructStorylines } from "../src/lib/ai/director/storylines";
import { createInvestigation } from "../src/lib/ai/director/tools";
import { validateEditorialPlan } from "../src/lib/ai/director/story";
import { investigate } from "../src/lib/ai/director/runner";
import { configure } from "./ai-helpers";

const baseline = JSON.parse(
  readFileSync("docs/intelligence/original-baseline.json", "utf8"),
) as {
  originalRef: string;
  rows: {
    id: string;
    inputDigest: string;
    deterministic: unknown[];
    originalDirector: { category: string; evidenceIds: string[] }[];
  }[];
};
const pairedRows: Record<string, unknown>[] = [];
const challengeRows: {
  id: string;
  passed: boolean;
  expectedBehavior: string;
}[] = [];
const source = new SyntheticMatchSource();

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        new Error("Network forbidden in offline intelligence evaluation"),
      ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function challenge(
  id: string,
  expectedBehavior: string,
  run: () => void | Promise<void>,
) {
  it(id, async () => {
    const result = { id, passed: false, expectedBehavior };
    challengeRows.push(result);
    await run();
    result.passed = true;
  });
}

/** Test-only canonical event fixtures. The shipped synthetic generator is untouched. */
function fixture(
  name: string,
  specs: {
    type: "shot" | "pass" | "recovery";
    time: number;
    team?: "harbor" | "riverside";
    x?: number;
    recipient?: boolean;
  }[],
): MatchData {
  const match = source.read("quiet");
  match.id = `intelligence-evaluation-${name}`;
  match.provenance.sourceMatchId = match.id;
  match.provenance.raw = { fixture: name, testOnly: true };
  match.capabilities.xg = false;
  match.finalScore = { harbor: 0, riverside: 0 };
  match.events = specs
    .toSorted((a, b) => a.time - b.time)
    .map((spec, order): NormalizedEvent => {
      const team = spec.team ?? "harbor";
      const actorId = match.teams[team].lineup[7];
      const id = `${match.id}:${order}`;
      return {
        id,
        matchId: match.id,
        order,
        teamId: match.teams[team].id,
        time: spec.time,
        period: spec.time < 2700 ? "1H" : "2H",
        periodSeconds: spec.time < 2700 ? spec.time : spec.time - 2700,
        team,
        playerId: actorId,
        actorId,
        type: spec.type,
        position: { x: spec.x ?? 80, y: 50 },
        ...(spec.type === "pass"
          ? { end: { x: spec.x ?? 80, y: 51 }, success: true }
          : {}),
        ...(spec.type === "shot" ? { outcome: "wide" as const } : {}),
        ...(spec.recipient ? { recipientId: match.teams[team].lineup[8] } : {}),
        possessionId: Math.floor(spec.time / 30),
        qualifiers: {},
        relatedEvents: [],
        statistics: {},
        source: {
          provider: "synthetic",
          matchId: match.id,
          eventId: id,
          teamId: match.teams[team].id,
          playerId: actorId,
          eventType: spec.type,
          tags: [],
          precision: "second",
          coordinates: { transform: "identity-percent-v1" },
          raw: {},
        },
      };
    });
  return validateMatch(match);
}

function assertEvidenceBounded(
  match: MatchData,
  cutoff: number,
  claim: Candidate,
) {
  const assessment = evaluateHypothesis(match, cutoff, claim);
  const evidence = [
    ...assessment.supportingEvidence,
    ...assessment.limitingEvidence,
    ...assessment.contradictoryEvidence,
    ...assessment.measurements,
  ];
  for (const item of evidence)
    for (const id of item.eventIds)
      expect(
        match.events.some((event) => event.id === id && event.time <= cutoff),
      ).toBe(true);
  for (const window of assessment.windows) {
    expect(window.end).toBeLessThanOrEqual(cutoff);
    expect(window.start).toBeLessThanOrEqual(window.end);
  }
  const prefix = {
    ...match,
    events: match.events.filter((event) => event.time <= cutoff),
  };
  expect(evaluateHypothesis(prefix, cutoff, claim)).toEqual(assessment);
  return assessment;
}

describe("paired offline comparison with the original Director", () => {
  it.each(baselineCases())(
    "$id preserves inputs and recomputes every assessment",
    ({ id, match, cutoff, mode, preferences }) => {
      const original = baseline.rows.find((row) => row.id === id)!;
      expect(baseline.originalRef).toBe(ORIGINAL_INTELLIGENCE_REF);
      expect(digest({ match, cutoff, mode, preferences })).toBe(
        original.inputDigest,
      );
      const start = performance.now();
      const candidates = observe(match, cutoff, mode, preferences);
      const assessments = candidates.map((claim) =>
        assertEvidenceBounded(match, cutoff, claim),
      );
      for (const assessment of assessments)
        expect(assessment.verificationStatus).not.toBe("unsupported");
      const storylines = reconstructStorylines(match, cutoff);
      expect(
        reconstructStorylines(
          {
            ...match,
            events: match.events.filter((event) => event.time <= cutoff),
          },
          cutoff,
        ),
      ).toEqual(storylines);
      for (const storyline of storylines) {
        for (const window of [
          storyline.baseline,
          storyline.previous,
          storyline.current,
        ]) {
          const count = match.events.filter(
            (event) =>
              event.team === storyline.team &&
              event.period === storyline.period &&
              (window.startInclusive
                ? event.time >= window.start
                : event.time > window.start) &&
              event.time <= window.end &&
              (storyline.metric === "shots"
                ? event.type === "shot"
                : event.type === "recovery" &&
                  event.success !== false &&
                  (event.position?.x ?? -1) >= 66.7),
          ).length;
          expect(window.count).toBe(count);
        }
      }
      pairedRows.push({
        id,
        inputDigest: original.inputDigest,
        legacyDetector: { observationCount: original.deterministic.length },
        originalDirector: {
          candidateCount: original.originalDirector.length,
          structuredAssessments: 0,
          temporalStorylines: 0,
        },
        improvedDirector: {
          candidateCount: candidates.length,
          structuredAssessments: assessments.length,
          statuses: assessments.map(
            (assessment) => assessment.verificationStatus,
          ),
          supportingFacts: assessments.reduce(
            (sum, item) => sum + item.supportingEvidence.length,
            0,
          ),
          limitingFacts: assessments.reduce(
            (sum, item) => sum + item.limitingEvidence.length,
            0,
          ),
          contradictoryFacts: assessments.reduce(
            (sum, item) => sum + item.contradictoryEvidence.length,
            0,
          ),
          temporalStorylines: storylines.length,
          storylineStates: storylines.map((storyline) => ({
            id: storyline.id,
            state: storyline.state,
            timestamp: storyline.updatedAt,
          })),
        },
        offlineLatencyMs: performance.now() - start,
        humanPreferredArm: null,
        modelRequests: 0,
      });
    },
  );
});

describe("adversarial football evidence", () => {
  challenge(
    "empty feed abstains",
    "No candidate or invented timeline from no actions",
    () => {
      const match = fixture("empty", []);
      expect(observe(match, 1800)).toEqual([]);
      expect(reconstructStorylines(match, 1800)).toEqual([]);
    },
  );
  challenge(
    "one shot is not a trend",
    "An isolated shot does not become momentum or dominance",
    () => {
      const match = fixture("isolated-shot", [{ type: "shot", time: 1750 }]);
      expect(observe(match, 1800)).toEqual([]);
      expect(reconstructStorylines(match, 1800)).toEqual([]);
    },
  );
  challenge(
    "repetitive passes are not an attacking trend",
    "Passing frequency alone cannot create a shot or recovery storyline",
    () => {
      const match = fixture(
        "routine-passes",
        Array.from({ length: 30 }, (_, index) => ({
          type: "pass",
          time: 1200 + index * 10,
          x: 25,
          recipient: true,
        })),
      );
      expect(reconstructStorylines(match, 1800)).toEqual([]);
      for (const claim of observe(match, 1800)) {
        expect(claim.category).toBe("passing-pair");
        assertEvidenceBounded(match, 1800, claim);
      }
    },
  );
  challenge(
    "attacking count without quality remains qualified",
    "More shots cannot establish chance quality without source xG",
    () => {
      const match = fixture(
        "no-quality",
        [100, 1200, 1300, 1400, 1500].map((time) => ({ type: "shot", time })),
      );
      const claim = observe(match, 1800).find(
        (item) =>
          item.category === "activity-change" &&
          item.statistics[0].label === "shots",
      )!;
      expect(claim).toBeDefined();
      const assessment = assertEvidenceBounded(match, 1800, claim);
      expect(
        assessment.limitingEvidence.length +
          assessment.missingInformation.length,
      ).toBeGreaterThan(0);
      expect(assessment.sourceCapabilities.xg).toBe(false);
      expect(JSON.stringify(assessment)).toMatch(/quality|expected goals|xG/i);
      expect(
        match.events.filter((event) => event.type === "goal"),
      ).toHaveLength(0);
    },
  );
  challenge(
    "competing attacking activity is inspectable",
    "An own-team rise does not hide the opponent's recorded attempts",
    () => {
      const match = fixture("both-attack", [
        ...[100, 1200, 1300, 1400, 1500].map((time) => ({
          type: "shot" as const,
          time,
        })),
        ...[1210, 1310, 1410, 1510, 1610].map((time) => ({
          type: "shot" as const,
          time,
          team: "riverside" as const,
        })),
      ]);
      const claim = observe(match, 1800).find(
        (item) =>
          item.team === "harbor" && item.statistics[0].label === "shots",
      )!;
      const assessment = assertEvidenceBounded(match, 1800, claim);
      const contextualIds = [
        ...assessment.limitingEvidence,
        ...assessment.contradictoryEvidence,
      ].flatMap((item) => item.eventIds);
      expect(
        contextualIds.some(
          (id) =>
            match.events.find((event) => event.id === id)?.team === "riverside",
        ),
      ).toBe(true);
    },
  );
  challenge(
    "an old burst is not presented as sustained momentum",
    "A valid wider-window increase is qualified when its latest segment fades",
    () => {
      const match = fixture(
        "fading-burst",
        [100, 910, 920, 930, 940].map((time) => ({ type: "shot", time })),
      );
      const claim = observe(match, 1800).find(
        (item) => item.statistics[0].label === "shots",
      )!;
      expect(claim).toBeDefined();
      const assessment = assertEvidenceBounded(match, 1800, claim);
      expect(assessment.verificationStatus).toBe("confirmed-observation");
      expect(
        assessment.contradictoryEvidence.some(
          (item) => item.code === "latest-rate-not-sustained",
        ),
      ).toBe(true);
      expect(
        reconstructStorylines(match, 1800).find(
          (storyline) => storyline.metric === "shots",
        )?.state,
      ).toBe("resolved");
    },
  );
  challenge(
    "favorite with no activity has no invented contribution",
    "Preferences do not create player evidence",
    () => {
      const match = fixture(
        "inactive-favorite",
        [100, 1200, 1300, 1400, 1500].map((time) => ({ type: "shot", time })),
      );
      const player = match.teams.harbor.lineup[1];
      const session = createInvestigation(match, 1800, "fan", {
        player,
        team: "harbor",
      });
      const result = session.execute("get_player_involvement", {
        matchId: match.id,
        start: 900,
        end: 1800,
        team: "harbor",
        playerId: player,
        eventId: null,
      });
      expect(result.totalEvents).toBe(0);
      expect(result.claims).toEqual([]);
    },
  );
  challenge(
    "substitution stays descriptive",
    "Recorded involvement is not a causal substitution effect",
    () => {
      const match = source.read("substitution");
      const sub = match.events.find((event) => event.type === "substitution")!;
      expect(
        observe(match, sub.time - 1).some(
          (claim) => claim.category === "substitute-involvement",
        ),
      ).toBe(false);
      const claim = observe(match, 4200).find(
        (item) => item.category === "substitute-involvement",
      )!;
      expect(claim).toBeDefined();
      const assessment = assertEvidenceBounded(match, 4200, claim);
      expect(JSON.stringify(assessment)).toMatch(/caus|effect|unequal/i);
    },
  );
  challenge(
    "missing source capabilities disable inferred relationships",
    "Absent recovery/possession/recipient data cannot produce those claims",
    () => {
      const match = source.read("pressure");
      match.capabilities.ballRecoveries = false;
      match.capabilities.possession = "unavailable";
      match.capabilities.passRecipients = false;
      const candidates = observe(match, 4200);
      expect(
        candidates.some((claim) =>
          ["recovery-shot", "shot-sequence", "passing-pair"].includes(
            claim.category,
          ),
        ),
      ).toBe(false);
      expect(
        reconstructStorylines(match, 4200).some(
          (storyline) => storyline.metric === "attacking-third-recoveries",
        ),
      ).toBe(false);
      for (const claim of candidates) assertEvidenceBounded(match, 4200, claim);
    },
  );
  challenge(
    "forged measurement cannot become a verified hypothesis",
    "Changing a validated candidate's value is rejected",
    () => {
      const match = source.read("pressure");
      const claim = structuredClone(observe(match, 4200)[0]);
      claim.statistics[0].value += 99;
      expect(evaluateHypothesis(match, 4200, claim).verificationStatus).toBe(
        "unsupported",
      );
    },
  );
  challenge(
    "forged tactical prose cannot inherit valid evidence",
    "Valid event IDs do not authorize arbitrary wording",
    () => {
      const match = source.read("pressure");
      const claim = {
        ...observe(match, 4200)[0],
        brief: "The manager ordered a high press and it caused the goal.",
      };
      expect(evaluateHypothesis(match, 4200, claim).verificationStatus).toBe(
        "unsupported",
      );
    },
  );
  challenge(
    "duplicated evidence and future IDs cannot pass",
    "Evidence membership, uniqueness and cutoff remain independent gates",
    () => {
      const match = source.read("pressure");
      const claim = observe(match, 4200)[0];
      for (const evidenceIds of [
        [...claim.evidenceIds, claim.evidenceIds[0]],
        [...claim.evidenceIds, match.events.at(-1)!.id],
      ])
        expect(
          evaluateHypothesis(match, 4200, { ...claim, evidenceIds })
            .verificationStatus,
        ).toBe("unsupported");
    },
  );
  challenge(
    "duplicate candidates cannot fill the editorial plan",
    "The same observation cannot be published twice",
    () => {
      const match = source.read("pressure");
      const session = createInvestigation(match, 4200, "fan");
      const result = session.execute("get_match_events", {
        matchId: match.id,
        start: 2700,
        end: 4200,
        team: null,
        playerId: null,
        eventId: null,
      });
      const claim = result.claims[0];
      const story = {
        claimId: claim.id,
        form: "brief",
        emphasis: claim.allowedEmphasis,
      };
      expect(() =>
        validateEditorialPlan(
          { decision: "publish", stories: [story, story] },
          session.candidates,
          new Set(session.claims.keys()),
        ),
      ).toThrow();
    },
  );
  challenge(
    "broad counter-evidence query is bounded and explicit",
    "A valid broad query returns intact assessments with disclosed truncation instead of overflowing",
    () => {
      const match = source.read("pressure");
      const result = createInvestigation(match, 4200, "analyst").execute(
        "inspect_counter_evidence",
        {
          matchId: match.id,
          start: 2700,
          end: 4200,
          team: null,
          playerId: null,
          eventId: null,
        },
      );
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(48000);
      expect(result).toMatchObject({ assessmentsTruncated: true });
      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims.length).toBeLessThanOrEqual(2);
    },
  );
  challenge(
    "temporal evolution survives advance and rewind",
    "Stable identities persist while evidence fades; rewind reconstructs the earlier state",
    () => {
      const match = fixture(
        "evolution",
        [350, 400, 450, 650, 700, 750, 950, 1000, 1050].map((time) => ({
          type: "shot",
          time,
        })),
      );
      const checkpoints = [600, 900, 1200, 1500, 1800];
      const snapshots = checkpoints.map((cutoff) =>
        reconstructStorylines(match, cutoff).find(
          (storyline) => storyline.metric === "shots",
        )!,
      );
      expect(snapshots.map((storyline) => storyline.state)).toEqual([
        "emerging",
        "developing",
        "sustained",
        "weakening",
        "resolved",
      ]);
      expect(new Set(snapshots.map((storyline) => storyline.id)).size).toBe(1);
      expect(reconstructStorylines(match, 600)[0]).toEqual(snapshots[0]);
      expect(
        reconstructStorylines(
          {
            ...match,
            events: match.events.filter((event) => event.time <= 600),
          },
          600,
        )[0],
      ).toEqual(snapshots[0]);
    },
  );
  challenge(
    "unfinished comparison does not overstate a misleading burst",
    "A partial window cannot stand in for a complete interval",
    () => {
      const match = fixture(
        "partial-window",
        [310, 320, 330].map((time) => ({ type: "shot", time })),
      );
      expect(reconstructStorylines(match, 330)).toEqual([]);
      expect(
        observe(match, 330).some(
          (claim) => claim.category === "activity-change",
        ),
      ).toBe(false);
    },
  );
  challenge(
    "full time does not promise another match window",
    "A completed match has no live watch-next target",
    () => {
      const match = source.read("pressure");
      const candidates = observe(match, match.duration);
      expect(candidates.length).toBeGreaterThan(0);
      for (const claim of candidates)
        expect(
          assertEvidenceBounded(match, match.duration, claim).watchNext,
        ).toBeNull();
    },
  );
  challenge(
    "selected evidence window can discover a claim outside the shortlist",
    "Model-selectable player queries yield independently reproducible observations",
    () => {
      const match = source.read("pressure");
      const player = match.players.find(
        (player) =>
          player.team === "harbor" &&
          match.events.filter(
            (event) =>
              event.actorId === player.id &&
              event.type === "pass" &&
              event.time > 3300 &&
              event.time <= 4200,
          ).length >= 5,
      )!;
      const session = createInvestigation(match, 4200, "analyst", {
        player: player.id,
      });
      const initial = new Set(session.candidates.map((claim) => claim.id));
      const result = session.execute("get_player_involvement", {
        matchId: match.id,
        start: 3300,
        end: 4200,
        team: "harbor",
        playerId: player.id,
        eventId: null,
      });
      const claim = result.claims.find(
        (item) => item.category === "player-involvement",
      )!;
      expect(claim).toBeDefined();
      expect(initial.has(claim.id)).toBe(false);
      expect(
        assertEvidenceBounded(match, 4200, claim).verificationStatus,
      ).not.toBe("unsupported");
    },
  );
  for (const seed of [17, 8911, 46003, 71827])
    for (const cutoff of [1800, 4200])
      challenge(
        `unfamiliar seed ${seed} at ${cutoff}`,
        "Unfamiliar balanced input preserves cutoff and prefix invariance",
        () => {
          const match = source.read("pressure", { seed, profile: "balanced" });
          for (const claim of observe(match, cutoff))
            assertEvidenceBounded(match, cutoff, claim);
          const before = reconstructStorylines(match, cutoff);
          reconstructStorylines(match, 5400);
          expect(reconstructStorylines(match, cutoff)).toEqual(before);
          expect(
            reconstructStorylines(
              {
                ...match,
                events: match.events.filter((event) => event.time <= cutoff),
              },
              cutoff,
            ),
          ).toEqual(before);
        },
      );
});

describe("Foundry scripted transport: orchestration only", () => {
  challenge(
    "scripted Foundry selectively investigates counter-evidence",
    "Three bounded transport turns preserve the actual tool trace and freshly verify publication",
    async () => {
      configure("foundry");
      const match = source.read("pressure");
      let turn = 0;
      const transport = vi.fn(async (_url: string, init: RequestInit) => {
        turn++;
        const request = JSON.parse(String(init.body));
        if (turn <= 2) {
          const retrieved =
            turn === 2
              ? JSON.parse(
                  request.input.findLast(
                    (item: { type: string }) =>
                      item.type === "function_call_output",
                  ).output,
                )
              : null;
          const selected = retrieved?.claims.find(
            (claim: { category: string }) => claim.category === "recovery-shot",
          );
          return Response.json({
            status: "completed",
            output: [
              {
                type: "function_call",
                name:
                  turn === 1 ? "get_match_events" : "inspect_counter_evidence",
                call_id: `read-${turn}`,
                arguments: JSON.stringify({
                  matchId: match.id,
                  start: 2700,
                  end: 4200,
                  team: null,
                  playerId: null,
                  eventId: selected?.evidenceIds.at(-1) ?? null,
                }),
              },
            ],
          });
        }
        const response = JSON.parse(
          request.input.findLast(
            (item: { type: string }) => item.type === "function_call_output",
          ).output,
        );
        expect(response.assessments.length).toBeGreaterThan(0);
        const claim = response.claims.find((item: { id: string }) =>
          response.assessments.some(
            (assessment: {
              claimId: string;
              assessment: { verificationStatus: string };
            }) =>
              assessment.claimId === item.id &&
              assessment.assessment.verificationStatus !== "unsupported",
          ),
        );
        return Response.json({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    decision: "publish",
                    stories: [
                      {
                        claimId: claim.id,
                        form: "brief",
                        emphasis: claim.allowedEmphasis,
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        });
      });
      vi.stubGlobal("fetch", transport);
      const result = await investigate(match, 4200, "fan", {}, "foundry");
      expect(transport).toHaveBeenCalledTimes(3);
      expect(result.metrics.requests).toBe(3);
      expect(result.metrics.toolInvocations).toBe(2);
      expect(result.trace.map((entry) => entry.tool)).toEqual([
        "get_match_events",
        "inspect_counter_evidence",
      ]);
      expect(result.stories).toHaveLength(1);
      expect(result.stories[0].provider).toBe("foundry");
      expect(result.stories[0].validation).toBe("verified");
    },
  );
  for (const [label, plan] of [
    ["inconsistent abstention", { decision: "publish", stories: [] }],
    [
      "fabricated claim",
      {
        decision: "publish",
        stories: [
          { claimId: "fabricated", form: "brief", emphasis: "sequence" },
        ],
      },
    ],
    [
      "free-form unsupported prose",
      {
        decision: "abstain",
        stories: [],
        explanation: "A tactical masterclass.",
      },
    ],
  ] as const)
    challenge(
      `scripted Foundry rejects ${label}`,
      "Malformed editorial output is not repaired with a paid retry",
      async () => {
        configure("foundry");
        const match = source.read("pressure");
        const transport = vi
          .fn()
          .mockResolvedValueOnce(
            Response.json({
              status: "completed",
              output: [
                {
                  type: "function_call",
                  name: "get_match_events",
                  call_id: "read",
                  arguments: JSON.stringify({
                    matchId: match.id,
                    start: 2700,
                    end: 4200,
                    team: null,
                    playerId: null,
                    eventId: null,
                  }),
                },
              ],
            }),
          )
          .mockResolvedValueOnce(
            Response.json({
              status: "completed",
              output: [
                {
                  type: "message",
                  content: [
                    { type: "output_text", text: JSON.stringify(plan) },
                  ],
                },
              ],
            }),
          );
        vi.stubGlobal("fetch", transport);
        await expect(
          investigate(match, 4200, "fan", {}, "foundry"),
        ).rejects.toThrow();
        expect(transport).toHaveBeenCalledTimes(2);
      },
    );
  challenge(
    "scripted Foundry unavailable",
    "An unavailable provider cannot yield verified AI output or trigger automatic retry",
    async () => {
      configure("foundry");
      const transport = vi
        .fn()
        .mockResolvedValue(new Response("unavailable", { status: 503 }));
      vi.stubGlobal("fetch", transport);
      await expect(
        investigate(source.read("pressure"), 4200, "fan", {}, "foundry"),
      ).rejects.toThrow();
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
});

afterAll(() => {
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/intelligence-evaluation.json",
    JSON.stringify(
      {
        kind: "Offline paired contract and adversarial evaluation; scripted provider calls are orchestration only",
        originalRef: ORIGINAL_INTELLIGENCE_REF,
        expectedPairedCaseCount: baseline.rows.length,
        completedPairedCaseCount: pairedRows.length,
        challengesCompleted: challengeRows.length,
        challengesPassed: challengeRows.filter((row) => row.passed).length,
        realProviderRequests: 0,
        actualProviderCostUsd: 0,
        liveModelQualityEvaluated: false,
        liveLatencyMs: null,
        improvementInHumanPreference: null,
        humanReview: null,
        pairedRows,
        challengeRows,
      },
      null,
      2,
    ) + "\n",
  );
});
