import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recordedContext, EMPTY_MATCH_CONTEXT } from "../src/lib/match-context";
import { matchContext, matchSummary } from "../src/lib/sources/context";
import { normalizeHistorical } from "../src/lib/sources/historical";
import { matchEvidence, matchInsights } from "../src/lib/sources/intelligence";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { renderSelection } from "../src/lib/ai/narration";
import { buildEvidence } from "../src/lib/ai/evidence";
import { pitchEvents, type MatchData } from "../src/lib/sources/model";
import { detectInsights } from "../src/lib/intelligence";

const matches = [
  ...(["pressure", "substitution", "quiet"] as const).flatMap((id) =>
    (["demo", "balanced"] as const).map((profile) =>
      new SyntheticMatchSource().read(id, { profile }),
    ),
  ),
  ...["2499719", "2499943", "2499841"].map((id) =>
    normalizeHistorical(
      JSON.parse(readFileSync(`data/historical/${id}.json`, "utf8")),
    ),
  ),
];
const checkpoints = (m: MatchData) =>
  [
    ["Kickoff", 0],
    ["10 minutes", 600],
    ["20 minutes", 1200],
    ["30 minutes", 1800],
    ["Halftime", m.periods[0].end],
    ["60 minutes", m.secondHalfStart + 900],
    ["Full time", m.duration],
  ] as const;

for (const match of matches)
  describe(match.id, () => {
    it.each(checkpoints(match))(
      "%s: useful context, exact counts, bounded evidence, no future events",
      (_, time) => {
        const visible = match.events.filter((e) => e.time <= time);
        const prefix = {
          ...match,
          events: visible,
          finalScore: { harbor: 99, riverside: 99 },
        };
        const context = matchContext(match, time);
        expect(context).toEqual(matchContext(prefix, time));
        expect(context.items.length).toBeLessThanOrEqual(3);
        if (time > 0) expect(context.items.length).toBeGreaterThan(0);
        else expect(context.items).toEqual([]);
        const references = [
          ...context.items.flatMap((i) => i.evidenceIds),
          ...context.moments.map((m) => m.event.id),
        ];
        expect(references.every((id) => visible.some((e) => e.id === id))).toBe(
          true,
        );
        const stat = context.items.find((i) => i.kind === "statistic");
        if (stat) {
          const type = stat.id === "context-shots" ? "shot" : "pass";
          const sample = visible.filter(
            (e) => e.type === type && e.period !== "PS",
          );
          expect(stat.evidenceIds).toEqual(sample.map((e) => e.id));
          for (const team of ["harbor", "riverside"] as const)
            expect(stat.text).toContain(
              `${match.teams[team].short}: ${sample.filter((e) => e.team === team).length}.`,
            );
        }
        const insights = matchInsights(match, time);
        if (time < 600) expect(insights).toEqual([]);
        for (const mode of ["fan", "analyst"] as const) {
          const summary = matchSummary(match, time, mode, insights);
          expect(summary).toEqual(
            matchSummary(prefix, time, mode, matchInsights(prefix, time)),
          );
          expect(summary.summary).not.toMatch(
            /No clear|not yet.*windows|No.*threshold|taking shape/,
          );
          if (insights.length)
            expect(summary.summary).toBe(
              mode === "fan" ? insights[0].explanation : insights[0].analyst,
            );
          const packet = matchEvidence(match, time, mode);
          expect(packet).toEqual(matchEvidence(prefix, time, mode));
          const rendered = renderSelection({ factIds: [] }, packet);
          expect(
            rendered.narrative.evidenceIds.every((id) =>
              visible.some((e) => e.id === id),
            ),
          ).toBe(true);
          if (!insights.length && context.items.length) {
            expect(packet.facts.some((f) => f.kind === "abstention")).toBe(
              false,
            );
            expect(rendered.contextFactIds.some((id) => id !== "score")).toBe(
              true,
            );
          }
        }
      },
    );
  });

it("keeps quiet matches descriptive without manufacturing discoveries", () => {
  const match = matches.find((m) => m.id === "quiet")!;
  expect(matchInsights(match, 3804)).toEqual([]);
  expect(matchContext(match, 3804).items.length).toBeGreaterThan(0);
  const legacy = pitchEvents(match.events);
  expect(detectInsights(legacy, 3804)).toEqual([]);
  expect(
    buildEvidence(legacy, 3804, "fan").facts.some(
      (f) => f.kind === "abstention",
    ),
  ).toBe(false);
});
it("counts scoring shots once and credits own goals to the recorded scoring side", () => {
  for (const m of matches) {
    for (const goal of m.events.filter((e) => e.scoringTeam)) {
      const before = matchContext(m, goal.time - 0.001);
      expect(before.items.flatMap((i) => i.evidenceIds)).not.toContain(goal.id);
      const at = matchContext(m, goal.time);
      expect(at.items[0].text).toContain(m.teams[goal.scoringTeam!].name);
      expect(
        at.moments.filter(({ event }) => event.id === goal.id),
      ).toHaveLength(1);
      expect(
        at.moments.some(
          ({ event }) =>
            event.type === "shot" &&
            event.outcome === "goal" &&
            !event.scoringTeam,
        ),
      ).toBe(false);
    }
  }
});
it("supports sparse data without inventing outcomes, possession or comparison claims", () => {
  const identity = { teams: matches[0].teams, player: () => "Recorded player" };
  const event = {
    id: "action",
    time: 10,
    team: "harbor" as const,
    playerId: "p",
    type: "pass",
  };
  expect(recordedContext([event], 9, identity).items).toEqual([]);
  const pass = recordedContext([event], 10, identity).items[0];
  expect(pass.headline).toBe("Pass attempts so far");
  expect(pass.text).not.toMatch(/complete|possession|dominant|rhythm/);
  const shot = recordedContext([{ ...event, type: "shot" }], 10, identity)
    .items[0];
  expect(shot.text).toContain("recorded shot");
  expect(shot.text).not.toMatch(/target|saved|chance quality/);
  const empty = matchEvidence({ ...matches[0], events: [] }, 600, "fan");
  expect(
    renderSelection({ factIds: [] }, empty).narrative.explanation,
  ).toContain(EMPTY_MATCH_CONTEXT);
});
