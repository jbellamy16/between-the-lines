import "server-only";
import { createHash } from "node:crypto";
import type { MatchData } from "../../sources/model";
import {
  controlledNarration,
  usageStoreReady,
  WorkflowFailure,
} from "../controls";
import { configuredProvider, modelFor, ProviderFailure } from "../providers";
import { UsageFailure } from "../request-controls";
import { offlineAnalyst, runAnalyst } from "./agent";
import {
  ANALYST_VERSION,
  type AnalystResult,
  type AnalystStep,
  type AnalystStyle,
} from "./types";

export function analystEnabled() {
  return configuredProvider() !== "offline" && usageStoreReady();
}

const normalize = (question: string) =>
  question.trim().replace(/\s+/g, " ").toLowerCase();

export async function askAnalyst(
  match: MatchData,
  cutoff: number,
  question: string,
  style: AnalystStyle,
  options: { signal?: AbortSignal; onStep?: (step: AnalystStep) => void } = {},
): Promise<AnalystResult> {
  const provider = configuredProvider();
  if (provider === "offline")
    return offlineAnalyst(
      match,
      cutoff,
      question,
      "offline",
      "The live analyst is off in this build. The questions under Look closer are answered from the recorded events.",
    );
  if (!usageStoreReady() || match.kind !== "synthetic")
    return offlineAnalyst(
      match,
      cutoff,
      question,
      "unavailable",
      "The live analyst isn't available right now. The story above is still checked from the recorded events.",
    );
  const identity = {
    workflow: ANALYST_VERSION,
    match: createHash("sha256").update(JSON.stringify(match)).digest("hex"),
    cutoff,
    question: normalize(question),
    style,
    provider,
    model: modelFor(provider),
    endpoint: provider === "foundry" ? process.env.FOUNDRY_ENDPOINT : "openai",
  };
  const telemetry = { requests: 0, toolCalls: 0 };
  const started = Date.now();
  try {
    const { result, cached } = await controlledNarration(
      identity,
      (shared) =>
        runAnalyst(match, cutoff, question, style, provider, {
          signal: shared,
          onStep: options.onStep,
          telemetry,
        }),
      options.signal,
    );
    if (cached) for (const step of result.steps) options.onStep?.(step);
    return cached
      ? {
          ...result,
          question,
          cached: true,
          metrics: {
            ...result.metrics,
            requests: 0,
            estimatedCostUsd: 0,
            latencyMs: Date.now() - started,
          },
        }
      : result;
  } catch (error) {
    options.signal?.throwIfAborted();
    const category =
      error instanceof ProviderFailure ||
      error instanceof UsageFailure ||
      error instanceof WorkflowFailure
        ? error.category
        : error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "invalid";
    const notice =
      category === "budget"
        ? "The live analyst has reached its usage limit for now. The story above is still checked from the recorded events."
        : category === "busy"
          ? "That question is already being answered. Try again in a few seconds."
          : category === "timeout"
            ? "The analyst ran out of time on that one. Try a narrower question."
            : "The analyst couldn't finish that question. Nothing unverified is shown. Try again or rephrase.";
    return {
      ...offlineAnalyst(match, cutoff, question, "unavailable", notice),
      source: provider,
      model: modelFor(provider) || null,
      metrics: {
        requests: telemetry.requests,
        toolCalls: telemetry.toolCalls,
        latencyMs: Date.now() - started,
        estimatedCostUsd: null,
      },
    };
  }
}

/** Instance-local courtesy limit per client, on top of the shared quotas. */
const recent = new Map<string, number[]>();
export function clientAllowed(
  client: string,
  now = Date.now(),
  max = Number(process.env.AI_ASK_PER_CLIENT_LIMIT ?? 12),
  windowMs = 10 * 60 * 1000,
) {
  const times = (recent.get(client) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= max) {
    recent.set(client, times);
    return false;
  }
  times.push(now);
  recent.set(client, times);
  if (recent.size > 5000)
    for (const [key, list] of recent)
      if (!list.some((t) => now - t < windowMs)) recent.delete(key);
  return true;
}
