import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { observe, DIRECTOR_VERSION } from "../src/lib/ai/director/observer";
import { matchInsights } from "../src/lib/sources/intelligence";

export const ORIGINAL_INTELLIGENCE_REF =
  "f7b0b87986efba09ca95bdf8750a39df31f1258f";
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Frozen scenario inputs, shared with the paired offline evaluation. */
export function baselineCases() {
  const source = new SyntheticMatchSource();
  return (["pressure", "substitution", "quiet"] as const).flatMap((scenario) =>
    [600, 3600, 4200].flatMap((cutoff) =>
      (["fan", "analyst"] as const).map((mode) => ({
        id: `${scenario}-${cutoff}-${mode}`,
        match: source.read(scenario),
        cutoff,
        mode,
        preferences: {},
      })),
    ),
  );
}

/** Refuses to relabel changed code as the original Director. No provider is used. */
function captureOriginal() {
  const files = [
    "src/lib/ai/director/observer.ts",
    "src/lib/intelligence.ts",
    "src/lib/sources/intelligence.ts",
    "src/lib/sources/synthetic.ts",
    "src/lib/sources/model.ts",
    "src/lib/match.ts",
  ];
  const sourceHashes = Object.fromEntries(
    files.map((path) => {
      const original = execFileSync("git", [
        "show",
        `${ORIGINAL_INTELLIGENCE_REF}:${path}`,
      ]);
      const current = readFileSync(path);
      if (!original.equals(current))
        throw new Error(
          `Original capture refused: ${path} differs from ${ORIGINAL_INTELLIGENCE_REF}`,
        );
      return [path, createHash("sha256").update(original).digest("hex")];
    }),
  );
  const rows = baselineCases().map(
    ({ id, match, cutoff, mode, preferences }) => {
      const candidates = observe(match, cutoff, mode, preferences);
      const baseline = matchInsights(match, cutoff);
      return {
        id,
        inputDigest: digest({ match, cutoff, mode, preferences }),
        match: match.id,
        cutoff,
        mode,
        preferences,
        deterministic: baseline.map((c) => ({
          id: c.id,
          category: c.category,
          text: c.explanation,
        })),
        originalDirector: candidates.map((c) => ({
          id: c.id,
          category: c.category,
          text: mode === "fan" ? c.brief : c.detail,
          evidenceIds: c.evidenceIds,
        })),
      };
    },
  );
  writeFileSync(
    "docs/intelligence/original-baseline.json",
    JSON.stringify(
      {
        kind: "Frozen offline candidate comparison; no provider or human editorial preference evaluation",
        originalRef: ORIGINAL_INTELLIGENCE_REF,
        directorVersion: DIRECTOR_VERSION,
        sourceHashes,
        caseCount: rows.length,
        modelRequests: 0,
        costUsd: 0,
        liveModelQualityEvaluated: false,
        humanReview: null,
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Captured ${rows.length} original offline states from ${ORIGINAL_INTELLIGENCE_REF}.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  captureOriginal();
