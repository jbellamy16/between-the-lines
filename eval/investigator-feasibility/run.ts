import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  collectPreflight,
  localConfiguration,
  quotaSnapshot as preparationLimits,
} from "../guided-study/preflight";
import { runBoundedInvestigator } from "../../src/lib/ai/director/investigator";
import {
  investigationMaterial,
  prepareInvestigation,
  verifyInvestigation,
} from "../../src/lib/ai/director/investigator-contract";
import { DIRECTORY, digest, frozenContent, fixture, proposal } from "./plan";
import { authorizationSchema, durableStore } from "./store";
import { guardedTransport } from "./transport";

export function entryGate(
  args: string[],
  env: Record<string, string | undefined>,
  inputTTY: boolean,
  outputTTY: boolean,
) {
  if (
    env.CI ||
    env.GITHUB_ACTIONS ||
    env.VITEST ||
    env.NODE_ENV === "test" ||
    !inputTTY ||
    !outputTTY ||
    args.length !== 2 ||
    args[0] !== "--authorization-file"
  )
    throw new Error(
      "Live evaluation requires a separate explicit authorization file and interactive terminal outside CI/tests",
    );
}
export function measure(
  result: Awaited<ReturnType<typeof runBoundedInvestigator>>,
) {
  const c = fixture(),
    p = prepareInvestigation(c.match, c.cutoff, c.context);
  const r = result.receipt;
  const verified =
    r.plan && r.verification === "passed"
      ? verifyInvestigation(c.match, c.cutoff, c.context, {
          ...r,
          plan: r.plan,
        })
      : null;
  const material = investigationMaterial(
    p.reader.index,
    p.initial,
    p.baseline.stories[0].storyId,
  );
  const opponentChallengeIds = material.challenges
    .filter(
      (c) =>
        c.id === "challenge:opponent-shot-response" ||
        c.text.includes("one-sided control is not established"),
    )
    .map((c) => c.id);
  return {
    evidenceSelectionVerified: !!verified,
    attemptedReads: r.trace.length,
    validatedReadIds: r.trace.map((t) => t.action.optionId),
    // Validity is not editorial relevance. No automatic reward for more reads.
    readRelevanceHumanReview: null,
    competingInterpretationRelevant:
      r.plan?.focalId === p.baseline.stories[0].storyId &&
      r.plan.interpretationIds[0] === "both-teams",
    counterEvidenceRelevant:
      r.plan?.focalId === p.baseline.stories[0].storyId &&
      r.plan.challengeIds.some((id) => opponentChallengeIds.includes(id)),
    voluntaryStop:
      r.stop.voluntary &&
      r.stop.origin === "model" &&
      r.verification === "passed",
    sameStoriesAsB2:
      JSON.stringify(result.stories) === JSON.stringify(p.baseline.stories),
    sameAnswersAsB2:
      JSON.stringify(result.answers) === JSON.stringify(p.baseline.answers),
    unsupportedPublishedConclusions:
      verified ||
      r.disposition === "fallback" ||
      r.disposition === "deterministic"
        ? 0
        : null,
    rejectedDecision: r.verification === "rejected",
    editorialImprovementHumanReview: null,
    beyondB2Established: false,
  };
}
export async function runOnce(args: string[]) {
  entryGate(args, process.env, !!process.stdin.isTTY, !!process.stdout.isTTY);
  const git = (...a: string[]) =>
    execFileSync("git", a, { encoding: "utf8" }).trim();
  if (git("status", "--porcelain"))
    throw new Error("Commit and review the frozen candidate first");
  const frozen = JSON.parse(readFileSync(`${DIRECTORY}/frozen.json`, "utf8"));
  if (
    JSON.stringify({ proposal: frozen.proposal, cases: frozen.cases }) !==
    JSON.stringify(frozenContent())
  )
    throw new Error("Frozen scenario/baseline drift");
  for (const [p, h] of Object.entries(frozen.sourceHashes))
    if (digest(readFileSync(p, "utf8")) !== h)
      throw new Error("Frozen source drift");
  const auth = authorizationSchema.parse(
    JSON.parse(readFileSync(args[1], "utf8")),
  );
  if (
    auth.manifest !== digest(JSON.stringify(frozen)) ||
    auth.commit !== git("rev-parse", "HEAD") ||
    Date.parse(auth.expiresAt) <= Date.now()
  )
    throw new Error("Stale or mismatched authorization");
  const config = localConfiguration();
  // Never override an existing lower quota. Foundry selection is private to
  // this terminal process; no persisted settings or public route are changed.
  Object.assign(process.env, config);
  if (preparationLimits(config).some((n, i) => n > [2, 2, 2, 2, 30, 30000][i]))
    throw new Error(
      "Application limits exceed the frozen preparation; do not increase limits",
    );
  const store = durableStore(auth);
  await store("inspect");
  const preflight = await collectPreflight();
  // The reused read-only collector targets an older six-case study. Its study
  // size warnings are inapplicable; independently enforce this proposal below.
  const cloudBlockers = preflight.blockers.filter(
    (b) =>
      !b.includes("six workflows") &&
      !b.includes("shared application allowance is insufficient"),
  );
  if (
    cloudBlockers.length ||
    !preflight.deployment ||
    !preflight.prices ||
    (preflight.application.remainingWorkflows ?? 0) < 1 ||
    (preflight.application.remainingAttempts ?? 0) < 1
  )
    throw new Error(
      "Current deployment, pricing or durable allowance is unverified",
    );
  if (
    config.FOUNDRY_DEPLOYMENT !== proposal.deployment ||
    config.FOUNDRY_ENDPOINT !== "https://josh-5098-resource.openai.azure.com" ||
    !config.FOUNDRY_API_KEY
  )
    throw new Error(
      "Existing evaluation Foundry credentials/configuration required; no key retrieval or provisioning",
    );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (
      (await rl.question(
        `Separate owner authorization required. Type ${auth.manifest} to spend at most $${auth.maxNanoUsd / 1e9} on this single run: `,
      )) !== auth.manifest
    )
      throw new Error("Not authorized");
  } finally {
    rl.close();
  }
  const output = `${DIRECTORY}/execution`;
  mkdirSync(output); // Never overwrite or resume an earlier local execution.
  const write = (name: string, value: unknown) =>
    writeFileSync(
      `${output}/${name}.json`,
      JSON.stringify(value, null, 2) + "\n",
      { flag: "wx" },
    );
  write("preflight", preflight);
  await store("claim", { manifest: auth.manifest, commit: auth.commit });
  const native = globalThis.fetch;
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const transport = guardedTransport(store, native, auth.maxAttempts);
  try {
    globalThis.fetch = async () => {
      throw new Error("No-call control attempted network");
    };
    const control = fixture(true);
    const noCall = await runBoundedInvestigator(
      control.match,
      control.cutoff,
      control.context,
      { mode: "normal", signal: controller.signal },
    );
    write("no-call", noCall);
    if (
      noCall.receipt.attempts ||
      noCall.stories.length ||
      noCall.receipt.disposition !== "deterministic"
    )
      throw new Error("No-call control failed");
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "foundry";
    process.env.AI_PROACTIVE_ENABLED = "false";
    globalThis.fetch = transport.fetch;
    const c = fixture();
    const started = performance.now();
    const result = await runBoundedInvestigator(c.match, c.cutoff, c.context, {
      mode: "evaluation",
      maxHttpAttempts: auth.maxAttempts,
      signal: controller.signal,
    });
    const latencyMs = performance.now() - started;
    const metrics = measure(result);
    const accounting = await store("stop", { reason: "single-use-complete" });
    const [fields] = accounting as [string[], string[]];
    const ledgerState = Object.fromEntries(
      Array.from({ length: fields.length / 2 }, (_, i) => [
        fields[2 * i],
        fields[2 * i + 1],
      ]),
    );
    const accountingReconciled =
      Number(ledgerState.attempts) === transport.attempts() &&
      ledgerState.pending === "0" &&
      transport.rows.length === transport.attempts() &&
      Number(ledgerState.accounted) ===
        transport.rows.reduce((s, r) => s + Number(r.accountedNanoUsd), 0) &&
      result.receipt.usage.inputTokens ===
        transport.rows.reduce(
          (s, r) =>
            s +
            Number(
              (r.usage as { input_tokens?: number } | null)?.input_tokens ?? 0,
            ),
          0,
        ) &&
      result.receipt.usage.outputTokens ===
        transport.rows.reduce(
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
      result.receipt.verification === "passed";
    const feasible =
      operationallyValid &&
      result.receipt.usage.complete &&
      metrics.competingInterpretationRelevant &&
      metrics.counterEvidenceRelevant &&
      metrics.unsupportedPublishedConclusions === 0;
    write("result", {
      feasible,
      result,
      metrics,
      latencyMs,
      actualHttpAttempts: transport.attempts(),
      attempts: transport.rows,
      durableAccounting: accounting,
      accountingReconciled,
      conservativelyAccountedUsd: Number(ledgerState.accounted) / 1e9,
      usageComplete: !transport.stopped() && result.receipt.usage.complete,
      actualEstimatedCostUsd: transport.rows.every(
        (r) => typeof r.reportedRateNanoUsd === "number",
      )
        ? transport.rows.reduce(
            (s, r) => s + Number(r.reportedRateNanoUsd),
            0,
          ) / 1e9
        : null,
      operationallyValid,
      humanReview: null,
      beyondB2Established: false,
    });
    if (!feasible)
      throw new Error("No demonstrated feasibility; review original receipts");
  } catch {
    write("failure", {
      status: "stopped-no-resume",
      actualHttpAttempts: transport.attempts(),
      attempts: transport.rows,
      modelValue: "not established",
      retainedReservations: true,
    });
    throw new Error("Evaluation stopped; inspect preserved receipts");
  } finally {
    globalThis.fetch = native;
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    await store("stop", { reason: "terminal-no-resume" });
  }
}
