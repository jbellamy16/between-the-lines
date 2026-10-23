import { afterAll, afterEach, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  generateMatch,
  eventsAt,
  statistics,
  type Scenario,
} from "../src/lib/match";
import { buildEvidence } from "../src/lib/ai/evidence";
import { composeNarration } from "../src/lib/ai/narration";
import { configure, editorialBaseline, mockProvider } from "./ai-helpers";
const rows: unknown[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
for (const scenario of ["pressure", "substitution", "quiet"] as Scenario[])
  for (const seed of [202632, 43, 73])
    for (const time of [0, 1800, 3300, 3804, 5400])
      it(`${scenario}/${seed}/${time}: verified data, audience distinction, negative cases and provider parity`, async () => {
        const all = generateMatch(scenario, seed);
        const texts: string[] = [];
        for (const mode of ["fan", "analyst"] as const) {
          const packet = buildEvidence(all, time, mode);
          expect(packet).toEqual(
            buildEvidence(eventsAt(all, time), time, mode),
          );
          expect(packet.events.every((e) => e.time <= time)).toBe(true);
          for (const comparison of packet.comparisons) {
            const counts = packet.events.filter((e) =>
              comparison.evidenceIds.includes(e.id),
            );
            expect(counts).toHaveLength(comparison.current);
            expect(
              packet.events.filter((e) =>
                comparison.baselineIds.includes(e.id),
              ),
            ).toHaveLength(comparison.previous);
          }
          const score = statistics(eventsAt(all, time));
          expect(packet.facts[0].text).toContain(
            `${score.harbor.goals}–${score.riverside.goals}`,
          );
          for (const provider of ["openai", "foundry"] as const) {
            configure(provider);
            vi.stubGlobal("fetch", mockProvider(packet));
            const result = await composeNarration(packet, provider);
            expect(result.selectedFactIds).toEqual(
              editorialBaseline(packet).factIds,
            );
            expect(
              result.narrative.evidenceIds.every((id) =>
                packet.events.some((e) => e.id === id),
              ),
            ).toBe(true);
            if (packet.facts.some((f) => f.kind === "abstention"))
              expect(result.selectedFactIds).toContain("no-pattern");
            if (time === 5400)
              expect(result.narrative.watch).toContain("Full time");
            rows.push({
              scenario,
              seed,
              time,
              mode,
              provider,
              kind: "mocked-contract-evaluation",
              output: result.narrative,
              facts: packet.facts,
              selected: result.selectedFactIds,
              checks: {
                evidenceConsistent: true,
                unsupportedClaims: 0,
                cutoffSafe: true,
                mandatoryContextPresent: true,
              },
              mockedLatencyMs: result.usage.latencyMs,
              actualApiRequests: 0,
              actualCostUsd: 0,
              narrativeQuality: "requires human review",
              relevanceVsBaseline:
                "mock follows deterministic baseline; no model superiority claim",
            });
            if (provider === "openai") texts.push(result.narrative.explanation);
          }
        }
        if (buildEvidence(all, time, "fan").comparisons.length)
          expect(texts[0]).not.toBe(texts[1]);
      });
afterAll(() => {
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/ai-evaluation.json",
    JSON.stringify(
      {
        kind: "mocked",
        actualApiRequests: 0,
        actualCostUsd: 0,
        cases: rows.length,
        rows,
      },
      null,
      2,
    ),
  );
});
