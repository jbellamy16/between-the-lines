import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  canReserveProposal,
  prepareComparison,
  proposal,
  readinessBlockers,
} from "../eval/investigation-preflight/plan";

const historical = () =>
  JSON.parse(
    readFileSync("docs/intelligence/director-offline-results.json", "utf8"),
  );

describe("bounded investigation preparation", () => {
  it("retains all failures and controls and does not turn scripted facts into model value", () => {
    const result = prepareComparison(historical());
    expect(result.states).toBe(14);
    expect(result.noCallStates).toBe(6);
    expect(result.comparisons).toHaveLength(28);
    expect(
      result.comparisons.filter((r) => r.disposition === "fallback"),
    ).toHaveLength(2);
    expect(
      result.comparisons.flatMap((r) => r.additionalUsefulFactsVsB),
    ).toEqual([]);
    expect(
      result.comparisons.every((r) => r.unsupportedConclusionDeltaVsB === 0),
    ).toBe(true);
    expect(result.publicationSafetyPassed).toBe(false);
    expect(result.modelSelectedResults).toBeNull();
    expect(result.selectedSizing).toHaveLength(2);
    expect(
      result.selectedSizing.find((r) => r.arm === "D-adaptive-mock")
        ?.scriptedDisposition,
    ).toBe("verified-script");
  });

  it.each(["missing", "duplicate", "unknown", "eligibility"])(
    "rejects a %s matrix row",
    (mutation) => {
      const raw = historical();
      if (mutation === "missing") raw.rows.pop();
      if (mutation === "duplicate") raw.rows[1] = raw.rows[0];
      if (mutation === "unknown") raw.rows[0].caseId = "invented";
      if (mutation === "eligibility")
        raw.rows[0].eligible = !raw.rows[0].eligible;
      expect(() => prepareComparison(raw)).toThrow();
    },
  );

  it("refuses a no-call dispatch, corpus drift and relabelled paid output", () => {
    const control = historical();
    control.rows.find((r: { eligible: boolean }) => !r.eligible).requests = 1;
    expect(() => prepareComparison(control)).toThrow("No-call");
    const drift = historical();
    drift.manifestDigest = "changed";
    expect(() => prepareComparison(drift)).toThrow("corpus");
    expect(() =>
      prepareComparison({ ...historical(), actualModelRequests: 1 }),
    ).toThrow();
  });

  it("retains the full unknown reservation and refuses the second full reserve", () => {
    expect(canReserveProposal(0, 0)).toBe(true);
    expect(canReserveProposal(308100000, 1)).toBe(false);
    expect(canReserveProposal(191900000, 1)).toBe(true);
    expect(canReserveProposal(191900001, 1)).toBe(false);
    expect(canReserveProposal(1000000, 2)).toBe(false);
    expect(canReserveProposal(-1, 0)).toBe(false);
    expect(canReserveProposal(NaN, 0)).toBe(false);
    expect(proposal.caps).toMatchObject({
      workflows: 1,
      attempts: 2,
      perWorkflow: 2,
      nanoUsd: 500000000,
    });
  });

  it("cannot authorize dispatch, even with sufficient allowance", () => {
    const sufficient = {
      limits: [2, 2, 2, 2, 30, 30000],
      store: "shared",
      remainingWorkflows: 2,
      remainingAttempts: 2,
    };
    expect(readinessBlockers(sufficient)).toHaveLength(2);
    expect(
      readinessBlockers({
        ...sufficient,
        store: "memory",
        remainingAttempts: null,
      }),
    ).toHaveLength(3);
    expect(
      readinessBlockers({ ...sufficient, remainingAttempts: 1 }),
    ).toHaveLength(3);
    expect(
      readinessBlockers({ ...sufficient, limits: [2, 1, 2, 2, 30, 30000] }),
    ).toHaveLength(3);
    expect(
      readinessBlockers({ ...sufficient, remainingAttempts: NaN }),
    ).toHaveLength(3);
  });

  it("rejects a live argument before running tests or reading credentials", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/prepare-investigation-evaluation.ts",
          "--live",
        ],
        { stdio: "pipe" },
      ),
    ).toThrow();
  });
});
