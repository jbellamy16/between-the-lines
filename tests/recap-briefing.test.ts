import { describe, expect, it, vi, afterEach } from "vitest";
import { buildBriefing } from "../src/lib/recap-briefing";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { recordedScore, type MatchData } from "../src/lib/sources/model";
import {
  readViewingPosition,
  viewingKey,
  missedSince,
} from "../src/lib/viewing-position";
import { requestDirector } from "../src/lib/ai/director/client-cache";

const source = new SyntheticMatchSource();
const match = source.read("pressure");
describe("evidence-controlled football briefing", () => {
  it("uses the real 552-second comparison and preserves the separate 15-minute analysis", () => {
    const result = buildBriefing(match, 3804);
    const shots = result.metrics.find((m) => m.label === "shots")!;
    expect(shots.current).toBe(4);
    expect(shots.previous).toBe(0);
    expect(shots.windows.map((w) => [w.start, w.end])).toEqual([
      [2700, 3252],
      [3252, 3804],
    ]);
    expect(result.narrative).toContain("9m 12s");
    expect(result.narrative).not.toContain("15-minute");
    const recovery = result.metrics.find(
      (m) => m.label === "Attacking-third recoveries",
    )!;
    expect(recovery.current).toBe(2); // Legacy ball wins include tackles/interceptions; this metric does not.
    expect(result.headline).toBe("Harbor are getting more shots away.");
    expect(result.narrative.split(/\s+/).length).toBeLessThanOrEqual(75);
    expect(result.narrative.match(/recorded 4 shots/g)).toHaveLength(1);
  });
  it("recounts every displayed comparison from its attributed events, for both teams", () => {
    for (const scenario of ["pressure", "quiet", "substitution"] as const) {
      const m = source.read(scenario);
      for (const time of [
        0, 600, 1200, 1800, 2700, 3000, 3804, 3900, 4200, 4500, 5400,
      ]) {
        const b = buildBriefing(m, time);
        expect(b.score).toEqual(
          recordedScore(m.events.filter((e) => e.time <= time)),
        );
        for (const metric of b.metrics.filter(
          (metric) => metric.windows.length,
        )) {
          const events = m.events.filter((e) =>
            metric.evidenceIds.includes(e.id),
          );
          expect(
            events.every((e) => m.teams[e.team].short === metric.team),
          ).toBe(true);
          expect(metric.windows[0].end - metric.windows[0].start).toBe(
            metric.windows[1].end - metric.windows[1].start,
          );
          for (const [index, expected] of [
            [0, metric.previous],
            [1, metric.current],
          ]) {
            const w = metric.windows[index];
            expect(
              events.filter(
                (e) =>
                  e.time > w.start && e.time <= w.end && e.period === w.period,
              ),
            ).toHaveLength(expected);
          }
        }
      }
    }
  });
  it("is unchanged by future events or final-score metadata and remains rewind-safe", () => {
    for (const time of [0, 1200, 2700, 3804, 4200]) {
      const truncated = {
        ...match,
        finalScore: { harbor: 99, riverside: 99 },
        events: match.events.filter((e) => e.time <= time),
      };
      expect(buildBriefing(truncated, time)).toEqual(
        buildBriefing(match, time),
      );
      const result = buildBriefing(match, time);
      expect(result.moments.every(({ event }) => event.time <= time)).toBe(
        true,
      );
      expect(
        result.evidenceIds.every((id) =>
          match.events.some((e) => e.id === id && e.time <= time),
        ),
      ).toBe(true);
    }
    const future = buildBriefing(match, 4500);
    expect(buildBriefing(match, 3804, { stories: future.stories })).toEqual(
      buildBriefing(match, 3804),
    );
    expect(buildBriefing(match, 5400).watch).toBeNull();
  });
  it("ranks goals above routine actions and avoids duplicated scoring-shot records", () => {
    const b = buildBriefing(match, 3804);
    expect(b.moments[0].event.scoringTeam).toBe("harbor");
    expect(b.moments.filter((m) => m.event.time === 60)).toHaveLength(1);
    expect(
      b.moments.some((m) => ["pass", "possession"].includes(m.event.type)),
    ).toBe(false);
  });
  it("keeps essential contradictory evidence in the main reading and updates watch-next", () => {
    const emerging = buildBriefing(match, 3900);
    const weakening = buildBriefing(match, 4200);
    const resolved = buildBriefing(match, 4500);
    expect(emerging.watch?.text).toContain("70:00");
    expect(weakening.qualifications.join(" ")).toContain("eased");
    expect(weakening.watch?.headline).toContain("revive");
    expect(weakening.watch?.text).toContain("75:00");
    expect(resolved.watch?.headline).not.toContain("Harbor");
    expect(resolved.headline).toContain("level");
  });
  it("limits returning-viewer developments while retaining an accurate whole-match score", () => {
    const b = buildBriefing(match, 3804, { since: 1200 });
    expect(b.since).toBe(1200);
    expect(b.score).toEqual({ harbor: 1, riverside: 0 });
    expect(b.narrative).not.toContain("Arlo Hayes's goal");
    expect(b.narrative).toContain("since 20:00");
    expect(
      b.moments.every((m) => m.event.time > 1200 && m.event.time <= 3804),
    ).toBe(true);
    expect(buildBriefing(match, 600, { since: 1200 }).since).toBeNull();
  });
  it("handles kickoff, sparse evidence and invalid cutoffs without manufacturing drama", () => {
    const empty: MatchData = { ...match, events: [] };
    const b = buildBriefing(empty, 0);
    expect(b.watch).toBeNull();
    expect(b.metrics).toEqual([]);
    expect(b.moments).toEqual([]);
    expect(b.narrative).toContain("No match developments");
    expect(() => buildBriefing(match, NaN)).toThrow();
    expect(() => buildBriefing(match, -1)).toThrow();
  });
});
it("scopes last-viewed positions to match and revision, validating stored and rewound positions", () => {
  expect(viewingKey(match)).not.toBe(viewingKey(source.read("quiet")));
  expect(viewingKey(match)).not.toBe(
    viewingKey({
      ...match,
      provenance: { ...match.provenance, revision: "changed" },
    }),
  );
  for (const raw of [
    null,
    "invalid",
    "{}",
    '{"version":1,"position":999999}',
    '{"version":1,"position":"1200"}',
    '{"version":1,"position":-1}',
  ])
    expect(readViewingPosition(raw, 5400)).toBeNull();
  expect(readViewingPosition('{"version":1,"position":1200}', 5400)).toBe(1200);
  expect(missedSince(1200, 600)).toBeNull();
  expect(missedSince(1200, 3804)).toBe(1200);
});
afterEach(() => vi.unstubAllGlobals());
it("coalesces recap requests, reuses results and invalidates on evidence, time or preference changes", async () => {
  const m = structuredClone(match);
  const fetcher = vi.fn(async (_url, init) => ({
    ok: true,
    json: async () => ({
      stories: [],
      provenance: { cutoff: JSON.parse(init.body).time },
    }),
  }));
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([
    requestDirector(m, 3804, "analyst", {}),
    requestDirector(m, 3804, "analyst", {}),
  ]);
  await requestDirector(m, 3804, "analyst", {});
  expect(fetcher).toHaveBeenCalledTimes(1);
  await requestDirector(m, 3805, "analyst", {});
  await requestDirector(m, 3804, "analyst", { team: "harbor" });
  await requestDirector(structuredClone(m), 3804, "analyst", {});
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("explains away-team leads in the leading team's order and full-time outcomes through decisive goals", () => {
  const away = structuredClone(match);
  // Changing only the credited side is sufficient for a recorded own-goal context;
  // hypotheses that cannot independently verify the modified fixture fail closed.
  const first = away.events.find((e) => e.scoringTeam)!;
  first.scoringTeam = "riverside";
  first.ownGoal = true;
  const b = buildBriefing(away, 60.5);
  expect(b.score).toEqual({ harbor: 0, riverside: 1 });
  expect(b.narrative).toContain("Riverside FC leading 1–0");
  expect(b.narrative).toContain("own goal");
  const full = buildBriefing(match, match.duration);
  expect(full.narrative).toContain("Theo March's goal at 77:33");
  expect(full.narrative).toContain("ahead for the last time");
  expect(full.metrics[0].label).toBe("Shots");
  expect(full.metrics[0].windows).toEqual([]);
});
