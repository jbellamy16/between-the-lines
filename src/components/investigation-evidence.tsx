import type { BroadcastStory } from "@/lib/ai/director/story";
import type { ExplanationStyle, StoryWording } from "@/lib/explanation";
import { eventClock, type MatchData } from "@/lib/sources/model";
import { singularCounts } from "@/lib/plural";

export function InvestigationEvidence({
  story,
  match,
  wording,
  style,
  onEvent,
}: {
  story: BroadcastStory;
  match: MatchData;
  wording: StoryWording;
  style: ExplanationStyle;
  onEvent: (id: string) => void;
}) {
  const assessment = story.hypothesis;
  const supportIds = new Set(
    assessment.supportingEvidence.flatMap((e) => e.eventIds),
  );
  const events = match.events.filter(
    (e) => e.time <= story.cutoff && supportIds.has(e.id),
  );
  const contrary = new Set(assessment.contradictoryEvidence.map((e) => e.code));
  const challenges = wording.qualifications.filter(
    (q) => contrary.has(q.code) || q.code === "storyline-eased",
  );
  const limits = wording.qualifications.filter((q) => !challenges.includes(q));
  return (
    <div className="investigation-evidence">
      <section aria-label="Supporting evidence">
        <h3>Evidence that supports it</h3>
        <p>
          {events.length} recorded {events.length === 1 ? "action" : "actions"}
          {assessment.windows.some((w) => w.id === "previous")
            ? " across the compared windows."
            : " behind this observation."}
        </p>
        {style === "analysis" &&
          assessment.supportingEvidence
            .filter(
              (e) =>
                !["recorded-observation", "current-shot-outcomes"].includes(
                  e.code,
                ),
            )
            .map((e) => <p key={e.code}>{e.description}</p>)}
      </section>
      <section
        className="investigation-challenges"
        aria-label="Counter-evidence and limits"
      >
        <h3>What challenges it</h3>
        {challenges.length ? (
          challenges.map((q) => {
            const evidence = assessment.contradictoryEvidence.find(
              (e) => e.code === q.code,
            );
            const event = match.events.findLast(
              (e) =>
                e.time <= story.cutoff && evidence?.eventIds.includes(e.id),
            );
            return (
              <div key={q.code}>
                <p>{singularCounts(q.text)}</p>
                {event && (
                  <button
                    className="text-button"
                    onClick={() => onEvent(event.id)}
                  >
                    Replay counter-evidence · {eventClock(match, event)}
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <p>
            No counter-evidence identified in this sample. That does not prove
            the interpretation.
          </p>
        )}
        {limits.map((q) => (
          <p key={q.code}>
            <strong>Missing context: </strong>
            {singularCounts(q.text)}
          </p>
        ))}
        {!limits.length && assessment.missingInformation.length > 0 && (
          <p className="investigation-limit">
            Recorded actions cannot explain intent or show movement away from
            the ball.
          </p>
        )}
      </section>
    </div>
  );
}
