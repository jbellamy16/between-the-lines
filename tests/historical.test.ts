import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { normalizeHistorical } from "../src/lib/sources/historical";
import { loadHistorical } from "../src/lib/sources/repository";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import {
  eventClock,
  matchClock,
  pitchEvents,
  recordedScore,
  type NormalizedEvent,
} from "../src/lib/sources/model";
import {
  historicalEvidence,
  historicalInsights,
  historicalSequence,
  historicalStats,
} from "../src/lib/sources/intelligence";
import { composeNarration, renderSelection } from "../src/lib/ai/narration";
import { narratePacket } from "../src/lib/ai/service";
import { POST } from "../src/app/api/historical/narrate/route";
import { GET } from "../src/app/api/historical/[id]/route";
import { configure, mockProvider } from "./ai-helpers";
import { generateMatch, type Scenario } from "../src/lib/match";
const raw = (id: string) =>
  JSON.parse(readFileSync(`data/historical/${id}.json`, "utf8"));
const ids = ["2499719", "2499943", "2499841"];
const matches = ids.map((id) => normalizeHistorical(raw(id)));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("historical source integrity", () => {
  it.each(ids)(
    "%s preserves every original record and verifies the final score",
    async (id) => {
      const source = raw(id),
        match = await loadHistorical(id);
      const original = match.events.filter(
        (e) => e.source.precision === "second",
      );
      expect(original).toHaveLength(source.events.length);
      expect(new Set(original.map((e) => Number(e.source.eventId)))).toEqual(
        new Set(source.events.map((e: { id: number }) => e.id)),
      );
      expect(new Set(match.events.map((e) => e.id)).size).toBe(
        match.events.length,
      );
      expect(recordedScore(match.events)).toEqual(match.finalScore);
      expect(
        match.events.every((e, i, a) => i === 0 || e.time >= a[i - 1].time),
      ).toBe(true);
      expect(match.events.every((e) => e.source.matchId === id)).toBe(true);
      for (const team of ["harbor", "riverside"] as const) {
        const originalTeam = source.events.filter(
          (e: { teamId: number }) => String(e.teamId) === match.teams[team].id,
        );
        const stats = historicalStats(match.events, team);
        expect(stats.passes).toBe(
          originalTeam.filter((e: { eventId: number }) => e.eventId === 8)
            .length,
        );
        expect(stats.shots).toBe(
          originalTeam.filter(
            (e: { eventId: number; subEventId: number }) =>
              e.eventId === 10 || [33, 35].includes(e.subEventId),
          ).length,
        );
      }
    },
  );
  it("keeps first-half stoppage before second-half kickoff", () => {
    const m = matches[0],
      first = m.events.filter((e) => e.period === "1H").at(-1)!;
    expect(first.periodSeconds).toBeGreaterThan(2700);
    expect(first.time).toBeLessThan(m.secondHalfStart);
    expect(matchClock(m, first.time)).toMatch(/^45\+/);
    expect(matchClock(m, m.secondHalfStart)).toBe("45:00");
    expect(matchClock(m, m.secondHalfStart + 2765)).toBe("90+01:05");
  });
  it("counts own goals and penalties once, never goalkeeper failed-save goal tags", () => {
    const m = matches[2],
      own = m.events.find((e) => e.ownGoal)!;
    expect(own.team).toBe("riverside");
    expect(own.scoringTeam).toBe("harbor");
    expect(recordedScore(m.events.filter((e) => e.time < own.time))).toEqual({
      harbor: 0,
      riverside: 0,
    });
    expect(recordedScore(m.events.filter((e) => e.time <= own.time))).toEqual({
      harbor: 1,
      riverside: 0,
    });
    expect(m.events.filter((e) => e.scoringTeam)).toHaveLength(3);
    expect(
      m.events.find((e) => e.source.eventType.includes("Penalty"))?.type,
    ).toBe("shot");
    expect(
      m.events.filter((e) => e.type === "save").every((e) => !e.scoringTeam),
    ).toBe(true);
  });
  it("never invents substitution coordinates, recipients, tracking, or possession", () => {
    const m = matches[0],
      subs = m.events.filter((e) => e.type === "substitution");
    expect(subs).toHaveLength(6);
    expect(
      subs.every((e) => e.position === null && e.source.precision === "minute"),
    ).toBe(true);
    expect(pitchEvents(subs)).toEqual([]);
    expect(eventClock(m, subs[0])).toBe("~67′");
    expect(subs[0].periodSeconds).toBe(23 * 60);
    expect(
      m.events.every(
        (e) =>
          e.possessionId === null &&
          e.recipientId === undefined &&
          e.xg === undefined,
      ),
    ).toBe(true);
    expect(m.players.every((p) => p.number === null)).toBe(true);
    expect(pitchEvents(m.events).every((e) => e.possessionId === null)).toBe(
      true,
    );
    expect(m.events.filter((e) => e.type === "shot").every((e) => !e.end)).toBe(
      true,
    );
  });
  it("handles missing positions without inventing events or dropping analytical counts", () => {
    const input = raw(ids[0]);
    const pass = input.events.find((e: { eventId: number }) => e.eventId === 8);
    pass.positions = [];
    const m = normalizeHistorical(input),
      e = m.events.find((e) => e.source.eventId === String(pass.id))!;
    expect(e.position).toBeNull();
    expect(pitchEvents([e])).toEqual([]);
    expect(historicalStats(m.events, e.team).passes).toBe(
      historicalStats(matches[0].events, e.team).passes,
    );
  });
  it("rejects invalid coordinates, duplicate records, score mismatches and unsupported periods", () => {
    for (const mutate of [
      (r: ReturnType<typeof raw>) => (r.events[0].positions[0].x = 101),
      (r: ReturnType<typeof raw>) => r.events.push(r.events[0]),
      (r: ReturnType<typeof raw>) =>
        (r.match.teamsData[Object.keys(r.match.teamsData)[0]].score = 99),
      (r: ReturnType<typeof raw>) => (r.events[0].matchPeriod = "E1"),
    ]) {
      const input = raw(ids[0]);
      mutate(input);
      expect(() => normalizeHistorical(input)).toThrow();
    }
  });
  it.each(["pressure", "substitution", "quiet"] as Scenario[])(
    "preserves synthetic %s behaviour through the shared model",
    async (scenario) => {
      const m = await new SyntheticMatchSource().load(scenario);
      const legacy = pitchEvents(m.events),
        original = generateMatch(scenario);
      expect(legacy).toHaveLength(original.length);
      original.forEach((e, i) => expect(legacy[i]).toMatchObject(e));
      expect(m.kind).toBe("synthetic");
    },
  );
});
describe("historical intelligence and AI", () => {
  it("recomputes real comparisons and never applies synthetic high-win claims", () => {
    for (const m of matches) {
      const observations = [];
      for (let t = 1800; t <= m.duration; t += 60) {
        const insights = historicalInsights(m, t);
        observations.push(...insights);
        for (const i of insights) {
          expect(i.category).not.toBe("pressure");
          expect(i.current).toBe(i.evidenceIds.length);
          expect(i.previous).toBe(i.baselineIds.length);
          const evidence = m.events.filter((e) => i.evidenceIds.includes(e.id));
          expect(
            evidence.every(
              (e) => e.time <= t && e.time > t - 900 && e.team === i.team,
            ),
          ).toBe(true);
          expect(
            evidence.every(
              (e) => e.type === (i.category === "chances" ? "shot" : "pass"),
            ),
          ).toBe(true);
        }
      }
      expect(observations.length).toBeGreaterThan(0);
      expect(historicalInsights(m, m.secondHalfStart + 599)).toEqual([]);
    }
  });
  it("arbitrary cutoffs exclude future facts, future scores and future sequence actions", () => {
    for (const m of matches)
      for (const t of [
        0,
        100,
        2700,
        m.secondHalfStart,
        m.secondHalfStart + 1200,
        m.duration,
      ]) {
        const p = historicalEvidence(m, t, "fan");
        expect(p.events.every((e) => e.time <= t)).toBe(true);
        for (const f of p.facts)
          for (const id of f.evidenceIds)
            expect(m.events.find((e) => e.id === id)!.time).toBeLessThanOrEqual(
              t,
            );
        const selected = m.events.findLast((e) => e.time <= t);
        if (selected)
          expect(
            historicalSequence(m, selected, t).every(
              (e) =>
                e.time <= t &&
                e.period === selected.period &&
                e.order <= selected.order &&
                selected.time - e.time <= 30,
            ),
          ).toBe(true);
        expect(historicalSequence(m, m.events.at(-1)!, 0)).toEqual([]);
        const score = recordedScore(m.events.filter((e) => e.time <= t));
        expect(p.facts.find((f) => f.id === "score")!.text).toContain(
          `${score.harbor}–${score.riverside}`,
        );
      }
  });
  it.each(["openai", "foundry"] as const)(
    "%s retrieves historical evidence and validates fan/analyst output",
    async (provider) => {
      configure(provider);
      for (const mode of ["fan", "analyst"] as const) {
        const m = matches[0],
          p = historicalEvidence(m, 2400, mode);
        const fetch = mockProvider(p);
        vi.stubGlobal("fetch", fetch);
        const result = await composeNarration(p, provider);
        expect(result.provider).toBe(provider);
        expect(result.usage.requests).toBe(2);
        expect(result.narrative.explanation).toContain("Arsenal");
        expect(result.narrative.explanation).not.toMatch(
          /Harbor|Riverside|synthetic chance/,
        );
        expect(result.contextFactIds).toContain("score");
        const payload = JSON.parse(fetch.mock.calls[1][1].body);
        expect(JSON.parse(payload.input.at(-1).output)).toEqual(p);
        expect(
          result.narrative.evidenceIds.every(
            (id) => m.events.find((e) => e.id === id)!.time <= 2400,
          ),
        ).toBe(true);
      }
    },
  );
  it("rejects forged and future fact IDs", () => {
    const m = matches[0],
      p = historicalEvidence(m, 100, "fan");
    expect(() =>
      renderSelection({ factIds: [`moment-${m.events.at(-1)!.id}`] }, p),
    ).toThrow();
    expect(() =>
      historicalEvidence(m, 100, "fan", "harbor-chances-80"),
    ).toThrow();
  });
  it("deduplicates simultaneous historical narrations and caches validated results", async () => {
    configure();
    const p = historicalEvidence(matches[1], 2413, "analyst"),
      fetch = mockProvider(p);
    vi.stubGlobal("fetch", fetch);
    const both = await Promise.all([narratePacket(p), narratePacket(p)]);
    expect(both.every((x) => x.source === "openai")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    const cached = await narratePacket(p);
    expect(cached.provenance.cached).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("returns verified offline data on provider failure", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private", { status: 500 })),
    );
    const result = await narratePacket(
      historicalEvidence(matches[0], 2111, "fan"),
    );
    expect(result.source).toBe("offline");
    expect(result.narrative).toBeNull();
    expect(result.provenance.facts.some((f) => f.id === "score")).toBe(true);
  });
  it("writes an auditable comparison evaluation without paid inference", () => {
    const report = matches.map((m) => {
      const scans = Array.from(
        { length: Math.floor(m.duration / 60) + 1 },
        (_, i) => historicalInsights(m, i * 60),
      );
      const patterns = scans.flat();
      return {
        id: m.id,
        match: m.title,
        events: m.events.filter((e) => e.source.precision === "second").length,
        finalScore: recordedScore(m.events),
        stats: {
          home: historicalStats(m.events, "harbor"),
          away: historicalStats(m.events, "riverside"),
        },
        qualifyingSnapshots: scans.filter((s) => s.length).length,
        categories: [...new Set(patterns.map((i) => i.category))],
        examples: patterns
          .filter(
            (i, n, a) =>
              a.findIndex(
                (j) => j.category === i.category && j.team === i.team,
              ) === n,
          )
          .map((i) => ({
            time: i.end,
            headline: i.headline,
            current: i.current,
            previous: i.previous,
          })),
        limitations: m.limitations,
      };
    });
    mkdirSync("artifacts", { recursive: true });
    writeFileSync(
      "artifacts/historical-evaluation.json",
      JSON.stringify(
        {
          paidRequests: 0,
          actualApiCostUsd: 0,
          liveLatencyMs: null,
          matches: report,
        },
        null,
        2,
      ),
    );
    expect(report.every((r) => r.qualifyingSnapshots > 0)).toBe(true);
  });
});
it("historical routes honor the flag and reject unknown IDs, forged evidence and invalid timestamps", async () => {
  vi.stubEnv("AI_ENABLED", "false");
  const post = (body: unknown) =>
    POST(
      new Request("http://localhost/api/historical/narrate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  expect((await post({ matchId: ids[0], time: 0, mode: "fan" })).status).toBe(
    200,
  );
  expect(
    (await post({ matchId: ids[0], time: 7000, mode: "fan" })).status,
  ).toBe(400);
  expect(
    (
      await post({
        matchId: ids[0],
        time: 100,
        mode: "fan",
        insightId: "forged",
      })
    ).status,
  ).toBe(404);
  expect(
    (await post({ matchId: ids[0], time: 100, mode: "fan", events: [] }))
      .status,
  ).toBe(400);
  const get = (id: string) =>
    GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });
  expect((await get("unknown")).status).toBe(404);
  vi.stubEnv("HISTORICAL_MATCHES_ENABLED", "false");
  expect((await get(ids[0])).status).toBe(404);
  expect((await post({ matchId: ids[0], time: 0, mode: "fan" })).status).toBe(
    404,
  );
});
it("all historical evidence fits the bounded Responses adapter", () => {
  let max = 0;
  for (const match of matches)
    for (let time = 1800; time <= match.duration; time += 60) {
      for (const selected of [
        undefined,
        ...historicalInsights(match, time).map((i) => i.id),
      ]) {
        const packet = historicalEvidence(match, time, "analyst", selected);
        max = Math.max(max, Buffer.byteLength(JSON.stringify(packet)));
      }
    }
  // Leave room for instructions, schema, tool call, and JSON escaping in the 128 KiB transport cap.
  expect(max).toBeLessThan(90000);
});
