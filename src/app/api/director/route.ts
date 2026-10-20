import { z } from "zod";
import { json, readInput } from "@/lib/ai/service";
import { preferencesSchema } from "@/lib/ai/evidence";
import { questionSchema } from "@/lib/ai/director/questions";
import {
  answerQuestion,
  QuestionUnavailable,
} from "@/lib/ai/director/question-runner";
import { directMatch } from "@/lib/ai/director/runner";
import { directorConfiguration } from "@/lib/ai/director/configuration";
import { SyntheticMatchSource } from "@/lib/sources/synthetic";
export const runtime = "nodejs";
const schema = z
  .object({
    scenario: z.enum(["pressure", "substitution", "quiet"]),
    profile: z.enum(["demo", "balanced"]).default("demo"),
    time: z.number().finite().min(0).max(7200),
    mode: z.enum(["fan", "analyst"]),
    preferences: preferencesSchema.optional(),
    question: questionSchema.optional(),
  })
  .strict();
export async function POST(req: Request) {
  let input;
  try {
    input = await readInput(req, schema);
  } catch {
    return json({ error: "Invalid director request" }, 400);
  }
  let match;
  try {
    match = new SyntheticMatchSource().read(input.scenario, {
      profile: input.profile,
    });
  } catch {
    return json({ error: "Match unavailable" }, 404);
  }
  if (input.time > match.duration)
    return json({ error: "Invalid cutoff" }, 400);
  try {
    return json({
      ...(input.question
        ? await answerQuestion(match, input.time, input.question, req.signal)
        : await directMatch(
            match,
            input.time,
            input.mode,
            input.preferences,
            req.signal,
          )),
      cacheContext: directorConfiguration(),
    });
  } catch (error) {
    if (error instanceof QuestionUnavailable)
      return json({ error: error.message }, 422);
    return json({ error: "Investigation cancelled" }, 499);
  }
}
