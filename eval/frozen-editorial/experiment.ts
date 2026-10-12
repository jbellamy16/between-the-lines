import { runBoundedInvestigator } from "../../src/lib/ai/director/investigator";
import { fixture } from "./plan";
import { prepareInvestigation } from "../../src/lib/ai/director/investigator-contract";
import { guardedTransport } from "./transport";
import type { Store } from "./store";
import { reviewComparison } from "./review";

/** Shared orchestration exercised with an injected mocked transport in unit tests.
 * Only the standalone gated entry supplies real network/accounting dependencies. */
export async function experiment(
  store: Store,
  native: typeof fetch,
  maxAttempts: number,
  signal: AbortSignal,
  provenance: "mock" | "recorded-model",
  record: (event: Record<string, unknown>) => void = () => {},
) {
  const originalFetch = globalThis.fetch;
  const transport = guardedTransport(store, native, maxAttempts, record);
  const started = performance.now();
  let result: Awaited<ReturnType<typeof runBoundedInvestigator>> | null = null;
  try {
    globalThis.fetch = async () => {
      throw new Error("No-call control attempted network");
    };
    const c = fixture(true);
    const noCall = await runBoundedInvestigator(c.match, c.cutoff, c.context, {
      mode: "normal",
      signal,
    });
    record({ kind: "no-call", result: noCall });
    if (signal.aborted)
      return {
        status: "cancelled-before-evaluation",
        noCall,
        result: null,
        comparisons: [],
        attempts: [],
        actualHttpAttempts: 0,
        paidCalls: 0,
        latencyMs: performance.now() - started,
        humanReview: null,
      };
    if (
      noCall.receipt.attempts ||
      noCall.stories.length ||
      noCall.answers.length ||
      noCall.receipt.disposition !== "deterministic"
    )
      throw new Error("No-call control failed");
    globalThis.fetch = transport.fetch;
    const target = fixture();
    const modelStart = performance.now();
    result = await runBoundedInvestigator(
      target.match,
      target.cutoff,
      target.context,
      { mode: "evaluation", maxHttpAttempts: maxAttempts, signal },
    );
    const latencyMs = performance.now() - modelStart;
    const prepared = prepareInvestigation(
      target.match,
      target.cutoff,
      target.context,
    );
    const evidence = {
      initial: prepared.initial,
      selected: result.receipt.trace.map((entry) =>
        prepared.reader.read({
          indexId: entry.action.indexId,
          optionId: entry.action.optionId,
        }),
      ),
    };
    // Persist actual output/trace before final accounting or rendering can fail.
    record({ kind: "investigator-result", result, evidence, latencyMs });
    const accounting = await store("stop", { reason: "single-use-complete" });
    const [fields] = accounting as [string[], string[]];
    const ledger = Object.fromEntries(
      Array.from({ length: fields.length / 2 }, (_, i) => [
        fields[2 * i],
        fields[2 * i + 1],
      ]),
    );
    const rows = transport.rows;
    const accountingReconciled =
      Number(ledger.attempts) === transport.attempts() &&
      ledger.pending === "0" &&
      rows.length === transport.attempts() &&
      Number(ledger.accounted) ===
        rows.reduce((s, r) => s + Number(r.accountedNanoUsd), 0) &&
      result.receipt.usage.inputTokens ===
        rows.reduce(
          (s, r) =>
            s +
            Number(
              (r.usage as { input_tokens?: number } | null)?.input_tokens ?? 0,
            ),
          0,
        ) &&
      result.receipt.usage.outputTokens ===
        rows.reduce(
          (s, r) =>
            s +
            Number(
              (r.usage as { output_tokens?: number } | null)?.output_tokens ??
                0,
            ),
          0,
        );
    const operationallyValid =
      accountingReconciled &&
      !transport.stopped() &&
      !result.receipt.cached &&
      transport.attempts() > 0 &&
      result.receipt.attempts === transport.attempts() &&
      result.receipt.verification === "passed" &&
      result.receipt.disposition === "model-selection" &&
      result.receipt.usage.complete;
    const comparisons = reviewComparison(result, provenance);
    return {
      studyProvenance: provenance,
      status: signal.aborted
        ? "cancelled"
        : operationallyValid
          ? "awaiting-blinded-human-review"
          : "failed-or-inconclusive",
      noCall,
      result,
      evidence,
      comparisons,
      latencyMs,
      totalWallMs: performance.now() - started,
      actualHttpAttempts: transport.attempts(),
      paidCalls: provenance === "mock" ? 0 : transport.attempts(),
      attempts: rows,
      durableAccounting: accounting,
      accountingReconciled,
      operationallyValid,
      conservativelyAccountedUsd: Number(ledger.accounted) / 1e9,
      actualEstimatedCostUsd:
        rows.length > 0 &&
        rows.every((r) => typeof r.reportedRateNanoUsd === "number")
          ? rows.reduce((s, r) => s + Number(r.reportedRateNanoUsd), 0) / 1e9
          : null,
      usageComplete: !transport.stopped() && result.receipt.usage.complete,
      voluntaryStop:
        result.receipt.stop.voluntary &&
        result.receipt.stop.origin === "model" &&
        result.receipt.verification === "passed",
      humanReview: null,
      beyondB2Established: false,
    };
  } catch {
    record({
      kind: "failure",
      status: "stopped-no-resume",
      result,
      attempts: transport.rows,
      actualHttpAttempts: transport.attempts(),
      retainedReservations: true,
    });
    throw new Error("Evaluation stopped; retain receipts and reservations");
  } finally {
    globalThis.fetch = originalFetch;
    await store("stop", { reason: "terminal-no-resume" });
  }
}
