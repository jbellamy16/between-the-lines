import type { Candidate } from "./observer";
import type { EditorialPlan } from "./story";

export function isMatchState(claim: Pick<Candidate, "category">) {
  return claim.category === "full-time" || claim.category === "score-change";
}

/** Routine contributions remain inspectable, but cannot create a lead by themselves. */
export function canLead(claim: Candidate) {
  if (isMatchState(claim)) return true;
  if (
    ["passing-pair", "player-involvement", "substitute-involvement"].includes(
      claim.category,
    )
  )
    return claim.statistics.some(
      (stat) => stat.label === "Shots" && stat.value >= 2,
    );
  if (
    claim.category === "activity-change" ||
    claim.category === "window-comparison"
  )
    return ["shots", "ball wins in the attacking third"].includes(
      claim.statistics[0]?.label.toLowerCase().replace(/^current /, ""),
    );
  // A single ordinary passing passage is useful evidence, not a new match development.
  return (
    claim.category === "recovery-shot" || claim.category === "shot-location"
  );
}

export function selectLeadCandidate(candidates: Candidate[]) {
  return candidates.find(isMatchState) ?? candidates.find(canLead);
}

/** Group equivalent observations even when their events or query windows differ. */
export function editorialGroup(claim: Candidate) {
  if (["activity-change", "window-comparison"].includes(claim.category)) {
    const metric =
      claim.statistics[0]?.label.toLowerCase().replace(/^current /, "") ??
      claim.category;
    return `${claim.team}:comparison:${metric}`;
  }
  return `${claim.team}:${claim.category}`;
}

export function evidenceOverlaps(a: Candidate, b: Candidate) {
  const intersection = a.evidenceIds.filter((id) =>
    b.evidenceIds.includes(id),
  ).length;
  return (
    intersection / Math.min(a.evidenceIds.length, b.evidenceIds.length) > 0.65
  );
}

/** Preserve the model's order; don't pad a recap with another version of a story. */
export function distinctEditorialStories(
  plan: EditorialPlan,
  claims: Candidate[],
) {
  const seen = new Set<string>();
  return plan.stories.filter((story) => {
    const claim = claims.find((c) => c.id === story.claimId)!;
    const group = editorialGroup(claim);
    if (seen.has(group)) return false;
    seen.add(group);
    return true;
  });
}
