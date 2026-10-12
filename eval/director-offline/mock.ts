import { vi } from "vitest";
import { estimateRequestTokens } from "../../src/lib/ai/providers";

export type Policy =
  | "fixed"
  | "adaptive"
  | "invented-reference"
  | "wrong-status"
  | "omit-challenge"
  | "causal-prose"
  | "future-replay"
  | "stop";
// Operates only on serialized provider input. No access to fixtures, gold labels,
// questionEvidence(), or the production result under test.
export function scriptedTransport(policy: Policy) {
  const transcript: {
    request: Record<string, any>;
    response: unknown;
    inputEstimate: number;
    outputEstimate: number;
    reservedEstimate: number;
  }[] = [];
  const eventIds: string[] = [];
  let interpretations: any[] = [],
    replay: string | null = null;
  const fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    if (
      String(url) !== "https://example.openai.azure.com/openai/v1/responses" ||
      !init?.body
    )
      throw new Error("Offline evaluator refused unexpected transport");
    const payload = String(init.body),
      body = JSON.parse(payload);
    const initial = JSON.parse(body.input[0].content);
    const returned = body.input.filter(
      (v: any) => v.type === "function_call_output",
    );
    const packet = returned.length ? JSON.parse(returned.at(-1).output) : null;
    const evidence = packet?.evidence ?? initial.evidence;
    evidence.eventIds.forEach((suffix: string, i: number) => {
      eventIds[evidence.eventOffset + i] = evidence.eventIdPrefix + suffix;
    });
    const call = (tool: string, eventId: string | null = null) => [
      {
        type: "function_call",
        name: "inspect_match_evidence",
        call_id: `offline-${transcript.length}`,
        arguments: JSON.stringify({
          ...initial.routeQuery,
          tool,
          eventId,
          purpose: "test-concentration",
        }),
      },
    ];
    let output: unknown[];
    if (policy === "stop") {
      output = [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                ...initial.question,
                decision: "no-added-insight",
                interpretations: [
                  "repeated-route",
                  "concentrated-attempts",
                  "both-teams",
                ].map((id) => ({
                  id,
                  status: "unresolved",
                  supportIds: [],
                  challengeIds: [],
                })),
                replayEventIds: [],
              }),
            },
          ],
        },
      ];
    } else if (!returned.length) output = call("compare_shot_routes");
    else {
      if (packet.interpretations?.length)
        interpretations = packet.interpretations.map(
          ({ text: _text, ...i }: any) => i,
        );
      if (
        returned.length === 1 &&
        (policy === "fixed" ||
          (policy === "adaptive" &&
            evidence.routes.current.largestPossession >= 2))
      ) {
        const rows = evidence.events;
        const col = (name: string) => evidence.eventColumns.indexOf(name);
        const shots = rows.filter(
          (r: any[]) =>
            r[col("type")] === "shot" &&
            r[col("team")] === initial.team &&
            r[col("time")] > initial.routeQuery.start,
        );
        // Fixed: first shot. Adaptive: illustrate the largest multi-shot group,
        // otherwise stop after the aggregate. This is a hand-written policy.
        const chosen =
          policy === "fixed"
            ? shots[0]
            : [...shots].sort(
                (a, b) =>
                  shots.filter(
                    (r: any[]) =>
                      r[col("possessionId")] === b[col("possessionId")],
                  ).length -
                  shots.filter(
                    (r: any[]) =>
                      r[col("possessionId")] === a[col("possessionId")],
                  ).length,
              )[0];
        replay = eventIds[chosen[col("eventRef")]];
        output = call("get_recorded_sequence", replay);
      } else {
        const plan: Record<string, any> = {
          ...initial.question,
          decision: "publish-comparison",
          interpretations: structuredClone(interpretations),
          replayEventIds: replay ? [replay] : [],
        };
        if (policy === "invented-reference")
          plan.interpretations[0].supportIds = ["invented-fact"];
        if (policy === "wrong-status")
          plan.interpretations[0].status =
            plan.interpretations[0].status === "supported"
              ? "limited"
              : "supported";
        if (policy === "omit-challenge")
          plan.interpretations[0].challengeIds = [];
        if (policy === "causal-prose")
          plan.conclusion = "Pressing caused this increase and will continue.";
        if (policy === "future-replay")
          plan.replayEventIds = ["unseen-future-event"];
        output = [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(plan) }],
          },
        ];
      }
    }
    // Deliberately omit usage: estimates are not provider-reported billing.
    const response = { status: "completed", output };
    transcript.push({
      request: body,
      response,
      inputEstimate: Math.ceil(Buffer.byteLength(payload) / 3) + 256,
      outputEstimate: Math.ceil(Buffer.byteLength(JSON.stringify(output)) / 3),
      reservedEstimate: estimateRequestTokens(payload),
    });
    return Response.json(response);
  });
  return { fetch, transcript };
}
