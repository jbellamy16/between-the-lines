import { z } from "zod";
import { json, readInput } from "@/lib/ai/service";
import { SyntheticMatchSource } from "@/lib/sources/synthetic";
import { investigateExplicitly } from "@/lib/ai/director/explicit-investigation";
export const runtime = "nodejs";
const schema = z
  .object({
    action: z.literal("investigate-with-microsoft-foundry"),
    scenario: z.enum(["pressure", "substitution", "quiet"]),
    profile: z.enum(["demo", "balanced"]).default("demo"),
    time: z.number().finite().min(0).max(7200),
  })
  .strict();
export async function POST(req: Request) {
  // No cross-origin browser dispatch; never accept arbitrary evidence or model IDs.
  const origin = req.headers.get("origin");
  try {
    if (
      origin &&
      new URL(origin).host !==
        (req.headers.get("host") ?? new URL(req.url).host)
    )
      return json({ error: "Same-origin action required" }, 403);
  } catch {
    return json({ error: "Invalid origin" }, 403);
  }
  let input;
  try {
    input = await readInput(req, schema);
  } catch {
    return json({ error: "Invalid investigation request" }, 400);
  }
  const match = new SyntheticMatchSource().read(input.scenario, {
    profile: input.profile,
  });
  if (input.time > match.duration)
    return json({ error: "Invalid cutoff" }, 400);
  try {
    return json(await investigateExplicitly(match, input.time, req.signal));
  } catch {
    return json({ error: "Investigation cancelled" }, 499);
  }
}
