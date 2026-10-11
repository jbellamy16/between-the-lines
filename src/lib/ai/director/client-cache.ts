import type { MatchData } from "../../sources/model";
import type { StoryPreferences, Mode } from "../../intelligence";
import type { DirectorResult } from "./runner";
import { DIRECTOR_VERSION } from "./observer";
import { sharedTasks } from "../wait";

// MatchData is immutable in the UI; object identity separates canonical source
// revisions. Provider/model/version configuration is checked before each action.
const settled = new WeakMap<MatchData, Map<string, DirectorResult>>();
const pending = new WeakMap<
  MatchData,
  ReturnType<typeof sharedTasks<DirectorResult>>
>();
const keyFor = (
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
  context: string,
) =>
  JSON.stringify({
    version: DIRECTOR_VERSION,
    context,
    time,
    mode,
    team: preferences.team,
    player: preferences.player,
    categories: preferences.categories?.slice().sort(),
    seen: preferences.seenEvidenceIds?.slice().sort() ?? [],
  });
export function cachedDirectorResult(
  match: MatchData,
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
  context: string,
) {
  return (
    settled.get(match)?.get(keyFor(time, mode, preferences, context)) ?? null
  );
}
export function rememberDirectorResult(
  match: MatchData,
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
  result: DirectorResult,
) {
  // A deterministic failure response is useful for display, never a completed
  // AI investigation. Missing configuration also fails closed for cache reuse.
  if (result.failure || !result.cacheContext) return;
  const known = settled.get(match) ?? new Map<string, DirectorResult>();
  known.set(keyFor(time, mode, preferences, result.cacheContext), result);
  if (known.size > 12) known.delete(known.keys().next().value!);
  settled.set(match, known);
}
export async function requestDirector(
  match: MatchData,
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
  signal?: AbortSignal,
): Promise<DirectorResult> {
  signal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(60000),
  ]);
  signal?.throwIfAborted();
  // No inference: refresh an opaque configuration fingerprint so a model or
  // implementation change in an open tab cannot reuse a prior investigation.
  const configuration = await fetch("/api/insights", {
    cache: "no-store",
    signal,
  });
  if (!configuration.ok)
    throw new Error("Investigation configuration unavailable");
  const { directorContext } = await configuration.json();
  const context = typeof directorContext === "string" ? directorContext : "";
  signal?.throwIfAborted();
  const cached =
    context && cachedDirectorResult(match, time, mode, preferences, context);
  if (cached) return cached;
  let share = pending.get(match);
  if (!share) {
    share = sharedTasks<DirectorResult>();
    pending.set(match, share);
  }
  const key = keyFor(time, mode, preferences, context);
  return share(
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
        body: JSON.stringify({ ...source, time, mode, preferences }),
      });
      if (!response.ok) throw new Error("Briefing unavailable");
      const result: DirectorResult = await response.json();
      sharedSignal.throwIfAborted();
      if (
        !Array.isArray(result.stories) ||
        result.provenance?.cutoff !== time ||
        result.stories.some(
          (story) =>
            story.matchId !== match.id ||
            !Array.isArray(story.highlightedEventIds),
        )
      )
        throw new Error("Mismatched briefing");
      rememberDirectorResult(match, time, mode, preferences, result);
      return result;
    },
    signal,
  );
}
