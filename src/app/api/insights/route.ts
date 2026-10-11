import { z } from "zod";
import { SyntheticMatchSource } from "@/lib/sources/synthetic";
import { pitchEvents } from "@/lib/sources/model";
import { detectInsights } from "@/lib/intelligence";
import { buildEvidence, matchRequestSchema } from "@/lib/ai/evidence";
import { configuredProvider } from "@/lib/ai/providers";
import { usageStoreReady } from "@/lib/ai/controls";
import { json, narratePacket, readInput } from "@/lib/ai/service";
import { directorConfiguration } from "@/lib/ai/director/configuration";
export const runtime = "nodejs";
const requestSchema = matchRequestSchema
  .extend({
    team: z.enum(["harbor", "riverside"]),
    category: z.enum(["pressure", "chances", "rhythm"]),
  })
  .strict();
export async function GET() {
  const configured = configuredProvider();
  return json({
    directorContext: directorConfiguration(),
    mode: usageStoreReady() ? configured : "offline",
    configured,
    proactive:
      process.env.AI_PROACTIVE_ENABLED === "true" &&
      configured !== "offline" &&
      usageStoreReady(),
    usageControls: usageStoreReady(),
  });
}
export async function POST(req: Request) {
  let input: z.infer<typeof requestSchema>;
  try {
    input = await readInput(req, requestSchema);
  } catch {
    return json({ error: "Invalid match request" }, 400);
  }
  const events = pitchEvents(
    new SyntheticMatchSource().read(input.scenario, { profile: input.profile })
      .events,
  );
  const insight = detectInsights(events, input.time).find(
    (i) => i.team === input.team && i.category === input.category,
  );
  if (!insight)
    return json({ error: "No verified pattern at this timestamp" }, 404);
  const packet = buildEvidence(
    events,
    input.time,
    input.mode,
    input.preferences,
    insight,
  );
  return json({ insight, ...(await narratePacket(packet)) });
}
