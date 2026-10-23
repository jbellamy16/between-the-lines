import { z } from "zod";

// Part of the answer cache key: bump it when answers change, so answers
// cached under older rules are not served again.
export const ANALYST_VERSION = "analyst-1.5.0";
export const QUESTION_MAX_LENGTH = 240;

export const analystStyleSchema = z.enum(["plain", "fan", "analysis"]);
export type AnalystStyle = z.infer<typeof analystStyleSchema>;

export const analystRequestSchema = z
  .object({
    scenario: z.enum(["pressure", "substitution", "quiet"]),
    profile: z.enum(["demo", "balanced"]).default("demo"),
    time: z.number().finite().min(0).max(7200),
    question: z.string().trim().min(3).max(QUESTION_MAX_LENGTH),
    style: analystStyleSchema.default("plain"),
  })
  .strict();
export type AnalystRequest = z.infer<typeof analystRequestSchema>;

export type AnalystStep =
  | { kind: "plan"; label: string }
  | { kind: "tool"; tool: string; label: string; events: number }
  | {
      kind: "rejected-query";
      label: string;
      /** The refusal handed back to the agent, and the call it refused. */
      reason?: string;
      tool?: string;
      query?: unknown;
    }
  | { kind: "verify"; passed: boolean; label: string; issues: string[] }
  | { kind: "revise"; label: string; reason?: "verification" | "retry" };

export type AnalystResult = {
  version: string;
  status: "answered" | "declined" | "unverified" | "offline" | "unavailable";
  matchId: string;
  cutoff: number;
  question: string;
  answer: string | null;
  citedEventIds: string[];
  steps: AnalystStep[];
  source: "offline" | "openai" | "foundry";
  model: string | null;
  cached: boolean;
  metrics: {
    requests: number;
    toolCalls: number;
    latencyMs: number;
    estimatedCostUsd: number | null;
  };
  notice: string;
};

/** One NDJSON line from /api/ask. */
export type AnalystStreamLine =
  | { type: "step"; step: AnalystStep }
  | { type: "result"; result: AnalystResult };

/** Starter prompts shown under the question box. */
export const suggestedQuestions = [
  "What changed in the last ten minutes?",
  "Is the other team doing anything about it?",
  "Who has been most involved for Harbor?",
  "Are these chances actually any good?",
] as const;
