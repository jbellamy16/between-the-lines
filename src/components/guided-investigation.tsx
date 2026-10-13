"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchData } from "@/lib/sources/model";
import { matchClock, eventClock } from "@/lib/sources/model";
import type { BroadcastStory } from "@/lib/ai/director/story";
import type { QuestionResult } from "@/lib/ai/director/question-runner";
import {
  guidedQuestions,
  questionEvidence,
  presentQuestion,
  questionLabels,
  type QuestionIntent,
} from "@/lib/ai/director/questions";
import { requestQuestion } from "@/lib/ai/director/question-cache";
import { useExplanationStyle } from "./explanation-preference";
import { AnimatedDetails } from "./motion";
import { InvestigationSource } from "./investigation-source";
import { InvestigationComparison } from "./investigation-comparison";

const sourceKeys = new WeakMap<MatchData, number>();
let sourceSequence = 0;

/** An answer belongs to one source story and exact viewer position. Remounting cancels subscribers; cache identity excludes presentation. */
export function GuidedInvestigation(props: {
  match: MatchData;
  story: BroadcastStory;
  time: number;
  provider: string;
  onExplore: () => void;
  onEvent: (id: string) => void;
}) {
  if (!sourceKeys.has(props.match))
    sourceKeys.set(props.match, ++sourceSequence);
  return (
    <QuestionPanel
      key={`${sourceKeys.get(props.match)}:${props.story.storyId}:${props.story.cutoff}:${props.time}`}
      {...props}
    />
  );
}
function QuestionPanel({
  match,
  story,
  provider,
  onExplore,
  onEvent,
}: {
  match: MatchData;
  story: BroadcastStory;
  provider: string;
  onExplore: () => void;
  onEvent: (id: string) => void;
}) {
  const style = useExplanationStyle();
  const questions = useMemo(
    () => guidedQuestions(match, story.cutoff, story.storyId),
    [match, story.cutoff, story.storyId],
  );
  const [intent, setIntent] = useState<QuestionIntent | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  // Object identity also catches replacement data with an unchanged match ID.
  useEffect(() => {
    setResult(null);
    setIntent(null);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [match]);
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setNotice(
      "Investigation cancelled. The recorded answer is still available.",
    );
  };
  async function choose(next: QuestionIntent) {
    onExplore();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIntent(next);
    setNotice("");
    const question = { intent: next, storyId: story.storyId };
    const evidence = questionEvidence(match, story.cutoff, question);
    if (!evidence) return;
    const baseline: QuestionResult = {
      evidence,
      source: "offline",
      supplements: [],
      trace: [],
      notice:
        "Checked from recorded events. This is a deterministic answer, not a model investigation.",
      metrics: {
        requests: 0,
        toolInvocations: 0,
        cached: false,
        latencyMs: 0,
        estimatedCostUsd: 0,
      },
    };
    setResult(baseline);
    if (
      provider === "offline" ||
      evidence.availability === "unavailable" ||
      evidence.comparison?.eligible === false ||
      match.provenance.redistribution === "restricted"
    ) {
      setBusy(false);
      setNotice(evidence.comparison?.noCallReason ?? baseline.notice);
      return;
    }
    setBusy(true);
    try {
      const answer = await requestQuestion(
        match,
        story.cutoff,
        question,
        controller.signal,
      );
      if (request.current === controller && !controller.signal.aborted) {
        setResult(answer);
        setNotice(answer.notice);
      }
    } catch {
      if (request.current === controller && !controller.signal.aborted) {
        setResult({ ...baseline, failure: { category: "transport" } });
        setNotice(
          "The investigation could not finish. Your recorded answer is still available. Try again.",
        );
      }
    } finally {
      if (request.current === controller) {
        setBusy(false);
        request.current = null;
      }
    }
  }
  if (!questions.length) return null;
  const wording = result && presentQuestion(result.evidence, match, style);
  const eventIds = new Set([
    ...(result?.evidence.eventIds ?? []),
    ...(result?.supplements.flatMap((s) => s.eventIds) ?? []),
  ]);
  const events = match.events.filter(
    (e) => e.time <= story.cutoff && eventIds.has(e.id),
  );
  return (
    <section
      className="guided-investigation"
      aria-label="Questions about this story"
    >
      <h3>Look closer</h3>
      <p className="guided-intro">
        Test this reading against the recorded evidence.
      </p>
      <div className="guided-questions">
        {questions
          .filter((q) => !q.unavailable)
          .map((q) => (
            <button
              className="question-button"
              key={q.intent}
              aria-pressed={intent === q.intent}
              onClick={() => void choose(q.intent)}
              disabled={busy && intent === q.intent}
            >
              {q.label}
            </button>
          ))}
      </div>
      {questions
        .filter((q) => q.unavailable)
        .map((q) => (
          <p className="question-unavailable" key={q.intent}>
            <strong>{q.label}</strong> {q.unavailable}
          </p>
        ))}
      {result && wording && (
        <div className="question-answer" aria-label="Question answer">
          <small>
            About this story · Through{" "}
            {matchClock(match, result.evidence.cutoff)}
          </small>
          <h4>{questionLabels[result.evidence.question.intent]}</h4>
          <InvestigationSource
            source={result.source}
            cached={result.metrics.cached}
          />
          <p className="question-direct-answer">
            <strong>{wording.answer}</strong>
          </p>
          <h5 className="investigation-heading">Evidence behind the answer</h5>
          {result.evidence.comparison ? (
            <InvestigationComparison
              evidence={result.evidence}
              match={match}
              style={style}
            />
          ) : (
            <p>{wording.measurement}</p>
          )}
          <p className="metric-note">{wording.windows}</p>
          {wording.qualifications.length > 0 && (
            <AnimatedDetails className="director-disclosure question-limits">
              <summary>
                What limits this reading ({wording.qualifications.length})
              </summary>
              {wording.qualifications.map((q) => (
                <p className="story-qualification" key={q}>
                  {q}
                </p>
              ))}
            </AnimatedDetails>
          )}
          {result.supplements.length > 0 && (
            <div className="question-followup">
              <h5 className="investigation-heading">Follow-up evidence</h5>
              {result.supplements.map((s) => (
                <p key={s.id}>{s.text}</p>
              ))}
            </div>
          )}
          <p role="status" aria-live="polite">
            {busy
              ? "Investigating this question. The recorded answer is visible while evidence is checked…"
              : notice}
          </p>
          {busy ? (
            <button className="text-button" onClick={cancel}>
              Cancel investigation
            </button>
          ) : (result.failure ||
              notice.startsWith("Investigation cancelled")) &&
            provider !== "offline" ? (
            <button
              className="text-button"
              onClick={() => void choose(intent!)}
            >
              Retry this question
            </button>
          ) : null}
          <AnimatedDetails className="director-disclosure">
            <summary>Explore answer evidence</summary>
            <p>{match.attribution}</p>
            <ul>
              {result.evidence.measurements.map((m) => (
                <li key={m.id}>
                  {match.teams[m.team].short} · {m.metric} · {m.window}:{" "}
                  {m.value === null
                    ? "unavailable"
                    : Number(m.value.toFixed(3))}
                </li>
              ))}
            </ul>
            {events.map((e) => (
              <button
                className="text-button"
                key={e.id}
                onClick={() => onEvent(e.id)}
              >
                {eventClock(match, e)} · {e.type.replaceAll("_", " ")} · Replay
              </button>
            ))}
          </AnimatedDetails>
        </div>
      )}
    </section>
  );
}
