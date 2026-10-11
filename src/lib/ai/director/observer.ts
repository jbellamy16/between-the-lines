import type { Mode, StoryPreferences } from "../../intelligence";
import {
  matchClock,
  periodAt,
  type MatchData,
  type NormalizedEvent,
} from "../../sources/model";

export const DIRECTOR_VERSION = "director-1.2.0";
export type Claim = {
  id: string;
  headline: string;
  brief: string;
  detail: string;
  evidenceIds: string[];
  statistics: { label: string; value: number; unit: string }[];
  limitations: string[];
};
export type Candidate = Claim & {
  category:
    | "recovery-shot"
    | "passing-pair"
    | "shot-sequence"
    | "shot-location"
    | "substitute-involvement"
    | "activity-change"
    | "player-involvement"
    | "window-comparison";
  team: "harbor" | "riverside";
  timestamp: number;
  importance: "moment" | "pattern" | "major";
  rank: number; // editorial ordering only, never a probability
};
export const claimEmphasis = {
  "recovery-shot": "sequence",
  "shot-sequence": "sequence",
  "passing-pair": "contribution",
  "substitute-involvement": "contribution",
  "player-involvement": "contribution",
  "activity-change": "comparison",
  "shot-location": "comparison",
  "window-comparison": "comparison",
} as const satisfies Record<
  Candidate["category"],
  "sequence" | "comparison" | "contribution"
>;
export const EVIDENCE_LIMITS = [
  "Recorded actions only; no off-ball positions, intentions, formations or physical attacking direction.",
  "Relationships and equal-window comparisons are descriptive, not causal or statistically significant.",
  "Coordinates are normalized to the team performing the action; increasing x is toward its attacking goal.",
];
export function visibleEvents(match: MatchData, cutoff: number) {
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > match.duration)
    throw new Error("Invalid cutoff");
  return match.events.filter((e) => e.time <= cutoff);
}
/** Same team, period and possession; never join coincident IDs across halves. */
export function possessionBefore(
  match: MatchData,
  visible: NormalizedEvent[],
  shot: NormalizedEvent,
) {
  if (
    match.capabilities.possession === "unavailable" ||
    shot.possessionId === null
  )
    return [];
  return visible.filter(
    (e) =>
      e.team === shot.team &&
      e.period === shot.period &&
      e.possessionId === shot.possessionId &&
      e.order <= shot.order,
  );
}
export function observe(
  match: MatchData,
  cutoff: number,
  mode: Mode = "fan",
  preferences: StoryPreferences = {},
  options: { unranked?: boolean } = {},
): Candidate[] {
  const visible = visibleEvents(match, cutoff);
  const period = periodAt(match, cutoff);
  const recent = visible.filter(
    (e) => e.time > Math.max(period.start - 0.001, cutoff - 900),
  );
  const candidates: Candidate[] = [];
  const add = (
    category: Candidate["category"],
    team: Candidate["team"],
    evidence: NormalizedEvent[],
    headline: string,
    brief: string,
    detail: string,
    statistics: Claim["statistics"],
    rank: number,
    anchor?: string,
  ) => {
    const preferenceCategory =
      category === "recovery-shot" ||
      (category === "activity-change" &&
        statistics[0]?.label === "recoveries in the attacking third")
        ? "pressure"
        : ["passing-pair", "substitute-involvement"].includes(category)
          ? "rhythm"
          : "chances";
    if (
      preferences.categories &&
      !preferences.categories.includes(preferenceCategory)
    )
      return;
    if (!evidence.length || evidence.length > 120) return;
    const latest = evidence.at(-1)!;
    const limitations = [...EVIDENCE_LIMITS];
    if (match.capabilities.possession === "generated")
      limitations.push(
        "Possessions are generated synthetic sequences, not observed tracking.",
      );
    const seen = preferences.seenEvidenceIds ?? [];
    const overlap =
      evidence.filter((e) => seen.includes(e.id)).length / evidence.length;
    candidates.push({
      id: `${match.id}:${category}:${team}:${anchor ?? latest.id}`,
      category,
      team,
      timestamp: latest.time,
      importance: rank >= 9 ? "major" : rank >= 6 ? "pattern" : "moment",
      headline,
      brief,
      detail,
      statistics,
      limitations,
      evidenceIds: [...new Set(evidence.map((e) => e.id))],
      rank:
        rank +
        (preferences.team === team ? 2 : 0) +
        (evidence.some((e) => e.actorId === preferences.player) ? 2 : 0) +
        (mode === "analyst" && category === "activity-change" ? 1 : 0) -
        overlap * 8,
    });
  };
  for (const team of ["harbor", "riverside"] as const) {
    const name = match.teams[team].short;
    const own = recent.filter((e) => e.team === team);
    for (const shot of own.filter((e) => e.type === "shot").slice(-6)) {
      const shooter = match.players.find(
        (p) => p.id === shot.actorId && p.team === team,
      );
      const shotLabel = `${shooter?.name ?? name}'s shot at ${matchClock(match, shot.time)}`;
      const sequence = possessionBefore(match, visible, shot);
      const wins = sequence.filter(
        (e) =>
          e.order < shot.order &&
          ((e.type === "recovery" && e.success !== false) ||
            (["interception", "tackle"].includes(e.type) &&
              e.success === true)) &&
          shot.time - e.time <= 30,
      );
      const win = wins.at(-1);
      if (match.capabilities.ballRecoveries && win) {
        const seconds = Math.round((shot.time - win.time) * 10) / 10;
        add(
          "recovery-shot",
          team,
          sequence.filter((e) => e.order >= win.order),
          `${name}: recovery to shot`,
          `${name} won the ball at ${matchClock(match, win.time)} before ${shotLabel} in the same possession.`,
          `${name}'s recorded ${win.type} at ${matchClock(match, win.time)} was followed by ${shotLabel} in the same possession. ${win.source.precision === "minute" || shot.source.precision === "minute" ? "Source timestamps have minute precision; elapsed seconds are not claimed." : `The recorded interval was ${seconds} seconds.`} This is sequence evidence, not proof that the recovery caused the chance.`,
          win.source.precision === "minute" ||
            shot.source.precision === "minute"
            ? []
            : [
                {
                  label: "Recovery to shot",
                  value: seconds,
                  unit: "recorded seconds",
                },
              ],
          8,
          shot.id,
        );
      }
      const passes = sequence.filter(
        (e) => e.type === "pass" && e.success === true,
      );
      if (passes.length >= 4)
        add(
          "shot-sequence",
          team,
          sequence,
          `${name}: passing passage ends in a shot`,
          `${name} completed ${passes.length} passes in the possession before ${shotLabel}.`,
          `${name} completed ${passes.length} recorded passes before ${shotLabel}, within the same period and possession. Missing events or off-ball movements cannot be reconstructed.`,
          [
            {
              label: "Completed passes before shot",
              value: passes.length,
              unit: "events",
            },
          ],
          7,
          shot.id,
        );
    }
    if (match.capabilities.passRecipients) {
      const pairs = new Map<string, NormalizedEvent[]>();
      for (const e of own.filter(
        (e) =>
          e.type === "pass" && e.success === true && e.actorId && e.recipientId,
      )) {
        if (
          !match.players.some((p) => p.id === e.actorId && p.team === team) ||
          !match.players.some((p) => p.id === e.recipientId && p.team === team)
        )
          continue;
        const key = `${e.actorId}:${e.recipientId}`;
        pairs.set(key, [...(pairs.get(key) ?? []), e]);
      }
      const pair = [...pairs.values()].sort((a, b) => b.length - a.length)[0];
      if (pair && pair.length >= 3) {
        const from = match.players.find((p) => p.id === pair[0].actorId)!.name;
        const to = match.players.find(
          (p) => p.id === pair[0].recipientId,
        )!.name;
        add(
          "passing-pair",
          team,
          pair,
          `${name}: a repeated passing connection`,
          `${from} found ${to} with ${pair.length} completed passes from ${matchClock(match, Math.max(period.start, cutoff - 900))} to ${matchClock(match, cutoff)}.`,
          `${pair.length} recorded successful passes from ${from} to ${to} between ${matchClock(match, Math.max(period.start, cutoff - 900))} and ${matchClock(match, cutoff)}. This is a directional pairing, not a measure of movement or chemistry.`,
          [
            {
              label: "Completed passes in pair",
              value: pair.length,
              unit: "events",
            },
          ],
          6,
          `${pair[0].id}`,
        );
      }
    }
    if (match.capabilities.substitutions) {
      for (const sub of own.filter((e) => e.type === "substitution")) {
        const actor = match.players.find(
          (p) => p.id === sub.playerId && p.team === team,
        );
        if (!actor) continue;
        const involvement = own.filter(
          (e) =>
            e.order > sub.order &&
            e.actorId === actor.id &&
            ["pass", "carry", "shot", "recovery", "interception"].includes(
              e.type,
            ),
        );
        const shots = involvement.filter((e) => e.type === "shot").length;
        if (involvement.length >= 3)
          add(
            "substitute-involvement",
            team,
            [sub, ...involvement],
            `${actor.name}: involvement after coming on`,
            `${actor.name} has ${involvement.length} recorded on-ball actions since coming on at ${matchClock(match, sub.time)}${shots ? `, including ${shots} ${shots === 1 ? "shot" : "shots"}` : ""}.`,
            `${actor.name} came on at ${matchClock(match, sub.time)} and has ${involvement.length} recorded passes, carries, shots, recoveries or interceptions since then. This does not establish a substitution effect or compare unequal playing time.`,
            [
              {
                label: "Recorded involvements",
                value: involvement.length,
                unit: "events",
              },
              { label: "Shots", value: shots, unit: "events" },
            ],
            shots ? 8 : 5,
            sub.id,
          );
      }
    }
    // Two complete, equal windows entirely inside the current period.
    const width = Math.min(900, Math.floor((cutoff - period.start) / 2));
    // Allow a useful early-half comparison without crossing the interval break
    // or comparing a partial window against a full 15 minutes.
    if (width >= 300) {
      const current = visible.filter(
        (e) =>
          e.team === team && e.period === period.id && e.time > cutoff - width,
      );
      const prior = visible.filter(
        (e) =>
          e.team === team &&
          e.period === period.id &&
          e.time > cutoff - 2 * width &&
          e.time <= cutoff - width,
      );
      const metrics = [
        {
          label: "shots",
          test: (e: NormalizedEvent) => e.type === "shot",
          min: 3,
          delta: 2,
        },
        {
          label: "recoveries in the attacking third",
          test: (e: NormalizedEvent) =>
            match.capabilities.ballRecoveries &&
            (e.position?.x ?? -1) >= 66.7 &&
            e.type === "recovery" &&
            e.success !== false,
          min: 2,
          delta: 2,
        },
        {
          label: "attacking-third actions",
          test: (e: NormalizedEvent) =>
            ["pass", "carry", "shot"].includes(e.type) &&
            (e.position?.x ?? -1) >= 66.7,
          min: 8,
          delta: 5,
        },
        {
          label: "forward passes",
          test: (e: NormalizedEvent) =>
            e.type === "pass" &&
            !!e.position &&
            !!e.end &&
            e.end.x > e.position.x + 5,
          min: 8,
          delta: 5,
        },
      ];
      for (const metric of metrics) {
        const a = current.filter(metric.test),
          b = prior.filter(metric.test);
        if (
          a.length >= metric.min &&
          a.length - b.length >= metric.delta &&
          a.length >= b.length * 1.5
        )
          add(
            "activity-change",
            team,
            [...b, ...a],
            `${name}: more ${metric.label}`,
            `${name} recorded ${a.length} ${metric.label} from ${matchClock(match, cutoff - width)} to ${matchClock(match, cutoff)}, compared with ${b.length} in the preceding equal window.`,
            `${name}: ${a.length} ${metric.label} (${matchClock(match, cutoff - width)}–${matchClock(match, cutoff)}) versus ${b.length} (${matchClock(match, cutoff - 2 * width)}–${matchClock(match, cutoff - width)}). Each window is ${width} seconds in ${period.id}; this is descriptive, not evidence of cause.${metric.label === "forward passes" ? " Forward is measured in normalized action coordinates, not physical stadium direction." : ""}`,
            [
              {
                label: metric.label,
                value: a.length,
                unit: `events / ${width} seconds`,
              },
              {
                label: `Previous ${metric.label}`,
                value: b.length,
                unit: `events / ${width} seconds`,
              },
            ],
            metric.label === "shots" ||
              metric.label === "recoveries in the attacking third"
              ? 9
              : 7,
            `${metric.label}:${a[0]?.id}`,
          );
      }
      const a = current.filter((e) => e.type === "shot" && e.position),
        b = prior.filter((e) => e.type === "shot" && e.position);
      if (a.length >= 3 && b.length >= 3) {
        const mean = (es: NormalizedEvent[]) =>
          Math.round(es.reduce((s, e) => s + e.position!.x, 0) / es.length);
        if (Math.abs(mean(a) - mean(b)) >= 10)
          add(
            "shot-location",
            team,
            [...b, ...a],
            `${name}: shot origins have shifted`,
            `${name}'s recent shots started ${mean(a) > mean(b) ? "farther forward" : "farther back"} on the normalized pitch.`,
            `${name}: mean shot-origin x ${mean(a)} versus ${mean(b)} on the 0–100 normalized pitch in consecutive ${width}-second windows ending at ${matchClock(match, cutoff)}, with ${a.length} and ${b.length} located shots. This is not shot quality, distance to goal or physical attacking direction.`,
            [
              {
                label: "Recent mean x",
                value: mean(a),
                unit: "normalized percent",
              },
              {
                label: "Previous mean x",
                value: mean(b),
                unit: "normalized percent",
              },
            ],
            6,
            a[0].id,
          );
      }
    }
  }
  // Independent publication verification needs the complete computation set,
  // including candidates outside a viewer's personalized editorial shortlist.
  if (options.unranked) return candidates;
  return candidates
    .filter((c) => c.rank >= 4)
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.timestamp - a.timestamp ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 12);
}
