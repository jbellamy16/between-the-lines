import { z } from "zod";
import { toolNames } from "../../src/lib/ai/director/tools";
import { editorialSchema } from "../../src/lib/ai/director/story";

const query = z
  .object({
    tool: z.enum(toolNames),
    matchId: z.string().max(160),
    start: z.number().finite(),
    end: z.number().finite(),
    team: z.enum(["harbor", "riverside"]).nullable(),
    playerId: z.string().max(160).nullable(),
    eventId: z.string().max(200).nullable(),
  })
  .strict();
const storyPlan = editorialSchema.extend({
  stories: z
    .array(
      editorialSchema.shape.stories.element.extend({
        claimId: z.string().regex(/^c\d+$/),
      }),
    )
    .max(3),
});
const plan = z.union([
  storyPlan,
  z
    .object({
      intent: z.enum([
        "chance-quality",
        "opponent-improvement",
        "fading-activity",
      ]),
      verdict: z.enum(["higher", "lower", "level", "unknown"]),
      supplementIds: z
        .array(
          z.enum([
            "current-shot-outcomes",
            "attacking-third-recovery-shot-links",
          ]),
        )
        .max(2),
    })
    .strict(),
]);
export const responseReceiptSchema = z
  .object({
    toolChoices: z.array(query).max(4),
    plans: z.array(plan).max(3),
    invalidStructuredItems: z.number().int().nonnegative(),
  })
  .strict();
/** Persist only typed editorial choices. Never retain reasoning, provider error
 * messages, response IDs, headers, arbitrary response text or request secrets. */
export function responseReceipt(value: unknown) {
  const result: z.infer<typeof responseReceiptSchema> = {
    toolChoices: [],
    plans: [],
    invalidStructuredItems: 0,
  };
  const output = (value as { output?: unknown[] } | null)?.output;
  if (!Array.isArray(output)) return result;
  for (const item of output.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (entry.type === "function_call") {
      try {
        const args = JSON.parse(String(entry.arguments));
        const parsed = query.parse(
          entry.name === "inspect_match_evidence"
            ? args
            : { ...args, tool: entry.name },
        );
        if (result.toolChoices.length < 4) result.toolChoices.push(parsed);
        else result.invalidStructuredItems++;
      } catch {
        result.invalidStructuredItems++;
      }
    }
    if (entry.type === "message" && Array.isArray(entry.content))
      for (const part of entry.content) {
        if (part?.type !== "output_text") continue;
        try {
          const parsed = plan.parse(JSON.parse(part.text));
          if (result.plans.length < 3) result.plans.push(parsed);
          else result.invalidStructuredItems++;
        } catch {
          result.invalidStructuredItems++;
        }
      }
  }
  return result;
}
