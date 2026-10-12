import type { MatchData, NormalizedEvent } from "../../sources/model";
import type { HypothesisAssessment } from "./hypothesis";

export type CoverageStatus = "complete" | "partial" | "unavailable";
export function deliveryCoverage(eligible: number, returned: number) {
  return {
    status: (eligible === returned
      ? "complete"
      : returned
        ? "partial"
        : "unavailable") as CoverageStatus,
    eligible,
    returned,
    omitted: eligible - returned,
  };
}

/** Completeness of recorded fields, never a claim that the provider observed all play. */
export function sourceCoverage(match: MatchData, events: NormalizedEvent[]) {
  const shots = events.filter((e) => e.type === "shot");
  const passes = events.filter((e) => e.type === "pass");
  const recoveries = events.filter((e) => e.type === "recovery");
  const field = (
    sample: NormalizedEvent[],
    supported: boolean,
    present: (e: NormalizedEvent) => boolean,
  ) => {
    const known = supported ? sample.filter(present).length : 0;
    return {
      status: (!supported
        ? "unavailable"
        : known === sample.length
          ? "complete"
          : "partial") as CoverageStatus,
      eligible: sample.length,
      known,
      missing: sample.length - known,
    };
  };
  return {
    scope: "recorded-events-only" as const,
    providerCompleteness: "unknown" as const,
    eventCount: events.length,
    actors: field(events, true, (e) => e.actorId !== null),
    shotOutcomes: field(
      shots,
      match.capabilities.shotOutcomes,
      (e) => e.outcome !== undefined,
    ),
    actionLocations: field(
      events.filter((e) => ["pass", "carry", "shot"].includes(e.type)),
      true,
      (e) => e.position !== null,
    ),
    xg: field(
      shots,
      match.capabilities.xg,
      (e) =>
        e.xg !== undefined && Number.isFinite(e.xg) && e.xg >= 0 && e.xg <= 1,
    ),
    possession: field(
      events,
      match.capabilities.possession !== "unavailable",
      (e) => e.possessionId !== null,
    ),
    secondLevelTiming: field(
      events,
      true,
      (e) => e.source.precision !== "minute",
    ),
    shotLocations: field(shots, true, (e) => e.position !== null),
    recoveryLocations: field(
      recoveries,
      match.capabilities.ballRecoveries,
      (e) => e.position !== null,
    ),
    passOutcomes: field(passes, true, (e) => e.success !== undefined),
    passRecipients: field(
      passes,
      match.capabilities.passRecipients,
      (e) => !!e.recipientId,
    ),
    passCoordinates: field(passes, true, (e) => !!e.position && !!e.end),
  };
}

export function assessmentEventIds(assessment: HypothesisAssessment) {
  return [
    ...new Set(
      [
        ...assessment.supportingEvidence,
        ...assessment.limitingEvidence,
        ...assessment.contradictoryEvidence,
        ...assessment.measurements,
        ...assessment.verificationChecks,
      ].flatMap((item) => item.eventIds),
    ),
  ];
}
