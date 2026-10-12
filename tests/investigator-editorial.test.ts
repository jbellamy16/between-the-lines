import { describe, expect, it, vi, afterEach } from "vitest";
import { controls } from "../eval/investigator-editorial/controls";
import { blindedArtifact } from "../eval/investigator-editorial/artifact";
import {
  compareExplanations,
  evaluateEditorial,
  STYLES,
  LENGTHS,
  WORD_LIMITS,
  type Submission,
} from "../eval/investigator-editorial/render";
import {
  investigationPlanSchema,
  prepareInvestigation,
} from "../src/lib/ai/director/investigator-contract";
import {
  questionText,
  presentQuestion,
} from "../src/lib/ai/director/questions";
import { buildCase, cases } from "../eval/editorial-baselines/cases";
import {
  investigatorDigest,
  INVESTIGATOR_VERSION,
} from "../src/lib/ai/director/investigator-contract";
import { scriptedPlan } from "../eval/investigator/scripted";

const scenarios = controls();
const base = scenarios.find((c) => c.id === "same-as-b2")!;
const evaluate = (
  submission: Submission = base.submission,
  style: (typeof STYLES)[number] = "plain",
  length: (typeof LENGTHS)[number] = "brief",
) =>
  evaluateEditorial(
    base.match,
    base.cutoff,
    base.context,
    submission,
    "mock",
    style,
    length,
  );
afterEach(() => vi.unstubAllGlobals());

describe("verified editorial evaluation", () => {
  it.each(STYLES.flatMap((s) => LENGTHS.map((l) => [s, l] as const)))(
    "uses the same %s/%s surface and preserves every mandatory qualification and alternative",
    (style, length) => {
      for (const c of scenarios) {
        const r = evaluateEditorial(
          c.match,
          c.cutoff,
          c.context,
          c.submission,
          "mock",
          style,
          length,
        );
        expect(r.status).toBe("reviewable");
        expect(r.b2.limit).toBe(WORD_LIMITS[length]);
        expect(r.investigator.limit).toBe(r.b2.limit);
        expect(r.investigator.words).toBeLessThanOrEqual(r.investigator.limit);
        for (const [arm, m, answers] of [
          [r.b2, r.audit.baselineMaterial, r.audit.baselineOutput.answers],
          [
            r.investigator,
            r.audit.verifiedMaterial,
            r.audit.verifiedOutput.answers,
          ],
        ] as const) {
          const text = arm.mandatory.map((b) => b.text);
          for (const x of m?.challenges ?? [])
            expect(text).toContain(questionText(x.text, style));
          for (const x of m?.support ?? [])
            expect(text).toContain(questionText(x.evidence.description, style));
          for (const x of m?.interpretations ?? [])
            expect(text).toContain(
              `${x.status}: ${questionText(x.text, style)}`,
            );
          for (const q of answers) {
            const wording = presentQuestion(q, c.match, style);
            expect(text).toEqual(
              expect.arrayContaining([
                wording.answer,
                wording.measurement,
                wording.windows,
                ...wording.qualifications,
              ]),
            );
          }
        }
      }
    },
  );
  it("changes actual rendered emphasis for valid interpretations, support and counter-evidence without changing canonical facts", () => {
    for (const id of [
      "limited-interpretation-focus",
      "generic-counter-evidence",
      "different-supported-evidence",
    ]) {
      const r = evaluate(scenarios.find((c) => c.id === id)!.submission);
      expect(r.audit.verification.result).toBe("passed");
      expect(r.comparison.kind).toBe("editorial-emphasis-change");
      expect(r.comparison.sameInformation).toBe(true);
      expect(r.investigator.mandatory).toEqual(r.b2.mandatory);
      expect(r.investigator.emphasis).not.toEqual(r.b2.emphasis);
      expect(r.audit.verifiedOutput).toEqual(r.audit.baselineOutput);
    }
    const limited = evaluate(
      scenarios.find((c) => c.id === "limited-interpretation-focus")!
        .submission,
    );
    expect(limited.investigator.emphasis[0].text).toMatch(/^limited:/);
  });
  it("supports a different verified focal development only after its mandatory reads", () => {
    const c = scenarios.find((c) => c.id === "other-focal-development")!;
    const r = evaluate(c.submission);
    expect(r.audit.verification.result).toBe("passed");
    expect(r.comparison.kind).toBe("focal-development-change");
    expect(r.investigator.headline).toContain("Harbor");
    const premature = evaluate({ ...c.submission, trace: [] });
    expect(premature.audit.verification.result).toBe("rejected");
    expect(premature.investigator).toEqual(premature.b2);
  });
  it("distinguishes parity, secondary reordering and genuine focus changes", () => {
    expect(evaluate().comparison.kind).toBe("identical");
    // Strong B2 already emphasizes the relevant opponent response.
    expect(
      evaluate(
        scenarios.find((c) => c.id === "opponent-counter-evidence")!.submission,
      ).comparison.kind,
    ).toBe("identical");
    const plan = investigationPlanSchema.parse(base.submission.plan);
    const r = evaluate({
      ...base.submission,
      plan: {
        ...plan,
        interpretationIds: [
          plan.interpretationIds[0],
          plan.interpretationIds[2],
          plan.interpretationIds[1],
        ],
      },
    });
    expect(r.comparison.kind).toBe("reordered-only");
    const relabelled = structuredClone(r.b2);
    expect(compareExplanations(r.b2, relabelled).kind).toBe("identical");
    expect(r.comparison.improvementEstablished).toBe(false);
    expect(r.comparison.humanPreference).toBeNull();
  });
  it.each([
    { focalId: "invented" },
    { challengeIds: [] },
    { supportIds: [] },
    { challengeIds: ["invented"] },
    { interpretationIds: ["unsupported"] },
    {
      supportIds: [
        "support:recorded-observation",
        "support:recorded-observation",
      ],
    },
    { explanation: "99 shots prove domination" },
    { stop: "unresolved" },
    { indexId: "x".repeat(64) },
  ])(
    "invalid selection %j cannot change facts or suppress mandatory qualifications",
    (mutation) => {
      const plan = investigationPlanSchema.parse(base.submission.plan);
      const submitted = { ...base.submission, plan: { ...plan, ...mutation } };
      const r = evaluate(submitted);
      expect(r.audit.verification.result).toBe("rejected");
      expect(r.audit.exactSubmittedDecision).toEqual(submitted);
      expect(r.audit.selectedPlan).toBeNull();
      expect(r.investigator).toEqual(r.b2);
      expect(blindedArtifact(r, "01", false).html).not.toContain("99 shots");
    },
  );
  it("rejects forged trace digests and stale source evidence", () => {
    const c = scenarios.find((c) => c.id === "other-focal-development")!;
    const forged = structuredClone(c.submission);
    forged.trace[0].digest = "a".repeat(64);
    expect(evaluate(forged).audit.verification.result).toBe("rejected");
    expect(
      evaluate({ ...base.submission, initialDigest: "b".repeat(64) }).audit
        .verification.result,
    ).toBe("rejected");
  });
  it("keeps all missing-data qualifications for unresolved cases", () => {
    for (const id of [
      "unknown-quality",
      "unknown-possession",
      "minute-timing",
    ]) {
      const c = buildCase(cases.find((c) => c.id === id)!);
      const p = prepareInvestigation(c.match, c.cutoff, c.context);
      const plan = scriptedPlan({
        index: p.reader.index,
        bundles: p.initial,
        baselineIds: p.baseline.stories.map((s) => s.storyId),
      });
      const receipt: Submission = {
        version: INVESTIGATOR_VERSION,
        indexId: p.reader.index.id,
        initialDigest: investigatorDigest(p.initial),
        trace: [],
        plan,
      };
      const r = evaluateEditorial(
        c.match,
        c.cutoff,
        c.context,
        receipt,
        "mock",
        "plain",
        "brief",
      );
      expect(r.audit.verification.result).toBe("passed");
      expect(r.investigator.mandatory.at(-1)?.text).toContain("unresolved");
      const invalid = evaluateEditorial(
        c.match,
        c.cutoff,
        c.context,
        { ...receipt, plan: { ...plan, stop: "sufficient" } },
        "mock",
        "plain",
        "brief",
      );
      expect(invalid.audit.verification.result).toBe("rejected");
    }
  });
  it("renders a valid stopping choice without giving it voluntary-stop or quality credit", () => {
    const plan = investigationPlanSchema.parse(base.submission.plan);
    const r = evaluate({
      ...base.submission,
      plan: { ...plan, stop: "no-material-gain" },
    });
    expect(r.audit.verification.result).toBe("passed");
    expect(r.investigator.mandatory.at(-1)?.text).toContain(
      "no further material gain",
    );
    expect(r.audit.stopVerification).toContain("original runner receipt");
    expect(r.comparison.kind).toBe("stopping-change");
    expect(r.comparison.sameInformation).toBe(true);
    expect(r.comparison.improvementEstablished).toBe(false);
  });
  it("runs without network and keeps mocks distinct from recorded decisions", () => {
    const network = vi.fn(() => {
      throw new Error("No network");
    });
    vi.stubGlobal("fetch", network);
    const r = evaluate();
    expect(network).not.toHaveBeenCalled();
    expect(r.audit.actualModelSelectedDecisions).toBeNull();
    const recorded = evaluateEditorial(
      base.match,
      base.cutoff,
      base.context,
      base.submission,
      "recorded-model",
      "plain",
      "brief",
    );
    expect(recorded.audit.actualModelSelectedDecisions).toEqual(
      base.submission,
    );
    expect(recorded.audit.paidCalls).toBe(0);
  });
  it("withholds both arms when complete mandatory content exceeds the shared budget", () => {
    const c = scenarios.find((c) => c.id === "quiet-no-call")!;
    const match = structuredClone(c.match);
    match.teams.harbor.short = "Long source name ".repeat(700);
    const r = evaluateEditorial(
      match,
      c.cutoff,
      c.context,
      c.submission,
      "mock",
      "plain",
      "brief",
    );
    expect(r.status).toBe("blocked-length");
    expect(r.b2.words).toBeGreaterThan(r.b2.limit);
    expect(r.investigator.words).toBeGreaterThan(r.investigator.limit);
    expect(r.b2.mandatory[0].text).toContain(match.teams.harbor.short);
    expect(() => blindedArtifact(r, "123", false)).toThrow();
  });
  it("blinds both assignment and rejected prose; stores the key separately and fails closed on overflow", () => {
    const r = evaluate();
    const a = blindedArtifact(r, "123", false);
    const b = blindedArtifact(r, "123", true);
    expect(a.html).toContain("Explanation A");
    expect(a.html).not.toMatch(
      /investigator|B2|same-as-b2|mock|focalId|indexId/,
    );
    expect(a.key.A).toBe("B2");
    expect(b.key.A).toBe("investigator");
    expect(a.key.artifactDigest).toBe(investigatorDigest(a.html));
    expect(() =>
      blindedArtifact({ ...r, status: "blocked-length" }, "123", false),
    ).toThrow();
    expect(
      blindedArtifact(r, "<script>alert(1)</script>", false).html,
    ).not.toContain("<script>");
  });
});
