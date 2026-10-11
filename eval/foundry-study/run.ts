import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { directMatch } from "../../src/lib/ai/director/runner";
import { DIRECTOR_VERSION } from "../../src/lib/ai/director/observer";
import { foundryUrl, configuredProvider } from "../../src/lib/ai/providers";
import { wait } from "../../src/lib/ai/wait";
import { CASES, loadCases, fixtureEvidence, verifyAndRender } from "./cases";
import {
  collectPreflight,
  localConfiguration,
  MODEL_URL,
  quotaSnapshot,
} from "./preflight";
import {
  CAPS,
  DEPLOYMENT,
  ENVELOPE,
  PRICE,
  STUDY,
  StudyLedger,
  digest,
} from "./ledger";
import { studyTransport } from "./transport";
import {
  CONTINUATION,
  CONTINUATION_OUTPUT,
  STUDY_REDIS_URL,
  studyStore,
  verifyParent,
} from "./continuation";

// Fixed path for this authorization. Never offer a new path/reset/force option.
export const OUTPUT = resolve(`docs/intelligence/${STUDY}`);
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const writeNewAt = (output: string, name: string, value: unknown) =>
  writeFileSync(
    `${output}/${name}.json`,
    JSON.stringify(value, null, 2) + "\n",
    { flag: "wx" },
  );

export async function runStudy(mode: "prepare" | "live" | "continuation") {
  const OUTPUT =
    mode === "continuation"
      ? CONTINUATION_OUTPUT
      : resolve(`docs/intelligence/${STUDY}`);
  const writeNew = (name: string, value: unknown) =>
    writeNewAt(OUTPUT, name, value);
  if (existsSync(`${OUTPUT}/manifest.json`))
    throw new Error(
      "Study receipts already exist. Do not overwrite or start another paid campaign.",
    );
  if (git("status", "--porcelain"))
    throw new Error("Commit candidate/harness before freezing the study.");
  const parent = mode === "continuation" ? verifyParent() : undefined;
  let initialStore;
  if (parent) {
    if (
      process.env.AI_REDIS_URL !== STUDY_REDIS_URL ||
      process.env.AI_USAGE_STORE !== "redis" ||
      JSON.stringify(quotaSnapshot(process.env)) !==
        JSON.stringify([2, 12, 12, 12, 10, 10000])
    )
      throw new Error(
        "Continuation requires the dedicated store and authorized process limits",
      );
    initialStore = await studyStore("inspect");
    if (initialStore.owner.execution)
      throw new Error("Continuation already executed");
  }
  const evaluatedCommit = git("rev-parse", "HEAD"),
    cases = loadCases();
  const sourcePaths = git(
    "ls-files",
    "src",
    "eval",
    "scripts/ai-local-config.mjs",
    "scripts/run-foundry-continuation.mjs",
    "package.json",
    "package-lock.json",
    "vitest.config.ts",
    "vitest.bounded-foundry.config.ts",
  ).split("\n");
  const historicalPaths = [
    "docs/intelligence/pr18-intelligence-2026-10-10/cases.json",
    "docs/intelligence/pr18-intelligence-2026-10-10/synthetic-evidence.json",
    ...(parent
      ? ["docs/intelligence/foundry-continuation-setup-2026-10-11.json"]
      : []),
  ];
  const sourceHashes = Object.fromEntries(
    [...sourcePaths, ...historicalPaths].map((p) => [
      p,
      digest(readFileSync(p, "utf8")),
    ]),
  );
  const preflight = await collectPreflight();
  const fixtureChecks = cases.map((c) => ({
    id: c.id,
    digest: c.digest,
    cutoff: c.cutoff,
    mode: c.mode,
    preferences: c.preferences,
    regeneration: c.regeneration,
    preflightEligibility: c.eligibility,
    evidence: fixtureEvidence(c),
  }));
  const manifest = {
    study: STUDY,
    continuation: parent ? CONTINUATION : undefined,
    parent,
    initialStore,
    frozenAt: new Date().toISOString(),
    evaluatedCommit,
    mergedPr24: "9b2cd5015391817d0eb0641637cc77c9e897fb7e",
    directorVersion: DIRECTOR_VERSION,
    promptSource: "src/lib/ai/director/runner.ts",
    promptSha256: sourceHashes["src/lib/ai/director/runner.ts"],
    sourceHashes,
    provider: "foundry",
    credentialHandling: parent
      ? "Existing key retrieved privately by the launcher; process environment only; no key in receipts"
      : "Caller supplied",
    account: "josh-5098-resource",
    endpointSha256: digest(
      "https://josh-5098-resource.openai.azure.com/openai/v1/responses",
    ),
    deployment: DEPLOYMENT,
    model: "gpt-5.4-mini",
    modelVersion: "2026-03-17",
    sku: "GlobalStandard",
    region: "westus3",
    limits: CAPS,
    reservation: ENVELOPE,
    price: PRICE,
    modelContextSource: MODEL_URL,
    settings: {
      investigationMode: "analyst",
      preferences: {},
      attemptsPerWorkflow: 3,
      evidenceQueriesPerWorkflow: 4,
      outputTokens: 1800,
      transportMs: 18000,
      workflowMs: 55000,
      application: preflight.application,
    },
    preflightDigest: digest(JSON.stringify(preflight)),
    cases: fixtureChecks.map(({ evidence: _evidence, ...c }) => c),
  };
  mkdirSync(OUTPUT, { recursive: true });
  writeNew("manifest", manifest);
  writeNew("preflight", preflight);
  writeNew("fixtures", fixtureChecks);
  const l = new StudyLedger(
    `${OUTPUT}/ledger.jsonl`,
    digest(JSON.stringify(manifest)),
  );
  const originalFetch = globalThis.fetch,
    originalEnvironment = { ...process.env };
  const rows: Record<string, unknown>[] = [];
  const offline: unknown[] = [];
  const controller = new AbortController();
  const interrupt = () =>
    controller.abort(new DOMException("Study interrupted", "AbortError"));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    // Preparation always uses the real directMatch fallback with an explicit
    // no-network transport. It does not consume workflows or imply live success.
    process.env.AI_ENABLED = "false";
    globalThis.fetch = async () => {
      throw new Error("Network forbidden during offline fixture preparation");
    };
    for (const c of cases) {
      const result = await directMatch(c.match, c.cutoff, "analyst", {});
      offline.push({
        caseId: c.id,
        kind: "deterministic offline preparation; not provider success or live abstention",
        result,
        verification: verifyAndRender(c, result),
      });
    }
    writeNew("offline-preparation", offline);
    if (preflight.blockers.length || mode === "prepare") {
      l.stop("blocked_preflight");
      for (const c of cases)
        rows.push({
          caseId: c.id,
          outcome: "not_attempted",
          reason: preflight.blockers.length
            ? "blocked_preflight"
            : "preparation_only",
          requests: 0,
          reportedUsage: null,
          reservedUsd: 0,
          humanReview: null,
        });
      return;
    }
    const config = localConfiguration();
    for (const [name, value] of Object.entries(config))
      if (/^(AI_|FOUNDRY_)/.test(name)) process.env[name] = value;
    // Only the continuation launcher supplies the newly authorized dedicated
    // allowance. No persistent environment or hosted settings are changed.
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "foundry";
    process.env.AI_PROACTIVE_ENABLED = "false";
    if (
      configuredProvider() !== "foundry" ||
      process.env.FOUNDRY_DEPLOYMENT !== DEPLOYMENT ||
      !process.env.AI_REDIS_URL ||
      JSON.stringify(quotaSnapshot(process.env)) !==
        JSON.stringify(preflight.application.limits)
    )
      l.refuse("blocked_preflight");
    const destination = foundryUrl();
    if (
      destination !==
      "https://josh-5098-resource.openai.azure.com/openai/v1/responses"
    )
      l.refuse("blocked_preflight");
    if (
      git("rev-parse", "HEAD") !== evaluatedCommit ||
      Object.entries(sourceHashes).some(
        ([p, hash]) => digest(readFileSync(p, "utf8")) !== hash,
      )
    )
      l.refuse("verification");
    const manifestHash = digest(JSON.stringify(manifest));
    if (parent)
      writeNew("execution-claim", await studyStore("claim", manifestHash));
    const checkStore = parent
      ? async () => {
          const state = await studyStore("inspect");
          if (state.owner.execution !== manifestHash)
            throw new Error("Execution owner changed");
          return state;
        }
      : undefined;
    const guarded = studyTransport(l, destination, originalFetch, checkStore);
    globalThis.fetch = guarded.fetch;
    let completedAt = 0;
    for (const c of cases) {
      if (l.stopped) break;
      await wait(
        Math.max(0, completedAt + CAPS.spacingMs - Date.now()),
        controller.signal,
      );
      if (existsSync(`${OUTPUT}/STOP`)) l.refuse("cancelled");
      if (checkStore) await checkStore();
      l.begin(c.id);
      const countBefore = l.dispatched;
      const result = await directMatch(
        c.match,
        c.cutoff,
        "analyst",
        {},
        controller.signal,
      );
      const row: Record<string, unknown> = {
        caseId: c.id,
        result,
        outcome: "failed",
        humanReview: null,
      };
      // Persist the ORIGINAL result before any acceptance check or diagnosis.
      writeNew(`case-${c.id}`, {
        caseId: c.id,
        kind: "Original runtime result before evaluation; verdict is in results.json",
        result,
      });
      rows.push(row);
      if (checkStore) {
        const state = await checkStore();
        row.applicationAfter = state;
        const expectedWorkflows = cases
          .slice(0, l.workflows.length)
          .filter((item) => item.eligibility !== "no-call").length;
        if (
          Number(state.budget.used4) !== expectedWorkflows ||
          Number(state.budget.attemptUsed3) !== l.dispatched
        )
          l.stop("accounting");
      }
      if (
        guarded.pending() ||
        result.metrics.requests !== l.dispatched - countBefore ||
        result.metrics.toolInvocations > 4 ||
        result.metrics.requests > 3 ||
        result.metrics.cached
      )
        l.stop("accounting");
      if (result.failure) l.stop("runtime_failure");
      if (!l.stopped) {
        try {
          row.verification = verifyAndRender(c, result);
        } catch {
          l.stop("verification");
        }
      }
      if (!l.stopped) {
        if (result.source !== "foundry" && c.eligibility !== "no-call")
          l.stop("runtime_failure");
        else
          row.outcome =
            result.source === "foundry" && result.decision === "publish"
              ? "completed"
              : "abstained";
      }
      l.end(row.outcome as "failed" | "completed" | "abstained");
      completedAt = Date.now();
      if (l.dispatched >= CAPS.attempts) l.stop("attempt_limit");
      if (l.totalNanoUsd() >= CAPS.nanoUsd) l.stop("spend_limit");
    }
    if (!l.stopped) l.stop("complete");
  } catch {
    // Errors can contain private configuration. Receipts contain safe categories
    // and the durable request ledger, never raw exceptions or model reasoning.
    l.stop(controller.signal.aborted ? "cancelled" : "verification");
    if (l.active) {
      if (!rows.some((row) => row.caseId === l.active))
        rows.push({
          caseId: l.active,
          outcome: "failed",
          reason: l.stopped?.reason,
          humanReview: null,
        });
      l.end("failed");
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of Object.keys(process.env))
      if (!(name in originalEnvironment)) delete process.env[name];
    Object.assign(process.env, originalEnvironment);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    for (const c of CASES)
      if (!rows.some((row) => row.caseId === c.id))
        rows.push({
          caseId: c.id,
          outcome: "not_attempted",
          reason: l.stopped?.reason,
          humanReview: null,
        });
    const reservationsUsd =
      l.reservations.reduce((sum, r) => sum + r.nanoUsd, 0) / 1e9;
    writeNew("results", {
      study: STUDY,
      evaluatedCommit,
      mode,
      stop: l.stopped?.reason,
      acceptanceCriteriaPassed:
        mode !== "prepare" &&
        !preflight.blockers.length &&
        rows.every(
          (r) => r.outcome === "completed" || r.outcome === "abstained",
        ),
      workflows: l.workflows.length,
      parent,
      continuation: parent ? CONTINUATION : undefined,
      actualHttpAttempts: l.dispatched,
      rows,
      reportedUsage: l.settlements.filter((s) => s.usage).map((s) => s.usage),
      reportedRateEstimateUsd:
        l.settlements.reduce(
          (sum, s) => sum + (s.reportedRateNanoUsd ?? 0),
          0,
        ) / 1e9,
      grossReservationsUsd: reservationsUsd,
      accountedUsd: l.totalNanoUsd() / 1e9,
      maximumStudyUsd: 0.5,
      billingUncertainty:
        "Token-rate estimates, not an invoice. All input priced uncached for accounting. Missing usage retains a full-context reservation. Reservation/dispatch crash boundaries are potentially sent, not proven HTTP completions.",
    });
    l.close();
  }
}
