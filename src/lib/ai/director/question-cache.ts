import type { MatchData } from "../../sources/model";
import type { QuestionResult } from "./question-runner";
import { QUESTION_VERSION, type Question } from "./questions";
import { sharedTasks } from "../wait";
const results = new WeakMap<MatchData, Map<string, QuestionResult>>();
const tasks = new WeakMap<
  MatchData,
  ReturnType<typeof sharedTasks<QuestionResult>>
>();
export async function requestQuestion(
  match: MatchData,
  cutoff: number,
  question: Question,
  signal?: AbortSignal,
): Promise<QuestionResult> {
  signal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(60000),
  ]);
  const config = await fetch("/api/insights", { cache: "no-store", signal });
  if (!config.ok) throw new Error("Question configuration unavailable");
  const { directorContext } = await config.json();
  const key = JSON.stringify({
    version: QUESTION_VERSION,
    context: directorContext,
    cutoff,
    question,
  });
  signal.throwIfAborted();
  const cached = directorContext && results.get(match)?.get(key);
  if (cached)
    return {
      ...cached,
      metrics: {
        ...cached.metrics,
        cached: true,
        requests: 0,
        estimatedCostUsd: 0,
      },
    };
  let shared = tasks.get(match);
  if (!shared) {
    shared = sharedTasks<QuestionResult>();
    tasks.set(match, shared);
  }
  return shared(
    key,
    async (sharedSignal) => {
      const source =
        match.kind === "synthetic"
          ? {
              scenario: match.provenance.raw.scenario,
              profile: match.provenance.raw.profile,
            }
          : { matchId: match.id };
      const response = await fetch("/api/director", {
        method: "POST",
        signal: sharedSignal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...source,
          time: cutoff,
          mode: "fan",
          question,
        }),
      });
      if (!response.ok) throw new Error("Question unavailable");
      const result: QuestionResult = await response.json();
      sharedSignal.throwIfAborted();
      if (
        result.evidence?.matchId !== match.id ||
        result.evidence.cutoff !== cutoff ||
        result.evidence.question.intent !== question.intent ||
        result.evidence.question.storyId !== question.storyId ||
        result.evidence.version !== QUESTION_VERSION ||
        !Array.isArray(result.supplements)
      )
        throw new Error("Mismatched question answer");
      if (
        !result.failure &&
        result.source !== "offline" &&
        directorContext &&
        result.cacheContext === directorContext
      ) {
        const map = results.get(match) ?? new Map<string, QuestionResult>();
        map.set(key, result);
        if (map.size > 12) map.delete(map.keys().next().value!);
        results.set(match, map);
      }
      return result;
    },
    signal,
  );
}
