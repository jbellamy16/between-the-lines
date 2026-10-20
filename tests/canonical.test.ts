import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  validateMatch,
  matchClock,
  periodAt,
  recordedScore,
  pitchEvents,
  activeMatchPlayers,
  type MatchData,
} from "../src/lib/sources/model";
import {
  normalizePoint,
  displayPoint,
  referenceDistance,
} from "../src/lib/sources/coordinates";
import { matchStatistics } from "../src/lib/sources/analytics";
import {
  matchEvidence,
  matchInsights,
  matchSequence,
} from "../src/lib/sources/intelligence";
import { benchmarkMatch } from "../src/lib/sources/benchmark";
import { playbackTime, replayFrame } from "../src/lib/playback";
import { composeNarration } from "../src/lib/ai/narration";
import { configure, mockProvider } from "./ai-helpers";

const synthetic = new SyntheticMatchSource();
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("canonical invariants", () => {
  const match = synthetic.read("pressure");
  it.each([
    [
      "version",
      (m: MatchData) => {
        (m as unknown as { schemaVersion: string }).schemaVersion = "2.0.0";
      },
    ],
    [
      "order",
      (m: MatchData) => {
        m.events[1].order = 99;
      },
    ],
    [
      "match",
      (m: MatchData) => {
        m.events[0].matchId = "other";
      },
    ],
    [
      "team",
      (m: MatchData) => {
        m.events[0].teamId = "other";
      },
    ],
    [
      "player",
      (m: MatchData) => {
        m.events[0].actorId = "nonexistent";
      },
    ],
    [
      "association",
      (m: MatchData) => {
        m.events[0].playerId =
          m.events[0].team === "harbor" ? "riverside-1" : "harbor-1";
        m.events[0].actorId = m.events[0].playerId;
      },
    ],
    [
      "period",
      (m: MatchData) => {
        m.events[0].periodSeconds += 1;
      },
    ],
    [
      "score",
      (m: MatchData) => {
        m.finalScore.harbor += 1;
      },
    ],
    [
      "related",
      (m: MatchData) => {
        m.events[0].relatedEvents = ["missing"];
      },
    ],
    [
      "lineup",
      (m: MatchData) => {
        m.teams.harbor.lineup.push("missing");
      },
    ],
    [
      "unsupported xG",
      (m: MatchData) => {
        m.capabilities.xg = false;
      },
    ],
    [
      "duplicate",
      (m: MatchData) => {
        m.events[1].id = m.events[0].id;
      },
    ],
  ] as const)("rejects corrupt %s", (_, mutate) => {
    const copy = structuredClone(match);
    mutate(copy);
    expect(() => validateMatch(copy)).toThrow();
  });
  it("all demo seeds are stable; balanced profile remains deterministic across seeds", () => {
    for (const id of ["pressure", "substitution", "quiet"]) {
      expect(synthetic.read(id)).toEqual(synthetic.read(id));
      for (const seed of [42, 99, 2026])
        expect(synthetic.read(id, { seed, profile: "balanced" })).toEqual(
          synthetic.read(id, { seed, profile: "balanced" }),
        );
    }
    expect(
      benchmarkMatch(
        synthetic.read("pressure", { profile: "balanced", seed: 42 }),
      ).passesPer90,
    ).toBeGreaterThan(benchmarkMatch(match).passesPer90);
  });
});
it("coordinate transforms have a single orientation and reference distance", () => {
  expect(normalizePoint([120, 80], 120, 80)).toEqual({ x: 100, y: 100 });
  expect(displayPoint({ x: 80, y: 20 }, "riverside")).toEqual({ x: 20, y: 80 });
  expect(referenceDistance({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(105);
  expect(() => normalizePoint([121, 40], 120, 80)).toThrow();
});
for (const m of [
  synthetic.read("pressure"),
]) {
  it(`${m.provenance.provider}: shared replay, statistics, insights and evidence respect the cutoff`, () => {
    for (const t of [0, 100, m.secondHalfStart, m.duration]) {
      const visible = m.events.filter((e) => e.time <= t),
        packet = matchEvidence(m, t, "analyst");
      expect(packet.events.every((e) => e.time <= t)).toBe(true);
      expect(matchStatistics(m, t).harbor.goals).toBe(
        recordedScore(visible).harbor,
      );
      expect(replayFrame(pitchEvents(m.events), t).visible).toEqual(
        pitchEvents(visible),
      );
      for (const fact of packet.facts)
        for (const id of fact.evidenceIds)
          expect(visible.some((e) => e.id === id)).toBe(true);
      for (const i of matchInsights(m, t))
        expect(i.current).toBe(i.evidenceIds.length);
      const selected = visible.at(-1);
      if (selected)
        expect(
          matchSequence(m, selected, t).every(
            (e) => e.time <= t && e.order <= selected.order,
          ),
        ).toBe(true);
    }
    const value = playbackTime(
      { time: 99, sampledAt: 1000, playing: true, speed: 2 },
      1500,
      m.duration,
    );
    expect(value).toBe(100);
    expect(() => matchEvidence(m, Infinity, "fan")).toThrow();
  });
  it(`${m.provenance.provider}: canonical evidence works with both mocked AI providers`, async () => {
    for (const provider of ["openai", "foundry"] as const) {
      const packet = matchEvidence(m, m.duration, "fan");
      configure(provider);
      vi.stubGlobal("fetch", mockProvider(packet));
      const result = await composeNarration(packet, provider);
      expect(
        result.narrative.evidenceIds.every((id) =>
          packet.events.some((e) => e.id === id),
        ),
      ).toBe(true);
    }
  });
}
it("canonical synthetic AI packets stay bounded and do not transmit raw provider records", async () => {
  const { buildEvidence } = await import("../src/lib/ai/evidence");
  const m = synthetic.read("pressure", { profile: "balanced", seed: 42 });
  for (let t = 1800; t <= m.duration; t += 60) {
    const packet = buildEvidence(pitchEvents(m.events), t, "analyst");
    expect(Buffer.byteLength(JSON.stringify(packet))).toBeLessThan(90000);
    expect(packet.events.every((e) => !("source" in e))).toBe(true);
  }
});

it("synthetic variant identities do not collide with preserved demo events", () => {
  const demo = synthetic.read("pressure"),
    balanced = synthetic.read("pressure", { profile: "balanced" });
  expect(balanced.id).not.toBe(demo.id);
  const ids = new Set(demo.events.map((e) => e.id));
  expect(balanced.events.every((e) => !ids.has(e.id))).toBe(true);
});
