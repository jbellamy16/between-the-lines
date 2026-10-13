import { describe, expect, it } from "vitest";
import { SyntheticMatchSource } from "@/lib/sources/synthetic";
import {
  arrivedMoment,
  createMomentScanner,
  MOMENT_REPEAT_SECONDS,
  momentsThrough,
} from "@/lib/moments";
import { presentStory, replayStartEventId } from "@/lib/explanation";
import { ANALYSIS_MODE } from "@/lib/intelligence";
import { observe } from "@/lib/ai/director/observer";
import { selectLeadCandidate } from "@/lib/ai/director/editorial";

const source = new SyntheticMatchSource();
const pressure = source.read("pressure", { profile: "demo" });

describe("match moments", () => {
  const full = momentsThrough(pressure, pressure.duration, ANALYSIS_MODE);

  it("finds goals, full time and story changes in order", () => {
    expect(full.filter((m) => m.kind === "goal").map((m) => m.time)).toEqual([
      60, 4480, 4660,
    ]);
    expect(full.at(-1)).toMatchObject({ kind: "full-time", time: 5400 });
    expect(full.map((m) => m.time)).toEqual(
      [...full.map((m) => m.time)].sort((a, b) => a - b),
    );
  });

  it("opens a goal's replay on the goal tapped, not the first goal", () => {
    const start = (m: (typeof full)[number]) =>
      pressure.events.find(
        (e) => e.id === replayStartEventId(m.story, pressure),
      )?.time;
    const goals = full.filter((m) => m.kind === "goal");
    // 77:33 is the third goal its story highlights; 74:35 the second.
    expect(goals.map((m) => m.story.highlightedEventIds.length)).toEqual([
      1, 2, 3,
    ]);
    expect(goals.map(start)).toEqual([60, 4475, 4653]);
    // Full time replays every goal from the first.
    expect(replayStartEventId(full.at(-1)!.story, pressure)).toBeUndefined();
  });

  it("never holds a moment, or evidence, from after the position", () => {
    for (const cutoff of [0, 1859, 1860, 3650, 4479, 4480, 5399]) {
      const moments = momentsThrough(pressure, cutoff, ANALYSIS_MODE);
      expect(moments).toEqual(full.filter((m) => m.time <= cutoff));
      for (const m of moments) {
        expect(m.story.cutoff).toBe(m.time);
        const evidence = pressure.events.filter((e) =>
          m.story.evidenceEventIds.includes(e.id),
        );
        expect(evidence.every((e) => e.time <= m.time)).toBe(true);
      }
    }
  });

  it("is the same whether scanned in one jump or tick by tick, and after a rewind", () => {
    const scanner = createMomentScanner(pressure, ANALYSIS_MODE);
    for (let t = 0; t <= 4000; t += 2) scanner.advance(t);
    expect(scanner.through(4000)).toEqual(full.filter((m) => m.time <= 4000));
    // Rewinding hides later moments; nothing later is returned.
    expect(scanner.through(3000)).toEqual(full.filter((m) => m.time <= 3000));
  });

  it("is the story card's lead at that minute, in its wording", () => {
    for (const m of full) {
      const lead = selectLeadCandidate(
        observe(pressure, m.time, ANALYSIS_MODE),
      );
      expect(lead?.id).toBe(m.story.storyId);
    }
  });

  it("does not repeat the same story while it flips with another", () => {
    const keys = full.map((m) => [
      m.time,
      presentStory(m.story, pressure, "plain").headline,
    ]);
    for (const [time, headline] of keys) {
      const repeat = keys.find(
        ([t, h]) =>
          h === headline &&
          (t as number) > (time as number) &&
          (t as number) - (time as number) < MOMENT_REPEAT_SECONDS,
      );
      expect(repeat).toBeUndefined();
    }
    // 60:40–64:00 alternates five times on the story card; two moments.
    expect(full.filter((m) => m.time >= 3640 && m.time <= 3840)).toHaveLength(
      2,
    );
  });

  it("knows when it has caught up between grid positions", () => {
    const scanner = createMomentScanner(pressure, ANALYSIS_MODE);
    expect(scanner.behind(0)).toBe(true);
    scanner.advance(3804);
    expect(scanner.scannedThrough()).toBe(3800);
    expect(scanner.behind(3804)).toBe(false);
    expect(scanner.behind(3810)).toBe(true);
    scanner.advance(pressure.duration);
    expect(scanner.behind(pressure.duration + 60)).toBe(false);
  });

  it("reports the moment playback just reached", () => {
    expect(arrivedMoment(full, 3630, 3642)?.time).toBe(3640);
    expect(arrivedMoment(full, 3640, 3650)).toBeNull();
    expect(arrivedMoment(full, 3600, 3700)?.time).toBe(3680);
  });

  it("follows the viewer's story preferences, like the story card", () => {
    const rhythm = momentsThrough(pressure, pressure.duration, ANALYSIS_MODE, {
      categories: ["rhythm"],
    });
    expect(rhythm.filter((m) => m.kind === "goal")).toHaveLength(3);
    expect(rhythm.some((m) => m.story.category === "recovery-shot")).toBe(
      false,
    );
    for (const m of rhythm) {
      const lead = selectLeadCandidate(
        observe(pressure, m.time, ANALYSIS_MODE, { categories: ["rhythm"] }),
      );
      expect(lead?.id).toBe(m.story.storyId);
    }
  });
});
