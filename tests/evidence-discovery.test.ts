import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildEvidenceIndex,
  executeEvidenceOption,
  DISCOVERY_LIMITS,
  type EvidenceIndex,
  type DiscoveryOption,
} from "../src/lib/ai/director/discovery";
import { surgeFixture } from "./shot-surge-fixture";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { observe } from "../src/lib/ai/director/observer";
import { evaluateHypothesis } from "../src/lib/ai/director/hypothesis";
import { questionEvidence } from "../src/lib/ai/director/questions";
import { createInvestigation } from "../src/lib/ai/director/tools";
import { evidenceWire } from "../src/lib/ai/director/evidence-wire";
import type { MatchData } from "../src/lib/sources/model";

const read = (
  match: MatchData,
  cutoff: number,
  index: EvidenceIndex,
  option: DiscoveryOption,
) =>
  executeEvidenceOption(match, cutoff, {
    indexId: index.id,
    optionId: option.id,
  });
const findTool = (index: EvidenceIndex, tool: string, team = "harbor") =>
  index.options.find((o) => o.tool === tool && o.team === team)!;
const findQuestion = (index: EvidenceIndex, storyId: string, intent: string) =>
  index.options.find(
    (o) =>
      o.tool === "guided_question" &&
      o.developmentId === storyId &&
      o.intent === intent,
  )!;
afterEach(() => vi.unstubAllGlobals());

describe("bounded shared evidence discovery", () => {
  it("lets an offline policy enumerate every available option using the same read interface", () => {
    for (const { match, cutoff } of [
      surgeFixture(),
      { match: new SyntheticMatchSource().read("pressure"), cutoff: 4200 },
    ]) {
      const index = buildEvidenceIndex(match, cutoff);
      for (const option of index.options.filter((o) => !o.unavailable)) {
        const result = read(match, cutoff, index, option);
        expect(result.option).toEqual(option);
        expect(result.events.every((e) => e.time <= cutoff)).toBe(true);
        expect(JSON.stringify(result).length).toBeLessThanOrEqual(48000);
      }
    }
  });
  it("offers deterministic verdicts and all three competing interpretations with intact evidence", () => {
    const { match, cutoff, question } = surgeFixture();
    const fetch = vi.fn(() => {
      throw new Error("No inference allowed");
    });
    vi.stubGlobal("fetch", fetch);
    const index = buildEvidenceIndex(match, cutoff);
    const d = index.developments.find((d) => d.id === question.storyId)!;
    expect(d).toBeDefined();
    expect(
      d.questions
        .find((q) => q.intent === question.intent)
        ?.interpretations.map((i) => i.status),
    ).toEqual(["supported", "supported", "supported"]);
    const option = findQuestion(index, question.storyId, question.intent);
    const result = read(match, cutoff, index, option);
    expect(result.payload.question).toEqual(
      questionEvidence(match, cutoff, question),
    );
    expect(result.coverage.bundle).toBe("complete");
    expect(index.score).toEqual({ harbor: 0, riverside: 0 });
    expect(index.version).toBe("evidence-discovery-1.0.0");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("exposes evidence outside the personalized shortlist to either evaluation policy", () => {
    const match = new SyntheticMatchSource().read("pressure"),
      cutoff = 4200;
    const preferences = {
      seenEvidenceIds: match.events
        .filter((e) => e.time <= cutoff)
        .map((e) => e.id),
    };
    const index = buildEvidenceIndex(match, cutoff, { preferences });
    expect(index.developments.some((d) => !d.inShortlist)).toBe(true);
    expect(index.developments.map((d) => d.id)).toEqual(
      buildEvidenceIndex(match, cutoff).developments.map((d) => d.id),
    );
    expect(index.coverage.developments.eligible).toBe(
      observe(match, cutoff, "fan", {}, { unranked: true }).length,
    );
    expect(JSON.stringify(index).length).toBeLessThanOrEqual(48000);
    expect(index.options.length).toBeLessThanOrEqual(96);
    expect(new Set(index.options.map((o) => o.id)).size).toBe(
      index.options.length,
    );
  });

  it("catalogues more than twelve developments without inheriting the observer shortlist cap", () => {
    const { match, cutoff } = surgeFixture();
    const recent = match.events.filter((e) => e.time > 900);
    const groups = new Set<string>();
    for (const shot of recent.filter((e) => e.type === "shot")) {
      const key = `${shot.team}:${shot.possessionId}`;
      if (groups.has(key)) continue;
      groups.add(key);
      for (let i = 1; i <= 4; i++) {
        const pass = structuredClone(shot);
        pass.id = `pass:${shot.id}:${i}`;
        pass.type = "pass";
        pass.time = pass.periodSeconds = shot.time - i;
        pass.source.eventId = pass.id;
        pass.source.eventType = "pass";
        delete pass.xg;
        delete pass.outcome;
        recent.push(pass);
      }
    }
    // Identical earlier activity keeps this fixture about independent possessions,
    // with no activity-increase candidates consuming the catalogue envelope.
    const previous = recent.map((event) => {
      const e = structuredClone(event);
      e.id = `previous:${e.id}`;
      e.source.eventId = e.id;
      e.time -= 900;
      e.periodSeconds = e.time;
      e.possessionId! += 100;
      return e;
    });
    match.events = [...previous, ...recent].sort((a, b) => a.time - b.time);
    match.events.forEach((e, order) => (e.order = order));
    const index = buildEvidenceIndex(match, cutoff);
    expect(observe(match, cutoff)).toHaveLength(12);
    expect(index.developments).toHaveLength(15);
    expect(index.coverage.developments.status).toBe("complete");
    expect(index.developments.filter((d) => !d.inShortlist)).toHaveLength(3);
  });

  it("retrieves a precisely targeted assessment omitted by the two-assessment broad query", () => {
    const { match, cutoff } = surgeFixture();
    const query = {
      matchId: match.id,
      start: 0,
      end: cutoff,
      team: null,
      playerId: null,
      eventId: null,
    };
    const session = createInvestigation(
      match,
      cutoff,
      "fan",
      {},
      { unranked: true },
    );
    const packet = session.execute("inspect_counter_evidence", query);
    const broad = packet as unknown as {
      assessments: unknown[];
      assessmentCoverage: {
        omittedAssessmentIds: string[];
        eligible: number;
        returned: number;
      };
    };
    expect(broad.assessments).toHaveLength(2);
    expect(
      broad.assessmentCoverage.omittedAssessmentIds.length,
    ).toBeGreaterThan(0);
    expect(evidenceWire()(packet)).toHaveProperty(
      "assessmentCoverage",
      broad.assessmentCoverage,
    );
    const index = buildEvidenceIndex(match, cutoff);
    const id = broad.assessmentCoverage.omittedAssessmentIds.find((id) =>
      index.developments.some((d) => d.id === id),
    )!;
    const option = index.options.find(
      (o) => o.developmentId === id && o.purpose === "inspect-challenge",
    )!;
    const result = read(match, cutoff, index, option);
    const candidate = observe(
      match,
      cutoff,
      "fan",
      {},
      { unranked: true },
    ).find((c) => c.id === id)!;
    expect(result.payload.assessments).toEqual([
      { claimId: id, assessment: evaluateHypothesis(match, cutoff, candidate) },
    ]);
    expect(result.payload.assessmentCoverage).toMatchObject({
      eligible: 1,
      returned: 1,
      omittedAssessmentIds: [],
      incompleteAssessmentIds: [],
    });
  });

  it("reports an incomplete assessment instead of treating an empty result as no challenge", () => {
    const { match, cutoff, question } = surgeFixture();
    const result = createInvestigation(
      match,
      cutoff,
      "fan",
      {},
      { unranked: true },
    ).execute("inspect_counter_evidence", {
      matchId: match.id,
      start: 900,
      end: cutoff,
      team: "harbor",
      playerId: null,
      eventId: null,
      claimId: question.storyId,
    });
    expect(result).toMatchObject({
      assessments: [],
      assessmentCoverage: {
        eligible: 0,
        returned: 0,
        incompleteAssessmentIds: [question.storyId],
      },
    });
  });

  it.each(["xg", "possession", "timing", "locations"])(
    "preserves missing %s instead of treating it as zero",
    (missing) => {
      const { match, cutoff, question } = surgeFixture();
      const shot = match.events.find(
        (e) => e.type === "shot" && e.team === "harbor" && e.time > 900,
      )!;
      if (missing === "xg") delete shot.xg;
      if (missing === "possession") shot.possessionId = null;
      if (missing === "timing") shot.source.precision = "minute";
      if (missing === "locations")
        match.events.find((e) => e.type === "recovery")!.position = null;
      const index = buildEvidenceIndex(match, cutoff);
      const field =
        missing === "xg"
          ? "xg"
          : missing === "possession"
            ? "possession"
            : missing === "timing"
              ? "secondLevelTiming"
              : "recoveryLocations";
      expect(index.sourceCoverage[field].status).toBe("partial");
      expect(index.sourceCoverage[field].missing).toBeGreaterThan(0);
      const intent =
        missing === "xg" ? "chance-quality" : "shot-surge-explanations";
      const result = read(
        match,
        cutoff,
        index,
        findQuestion(index, question.storyId, intent),
      );
      expect(result.coverage.bundle).toBe("partial");
      expect(result.coverage.missingInformation.length).toBeGreaterThan(0);
      if (missing === "xg")
        expect(result.payload.question).toMatchObject({
          availability: "unavailable",
          verdict: "unknown",
          measurements: expect.arrayContaining([
            expect.objectContaining({ id: "current-xg", value: null }),
          ]),
        });
    },
  );

  it("keeps unknown pass outcomes separate from known failures and suppresses unsupported sequences", () => {
    const match = structuredClone(new SyntheticMatchSource().read("pressure")),
      cutoff = 4200;
    const pass = match.events.find(
      (e) =>
        e.type === "pass" &&
        e.team === "harbor" &&
        e.time > 3300 &&
        e.time <= cutoff,
    )!;
    delete pass.success;
    match.capabilities.possession = "unavailable";
    match.capabilities.xg = false;
    const index = buildEvidenceIndex(match, cutoff);
    expect(index.sourceCoverage.xg.status).toBe("unavailable");
    expect(index.sourceCoverage.passOutcomes.missing).toBeGreaterThan(0);
    const sequence = findTool(index, "get_recorded_sequence");
    expect(sequence.unavailable).toContain("unavailable");
    expect(() => read(match, cutoff, index, sequence)).toThrow("unavailable");
    const stats = read(
      match,
      cutoff,
      index,
      findTool(index, "get_team_statistics"),
    );
    expect(stats.coverage.eventDetails.status).toBe("partial");
    expect(stats.events).toHaveLength(40);
    const counts = stats.payload.statistics as {
      passes: number;
      knownPassOutcomes: number;
    };
    expect(counts.knownPassOutcomes).toBeLessThan(counts.passes);
    expect(counts.passes).toBe(
      match.events.filter(
        (e) =>
          e.type === "pass" &&
          e.team === "harbor" &&
          e.time > 3300 &&
          e.time <= cutoff,
      ).length,
    );
    expect(stats.coverage.source.providerCompleteness).toBe("unknown");
  });

  it("rejects arbitrary, foreign, stale and mutated queries without dispatch", () => {
    const { match, cutoff } = surgeFixture();
    const index = buildEvidenceIndex(match, cutoff);
    const request = { indexId: index.id, optionId: index.options[0].id };
    for (const raw of [
      { ...request, start: 0 },
      { ...request, tool: "sql" },
      { ...request, optionId: "invented" },
      { ...request, indexId: "0".repeat(64) },
    ])
      expect(() => executeEvidenceOption(match, cutoff, raw)).toThrow();
    for (const time of [NaN, -1, Infinity, match.duration + 1])
      expect(() => buildEvidenceIndex(match, time)).toThrow();
    const gap = structuredClone(match);
    gap.periods[0].end = 1900;
    expect(() => buildEvidenceIndex(gap, 2000)).toThrow("recorded period");
    expect(() => executeEvidenceOption(match, cutoff - 0.001, request)).toThrow(
      "Stale",
    );
    expect(() =>
      executeEvidenceOption(match, cutoff, request, { mode: "analyst" }),
    ).toThrow("Stale");
    const changed = structuredClone(match);
    changed.provenance.revision = "new";
    expect(() => executeEvidenceOption(changed, cutoff, request)).toThrow(
      "Stale",
    );
    changed.provenance.revision = match.provenance.revision;
    changed.events.find((e) => e.type === "shot")!.xg = 0.5;
    expect(() => executeEvidenceOption(changed, cutoff, request)).toThrow(
      "Stale",
    );
    const original = structuredClone(index.options[0]);
    index.options[0].purpose = "check-quality";
    expect(executeEvidenceOption(match, cutoff, request).option).toEqual(
      original,
    );
  });

  it("rejects invalid precise targets and disallows assessment boundaries on other tools", () => {
    const { match, cutoff, question } = surgeFixture();
    const session = createInvestigation(
      match,
      cutoff,
      "fan",
      {},
      { unranked: true },
    );
    const query = {
      matchId: match.id,
      start: 0,
      end: cutoff,
      team: null,
      playerId: null,
      eventId: null,
    };
    expect(() =>
      session.execute("inspect_counter_evidence", {
        ...query,
        claimId: "foreign-claim",
      }),
    ).toThrow("target");
    expect(() =>
      session.execute("get_team_statistics", {
        ...query,
        claimId: question.storyId,
      }),
    ).toThrow("target");
    expect(() =>
      session.execute("compare_time_windows", {
        ...query,
        start: 900,
        boundary: "[start,end]",
      }),
    ).toThrow("Boundary");
  });

  it("blocks restricted sources for external use but permits explicit local deterministic inspection", () => {
    const { match, cutoff } = surgeFixture();
    const permitted = buildEvidenceIndex(match, cutoff);
    match.provenance.redistribution = "restricted";
    expect(() => buildEvidenceIndex(match, cutoff)).toThrow("restricted");
    expect(() => read(match, cutoff, permitted, permitted.options[0])).toThrow(
      "restricted",
    );
    const local = buildEvidenceIndex(match, cutoff, { audience: "local" });
    const result = executeEvidenceOption(
      match,
      cutoff,
      { indexId: local.id, optionId: local.options[0].id },
      { audience: "local" },
    );
    expect(result.source.redistribution).toBe("restricted");
  });

  it.each(["matchId", "provider", "sourceMatchId", "teamId", "duplicate"])(
    "rejects inconsistent %s identities before indexing",
    (field) => {
      const { match, cutoff } = surgeFixture();
      if (field === "matchId") match.events[0].matchId = "foreign";
      if (field === "provider") match.events[0].source.provider = "foreign";
      if (field === "sourceMatchId") match.events[0].source.matchId = "foreign";
      if (field === "teamId") match.events[0].teamId = "foreign";
      if (field === "duplicate") match.events[1].id = match.events[0].id;
      expect(() => buildEvidenceIndex(match, cutoff)).toThrow("identity");
    },
  );

  it("is prefix invariant, strips raw/final data, and preserves exact fractional event times", () => {
    const match = structuredClone(new SyntheticMatchSource().read("pressure")),
      cutoff = 4200.125;
    const e = match.events.find(
      (e) =>
        e.type === "shot" &&
        e.team === "harbor" &&
        e.time > 3300 &&
        e.time < 4200,
    )!;
    e.time += 0.123;
    e.periodSeconds += 0.123;
    e.source.precision = "millisecond";
    const before = buildEvidenceIndex(match, cutoff);
    const changed = structuredClone(match);
    changed.finalScore = { harbor: 99, riverside: 99 };
    changed.provenance.raw = { secret: "RAW_INJECTION" };
    changed.events.forEach((e) => {
      e.source.raw = { secret: "RAW_INJECTION" };
      if (e.time > cutoff) e.xg = 0.9;
    });
    changed.events[0].relatedEvents.push(match.events.at(-1)!.id);
    expect(buildEvidenceIndex(changed, cutoff)).toEqual(before);
    const result = read(
      changed,
      cutoff,
      before,
      findTool(before, "get_shot_locations"),
    );
    expect(result.events.find((event) => event.id === e.id)).toMatchObject({
      time: e.time,
      periodSeconds: e.periodSeconds,
      source: {
        precision: "millisecond",
        matchId: match.provenance.sourceMatchId,
      },
    });
    expect(JSON.stringify(result)).not.toContain("RAW_INJECTION");
    expect(JSON.stringify(result)).not.toContain("finalScore");
    expect(
      result.events.every(
        (e) =>
          e.time <= cutoff &&
          e.relatedEvents.every(
            (id) => match.events.find((e) => e.id === id)!.time <= cutoff,
          ),
      ),
    ).toBe(true);
  });

  it("offers only fixed same-period comparisons and rejects early-half comparison options", () => {
    const match = new SyntheticMatchSource().read("pressure");
    for (const cutoff of [0, match.secondHalfStart + 120, 4200.123]) {
      const index = buildEvidenceIndex(match, cutoff);
      for (const o of index.options.filter((o) =>
        ["compare_time_windows", "compare_shot_routes"].includes(o.tool),
      )) {
        const [a, b] = o.windowRefs.map((ref) => index.windows[ref]);
        expect(a.period).toBe(b.period);
        expect(a.end).toBe(b.start);
        expect(a.end - a.start).toBeCloseTo(b.end - b.start, 8);
        expect(b.end).toBe(cutoff);
        if (o.unavailable)
          expect(() => read(match, cutoff, index, o)).toThrow(
            "complete same-period",
          );
      }
    }
  });

  it("discloses upstream shot-anchor omissions and response bounds", () => {
    const { match, cutoff } = surgeFixture();
    const template = match.events.find(
      (e) => e.type === "shot" && e.team === "harbor",
    )!;
    for (let i = 0; i < 130; i++)
      match.events.push({
        ...structuredClone(template),
        id: `extra:${i}`,
        time: 1500 + i,
        periodSeconds: 1500 + i,
        source: { ...structuredClone(template.source), eventId: `extra:${i}` },
      });
    match.events
      .sort((a, b) => a.time - b.time)
      .forEach((e, order) => (e.order = order));
    const index = buildEvidenceIndex(match, cutoff);
    expect(index.coverage.observerOmissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "shot-anchor-limit", count: 130 }),
        expect.objectContaining({ reason: "claim-evidence-limit" }),
      ]),
    );
    expect(index.coverage.scopeOmissions.sequences).toBe(130);
    expect(JSON.stringify(index).length).toBeLessThanOrEqual(
      DISCOVERY_LIMITS.characters,
    );
    const route = read(
      match,
      cutoff,
      index,
      findTool(index, "compare_shot_routes"),
    );
    expect(route.coverage.bundle).toBe("unavailable");
    expect(route.coverage.routeReferences!.eligible).toBeGreaterThan(120);
    expect(route.coverage.routeReferences).toMatchObject({
      returned: 0,
      omitted: route.coverage.routeReferences!.eligible,
    });
    expect(route.payload.routes).toMatchObject({
      suppressed: true,
      facts: [],
      eventIds: [],
    });
  });
});
