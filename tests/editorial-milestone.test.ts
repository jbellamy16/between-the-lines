import { describe, expect, it, vi, afterEach } from "vitest";
import { observe, claimEmphasis } from "../src/lib/ai/director/observer";
import { canLead, selectLeadCandidate } from "../src/lib/ai/director/editorial";
import { packageStory } from "../src/lib/ai/director/story";
import { directMatch } from "../src/lib/ai/director/runner";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { loadHistorical } from "../src/lib/sources/repository";
import { matchInsights } from "../src/lib/sources/intelligence";
import { eventClock, recordedScore } from "../src/lib/sources/model";
import { comparisonWindow, isHighBallWin } from "../src/lib/sources/metrics";
import { reconstructStorylines } from "../src/lib/ai/director/storylines";

const source = new SyntheticMatchSource();
afterEach(() => vi.unstubAllEnvs());

describe("first editorial milestone", () => {
  it("uses the same ball wins, shots and equal half-bounded windows in both explanations", () => {
    const match = source.read("pressure");
    const time = 3804;
    const candidates = observe(match, time);
    for (const metric of ["Shots", "Ball wins in attacking third"]) {
      const label =
        metric === "Shots" ? "shots" : "ball wins in the attacking third";
      const candidate = candidates.find(
        (c) => c.statistics[0]?.label === label,
      )!;
      const insight = matchInsights(match, time).find(
        (i) => i.metric === metric,
      )!;
      const story = packageStory(
        candidate,
        match,
        time,
        "fan",
        "offline",
        "brief",
        "comparison",
      );
      expect(candidate.statistics.map((s) => s.value)).toEqual([4, 0]);
      expect(insight.current).toBe(4);
      expect(insight.previous).toBe(0);
      expect(candidate.evidenceIds).toEqual([
        ...insight.baselineIds,
        ...insight.evidenceIds,
      ]);
      expect(story.hypothesis.windows.map((w) => [w.start, w.end])).toEqual([
        [2700, 3252],
        [3252, 3804],
      ]);
      expect(insight.explanation).toContain("9 min 12 sec");
      expect(story.explanation).toContain("9 min 12 sec");
      expect(story.hypothesis.verificationChecks.every((c) => c.passed)).toBe(
        true,
      );
    }
    const recoveries = reconstructStorylines(match, 3900).find(
      (s) => s.metric === "attacking-third-recoveries",
    )!;
    expect(recoveries.label).toBe("recoveries in the attacking third");
    expect(recoveries.current.end - recoveries.current.start).toBe(300);
    expect(
      recoveries.current.evidenceIds.every(
        (id) => match.events.find((e) => e.id === id)?.type === "recovery",
      ),
    ).toBe(true);
  });

  it("does not count failed or unknown recorded tackles as wins, or count restarts", () => {
    const event = {
      type: "tackle",
      position: { x: 80, y: 50 },
      source: { provider: "wyscout" },
    };
    expect(isHighBallWin(event)).toBe(false);
    expect(isHighBallWin({ ...event, success: false })).toBe(false);
    expect(isHighBallWin({ ...event, success: true })).toBe(true);
    expect(isHighBallWin({ ...event, source: { provider: "synthetic" } })).toBe(
      true,
    );
    expect(isHighBallWin({ ...event, type: "possession", success: true })).toBe(
      false,
    );
  });

  it("uses actual period starts and requires two complete windows of at least five minutes", async () => {
    const match = await loadHistorical("2499719");
    for (const elapsed of [0, 599, 600, 1104, 1800]) {
      const cutoff = match.secondHalfStart + elapsed;
      const window = comparisonWindow(cutoff, match.secondHalfStart);
      expect(window.previousStart).toBeGreaterThanOrEqual(
        match.secondHalfStart,
      );
      expect(window.end - window.start).toBe(
        window.start - window.previousStart,
      );
      if (elapsed < 600) expect(matchInsights(match, cutoff)).toEqual([]);
      for (const insight of matchInsights(match, cutoff)) {
        expect(
          insight.start - (insight.end - insight.start),
        ).toBeGreaterThanOrEqual(match.secondHalfStart);
        expect(
          insight.evidenceIds.every((id) => {
            const e = match.events.find((e) => e.id === id)!;
            return (
              e.time > insight.start && e.time <= cutoff && e.period === "2H"
            );
          }),
        ).toBe(true);
      }
    }
  });

  it("preserves D. Gray's minute precision without moving the conservative visibility boundary", async () => {
    const match = await loadHistorical("2499719");
    const gray = match.players.find((p) => p.name === "D. Gray")!;
    const sub = match.events.find(
      (e) => e.type === "substitution" && e.playerId === gray.id,
    )!;
    expect(eventClock(match, sub)).toBe("~88′");
    expect(
      observe(match, sub.time - 1, "fan", {}, { unranked: true }).some((c) =>
        c.evidenceIds.includes(sub.id),
      ),
    ).toBe(false);
    const candidate = observe(
      match,
      match.duration,
      "fan",
      {},
      { unranked: true },
    ).find(
      (c) =>
        c.category === "substitute-involvement" &&
        c.evidenceIds.includes(sub.id),
    )!;
    expect(candidate.brief).toContain("~88′");
    expect(candidate.detail).toContain("~88′");
    expect(candidate.detail).not.toContain("89:00");
    const story = packageStory(
      candidate,
      match,
      match.duration,
      "analyst",
      "offline",
      "detail",
      claimEmphasis[candidate.category],
    );
    expect(story.explanation).toContain("~88′");
    expect(story.hypothesis.supportingEvidence[0].description).toContain(
      "~88′",
    );
  });

  it("allows a quiet spell to abstain while preserving secondary observations", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const match = source.read("quiet");
    const candidates = observe(match, 3804);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => !canLead(c))).toBe(true);
    expect(selectLeadCandidate(candidates)).toBeUndefined();
    const result = await directMatch(match, 3804, "fan");
    expect(result.decision).toBe("abstain");
    expect(result.stories).toEqual([]);
    expect(result.metrics.requests).toBe(0);
  });

  it("leads full time with Arsenal's 4–3 result even with a favorite substitute and seen goals", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const match = await loadHistorical("2499719");
    const gray = match.players.find((p) => p.name === "D. Gray")!;
    const preferences = {
      team: "riverside" as const,
      player: gray.id,
      categories: ["rhythm" as const],
      seenEvidenceIds: match.events.map((e) => e.id),
    };
    const result = await directMatch(match, match.duration, "fan", preferences);
    const story = result.stories[0];
    expect(story.category).toBe("full-time");
    expect(story.headline).toContain("Arsenal 4–3 Leicester");
    expect(story.explanation).toContain("Arsenal won 4–3");
    expect(story.hypothesis.watchNext).toBeNull();
    expect(story.hypothesis.verificationChecks.every((c) => c.passed)).toBe(
      true,
    );
    expect(
      recordedScore(
        match.events.filter((e) => story.evidenceEventIds.includes(e.id)),
      ),
    ).toEqual({ harbor: 4, riverside: 3 });
    const altered = { ...match, finalScore: { harbor: 99, riverside: 0 } };
    expect(selectLeadCandidate(observe(altered, match.duration))?.brief).toBe(
      selectLeadCandidate(observe(match, match.duration))?.brief,
    );
  });

  it("prioritizes the latest late goal and removes it on rewind", async () => {
    const match = await loadHistorical("2499719");
    const goal = match.events.findLast((e) => e.scoringTeam)!;
    const after = selectLeadCandidate(
      observe(match, goal.time + 1, "fan", {
        team: "riverside",
        categories: ["rhythm"],
      }),
    )!;
    expect(after.category).toBe("score-change");
    expect(after.evidenceIds).toContain(goal.id);
    const before = observe(match, goal.time - 1);
    expect(before.every((c) => !c.evidenceIds.includes(goal.id))).toBe(true);
    expect(selectLeadCandidate(before)?.headline).not.toContain("4–3");
  });

  it("can verify a goalless full-time result with no fabricated scoring event", () => {
    const match = source.read("quiet");
    match.events = match.events.filter((e) => !e.scoringTeam);
    const lead = selectLeadCandidate(observe(match, match.duration))!;
    expect(lead.headline).toContain("0–0");
    expect(lead.evidenceIds).toEqual([]);
    const story = packageStory(lead, match, match.duration, "fan", "offline");
    expect(story.hypothesis.verificationChecks.every((c) => c.passed)).toBe(
      true,
    );
    expect(story.coordinates).toEqual([]);
  });
});
