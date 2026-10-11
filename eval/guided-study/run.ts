import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { answerQuestion } from "../../src/lib/ai/director/question-runner";
import {
  QUESTION_VERSION,
  presentQuestion,
} from "../../src/lib/ai/director/questions";
import { foundryUrl } from "../../src/lib/ai/providers";
import { wait } from "../../src/lib/ai/wait";
import { loadCases, verifyCase } from "./cases";
import { collectPreflight, quotaSnapshot } from "./preflight";
import { CAPS, ENVELOPE, PRICE, STUDY, StudyLedger, digest } from "./ledger";
import { studyTransport } from "./transport";
import { STUDY_REDIS_URL, studyStore } from "./store";
export const OUTPUT = resolve(`docs/intelligence/${STUDY}`);
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const writeNew = (name: string, value: unknown) =>
  writeFileSync(
    `${OUTPUT}/${name}.json`,
    JSON.stringify(value, null, 2) + "\n",
    { flag: "wx" },
  );
export async function runStudy() {
  if (existsSync(`${OUTPUT}/manifest.json`))
    throw new Error("Single-use campaign receipts already exist; no reruns");
  if (git("status", "--porcelain"))
    throw new Error("Freeze the completed candidate first");
  if (
    process.env.AI_REDIS_URL !== STUDY_REDIS_URL ||
    process.env.AI_USAGE_STORE !== "redis" ||
    JSON.stringify(quotaSnapshot(process.env)) !==
      JSON.stringify([2, 12, 12, 12, 30, 30000])
  )
    throw new Error("Wrong campaign process envelope");
  const initialStore = await studyStore("inspect");
  if (initialStore.owner.execution) throw new Error("Campaign already claimed");
  const evaluatedCommit = git("rev-parse", "HEAD"),
    cases = loadCases();
  const sourceHashes = Object.fromEntries(
    git(
      "ls-files",
      "src",
      "eval",
      "scripts",
      "package.json",
      "package-lock.json",
      "vitest.guided-foundry.config.ts",
    )
      .split("\n")
      .map((p) => [p, digest(readFileSync(p, "utf8"))]),
  );
  const historicalHashes = Object.fromEntries(
    git("ls-files", "docs/intelligence")
      .split("\n")
      .filter(Boolean)
      .map((p) => [p, digest(readFileSync(p).toString("base64"))]),
  );
  const preflight = await collectPreflight();
  const manifest = {
    study: STUDY,
    frozenAt: new Date().toISOString(),
    evaluatedCommit,
    questionVersion: QUESTION_VERSION,
    caps: CAPS,
    envelope: ENVELOPE,
    price: PRICE,
    initialStore,
    sourceHashes,
    historicalHashes,
    preflight,
    cases: cases.map(({ match: _match, baseline: _baseline, ...c }) => c),
    humanReview: null,
  };
  mkdirSync(OUTPUT, { recursive: true });
  writeNew("manifest", manifest);
  writeNew(
    "baselines",
    cases.map((c) => ({
      caseId: c.id,
      result: c.baseline,
      renderings: verifyCase(c, c.baseline).renderings,
    })),
  );
  const manifestHash = digest(JSON.stringify(manifest)),
    ledger = new StudyLedger(`${OUTPUT}/ledger.jsonl`, manifestHash);
  const nativeFetch = globalThis.fetch,
    rows: Record<string, unknown>[] = [];
  const controller = new AbortController(),
    interrupt = () =>
      controller.abort(new DOMException("Campaign interrupted", "AbortError"));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    if (preflight.blockers.length) ledger.refuse("blocked_preflight");
    if (
      Object.entries(sourceHashes).some(
        ([p, h]) => digest(readFileSync(p, "utf8")) !== h,
      )
    )
      ledger.refuse("verification");
    writeNew("execution-claim", await studyStore("claim", manifestHash));
    const checkStore = async () => {
      const state = await studyStore("inspect");
      if (state.owner.execution !== manifestHash)
        throw new Error("Campaign owner changed");
      return state;
    };
    const destination = foundryUrl();
    if (
      destination !==
      "https://josh-5098-resource.openai.azure.com/openai/v1/responses"
    )
      ledger.refuse("blocked_preflight");
    const guarded = studyTransport(
      ledger,
      destination,
      nativeFetch,
      checkStore,
    );
    globalThis.fetch = guarded.fetch;
    let completedAt = 0,
      billableWorkflows = 0;
    for (const c of cases) {
      if (ledger.stopped) break;
      const spacing = Math.max(0, completedAt + CAPS.spacingMs - Date.now());
      // Short waits leave the process interruptible; no other work is dispatched.
      if (spacing) await wait(spacing, controller.signal);
      if (existsSync(`${OUTPUT}/STOP`)) ledger.refuse("cancelled");
      await checkStore();
      ledger.begin(c.id);
      const before = ledger.dispatched;
      const result = await answerQuestion(
        c.match,
        c.cutoff,
        c.question,
        controller.signal,
      );
      writeNew(`case-${c.id}`, {
        caseId: c.id,
        kind: "Original result before acceptance; never overwritten",
        result,
      });
      const row: Record<string, unknown> = {
        caseId: c.id,
        outcome: "failed",
        result,
        humanReview: null,
      };
      rows.push(row);
      const state = await checkStore();
      row.applicationAfter = state;
      if (c.eligibility === "eligible") billableWorkflows++;
      if (
        Number(state.budget.used4) !== billableWorkflows ||
        Number(state.budget.attemptUsed3) !== ledger.dispatched ||
        guarded.pending() ||
        result.metrics.requests !== ledger.dispatched - before ||
        result.metrics.toolInvocations > 4 ||
        result.metrics.requests > 3 ||
        result.metrics.cached
      )
        ledger.stop("accounting");
      if (result.failure) ledger.stop("runtime_failure");
      try {
        row.verification = verifyCase(c, result);
      } catch {
        ledger.stop("verification");
      }
      const same =
        JSON.stringify(result.evidence) === JSON.stringify(c.baseline.evidence);
      row.comparison = {
        author: "assistant analysis",
        sameConclusionAndCoreEvidence: same,
        baseline: presentQuestion(c.baseline.evidence, c.match, "plain"),
        actual: presentQuestion(result.evidence, c.match, "plain"),
        addedEvidence: result.supplements,
        assessment: result.failure
          ? "No demonstrated additional benefit: investigation failed; deterministic fallback retained."
          : c.eligibility === "no-call"
            ? "Appropriate no-call: the known source limitation is answered deterministically."
            : result.supplements.length
              ? "Core conclusion confirmed; selected additional verified context. Its usefulness requires viewer testing."
              : "Confirmed the deterministic baseline; no demonstrated additional evidence or conclusion benefit.",
      };
      if (!ledger.stopped) {
        if (
          (c.eligibility === "eligible" && result.source !== "foundry") ||
          (c.eligibility === "no-call" &&
            (result.source !== "offline" || ledger.dispatched !== before))
        )
          ledger.stop("runtime_failure");
        else
          row.outcome =
            c.eligibility === "eligible" ? "completed" : "abstained";
      }
      ledger.end(row.outcome as "failed" | "completed" | "abstained");
      completedAt = Date.now();
      console.log(
        JSON.stringify({
          caseId: c.id,
          outcome: row.outcome,
          attempts: ledger.dispatched,
          accountedUsd: ledger.totalNanoUsd() / 1e9,
          stop: Reflect.get(ledger, "stopped")?.reason,
        }),
      );
      if (ledger.dispatched >= CAPS.attempts) ledger.stop("attempt_limit");
      if (ledger.totalNanoUsd() >= CAPS.nanoUsd) ledger.stop("spend_limit");
    }
    if (!ledger.stopped) ledger.stop("complete");
  } catch {
    ledger.stop(controller.signal.aborted ? "cancelled" : "verification");
    if (ledger.active) ledger.end("failed");
  } finally {
    globalThis.fetch = nativeFetch;
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    for (const c of cases)
      if (!rows.some((r) => r.caseId === c.id))
        rows.push({
          caseId: c.id,
          outcome: "not_attempted",
          reason: ledger.stopped?.reason,
          humanReview: null,
        });
    writeNew("results", {
      study: STUDY,
      evaluatedCommit,
      stop: ledger.stopped?.reason,
      acceptanceCriteriaPassed: ledger.stopped?.reason === "complete",
      workflows: ledger.workflows.length,
      actualHttpAttempts: ledger.dispatched,
      accountedUsd: ledger.totalNanoUsd() / 1e9,
      reportedRateEstimateUsd:
        ledger.settlements.reduce(
          (s, r) => s + (r.reportedRateNanoUsd ?? 0),
          0,
        ) / 1e9,
      grossReservationsUsd:
        ledger.reservations.reduce((s, r) => s + r.nanoUsd, 0) / 1e9,
      unknownUsageReservations: ledger.settlements.filter((s) => !s.usage)
        .length,
      settlements: ledger.settlements,
      rows,
      historicalHashesUnchanged: Object.entries(historicalHashes).every(
        ([p, h]) => digest(readFileSync(p).toString("base64")) === h,
      ),
      billingUncertainty:
        "Conservative token-rate accounting, not an invoice; all input priced uncached. Unknown usage retains full-context reservation.",
    });
    ledger.close();
  }
}
