import { z } from "zod";
import type { Mode } from "../../intelligence";
import { periodAt, type MatchData } from "../../sources/model";
import type { ProviderMode } from "../providers";
import { DIRECTOR_VERSION, claimEmphasis, type Candidate } from "./observer";
import { evidenceOverlaps } from "./editorial";
import { evaluateHypothesis, type HypothesisAssessment } from "./hypothesis";
import { reconstructStorylines, type TemporalStoryline } from "./storylines";
import { buildIntelligenceGraph, type IntelligenceGraph } from "./graph";

export const editorialSchema = z
  .object({
    decision: z.enum(["publish", "abstain"]),
    stories: z
      .array(
        z
          .object({
            claimId: z.string().max(300),
            form: z.enum(["brief", "detail"]),
            emphasis: z.enum(["sequence", "comparison", "contribution"]),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
export type EditorialPlan = z.infer<typeof editorialSchema>;
export type BroadcastStory = {
  schemaVersion: "1.1.0";
  storyId: string;
  matchId: string;
  cutoff: number;
  timestamp: number;
  headline: string;
  explanation: string;
  whatChanged: string;
  whyItMatters: string;
  watchNext: string;
  hypothesis: HypothesisAssessment;
  storyline: TemporalStoryline | null;
  intelligenceGraph: IntelligenceGraph;
  category: Candidate["category"];
  claimIds: string[];
  statistics: Candidate["statistics"];
  evidenceEventIds: string[];
  coordinates: { eventId: string; x: number; y: number; type: string }[];
  audience: Mode;
  visualization: "sequence" | "comparison" | "contribution";
  presentation: { earliest: number; expires: number; durationSeconds: number };
  limitations: string[];
  provider: ProviderMode;
  validation: "verified";
  evidenceQuality: "recorded-events";
  source: { provider: string; revision: string | null; attribution: string };
  promptVersion: string;
};
export function packageStory(
  candidate: Candidate,
  match: MatchData,
  cutoff: number,
  mode: Mode,
  provider: ProviderMode,
  form: "brief" | "detail" = mode === "fan" ? "brief" : "detail",
  emphasis: BroadcastStory["visualization"] = "sequence",
): BroadcastStory {
  const hypothesis = evaluateHypothesis(match, cutoff, candidate);
  if (
    !["confirmed-observation", "supported-interpretation"].includes(
      hypothesis.verificationStatus,
    )
  )
    throw new Error("Story hypothesis verification failed");
  const contextEvidence = [
    ...hypothesis.supportingEvidence.map((evidence) => ({
      ...evidence,
      relationship: "supported-by" as const,
    })),
    ...hypothesis.limitingEvidence.map((evidence) => ({
      ...evidence,
      relationship: "limited-by" as const,
    })),
    ...hypothesis.contradictoryEvidence.map((evidence) => ({
      ...evidence,
      relationship: "contradicted-by" as const,
    })),
  ];
  const evidenceIds = [
    ...new Set([
      ...candidate.evidenceIds,
      ...contextEvidence.flatMap((evidence) => evidence.eventIds),
      ...hypothesis.measurements.flatMap((measurement) => measurement.eventIds),
    ]),
  ];
  const events = evidenceIds.map((id) => match.events.find((e) => e.id === id));
  if (events.some((e) => !e || e.time > cutoff || e.matchId !== match.id))
    throw new Error("Story evidence violation");
  const storylines = reconstructStorylines(match, cutoff);
  const comparisonMetric = candidate.statistics[0]?.label
    .toLowerCase()
    .replace(/^current /, "");
  const storyline =
    storylines.find(
      (line) =>
        line.matchId === match.id &&
        line.cutoff === cutoff &&
        line.team === candidate.team &&
        (!["activity-change", "window-comparison"].includes(
          candidate.category,
        ) ||
          (comparisonMetric === "shots"
            ? line.metric === "shots"
            : comparisonMetric === "recoveries in the attacking third" &&
              line.metric === "attacking-third-recoveries")) &&
        line.evidenceIds.some((id) => candidate.evidenceIds.includes(id)),
    ) ?? null;
  const period = periodAt(match, cutoff);
  const nextAssessment =
    period.start + (Math.floor((cutoff - period.start) / 300) + 1) * 300;
  return {
    schemaVersion: "1.1.0",
    storyId: candidate.id,
    matchId: match.id,
    cutoff,
    timestamp: candidate.timestamp,
    headline: candidate.headline,
    explanation: candidate[form],
    whatChanged: candidate[form],
    whyItMatters: hypothesis.whyItMatters,
    watchNext:
      hypothesis.watchNext?.description ??
      "Full time. Revisit the recorded evidence.",
    hypothesis,
    storyline,
    intelligenceGraph: buildIntelligenceGraph(
      match,
      cutoff,
      candidate,
      hypothesis.hypothesis.id,
      hypothesis.windows,
      storyline?.id,
      contextEvidence,
      hypothesis.measurements,
    ),
    category: candidate.category,
    claimIds: [candidate.id],
    statistics: candidate.statistics,
    evidenceEventIds: evidenceIds,
    coordinates: events.flatMap((e) =>
      e?.position ? [{ eventId: e.id, ...e.position, type: e.type }] : [],
    ),
    audience: mode,
    visualization: emphasis,
    presentation: {
      earliest: cutoff,
      expires: Math.min(
        match.duration,
        cutoff + 180,
        ...(storyline ? [nextAssessment] : []),
      ),
      durationSeconds: mode === "fan" ? 8 : 14,
    },
    limitations: [
      ...new Set([
        ...match.limitations,
        ...candidate.limitations,
        ...hypothesis.limitingEvidence.map((evidence) => evidence.description),
      ]),
    ],
    provider,
    validation: "verified",
    evidenceQuality: "recorded-events",
    source: {
      provider: match.provenance.provider,
      revision: match.provenance.revision,
      attribution: match.attribution,
    },
    promptVersion: DIRECTOR_VERSION,
  };
}
export function validateEditorialPlan(
  raw: unknown,
  candidates: Candidate[],
  retrieved: Set<string>,
) {
  const plan = editorialSchema.parse(raw);
  if ((plan.decision === "abstain") !== !plan.stories.length)
    throw new Error("Invalid abstention");
  const seen = new Set<string>();
  for (const story of plan.stories) {
    const c = candidates.find((c) => c.id === story.claimId);
    if (!c || !retrieved.has(story.claimId) || seen.has(story.claimId))
      throw new Error("Uninvestigated or duplicate claim");
    if (story.emphasis !== claimEmphasis[c.category])
      throw new Error(`Invalid ${story.emphasis}`);
    for (const prior of candidates.filter((c) => seen.has(c.id))) {
      if (evidenceOverlaps(c, prior)) throw new Error("Overlapping stories");
    }
    seen.add(c.id);
  }
  return plan;
}
