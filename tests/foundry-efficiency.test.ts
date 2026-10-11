import { afterAll, afterEach, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { MatchData } from "../src/lib/sources/model";
import { periodAt } from "../src/lib/sources/model";
import { investigate } from "../src/lib/ai/director/runner";
import { createInvestigation } from "../src/lib/ai/director/tools";
import { evidenceWire } from "../src/lib/ai/director/evidence-wire";
import { canLead } from "../src/lib/ai/director/editorial";
import { estimateRequestTokens } from "../src/lib/ai/providers";
import { configure } from "./ai-helpers";

const historical = "docs/intelligence/pr18-intelligence-2026-10-10";
const cases = JSON.parse(readFileSync(`${historical}/cases.json`, "utf8"))
  .cases as {
  id: string;
  matchId: string;
  cutoff: number;
  mode: "fan" | "analyst";
  preferences: Record<string, never>;
}[];
const fixtures = JSON.parse(
  readFileSync(`${historical}/synthetic-evidence.json`, "utf8"),
).fixtures as Record<string, MatchData>;
// The reviewer export intentionally omitted each synthetic event's source/raw
// wrapper. Restore only the adapter's second-precision provenance in memory.
for (const match of Object.values(fixtures))
  for (const event of match.events)
    event.source = {
      provider: "synthetic",
      matchId: match.id,
      eventId: event.id,
      precision: "second",
      teamId: event.team,
      playerId: event.playerId,
      eventType: event.type,
      tags: [],
      coordinates: {
        transform: "identity-percent-v1",
        start: event.position
          ? [event.position.x, event.position.y]
          : undefined,
        end: event.end ? [event.end.x, event.end.y] : undefined,
      },
      raw: {},
    };
const selected = cases.filter((c) =>
  [
    "misleading-quality",
    "pressure-fan",
    "pressure-analyst",
    "temporal-weakening",
    "temporal-resolved",
    "unfamiliar-8911",
    "unfamiliar-73129",
  ].includes(c.id),
);
const rows: unknown[] = [];
const temporary: string[] = [];
let before: typeof investigate | undefined;
// Explicit offline baseline capture from the reviewed main commit. Temporary
// modules are removed; no historical receipts are overwritten or re-evaluated live.
if (process.env.FOUNDRY_CAPTURE_BASELINE === "1") {
  for (const name of ["runner", "tools", "observer"]) {
    const path = resolve(`src/lib/ai/director/__measure-before-${name}.ts`);
    const source = execFileSync(
      "git",
      ["show", `cd4b67d:src/lib/ai/director/${name}.ts`],
      { encoding: "utf8" },
    )
      .replaceAll('"./tools"', '"./__measure-before-tools"')
      .replaceAll('"./observer"', '"./__measure-before-observer"');
    writeFileSync(path, source);
    temporary.push(path);
  }
  before = (
    await import(
      /* @vite-ignore */ resolve(
        "src/lib/ai/director/__measure-before-runner.ts",
      )
    )
  ).investigate;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(() => {
  temporary.forEach((path) => unlinkSync(path));
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/foundry-efficiency.json",
    JSON.stringify(
      {
        kind: "Offline scripted transport; not live provider results or quality scores",
        fixtureSource: historical,
        baselineRef: "cd4b67d",
        outputAllowance: 1800,
        tokenEstimate:
          "ceil(UTF-8 serialized request bytes / 3) + 256 framing + 1800 output; not billed usage",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
});
for (const c of selected) {
  it(`measures ${c.id} without live inference and preserves retrieved claims`, async () => {
    configure("foundry");
    const match = fixtures[c.matchId];
    const query = {
      matchId: match.id,
      start: Math.max(periodAt(match, c.cutoff).start, c.cutoff - 1800),
      end: c.cutoff,
      team: null,
      playerId: null,
      eventId: null,
    };
    const session = createInvestigation(match, c.cutoff, c.mode, c.preferences);
    const raw = session.execute("get_match_events", query);
    const encoder = evidenceWire();
    const wire = encoder(raw);
    expect(wire.claims.map((v) => encoder.canonical(v.id))).toEqual(
      raw.claims.map((v) => v.id),
    );
    for (const projected of wire.claims) {
      const original = raw.claims.find(
        (claim) => claim.id === encoder.canonical(projected.id),
      )!;
      expect(
        projected.evidenceRefs.map(
          (index) => wire.eventIdPrefix + wire.eventIds[index],
        ),
      ).toEqual(original.evidenceIds);
      expect(
        projected.limitationRefs.map((index) => wire.limitations[index]),
      ).toEqual(original.limitations);
      expect(projected.detail).toBe(original.detail);
      expect(projected.statistics).toEqual(original.statistics);
    }
    const prefix = {
      ...match,
      events: match.events.filter((e) => e.time <= c.cutoff),
    };
    expect(
      evidenceWire()(
        createInvestigation(prefix, c.cutoff, c.mode, c.preferences).execute(
          "get_match_events",
          query,
        ),
      ),
    ).toEqual(wire);
    expect(wire.events.every((e) => Number(e[1]) <= c.cutoff)).toBe(true);
    const compact = evidenceWire();
    compact(raw);
    const repeated = compact(raw);
    expect(repeated.events).toEqual([]);
    expect(repeated.claims).toEqual([]);
    expect(repeated.returnedClaimIds.map(compact.canonical)).toEqual(
      raw.claims.map((claim) => claim.id),
    );
    const lead = raw.claims.find(canLead);
    const plan = {
      decision: lead ? "publish" : "abstain",
      stories: lead
        ? [
            {
              claimId: lead.id,
              form: c.mode === "fan" ? "brief" : "detail",
              emphasis: lead.allowedEmphasis,
            },
          ]
        : [],
    };
    const measurements: Record<string, unknown> = {};
    for (const [name, run] of [
      ["before", before],
      ["after", investigate],
    ] as const) {
      if (!run) continue;
      const payloads: string[] = [];
      const transport = vi.fn(async (_url: string, init: RequestInit) => {
        payloads.push(String(init.body));
        const request = JSON.parse(String(init.body));
        const compactClaim = JSON.parse(
          request.input[0].content,
        ).evidence?.claims.find(
          (claim: { detail: string }) => claim.detail === lead?.detail,
        );
        const responsePlan = {
          ...plan,
          stories: plan.stories.map((story) => ({
            ...story,
            claimId: compactClaim?.id ?? story.claimId,
          })),
        };
        return Response.json({
          status: "completed",
          output: request.tool_choice?.name
            ? [
                {
                  type: "function_call",
                  name: "get_match_events",
                  call_id: "initial",
                  arguments: JSON.stringify(query),
                },
              ]
            : [
                {
                  type: "message",
                  content: [
                    { type: "output_text", text: JSON.stringify(responsePlan) },
                  ],
                },
              ],
        });
      });
      vi.stubGlobal("fetch", transport);
      const result = await run(
        match,
        c.cutoff,
        c.mode,
        c.preferences,
        "foundry",
      );
      expect(result.stories.map((s) => s.storyId)).toEqual(
        lead ? [lead.id] : [],
      );
      expect(payloads).toHaveLength(name === "before" ? 2 : 1);
      const bytes = payloads.map((p) => Buffer.byteLength(p, "utf8"));
      const tokens = payloads.map(estimateRequestTokens);
      if (name === "after") expect(tokens.every((t) => t <= 10000)).toBe(true);
      measurements[name] = {
        requests: payloads.length,
        requestBytes: bytes,
        totalBytes: bytes.reduce((a, b) => a + b, 0),
        estimatedTokensIncludingOutput: tokens,
        totalEstimatedTokensIncludingOutput: tokens.reduce((a, b) => a + b, 0),
        claimCount: raw.claims.length,
        selectedClaim: lead?.id ?? null,
      };
    }
    rows.push({ caseId: c.id, ...measurements });
  });
}
it("the labelled sizing estimate exceeds recorded input usage on every saved HTTP success", () => {
  const requests = JSON.parse(
    readFileSync(`${historical}/requests.json`, "utf8"),
  ).attempts;
  for (const request of requests)
    if (request.usage)
      expect(Math.ceil(request.requestBytes / 3) + 256).toBeGreaterThanOrEqual(
        request.usage.input_tokens,
      );
});
