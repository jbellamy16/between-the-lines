import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { narrate } from "../src/lib/foundry";
import { generateMatch, DEMO_TIME } from "../src/lib/match";
import { detectInsights } from "../src/lib/intelligence";
import { configure } from "./ai-helpers";
beforeEach(() => configure("foundry"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("retrieves verified evidence through a tool before accepting a structured narrative", async () => {
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://example.openai.azure.com");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  vi.stubEnv("FOUNDRY_DEPLOYMENT", "test-model");
  const events = generateMatch("pressure"),
    insight = detectInsights(events, DEMO_TIME)[0];
  const narrative = {
    insightId: insight.id,
    explanation: "Harbor are recovering the ball closer to goal.",
    why: "This could shorten the route to the next chance.",
    watch: "Watch for a shot following the next high recovery.",
    evidenceIds: insight.evidenceIds,
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "function_call",
              name: "get_verified_evidence",
              call_id: "call-1",
              arguments: JSON.stringify({ insightId: insight.id }),
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                { type: "output_text", text: JSON.stringify(narrative) },
              ],
            },
          ],
        }),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  expect(await narrate(insight, events, "fan")).toEqual(narrative);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const body = JSON.parse(fetchMock.mock.calls[1][1].body);
  const evidence = JSON.parse(body.input.at(-1).output);
  expect(
    evidence.events.every((e: { time: number }) => e.time <= DEMO_TIME),
  ).toBe(true);
  expect(evidence.events.map((e: { id: string }) => e.id)).toEqual(
    insight.evidenceIds,
  );
  expect(evidence.baselineEvents.map((e: { id: string }) => e.id)).toEqual(
    insight.baselineIds,
  );
  expect(body.text.format.type).toBe("json_schema");
});
it("rejects a model that requests evidence outside the selected observation", async () => {
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://example.openai.azure.com");
  vi.stubEnv("FOUNDRY_API_KEY", "test-only");
  const events = generateMatch("pressure"),
    insight = detectInsights(events, DEMO_TIME)[0];
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        output: [
          {
            type: "function_call",
            name: "get_verified_evidence",
            call_id: "call-2",
            arguments: JSON.stringify({ insightId: "future" }),
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(narrate(insight, events, "analyst")).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([
  "https://example.openai.azure.com/unexpected",
  "https://example.openai.azure.com/?api-version=wrong",
  "https://example.openai.azure.com:8443",
  "http://example.openai.azure.com",
  "https://example.openai.azure.com.evil.example",
])(
  "rejects ambiguous or untrusted endpoint %s before sending credentials",
  async (endpoint) => {
    vi.stubEnv("FOUNDRY_ENDPOINT", endpoint);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const events = generateMatch("pressure");
    await expect(
      narrate(detectInsights(events, DEMO_TIME)[0], events, "fan"),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("does not accept incomplete model output", async () => {
  vi.stubEnv("FOUNDRY_ENDPOINT", "https://example.openai.azure.com");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "incomplete", output: [] })),
      ),
  );
  const events = generateMatch("pressure");
  await expect(
    narrate(detectInsights(events, DEMO_TIME)[0], events, "fan"),
  ).rejects.toMatchObject({ category: "invalid_response" });
});
