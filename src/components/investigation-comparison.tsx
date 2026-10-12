import type { QuestionEvidence } from "@/lib/ai/director/questions";
import type { MatchData } from "@/lib/sources/model";

/** Layout only: every value and interpretation comes from the verified result. */
export function InvestigationComparison({
  evidence,
  match,
}: {
  evidence: QuestionEvidence;
  match: MatchData;
}) {
  const comparison = evidence.comparison;
  if (!comparison) return null;
  const { routes, interpretations } = comparison;
  const a = routes.previous,
    b = routes.current;
  const known = (value: number | null) => (value === null ? "Unknown" : value);
  const opponent = (window: string) =>
    evidence.measurements.find((m) => m.id === `opponent-${window}`)?.value ??
    null;
  return (
    <div className="investigation-comparison">
      {routes.suppressed ? (
        <p>
          The complete route comparison exceeds the evidence limit and is
          unavailable.
        </p>
      ) : (
        <>
          <table>
            <caption>
              {match.teams[evidence.team].short} · Compared windows
            </caption>
            <thead>
              <tr>
                <th scope="col">Recorded measure</th>
                <th scope="col">Earlier</th>
                <th scope="col">Current</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Shots", a.shots, b.shots],
                  [
                    "Shots after qualifying ball wins",
                    a.linkedShots,
                    b.linkedShots,
                  ],
                  [
                    "Distinct linked possessions",
                    a.linkedPossessions,
                    b.linkedPossessions,
                  ],
                  ["Opponent shots", opponent("previous"), opponent("current")],
                ] as const
              ).map(([label, previous, current]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{known(previous)}</td>
                  <td>{known(current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Largest current shot group: {known(b.largestPossession)} of{" "}
            {b.shots}. Shots in the first half of this spell: {b.early}; second
            half: {b.late}.
          </p>
        </>
      )}
      <ul className="investigation-readings" aria-label="Possible explanations">
        {interpretations.map((reading) => (
          <li key={reading.id}>
            <strong>
              {reading.status === "supported"
                ? "Supported by events"
                : reading.status === "limited"
                  ? "Not established"
                  : "Unresolved"}
            </strong>
            <p>{reading.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
