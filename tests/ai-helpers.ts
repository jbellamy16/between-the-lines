import { requiredContext } from "../src/lib/ai/narration";
import { vi } from "vitest";
import * as requestControls from "../src/lib/ai/request-controls";
import type { EvidencePacket } from "../src/lib/ai/evidence";
export function editorialBaseline(packet: EvidencePacket) {
  const ids = requiredContext(packet);
  for (const fact of [...packet.facts].sort((a, b) => b.priority - a.priority))
    if (!ids.includes(fact.id) && ids.length < 4) ids.push(fact.id);
  return { factIds: ids };
}
export function mockProvider(
  packet: EvidencePacket,
  output: unknown = editorialBaseline(packet),
) {
  return vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        status: "completed",
        usage: { input_tokens: 100, output_tokens: 20 },
        output: [
          {
            type: "function_call",
            name: "get_verified_evidence",
            call_id: "evidence",
            arguments: JSON.stringify({ insightId: packet.id }),
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        status: "completed",
        usage: { input_tokens: 500, output_tokens: 30 },
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(output) }],
          },
        ],
      }),
    );
}
export function configure(provider = "openai", realAccounting = false) {
  // Existing editorial tests exercise scripted decisions, not wall-clock pacing.
  // Reliability tests opt into real accounting with fake time and mocked HTTP.
  if (!realAccounting) {
    vi.spyOn(requestControls, "reserveProviderAttempt").mockResolvedValue();
    vi.spyOn(requestControls, "providerCooldown").mockResolvedValue();
  }
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_PROVIDER", provider);
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://example.openai.azure.com");
  vi.stubEnv("FOUNDRY_DEPLOYMENT", "test-deployment");
  vi.stubEnv("AI_REDIS_URL", "");
  vi.stubEnv("AI_USAGE_STORE", "memory");
}
