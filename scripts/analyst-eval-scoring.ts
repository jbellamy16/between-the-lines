/** The existing status/decline score, not a measure of factual accuracy. */
export function analystEvalPass(
  expected: "answered" | "not-answered",
  status: string,
  answer: string | null,
) {
  if (expected === "answered") return status === "answered";
  return (
    status === "declined" ||
    (status === "answered" &&
      /can['’]t|cannot|not able|don['’]t|doesn['’]t/i.test(answer ?? ""))
  );
}

/** Review flags are reported separately and never change the score. */
export function normalAnswerWarnings(answer: string | null) {
  const warnings: string[] = [];
  if (answer?.includes("?")) warnings.push("question mark");
  if (
    answer &&
    /\b(?:no\s*[,;:—–-]|sorry\b|correction\b|i mean\b|let me (?:correct|rephrase)\b)/i.test(
      answer,
    )
  )
    warnings.push("possible self-correction");
  return warnings;
}
