import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { SyntheticMatchSource } from "../../src/lib/sources/synthetic";
import { type MatchData } from "../../src/lib/sources/model";
import { observe, claimEmphasis } from "../../src/lib/ai/director/observer";
import { createInvestigation } from "../../src/lib/ai/director/tools";
import { packageStory } from "../../src/lib/ai/director/story";
import { evaluateHypothesis } from "../../src/lib/ai/director/hypothesis";
import {
  selectLeadCandidate,
  isMatchState,
} from "../../src/lib/ai/director/editorial";
import { reconstructStorylines } from "../../src/lib/ai/director/storylines";
import type { DirectorResult } from "../../src/lib/ai/director/runner";
import { presentStory } from "../../src/lib/explanation";
import { buildBriefing } from "../../src/lib/recap-briefing";
import { digest } from "./ledger";

export const CASES = [
  { id: "misleading-quality", cutoff: 1800 },
  { id: "pressure-fan", cutoff: 3804 },
  { id: "temporal-weakening", cutoff: 4200 },
  { id: "temporal-resolved", cutoff: 4500 },
  { id: "unfamiliar-8911", cutoff: 4200 },
  { id: "unfamiliar-73129", cutoff: 4200 },
] as const;
export type StudyCase = {
  id: string;
  cutoff: number;
  mode: "analyst";
  preferences: Record<string, never>;
  match: MatchData;
  digest: string;
  eligibility: "eligible" | "no-call";
  regeneration: string;
};
const historical = "docs/intelligence/pr18-intelligence-2026-10-10";
export function loadCases(): StudyCase[] {
  const saved = JSON.parse(
    readFileSync(`${historical}/synthetic-evidence.json`, "utf8"),
  ).fixtures as Record<string, MatchData>;
  const declarations = JSON.parse(
    readFileSync(`${historical}/cases.json`, "utf8"),
  ).cases as { id: string; matchId: string; cutoff: number }[];
  const source = new SyntheticMatchSource();
  return CASES.map((c) => {
    const declaration = declarations.find((v) => v.id === c.id)!;
    assert.equal(declaration.cutoff, c.cutoff);
    let match: MatchData;
    if (c.id === "misleading-quality") {
      match = structuredClone(saved[declaration.matchId]);
      for (const e of match.events)
        e.source = {
          provider: "synthetic",
          matchId: match.id,
          eventId: e.id,
          precision: "second",
          teamId: e.team,
          playerId: e.playerId,
          eventType: e.type,
          tags: [],
          coordinates: {
            transform: "identity-percent-v1",
            start: e.position ? [e.position.x, e.position.y] : undefined,
            end: e.end ? [e.end.x, e.end.y] : undefined,
          },
          raw: {},
        };
    } else {
      const seed = c.id.startsWith("unfamiliar-")
        ? Number(c.id.split("-")[1])
        : 202632;
      match = source.read("pressure", {
        seed,
        profile: c.id.startsWith("unfamiliar-") ? "balanced" : "demo",
      });
      // Compare every previously saved event field, not a favorable subset. The
      // current adapter restores source metadata and may add canonical fields.
      const old = saved[declaration.matchId];
      assert.equal(match.events.length, old.events.length);
      old.events.forEach((event, i) => {
        for (const [key, value] of Object.entries(event))
          assert.deepEqual(
            match.events[i][key as keyof typeof event],
            value,
            `${c.id}: saved event ${i}/${key} changed`,
          );
      });
    }
    const lead = selectLeadCandidate(observe(match, c.cutoff, "analyst", {}));
    return {
      ...c,
      mode: "analyst",
      preferences: {},
      match,
      digest: digest(JSON.stringify(match)),
      eligibility: !lead || isMatchState(lead) ? "no-call" : "eligible",
      regeneration:
        c.id === "misleading-quality"
          ? "saved diagnostic; source wrappers restored in memory"
          : "current seeded generator; every historical event field compared",
    };
  });
}

/** Independent fixed-fixture checks use direct event filters, not model output
 * or the observer's arithmetic. Unfamiliar seeds have no imposed home-fixture
 * outcome; their events are regenerated and their actual observations retained. */
export function fixtureEvidence(c: StudyCase) {
  const { match, cutoff } = c;
  const count = (
    start: number,
    end: number,
    metric: "shots" | "wins" | "recoveries",
  ) =>
    match.events.filter(
      (e) =>
        e.team === "harbor" &&
        e.time > start &&
        e.time <= end &&
        (metric === "shots"
          ? e.type === "shot"
          : (e.position?.x ?? -1) >= 66.7 &&
            (metric === "recoveries"
              ? e.type === "recovery"
              : e.type === "recovery"
                ? e.success !== false
                : ["interception", "tackle"].includes(e.type) &&
                  e.success !== false)),
    );
  const start = cutoff < 2700 ? 0 : 2700,
    width = Math.min(900, Math.floor((cutoff - start) / 2));
  const a = cutoff - width,
    b = cutoff - 2 * width;
  const current = count(a, cutoff, "shots"),
    previous = count(b, a, "shots");
  const evidence = {
    previousWindow: [b, a],
    currentWindow: [a, cutoff],
    shots: {
      previous: previous.length,
      current: current.length,
      early: count(a, a + width / 2, "shots").length,
      late: count(a + width / 2, cutoff, "shots").length,
    },
    xg: {
      previous: previous.reduce((s, e) => s + (e.xg ?? 0), 0),
      current: current.reduce((s, e) => s + (e.xg ?? 0), 0),
    },
    highWins: {
      previous: count(b, a, "wins").length,
      current: count(a, cutoff, "wins").length,
    },
    recoveryFiveMinutes: {
      previous: count(cutoff - 600, cutoff - 300, "recoveries").length,
      current: count(cutoff - 300, cutoff, "recoveries").length,
    },
    selectedShotIds: [...previous, ...current].map((e) => e.id),
    observations: observe(match, cutoff, "analyst", {}),
  };
  if (c.id === "misleading-quality") {
    assert.deepEqual([previous.length, current.length], [1, 4]);
    assert(
      Math.abs(evidence.xg.previous - 0.8) < 1e-9 &&
        Math.abs(evidence.xg.current - 0.2) < 1e-9,
    );
  }
  if (c.id === "pressure-fan") {
    assert.deepEqual([previous.length, current.length], [0, 4]);
    assert.deepEqual(evidence.highWins, { previous: 0, current: 4 });
  }
  if (c.id === "temporal-weakening") {
    assert.deepEqual(evidence.shots, {
      previous: 1,
      current: 4,
      early: 3,
      late: 1,
    });
    assert.deepEqual(evidence.recoveryFiveMinutes, { previous: 3, current: 1 });
  }
  if (c.id === "temporal-resolved") {
    assert.equal(evidence.recoveryFiveMinutes.current, 0);
    assert(
      reconstructStorylines(match, cutoff).some(
        (s) =>
          s.team === "harbor" &&
          s.metric === "attacking-third-recoveries" &&
          s.state === "resolved",
      ),
    );
  }
  return evidence;
}

/** Fresh query replay against a prefix-only fixture, separate from the runtime's
 * publication verifier. Recheck all selected IDs, measurements and source IDs. */
export function verifyAndRender(c: StudyCase, result: DirectorResult) {
  const { match, cutoff } = c;
  const prefix = {
    ...match,
    events: match.events.filter((e) => e.time <= cutoff),
  };
  const verifier = createInvestigation(prefix, cutoff, "analyst", {});
  for (const entry of result.trace) {
    const checked = verifier.execute(entry.tool, entry.query);
    assert.deepEqual(
      checked.claims.map((v) => v.id),
      entry.claimIds,
    );
    assert.deepEqual(
      checked.events.map((v) => v.id),
      entry.eventIds,
    );
  }
  const candidates = result.trace.length
    ? verifier.candidates
    : observe(prefix, cutoff, "analyst", {});
  assert.deepEqual(reconstructStorylines(prefix, cutoff), result.storylines);
  const visible = new Map(prefix.events.map((e) => [e.id, e]));
  for (const id of result.narrative.evidenceIds)
    assert(visible.has(id), "Future/unknown narrative event");
  for (const story of result.stories) {
    const candidate = candidates.find((v) => v.id === story.storyId);
    assert(candidate, "Unretrieved selected claim");
    assert.deepEqual(
      evaluateHypothesis(prefix, cutoff, candidate),
      story.hypothesis,
    );
    assert.equal(story.cutoff, cutoff);
    assert.equal(story.audience, "analyst");
    assert(story.hypothesis.verificationChecks.every((v) => v.passed));
    for (const id of story.evidenceEventIds) {
      const event = visible.get(id);
      assert(
        event &&
          event.matchId === match.id &&
          event.source.matchId === match.id &&
          (event.source.eventId === id ||
            `${match.id}:${event.source.eventId}` === id) &&
          event.source.precision === "second",
        "Source alignment/precision violation",
      );
    }
    const repack = packageStory(
      candidate,
      prefix,
      cutoff,
      "analyst",
      story.provider,
      candidate.detail === story.explanation ? "detail" : "brief",
      claimEmphasis[candidate.category],
    );
    assert(
      isDeepStrictEqual(repack, story),
      "Published package differs from fresh verification",
    );
  }
  const rendered = (["plain", "analysis"] as const).map((style) => {
    const stories = result.stories.map((s) => presentStory(s, match, style));
    const briefing = buildBriefing(match, cutoff, {
      style,
      stories: result.stories,
    });
    for (const id of briefing.evidenceIds) assert(visible.has(id));
    // These are the same data fields used by the UI's Quick and Full toggles.
    const moments = (count: number) =>
      briefing.moments
        .slice(0, count)
        .sort((a, b) => a.event.time - b.event.time)
        .map((m) => ({ eventId: m.event.id, label: m.label }));
    const quick = {
      headline: briefing.headline,
      narrative: briefing.narrative,
      qualifications: briefing.qualifications,
      watch: briefing.watch,
      metrics: briefing.metrics.slice(0, 2),
      moments: moments(3),
    };
    const full = {
      ...quick,
      expanded: briefing.expanded,
      metrics: briefing.metrics.slice(0, 6),
      moments: moments(8),
    };
    for (let i = 0; i < result.stories.length; i++) {
      for (const contrary of result.stories[i].hypothesis.contradictoryEvidence)
        assert(
          stories[i].qualifications.some((q) => q.code === contrary.code),
          "Dropped material counter-evidence",
        );
    }
    for (const q of stories[0]?.qualifications ?? [])
      assert(
        quick.qualifications.includes(q.text),
        "Quick/Full dropped the lead qualification",
      );
    assert(
      !/\d+(?:\.\d+)?%/.test(JSON.stringify(stories)),
      "Unexpected percentage claim",
    );
    return { style, stories, quick, full };
  });
  if (c.id === "misleading-quality" && result.stories.length) {
    assert(
      result.stories.some((s) =>
        s.hypothesis.contradictoryEvidence.some(
          (e) => e.code === "shot-volume-without-xg-increase",
        ),
      ),
      "Missing lower-quality qualification",
    );
    for (const r of rendered) {
      assert(
        r.stories.some((s) =>
          s.qualifications.some(
            (q) => q.code === "shot-volume-without-xg-increase",
          ),
        ),
      );
      assert(
        /quality|xG|chances/i.test(
          r.quick.narrative + r.quick.qualifications.join(" "),
        ),
      );
    }
  }
  return {
    checks: [
      "fresh prefix-only query replay",
      "selected IDs and complete hypothesis equality",
      "source precision and event identity",
      "full story repackaging equality",
      "locally rendered both styles and recap lengths",
    ],
    selectedClaims: result.stories.map((s) => s.storyId),
    rendered,
  };
}
