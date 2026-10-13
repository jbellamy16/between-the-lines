"use client";
import { useEffect, useRef, useState } from "react";
import type { MatchData } from "@/lib/sources/model";
import { matchClock, eventClock } from "@/lib/sources/model";
import type { ExplicitInvestigation } from "@/lib/ai/director/explicit-investigation";
import { presentStory } from "@/lib/explanation";
import { presentQuestion } from "@/lib/ai/director/questions";
import { useExplanationStyle } from "./explanation-preference";
import { InvestigationComparison } from "./investigation-comparison";

const reasons: Record<string, string> = {
  disabled: "Foundry investigation is disabled. No model request was made.",
  controls: "Shared spending controls are unavailable or busy.",
  budget: "The investigation reached its spending or usage limit.",
  "provider-failure": "The model request failed.",
  "invalid-plan": "Independent verification rejected the model result.",
  deadline: "The investigation reached its time limit.",
  capability: "Foundry investigation is available only for synthetic matches.",
};
export function FoundryInvestigation({
  match,
  time,
  onExplore,
  onEvent,
}: {
  match: MatchData;
  time: number;
  onExplore: () => void;
  onEvent: (id: string) => void;
}) {
  const style = useExplanationStyle();
  const [result, setResult] = useState<ExplicitInvestigation | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setResult(null);
    setNotice("");
    setBusy(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [match, time]);
  async function investigate() {
    onExplore();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setNotice("");
    setResult(null);
    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(60000),
        ]),
        body: JSON.stringify({
          action: "investigate-with-microsoft-foundry",
          scenario: match.provenance.raw.scenario,
          profile: match.provenance.raw.profile,
          time,
        }),
      });
      if (!response.ok) throw new Error("Unavailable");
      const answer: ExplicitInvestigation = await response.json();
      if (answer.matchId !== match.id || answer.receipt.cutoff !== time)
        throw new Error("Mismatched answer");
      if (request.current === controller && !controller.signal.aborted)
        setResult(answer);
    } catch {
      if (request.current === controller && !controller.signal.aborted)
        setNotice(
          "Foundry could not finish. The deterministic explanation above remains available.",
        );
    } finally {
      if (request.current === controller) {
        setBusy(false);
        request.current = null;
      }
    }
  }
  if (match.kind !== "synthetic") return null;
  const verified =
    result?.receipt.disposition === "model-selection" &&
    result.receipt.verification === "passed";
  return (
    <section
      className="guided-investigation foundry-investigation"
      aria-label="Microsoft Foundry investigation"
    >
      <h3>Investigate this moment</h3>
      <p>
        Use Microsoft Foundry to select evidence and test competing readings
        through {matchClock(match, time)}. Runs only when requested.
      </p>
      <button
        className="question-button"
        disabled={busy}
        onClick={() => void investigate()}
      >
        Investigate with Microsoft Foundry
      </button>
      {busy && (
        <button
          className="text-button"
          onClick={() => {
            request.current?.abort();
            request.current = null;
            setBusy(false);
            setNotice(
              "Investigation cancelled. The deterministic explanation remains available.",
            );
          }}
        >
          Cancel Foundry investigation
        </button>
      )}
      {(busy || notice) && (
        <p role="status" aria-live="polite">
          {busy
            ? "Investigating selected evidence; the deterministic explanation remains available…"
            : notice}
        </p>
      )}
      {result && (
        <div className="question-answer">
          <h4>
            {verified
              ? "Verified Foundry investigation"
              : "Deterministic fallback"}
          </h4>
          <p>
            {verified
              ? "The model selected the focus and evidence. Application code calculated and rendered the facts."
              : (reasons[result.receipt.stop.reason] ??
                "No verified model conclusion was published.")}
          </p>
          {result.receipt.cached && (
            <p>
              Previously completed model investigation, independently rechecked
              for this request. No new model call.
            </p>
          )}
          <h5 className="investigation-heading">Supported conclusion</h5>
          {!result.stories.length && (
            <p>No supported development is available at this moment.</p>
          )}
          {result.stories.map((story) => {
            const wording = presentStory(story, match, style);
            return (
              <div key={story.storyId}>
                <strong>{wording.headline}</strong>
                <p>{wording.explanation}</p>
                {story.limitations.map((text) => (
                  <p className="story-qualification" key={text}>
                    {text}
                  </p>
                ))}
              </div>
            );
          })}
          <h5 className="investigation-heading">
            Competing readings and counter-evidence
          </h5>
          {result.answers.map((answer) => {
            const wording = presentQuestion(answer, match, style);
            return (
              <div key={`${answer.question.storyId}:${answer.question.intent}`}>
                <p>
                  <strong>{wording.answer}</strong>
                </p>
                {answer.comparison ? (
                  <InvestigationComparison
                    evidence={answer}
                    match={match}
                    style={style}
                  />
                ) : (
                  <p>{wording.measurement}</p>
                )}
                {wording.qualifications.map((q) => (
                  <p className="story-qualification" key={q}>
                    {q}
                  </p>
                ))}
              </div>
            );
          })}
          {!result.answers.length && (
            <p>
              No additional guided comparisons are available for this focus.
            </p>
          )}
          <details>
            <summary>Which evidence was investigated?</summary>
            <h5>Deterministic calculations</h5>
            <p>Verified B2 evidence supplied before model selection:</p>
            <ul>
              {result.initialEvidence.map((e) => (
                <li key={e.optionId}>
                  {e.label} · {e.coverage.bundle}
                </li>
              ))}
            </ul>
            <h5>Model-directed decisions</h5>
            {result.investigatedEvidence.length ? (
              <ol>
                {result.investigatedEvidence.map((entry, i) => (
                  <li key={i}>
                    {entry.label} · purpose:{" "}
                    {entry.action.purpose.replaceAll("-", " ")} · coverage:{" "}
                    {entry.coverage.bundle}
                    <ul>
                      {entry.evidenceIds.map((id) => {
                        const event = match.events.find(
                          (e) => e.id === id && e.time <= time,
                        );
                        return event ? (
                          <li key={id}>
                            <button
                              className="text-button"
                              onClick={() => onEvent(id)}
                            >
                              {eventClock(match, event)} ·{" "}
                              {event.type.replaceAll("_", " ")} · Replay
                            </button>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No model-selected follow-up retrieval was completed.</p>
            )}
            <h5>Independent verification</h5>
            <p>
              {result.receipt.verification === "passed"
                ? "Canonical evidence replay and final publication checks passed."
                : result.receipt.verification === "rejected"
                  ? "Model result rejected; deterministic evidence retained."
                  : "No model result was available for verification."}
            </p>
            <h5>Stopping decision and unresolved interpretations</h5>
            <p>
              {result.receipt.stop.origin === "model"
                ? "Model chose to stop"
                : result.receipt.stop.origin === "application"
                  ? "Application stopped the workflow"
                  : "Deterministic stopping decision"}
              : {result.receipt.stop.reason.replaceAll("-", " ")}.{" "}
              {result.receipt.stop.voluntary
                ? "Voluntary model stop."
                : "No voluntary model stop credited."}
            </p>
            {result.receipt.plan && (
              <p>
                Model’s proposed stop:{" "}
                {result.receipt.plan.stop.replaceAll("-", " ")}. All limitations
                above remain in effect.
              </p>
            )}
            <h5>Comparison with B2</h5>
            <p>{result.comparison}</p>
            <ul>
              {result.baseline.stories.map((story) => (
                <li key={story.storyId}>
                  {presentStory(story, match, style).headline}
                </li>
              ))}
            </ul>
            <p>
              {result.receipt.attempts} HTTP attempts in the original
              investigation · {result.receipt.usage.inputTokens} reported input
              tokens · {result.receipt.usage.outputTokens} reported output
              tokens · usage{" "}
              {result.receipt.usage.complete ? "complete" : "incomplete"} ·{" "}
              {(result.latencyMs / 1000).toFixed(1)}s for this request.
            </p>
            <p>
              Reserved this request: ${result.spending.reservedUsd.toFixed(2)}.
              Token cost estimate:{" "}
              {result.spending.estimatedUsd === null
                ? "unknown"
                : `$${result.spending.estimatedUsd.toFixed(5)}`}
              . {result.spending.estimateBasis}
            </p>
          </details>
          <button
            className="text-button"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(result, null, 2)], {
                  type: "application/json",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = `foundry-investigation-${result.receiptId}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download investigation receipt
          </button>
        </div>
      )}
    </section>
  );
}
