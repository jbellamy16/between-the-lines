import type { MatchData } from "./sources/model";

export const viewingKey = (match: MatchData) =>
  `btl-viewed-v1:${match.id}:${match.provenance.adapterVersion}:${match.provenance.revision ?? "unversioned"}`;
export function readViewingPosition(
  raw: string | null,
  duration: number,
): number | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value?.version === 1 &&
      typeof value.position === "number" &&
      Number.isFinite(value.position) &&
      value.position >= 0 &&
      value.position <= duration
      ? value.position
      : null;
  } catch {
    return null;
  }
}
export function missedSince(position: number | null, cutoff: number) {
  return position !== null && position >= 0 && position < cutoff
    ? position
    : null;
}
