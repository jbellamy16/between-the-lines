import { z } from "zod";
import { json, readInput } from "@/lib/ai/service";
import { preferencesSchema } from "@/lib/ai/evidence";
import { directMatch } from "@/lib/ai/director/runner";
import { SyntheticMatchSource } from "@/lib/sources/synthetic";
import { historicalEnabled, loadHistorical } from "@/lib/sources/repository";
export const runtime = "nodejs";
const schema = z
  .object({
    scenario: z.enum(["pressure", "substitution", "quiet"]).optional(),
    profile: z.enum(["demo", "balanced"]).default("demo"),
    matchId: z
      .string()
      .regex(/^(2499719|2499943|2499841|statsbomb-8658)$/)
      .optional(),
    time: z.number().finite().min(0).max(7200),
    mode: z.enum(["fan", "analyst"]),
    preferences: preferencesSchema.optional(),
  })
  .strict()
  .refine((v) => !!v.scenario !== !!v.matchId, "One source required");
export async function POST(req: Request) {
  let input;
  try {
    input = await readInput(req, schema);
  } catch {
    return json({ error: "Invalid director request" }, 400);
  }
  if (input.matchId && !historicalEnabled())
    return json({ error: "Historical matches disabled" }, 404);
  let match;
  try {
    match = input.matchId
      ? await loadHistorical(input.matchId)
      : new SyntheticMatchSource().read(input.scenario!, {
          profile: input.profile,
        });
  } catch {
    return json({ error: "Match unavailable" }, 404);
  }
  if (input.time > match.duration)
    return json({ error: "Invalid cutoff" }, 400);
  try {
    return json(
      await directMatch(
        match,
        input.time,
        input.mode,
        input.preferences,
        req.signal,
      ),
    );
  } catch {
    return json({ error: "Investigation cancelled" }, 499);
  }
}
