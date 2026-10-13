import "server-only";
import { randomUUID } from "node:crypto";
import type { MatchData } from "../../sources/model";
import { investigationBudget } from "../investigation-budget";
import { UsageFailure } from "../request-controls";
import { runBoundedInvestigator } from "./investigator";
import { prepareInvestigation } from "./investigator-contract";

/** The only application entry for paid investigation. Legacy AI stays disabled. */
export async function investigateExplicitly(
  match: MatchData,
  time: number,
  signal?: AbortSignal,
) {
  const started = Date.now();
  const prepared = prepareInvestigation(match, time, { audience: "local" });
  let result = await runBoundedInvestigator(match, time, {}, { signal });
  let reservedUsd = 0;
  if (process.env.AI_INVESTIGATOR_ENABLED !== "true") {
    result.receipt.stop.reason = "disabled";
  } else if (match.kind !== "synthetic") {
    result.receipt.stop.reason = "capability";
  } else if (!process.env.FOUNDRY_ENDPOINT || !process.env.FOUNDRY_API_KEY) {
    result.receipt.stop.reason = "disabled";
  } else {
    let budget: Awaited<ReturnType<typeof investigationBudget>> | undefined;
    try {
      signal?.throwIfAborted();
      budget = await investigationBudget();
      result = await runBoundedInvestigator(
        match,
        time,
        {},
        {
          mode: "explicit",
          signal,
          beforeAttempt: budget.reserve,
        },
      );
    } catch (error) {
      signal?.throwIfAborted();
      result.receipt.stop.reason =
        error instanceof UsageFailure && error.category === "budget"
          ? "budget"
          : "controls";
      result.receipt.disposition = "fallback";
    } finally {
      reservedUsd = budget?.reservedUsd() ?? 0;
      await budget?.release();
    }
  }
  signal?.throwIfAborted();
  const model = result.receipt.disposition === "model-selection";
  return {
    ...result,
    matchId: match.id,
    receiptId: randomUUID(),
    createdAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    // A reservation is a ceiling, not an invoice. Missing/retried usage stays unknown.
    spending: {
      reservedUsd,
      estimatedUsd: result.receipt.usage.complete
        ? (result.receipt.usage.inputTokens * 0.75 +
            result.receipt.usage.outputTokens * 4.5) /
          1_000_000
        : null,
      estimateBasis:
        "Uncached retail token estimate; not an invoice. Cache discounts omitted.",
    },
    baseline: {
      stories: prepared.baseline.stories,
      answers: prepared.baseline.answers,
    },
    comparison: model
      ? JSON.stringify(result.receipt.finalIds) ===
        JSON.stringify(result.receipt.baselineIds)
        ? "Same focal selection as B2. Additional value has not been established."
        : "Different focal selection from B2. This does not establish a better answer."
      : "Showing the deterministic B2 answer. No verified model conclusion was published.",
    initialEvidence: prepared.initial.map((bundle) => ({
      optionId: bundle.option.id,
      label: bundle.option.label,
      purpose: bundle.option.purpose,
      coverage: bundle.coverage,
    })),
    investigatedEvidence: result.receipt.trace.map((entry) => ({
      ...entry,
      label:
        prepared.reader.index.options.find(
          (o) => o.id === entry.action.optionId,
        )?.label ?? entry.action.purpose,
    })),
  };
}
export type ExplicitInvestigation = Awaited<
  ReturnType<typeof investigateExplicitly>
>;
