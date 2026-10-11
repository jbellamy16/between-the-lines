import type { MatchData } from "../../sources/model";
import type { StoryPreferences, Mode } from "../../intelligence";
import type { DirectorResult } from "./runner";
import { DIRECTOR_VERSION } from "./observer";

// Weak identity includes the complete canonical evidence object; results cannot cross source revisions.
const settled = new WeakMap<MatchData, Map<string, DirectorResult>>();
const cache = new WeakMap<MatchData, Map<string, Promise<DirectorResult>>>();
const keyFor = (time: number, mode: Mode, preferences: StoryPreferences) =>
  JSON.stringify({
    version: DIRECTOR_VERSION,
    time,
    mode,
    team: preferences.team,
    player: preferences.player,
    categories: preferences.categories?.slice().sort(),
    seen: preferences.seenEvidenceIds?.slice().sort() ?? [],
  });
function entries(match: MatchData) {
  let result = cache.get(match);
  if (!result) {
    result = new Map();
    cache.set(match, result);
  }
  return result;
}
export function cachedDirectorResult(
  match: MatchData,
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
) {
  return settled.get(match)?.get(keyFor(time, mode, preferences)) ?? null;
}
export function rememberDirectorResult(
  match: MatchData,
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
  result: DirectorResult,
) {
  const known = settled.get(match) ?? new Map<string, DirectorResult>();
  known.set(keyFor(time, mode, preferences), result);
  if (known.size > 12) known.delete(known.keys().next().value!);
  settled.set(match, known);
  const values = entries(match);
  values.set(keyFor(time, mode, preferences), Promise.resolve(result));
  if (values.size > 12) values.delete(values.keys().next().value!);
}
export function requestDirector(
  match: MatchData,
  time: number,
  mode: Mode,
  preferences: StoryPreferences,
): Promise<DirectorResult> {
  const values = entries(match),
    key = keyFor(time, mode, preferences);
  const cached = values.get(key);
  if (cached) return cached;
  const source =
    match.kind === "synthetic"
      ? {
          scenario: match.provenance.raw.scenario,
          profile: match.provenance.raw.profile,
        }
      : { matchId: match.id };
  const pending = fetch("/api/director", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...source, time, mode, preferences }),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Briefing unavailable");
      const result: DirectorResult = await response.json();
      if (!Array.isArray(result.stories) || result.provenance?.cutoff !== time)
        throw new Error("Mismatched briefing");
      rememberDirectorResult(match, time, mode, preferences, result);
      return result;
    })
    .catch((error) => {
      values.delete(key);
      throw error;
    });
  values.set(key, pending);
  if (values.size > 12) values.delete(values.keys().next().value!);
  return pending;
}
