import { expect, it } from "vitest";
import {
  analystEvalPass,
  normalAnswerWarnings,
} from "../scripts/analyst-eval-scoring";

it.each(["can't", "can’t", "don't", "don’t", "doesn't", "doesn’t"])(
  "scores the same refusal wording with either apostrophe: %s",
  (word) => {
    expect(
      analystEvalPass(
        "not-answered",
        "answered",
        `The record ${word} show why.`,
      ),
    ).toBe(true);
  },
);
it.each(["does not", "do not"])(
  "does not silently broaden scoring to %s",
  (word) => {
    expect(
      analystEvalPass(
        "not-answered",
        "answered",
        `The records ${word} show why.`,
      ),
    ).toBe(false);
  },
);
it("still distinguishes declines, answers and errors", () => {
  expect(
    analystEvalPass("not-answered", "declined", "Outside this match."),
  ).toBe(true);
  expect(analystEvalPass("not-answered", "answered", "Harbor lead.")).toBe(
    false,
  );
  expect(analystEvalPass("not-answered", "unverified", "I can't say.")).toBe(
    false,
  );
  expect(analystEvalPass("answered", "declined", "Outside this match.")).toBe(
    false,
  );
});
it("flags the observed broken answer without changing its status score", () => {
  const answer =
    "Harbor had 37 passes to Riverside's 37? No — the window shows Riverside with 37?";
  expect(normalAnswerWarnings(answer)).toEqual([
    "question mark",
    "possible self-correction",
  ]);
  expect(analystEvalPass("answered", "answered", answer)).toBe(true);
});
it.each([
  "No—Harbor had more.",
  "No, I mean Harbor.",
  "Correction: Harbor had more.",
  "Let me correct that.",
])("lists self-correction wording for review: %s", (answer) => {
  expect(normalAnswerWarnings(answer)).toContain("possible self-correction");
});
it("does not flag ordinary statements or absent answers", () => {
  expect(
    normalAnswerWarnings(
      "Harbor had no shots. Their chances were actually poor.",
    ),
  ).toEqual([]);
  expect(normalAnswerWarnings(null)).toEqual([]);
});
