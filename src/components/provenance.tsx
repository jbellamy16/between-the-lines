import { eventLabel } from "@/lib/event-label";
import { AnimatedDetails } from "./motion";
import type { Provenance } from "@/lib/ai/service";
import { clock, player, type MatchEvent } from "@/lib/match";
import type { Insight } from "@/lib/intelligence";
export const providerLabel = (value: string) =>
  value === "openai"
    ? "OpenAI"
    : value === "foundry"
      ? "Microsoft Foundry"
      : "Deterministic offline";
export function ProvenanceDetails({
  provenance,
  events,
  insights,
}: {
  provenance: Provenance;
  events: MatchEvent[];
  insights: Insight[];
}) {
  const ids = new Set(provenance.facts.flatMap((f) => f.evidenceIds));
  const evidence = events.filter(
    (e) => ids.has(e.id) && e.time <= provenance.cutoff,
  );
  return (
    <AnimatedDetails className="provenance">
      <summary>How Between the Lines knows</summary>
      <div
        className="provenance-content"
        tabIndex={0}
        aria-label="Explanation evidence and limitations"
      >
        <strong>
          {providerLabel(provenance.provider)}
          {provenance.model ? ` (${provenance.model})` : ""}
        </strong>
        <p>
          Through {clock(provenance.cutoff)}
          {provenance.cached ? ". Reused a validated response" : ""}.{" "}
          {provenance.provider !== "offline"
            ? "AI chose supporting observations; Between the Lines supplied required match context."
            : "Computed directly from recorded events."}
        </p>
        <h3>Detected observations</h3>
        {provenance.facts.map((f) => (
          <p key={f.id}>{f.text}</p>
        ))}
        {!!insights.length && (
          <>
            <h3>Measurement notes</h3>
            <p>
              Equal-duration windows and descriptive thresholds, not a
              statistical significance test. Coordinates are normalized to the
              attacking team. Recorded actions do not show off-ball positioning
              or establish cause and effect.
            </p>
            <h3>Statistical comparisons</h3>
            {insights.map((i) => (
              <p key={i.id}>
                {i.metric}: {i.current} vs {i.previous}. Windows{" "}
                {clock(i.start)}–{clock(i.end)} and{" "}
                {clock(i.start - (i.end - i.start))}–{clock(i.start)}.
              </p>
            ))}
          </>
        )}
        <h3>Supporting events ({evidence.length})</h3>
        <ul
          className="provenance-events"
          tabIndex={0}
          aria-label="Supporting recorded events"
        >
          {evidence.map((e) => (
            <li key={e.id}>
              {clock(e.time)} {eventLabel(e.type)} by {player(e.playerId).name}{" "}
              <small>{e.id}</small>
            </li>
          ))}
        </ul>
        {!evidence.length && (
          <p>
            No supporting event is claimed for an absence of a pattern or a
            scoreless opening.
          </p>
        )}
        <h3>Evidence validation</h3>
        <ul>
          {provenance.validation.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
        <h3>Tool activity</h3>
        {provenance.activity.length ? (
          <ul>
            {provenance.activity.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : (
          <p>No completed AI tool activity is recorded for this explanation.</p>
        )}
        <h3>Known limitations</h3>
        <ul>
          {provenance.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </AnimatedDetails>
  );
}
