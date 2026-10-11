import { it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { intelligenceCases } from "./intelligence-cases";
import {
  EvaluationLedger,
  ENDPOINT,
  DEPLOYMENT,
  EVALUATED_REF,
  STUDY,
  PRICE,
} from "./intelligence-ledger";
import { observe, DIRECTOR_VERSION } from "../src/lib/ai/director/observer";
import { directMatch, investigate } from "../src/lib/ai/director/runner";
import { createInvestigation } from "../src/lib/ai/director/tools";
import { reconstructStorylines } from "../src/lib/ai/director/storylines";
import { evaluateHypothesis } from "../src/lib/ai/director/hypothesis";
import { matchInsights, matchEvidence } from "../src/lib/sources/intelligence";
import { digest } from "../scripts/evaluate-intelligence-baseline";

const root = `artifacts/${STUDY}`;
const evidenceRoot = `docs/intelligence/${STUDY}`;
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const saveNew = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });

it("PR18 controlled intelligence study (explicit authorization only)", async () => {
  const live = process.env.SECOND_LOOK_AUTHORIZE_INTELLIGENCE_LIVE === "yes";
  const prepare = process.env.SECOND_LOOK_PREPARE_INTELLIGENCE === "yes";
  if (!live && !prepare)
    throw new Error("Explicit preparation or live authorization required");
  mkdirSync(root, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  const files = execFileSync(
    "git",
    [
      "ls-tree",
      "-r",
      "--name-only",
      EVALUATED_REF,
      "src/lib/ai",
      "src/lib/sources",
      "src/lib/match.ts",
      "src/lib/intelligence.ts",
    ],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n");
  const sourceHashes = Object.fromEntries(
    files.map((path) => {
      const committed = execFileSync("git", [
        "show",
        `${EVALUATED_REF}:${path}`,
      ]);
      if (!committed.equals(readFileSync(path)))
        throw new Error(`Evaluated implementation changed: ${path}`);
      return [path, hash(committed)];
    }),
  );
  // Legacy detector is unchanged from the frozen baseline's source reference.
  for (const path of [
    "src/lib/intelligence.ts",
    "src/lib/sources/intelligence.ts",
    "src/lib/sources/synthetic.ts",
    "src/lib/match.ts",
  ])
    expect(
      readFileSync(path).equals(
        execFileSync("git", [
          "show",
          `f7b0b87986efba09ca95bdf8750a39df31f1258f:${path}`,
        ]),
      ),
    ).toBe(true);
  const frozen = JSON.parse(
    readFileSync("docs/intelligence/original-baseline.json", "utf8"),
  );
  const supplement = process.env.SECOND_LOOK_INTELLIGENCE_SUPPLEMENT;
  if (supplement && supplement !== "active-favorite")
    throw new Error("Unknown diagnostic supplement");
  const mainCases = intelligenceCases();
  const favoriteCase = mainCases.find((c) => c.id === "player-preference")!;
  const cases = supplement
    ? [
        {
          ...favoriteCase,
          id: "active-favorite-theo",
          historicalCase: undefined,
          question:
            "Supplementary diagnostic: does following active Theo March prompt a useful player investigation? Added after the primary favorite fixture was found to have only one pass.",
          preferences: {
            team: "harbor" as const,
            player: favoriteCase.match.players.find(
              (p) => p.name === "Theo March",
            )!.id,
          },
        },
      ]
    : mainCases;
  // Offline calls cannot use any provider, regardless of a developer's environment.
  vi.stubEnv("AI_ENABLED", "false");
  vi.stubGlobal("fetch", async () => {
    throw new Error("Network forbidden during preparation");
  });
  const inputs = [];
  for (const c of cases) {
    const candidates = observe(c.match, c.cutoff, c.mode, c.preferences);
    const prefix = {
      ...c.match,
      events: c.match.events.filter((e) => e.time <= c.cutoff),
    };
    expect(observe(prefix, c.cutoff, c.mode, c.preferences)).toEqual(
      candidates,
    );
    expect(reconstructStorylines(prefix, c.cutoff)).toEqual(
      reconstructStorylines(c.match, c.cutoff),
    );
    const frozenRow = c.frozenCase
      ? frozen.rows.find((r: { id: string }) => r.id === c.frozenCase)
      : null;
    const inputDigest = digest({
      match: c.match,
      cutoff: c.cutoff,
      mode: c.mode,
      preferences: c.preferences,
    });
    if (frozenRow) expect(inputDigest).toBe(frozenRow.inputDigest);
    inputs.push({
      ...c,
      inputDigest,
      availableObservations: candidates,
      assessments: candidates.map((x) =>
        evaluateHypothesis(c.match, c.cutoff, x),
      ),
      storylines: reconstructStorylines(c.match, c.cutoff),
      matchContext: matchEvidence(c.match, c.cutoff, c.mode),
      deterministicA: matchInsights(c.match, c.cutoff),
      frozenOriginal: frozenRow,
      offlineFallback: await directMatch(
        c.match,
        c.cutoff,
        c.mode,
        c.preferences,
      ),
    });
  }
  vi.unstubAllGlobals();
  const matrix = {
    study: STUDY,
    evaluatedRef: EVALUATED_REF,
    directorVersion: DIRECTOR_VERSION,
    sourceHashes,
    price: PRICE,
    cases: inputs,
  };
  const matrixPath = `${root}/${supplement ? "supplement-active-favorite" : "matrix"}.json`;
  if (!existsSync(matrixPath)) saveNew(matrixPath, matrix);
  else
    expect(
      JSON.parse(readFileSync(matrixPath, "utf8")).cases.map(
        (c: { inputDigest: string }) => c.inputDigest,
      ),
    ).toEqual(inputs.map((c) => c.inputDigest));
  if (prepare && !live) {
    vi.unstubAllEnvs();
    return;
  }
  if (
    process.env.FOUNDRY_DEPLOYMENT !== DEPLOYMENT ||
    process.env.FOUNDRY_ENDPOINT !==
      ENDPOINT.replace("/openai/v1/responses", "") ||
    !process.env.FOUNDRY_API_KEY
  )
    throw new Error("Unexpected Foundry configuration");
  const preflight = JSON.parse(readFileSync(`${root}/preflight.json`, "utf8"));
  if (
    preflight.model.name !== "gpt-5.4-mini" ||
    preflight.model.version !== "2026-03-17" ||
    preflight.deployment !== DEPLOYMENT ||
    preflight.sku !== "GlobalStandard" ||
    preflight.rpm !== 10 ||
    preflight.tpm !== 10000 ||
    Date.now() - Date.parse(preflight.checkedAt) > 24 * 3600000
  )
    throw new Error("Preflight needs current verification");
  const ledger = new EvaluationLedger(`${root}/ledger.jsonl`);
  const transport = globalThis.fetch;
  let activeCase = "",
    stopped = false,
    lastRequest = 0;
  let received: Record<string, unknown>[] = [];
  const selected =
    process.env.SECOND_LOOK_INTELLIGENCE_CASES?.split(",") ??
    cases.map((c) => c.id);
  if (selected.some((id) => !cases.some((c) => c.id === id))) {
    ledger.close();
    throw new Error("Unknown case");
  }
  vi.stubGlobal(
    "fetch",
    async (
      url: Parameters<typeof fetch>[0],
      options: Parameters<typeof fetch>[1],
    ) => {
      if (stopped || existsSync(`${root}/STOP`))
        throw new Error("Evaluation stopped");
      if (
        String(url) !== ENDPOINT ||
        options?.method !== "POST" ||
        options.redirect !== "error"
      )
        throw new Error("Unexpected transport destination");
      const payload = String(options.body),
        body = JSON.parse(payload);
      // Evenly space requests for the 10 RPM deployment, inside the existing timeout.
      await delay(Math.max(0, 6100 - (Date.now() - lastRequest)), undefined, {
        signal: options.signal ?? undefined,
      });
      options.signal?.throwIfAborted();
      if (existsSync(`${root}/STOP`)) throw new Error("Evaluation stopped");
      const reservation = ledger.reserve(activeCase, payload);
      lastRequest = Date.now();
      const started = Date.now();
      const entry: Record<string, any> = {
        id: reservation.id,
        caseId: activeCase,
        requestBytes: Buffer.byteLength(payload),
        reservedUsd: reservation.reservedUsd,
        toolResults: body.input
          .filter((x: any) => x.type === "function_call_output")
          .map((x: any) => ({
            callId: x.call_id,
            output: JSON.parse(x.output),
          })),
      };
      received.push(entry);
      try {
        const response = await transport(url, options);
        const data = await response
          .clone()
          .json()
          .catch(() => ({}));
        entry.status = response.status;
        entry.responseStatus = data.status;
        entry.responseModel = data.model;
        if (data.usage)
          entry.usage = {
            input_tokens: data.usage.input_tokens,
            output_tokens: data.usage.output_tokens,
            input_tokens_details: {
              cached_tokens:
                data.usage.input_tokens_details?.cached_tokens ?? 0,
            },
          };
        // Whitelist public tool calls and final editorial text only. Never reasoning,
        // encrypted items, raw headers, request bodies, keys or provider error prose.
        entry.output = (data.output ?? []).flatMap((x: any) =>
          x.type === "function_call"
            ? [
                {
                  type: x.type,
                  call_id: x.call_id,
                  name: x.name,
                  arguments: x.arguments,
                },
              ]
            : x.type === "message"
              ? [
                  {
                    type: x.type,
                    content: (x.content ?? [])
                      .filter((c: any) => c.type === "output_text")
                      .map((c: any) => ({ type: c.type, text: c.text })),
                  },
                ]
              : [],
        );
        entry.rateLimits = Object.fromEntries(
          [
            "x-ratelimit-limit-requests",
            "x-ratelimit-limit-tokens",
            "x-ratelimit-remaining-requests",
            "x-ratelimit-remaining-tokens",
            "retry-after",
          ].map((k) => [k, response.headers.get(k)]),
        );
        if (!response.ok) entry.error = `HTTP ${response.status}`;
        return response;
      } catch (error) {
        entry.error = error instanceof Error ? error.name : "TransportError";
        throw error;
      } finally {
        entry.latencyMs = Date.now() - started;
        try {
          ledger.settle(reservation.id, entry);
        } catch {
          stopped = true;
          throw new Error(
            "Accounting failed; reservation retained and evaluation stopped",
          );
        }
        saveNew(`${root}/request-${reservation.id}.json`, entry);
      }
    },
  );
  try {
    for (const c of inputs.filter((c) => selected.includes(c.id))) {
      if (existsSync(`${root}/case-${c.id}.json`)) continue; // Never rerun/overwrite a case silently.
      if (ledger.reservations.length)
        await delay(
          Math.max(
            0,
            65000 - (Date.now() - Date.parse(ledger.reservations.at(-1)!.at)),
          ),
        );
      activeCase = c.id;
      received = [];
      const row: Record<string, any> = {
        id: c.id,
        inputDigest: c.inputDigest,
        evaluatedRef: EVALUATED_REF,
        humanReview: null,
        preliminaryAssessment: null,
        startedAt: new Date().toISOString(),
      };
      const start = Date.now();
      try {
        if (stopped || existsSync(`${root}/STOP`)) {
          row.outcome = "skipped";
          row.reason = "Study stopped";
        } else if (!c.availableObservations.length) {
          row.result = c.offlineFallback;
          row.outcome = "deterministic-abstention";
        } else {
          row.result = await investigate(
            c.match,
            c.cutoff,
            c.mode,
            c.preferences,
            "foundry",
          );
          row.outcome =
            row.result.decision === "abstain" ? "model-abstention" : "accepted";
          const verifier = createInvestigation(
            c.match,
            c.cutoff,
            c.mode,
            c.preferences,
          );
          for (const t of row.result.trace) verifier.execute(t.tool, t.query);
          for (const s of row.result.stories) {
            expect(s.validation).toBe("verified");
            expect(
              s.evidenceEventIds.every((id: string) =>
                c.match.events.some((e) => e.id === id && e.time <= c.cutoff),
              ),
            ).toBe(true);
            expect(s.hypothesis).toEqual(
              evaluateHypothesis(
                c.match,
                c.cutoff,
                verifier.candidates.find((x) => x.id === s.claimIds[0])!,
              ),
            );
          }
          expect(
            row.result.narrative.evidenceIds.every((id: string) =>
              c.match.events.some((e) => e.id === id && e.time <= c.cutoff),
            ),
          ).toBe(true);
          row.automatedVerification = "passed";
        }
      } catch (error) {
        row.error =
          error instanceof Error ? error.message : "Unknown evaluation failure";
        row.outcome = received.some((r) => r.status !== 200)
          ? "provider-failed"
          : received.some((r) =>
                (r.output as any[])?.some((x) => x.type === "message"),
              )
            ? "editorial-rejected"
            : received.length
              ? "investigation-failed"
              : "skipped";
        row.fallback = c.offlineFallback;
        row.fallbackNote =
          "Deterministic fallback computed offline; application catch path not invoked in this direct investigator study.";
      }
      row.latencyMs = Date.now() - start;
      row.requests = received.map((r) => r.id);
      row.requestCount = received.length;
      row.accountedStudyUsd = ledger.total();
      saveNew(`${root}/case-${c.id}.json`, row);
      console.log(
        JSON.stringify({
          case: c.id,
          outcome: row.outcome,
          requests: row.requestCount,
          error: row.error,
          accountedStudyUsd: ledger.total(),
        }),
      );
    }
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    ledger.close();
  }
});
