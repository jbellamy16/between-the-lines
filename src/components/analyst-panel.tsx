"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { MatchData } from "@/lib/sources/model";
import { eventClock, matchClock } from "@/lib/sources/model";
import {
  QUESTION_MAX_LENGTH,
  suggestedQuestions,
  type AnalystResult,
  type AnalystStep,
  type AnalystStreamLine,
} from "@/lib/ai/analyst/types";
import type { BroadcastStory } from "@/lib/ai/director/story";
import {
  guidedQuestions,
  presentQuestion,
  questionEvidence,
  type QuestionIntent,
} from "@/lib/ai/director/questions";
import { singularCounts } from "@/lib/plural";
import { useExplanationStyle } from "./explanation-preference";
import { providerLabel } from "./provenance";
import { AnimatedDetails } from "./motion";
import { InvestigationComparison } from "./investigation-comparison";
import { Check, X } from "./icons";

type Asked = {
  question: string;
  cutoff: number;
  /** Set when the question is one of the story's checked questions. */
  checked?: { intent: QuestionIntent; storyId: string };
};

/**
 * Ask the Analyst: a free-text question answered by a tool-using agent.
 * The story's own questions are the starter chips: their checked answer
 * (deterministic, from recorded events) shows instantly and the agent adds
 * to it. Steps stream in as the agent works; only answers that pass the
 * grounding check are shown.
 */
export function AnalystPanel({
  match,
  time,
  provider,
  story = null,
  onExplore,
  onEvent,
}: {
  match: MatchData;
  time: number;
  provider: string;
  story?: BroadcastStory | null;
  onExplore: () => void;
  onEvent: (id: string) => void;
}) {
  const style = useExplanationStyle();
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<Asked | null>(null);
  const [steps, setSteps] = useState<AnalystStep[]>([]);
  const [result, setResult] = useState<AnalystResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const live = provider === "foundry" || provider === "openai";
  const storyId = story?.storyId ?? null;
  const storyCutoff = story?.cutoff ?? null;
  const starters = useMemo(
    () =>
      storyId !== null && storyCutoff !== null
        ? guidedQuestions(match, storyCutoff, storyId)
        : [],
    [match, storyId, storyCutoff],
  );

  const reset = () => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setSteps([]);
    setResult(null);
    setAsked(null);
    setError("");
  };
  // Never show an answer from a different match, or from after the viewer's position.
  useEffect(reset, [match]);
  useEffect(() => {
    if (!asked) return;
    // A checked answer belongs to one story at one exact position.
    if (asked.checked)
      if (time !== asked.cutoff || storyId !== asked.checked.storyId) reset();
    if (time < asked.cutoff || time - asked.cutoff > 600) reset();
  }, [time, asked, storyId]);
  useEffect(() => () => request.current?.abort(), []);

  async function ask(text: string, checked?: Asked["checked"]) {
    const q = text.trim();
    if (q.length < 3 || match.kind !== "synthetic") return;
    onExplore();
    request.current?.abort();
    request.current = null;
    const cutoff = Math.floor(time);
    setAsked({ question: q, cutoff, checked });
    setSteps([]);
    setResult(null);
    setError("");
    if (!live) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(60000),
        ]),
        body: JSON.stringify({
          scenario: match.provenance.raw.scenario,
          profile: match.provenance.raw.profile,
          time: cutoff,
          question: q,
          style,
        }),
      });
      if (!response.ok || !response.body) throw new Error("Unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line || request.current !== controller) continue;
          const message = JSON.parse(line) as AnalystStreamLine;
          if (message.type === "step") setSteps((s) => [...s, message.step]);
          else if (
            message.result.matchId === match.id &&
            message.result.cutoff === cutoff
          )
            setResult(message.result);
        }
      }
    } catch {
      if (request.current === controller && !controller.signal.aborted)
        setError(
          checked
            ? "The analyst couldn't be reached. The checked answer above still stands."
            : "The analyst couldn't be reached. The story above is still checked from the recorded events.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  if (match.kind !== "synthetic") return null;
  const cited = result
    ? match.events.filter((e) => result.citedEventIds.includes(e.id))
    : [];
  const verified = result?.status === "answered";
  const declined = result?.status === "declined";
  const lookups = steps.filter((s) => s.kind === "tool").length;
  const evidence = asked?.checked
    ? questionEvidence(match, asked.cutoff, asked.checked)
    : null;
  const checked = evidence && presentQuestion(evidence, match, style);
  const checkedEvents = evidence
    ? match.events.filter(
        (e) => e.time <= evidence.cutoff && evidence.eventIds.includes(e.id),
      )
    : [];
  // On a checked question the agent only adds; a decline adds nothing.
  const showAgentAnswer =
    result?.answer && (verified || (declined && !asked?.checked));

  return (
    <section className="analyst-panel" aria-label="Ask the analyst">
      <div className="analyst-heading">
        <h3>Ask the analyst</h3>
        {live && (
          <span className="analyst-engine">
            {providerLabel(provider)} agent
          </span>
        )}
      </div>
      {live ? (
        <form className="analyst-form" onSubmit={submit}>
          <label htmlFor={inputId} className="visually-hidden">
            Your question about this match
          </label>
          <input
            id={inputId}
            type="text"
            value={question}
            maxLength={QUESTION_MAX_LENGTH}
            placeholder="Ask about the match so far"
            onChange={(e) => setQuestion(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button
            type="submit"
            className="analyst-submit"
            disabled={busy || question.trim().length < 3}
          >
            {busy ? "Working…" : "Ask"}
          </button>
        </form>
      ) : (
        <p className="analyst-offline">
          The live analyst is off in this build.
          {starters.length > 0 &&
            " These questions are answered from the recorded events."}
        </p>
      )}
      {(starters.length > 0 || live) && (
        <div className="analyst-suggestions" aria-label="Suggested questions">
          {starters.length > 0
            ? starters.map((s) => (
                <button
                  key={s.intent}
                  type="button"
                  className="analyst-chip"
                  aria-pressed={asked?.checked?.intent === s.intent}
                  onClick={() => {
                    setQuestion("");
                    void ask(s.label, { intent: s.intent, storyId: storyId! });
                  }}
                >
                  {s.label}
                </button>
              ))
            : suggestedQuestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="analyst-chip"
                  disabled={busy}
                  onClick={() => {
                    setQuestion(s);
                    void ask(s);
                  }}
                >
                  {s}
                </button>
              ))}
        </div>
      )}

      {asked && (
        <div className="analyst-response" aria-live="polite">
          <p className="analyst-question">
            <span>You asked at {matchClock(match, asked.cutoff)}</span>
            {asked.question}
          </p>
          {evidence && checked && (
            <div className="analyst-checked" aria-label="Checked answer">
              <span className="analyst-badge">
                Checked from recorded events
              </span>
              <p className="analyst-checked-answer">
                <strong>{singularCounts(checked.answer)}</strong>
              </p>
              {evidence.availability === "available" &&
                !evidence.comparison && (
                  <p className="analyst-checked-measure">
                    {singularCounts(checked.measurement)}
                  </p>
                )}
              {evidence.availability === "available" && (
                <AnimatedDetails className="director-disclosure analyst-checked-detail">
                  <summary>How this was checked</summary>
                  {evidence.comparison && (
                    <InvestigationComparison
                      evidence={evidence}
                      match={match}
                      style={style}
                    />
                  )}
                  <p className="metric-note">{checked.windows}</p>
                  {checked.qualifications.map((q) => (
                    <p className="story-qualification" key={q}>
                      {singularCounts(q)}
                    </p>
                  ))}
                  {checkedEvents.length > 0 && (
                    <div
                      className="analyst-replay"
                      role="group"
                      aria-label="Replay a moment"
                    >
                      <span aria-hidden="true">Replay a moment</span>
                      <div className="story-chips">
                        {checkedEvents.slice(-6).map((e) => (
                          <button
                            className="story-chip"
                            key={e.id}
                            onClick={() => onEvent(e.id)}
                            aria-label={`Replay ${e.type.replaceAll("_", " ")} at ${eventClock(match, e)}`}
                          >
                            {eventClock(match, e)} ·{" "}
                            {e.type.replaceAll("_", " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </AnimatedDetails>
              )}
              {!live && (
                <p className="analyst-checked-note">
                  Deterministic rules over the recorded events · No model
                  investigation.
                </p>
              )}
            </div>
          )}
          {(steps.length > 0 || busy) && (
            <ol className="analyst-trace" aria-label="What the analyst did">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className={`analyst-step analyst-step-${step.kind}`}
                >
                  <span className="analyst-step-mark" aria-hidden="true">
                    {step.kind === "verify" && !step.passed ? (
                      <X size={16} />
                    ) : step.kind === "verify" ? (
                      <Check size={16} />
                    ) : null}
                  </span>
                  <span>
                    {step.label}
                    {step.kind === "tool" && (
                      <small> · {step.events} events</small>
                    )}
                  </span>
                </li>
              ))}
              {busy && (
                <li className="analyst-step analyst-step-pending">
                  <span className="analyst-step-mark" aria-hidden="true" />
                  <span>
                    {asked.checked && steps.length <= 1
                      ? "The analyst is looking for more…"
                      : steps.length <= 1
                        ? "Choosing which evidence to check…"
                        : "Checking the evidence…"}
                  </span>
                </li>
              )}
            </ol>
          )}
          {result && showAgentAnswer && (
            <div
              className={`analyst-answer ${verified ? "is-verified" : "is-declined"}`}
            >
              <span className="analyst-badge">
                {verified
                  ? `${asked.checked ? "The analyst adds · " : ""}Verified · ${lookups} ${lookups === 1 ? "lookup" : "lookups"}${result.cached ? " · reused" : ""}`
                  : "The events can't tell us that"}
              </span>
              <p>{result.answer}</p>
              {cited.length > 0 && (
                <div className="analyst-cited">
                  <span>Replay the evidence</span>
                  {cited.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="text-button"
                      onClick={() => onEvent(e.id)}
                    >
                      {eventClock(match, e)} · {e.type.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {result && !result.answer && (
            <p className="notice" role="status">
              {result.notice}
            </p>
          )}
          {result && declined && asked.checked && (
            <p className="notice" role="status">
              The analyst found nothing to add beyond the checked answer.
            </p>
          )}
          {error && (
            <p className="notice" role="status">
              {error}
            </p>
          )}
          {busy && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                request.current?.abort();
                request.current = null;
                setBusy(false);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </section>
  );
}
