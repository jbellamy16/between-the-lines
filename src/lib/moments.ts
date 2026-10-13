import {
  editorialGroup,
  isMatchState,
  selectLeadCandidate,
} from "./ai/director/editorial";
import { claimEmphasis, observe } from "./ai/director/observer";
import { packageStory, type BroadcastStory } from "./ai/director/story";
import { presentStory } from "./explanation";
import type { Mode, StoryPreferences } from "./intelligence";
import type { MatchData } from "./sources/model";

/** Moments are sampled on a fixed grid so seeking never changes what was found. */
export const MOMENT_STEP_SECONDS = 10;
/** The same story wording within this span is the story continuing, not a new moment. */
export const MOMENT_REPEAT_SECONDS = 600;

export type MatchMoment = {
  id: string;
  matchId: string;
  /** Grid position where the moment was found; the viewer jumps here. */
  time: number;
  kind: "goal" | "full-time" | "story";
  /** The lead story at `time`, packaged from events up to `time` only. */
  story: BroadcastStory;
};

/**
 * A moment is the lead story starting or changing its headline: a new
 * storyline, a goal, full time, or a change such as an increase easing.
 * Each sample reads only events up to that sample, the same lead the story
 * card shows. Scanning is incremental and never looks past the furthest
 * position requested, so callers filter by the viewer's position and never
 * hold a moment from later in the match.
 */
export function createMomentScanner(
  match: MatchData,
  mode: Mode,
  preferences: StoryPreferences = {},
) {
  const moments: MatchMoment[] = [];
  const lastShown = new Map<string, number>();
  let next = 0,
    currentKey: string | null = null;
  function sample(t: number) {
    const lead = selectLeadCandidate(observe(match, t, mode, preferences));
    if (!lead) {
      currentKey = null;
      return;
    }
    let story: BroadcastStory;
    try {
      story = packageStory(
        lead,
        match,
        t,
        mode,
        "offline",
        "brief",
        claimEmphasis[lead.category],
      );
    } catch {
      // The story card cannot show an unverified story; neither can a moment.
      return;
    }
    const thread = isMatchState(lead) ? lead.id : editorialGroup(lead);
    const key = `${thread}|${presentStory(story, match, "plain").headline}`;
    if (key === currentKey) return;
    currentKey = key;
    const shown = lastShown.get(key);
    if (shown !== undefined && t - shown < MOMENT_REPEAT_SECONDS) return;
    lastShown.set(key, t);
    moments.push({
      id: `${match.id}:moment:${t}`,
      matchId: match.id,
      time: t,
      kind:
        lead.category === "full-time"
          ? "full-time"
          : lead.category === "score-change"
            ? "goal"
            : "story",
      story,
    });
  }
  return {
    /** Scan forward to `cutoff`. Positions already scanned are not revisited. */
    advance(cutoff: number) {
      const end = Math.min(cutoff, match.duration);
      for (; next <= end; next += MOMENT_STEP_SECONDS) sample(next);
    },
    /** Whether positions up to `cutoff` still need scanning. */
    behind(cutoff: number) {
      return next <= Math.min(cutoff, match.duration);
    },
    /** The furthest position scanned so far (-1 before the first sample). */
    scannedThrough() {
      return next - MOMENT_STEP_SECONDS;
    },
    /** Moments at or before the viewer's position. */
    through(cutoff: number) {
      return moments.filter((m) => m.time <= cutoff);
    },
  };
}

export function momentsThrough(
  match: MatchData,
  cutoff: number,
  mode: Mode,
  preferences: StoryPreferences = {},
) {
  const scanner = createMomentScanner(match, mode, preferences);
  scanner.advance(cutoff);
  return scanner.through(cutoff);
}

/** A moment that arrived as playback moved from `from` (exclusive) to `to`. */
export function arrivedMoment(
  moments: MatchMoment[],
  from: number,
  to: number,
) {
  return moments.findLast((m) => m.time > from && m.time <= to) ?? null;
}
