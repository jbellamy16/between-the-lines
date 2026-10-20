import { describe, it, expect } from "vitest";
import { pitchGroups } from "../src/lib/sources/replay-view";
import { matchSequence } from "../src/lib/sources/intelligence";
import { pitchEvents } from "../src/lib/sources/model";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
const match = new SyntheticMatchSource().read("pressure");
describe("honest event presentation", () => {
  it("conserves every event when turning pass arrows into area counts", () => {
    const cutoff = match.secondHalfStart + 2100;
    const passes = pitchEvents(
      match.events.filter(
        (e) =>
          e.time <= cutoff &&
          e.time > cutoff - 900 &&
          e.team === "riverside" &&
          e.type === "pass",
      ),
    );
    expect(passes.length).toBeGreaterThan(20);
    const cells = pitchGroups(passes, true);
    expect(cells.length).toBeLessThan(100);
    expect(cells.flatMap((c) => c.events.map((e) => e.id)).sort()).toEqual(
      passes.map((e) => e.id).sort(),
    );
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThanOrEqual(90);
    }
  });
  it("never moves coordinates or drops events when grouping", () => {
    const events = pitchEvents(
      match.events.filter((e) => e.time <= 3853 && e.time > 3793),
    );
    const before = JSON.stringify(events);
    const groups = pitchGroups(events, false);
    expect(JSON.stringify(events)).toBe(before);
    expect(groups.reduce((n, g) => n + g.events.length, 0)).toBe(events.length);
  });
  it("replays a shot's own possession, never a future action", () => {
    const selected = match.events.findLast(
      (e) => e.time <= 3804 && e.type === "shot",
    )!;
    const passage = matchSequence(match, selected, 3804);
    expect(passage.length).toBeGreaterThan(0);
    expect(passage.every((e) => e.time <= 3804)).toBe(true);
    expect(
      passage.every(
        (e) =>
          e.possessionId === selected.possessionId && e.team === selected.team,
      ),
    ).toBe(true);
  });
});
