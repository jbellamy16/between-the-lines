import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { digest, frozenContent } from "./plan";
export const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
export function sourcePaths() {
  return [
    ...new Set(
      git(
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "src",
        "eval",
        "scripts",
        "tests",
        "e2e",
        ".github",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "vitest*.ts",
        "playwright*.ts",
        "next.config.ts",
      ).split("\n"),
    ),
  ].sort();
}
export function createFreeze() {
  return {
    ...frozenContent(),
    historicalHashes: Object.fromEntries(
      git("ls-files", "docs/intelligence")
        .split("\n")
        .filter(
          (p) =>
            !p.startsWith(
              "docs/intelligence/foundry-editorial-candidate-2026-10-12/",
            ),
        )
        .map((p) => [p, digest(readFileSync(p, "utf8"))]),
    ),
    sourceHashes: Object.fromEntries(
      sourcePaths().map((p) => [p, digest(readFileSync(p, "utf8"))]),
    ),
  };
}
export type Freeze = ReturnType<typeof createFreeze>;
export function verifyFreeze(frozen: Freeze) {
  if (
    JSON.stringify({ proposal: frozen.proposal, cases: frozen.cases }) !==
    JSON.stringify(frozenContent())
  )
    throw new Error("Frozen scenario/baseline/renderer drift");
  if (
    JSON.stringify(Object.keys(frozen.sourceHashes)) !==
    JSON.stringify(sourcePaths())
  )
    throw new Error("Frozen source inventory drift");
  for (const [p, hash] of Object.entries({
    ...frozen.sourceHashes,
    ...frozen.historicalHashes,
  }))
    if (digest(readFileSync(p, "utf8")) !== hash)
      throw new Error(`Frozen source drift: ${p}`);
}
