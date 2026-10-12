import { createInterface } from "node:readline/promises";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { entryGate } from "../investigator-feasibility/run";
import {
  collectPreflight,
  localConfiguration,
  quotaSnapshot,
} from "../guided-study/preflight";
import { DIRECTORY, digest, proposal, STUDY } from "./plan";
import { git, verifyFreeze, type Freeze } from "./freeze";
import { authorizationSchema, durableStore, type Authorization } from "./store";
import { experiment } from "./experiment";
import { writeReview } from "./review";
export { entryGate };
export function validateAuthorization(
  raw: unknown,
  frozen: Freeze,
  commit: string,
  now = Date.now(),
): Authorization {
  const auth = authorizationSchema.parse(raw);
  if (
    auth.manifest !== digest(JSON.stringify(frozen)) ||
    auth.commit !== commit ||
    Date.parse(auth.expiresAt) <= now
  )
    throw new Error("Stale or mismatched authorization");
  return auth;
}
export async function runOnce(args: string[]) {
  entryGate(args, process.env, !!process.stdin.isTTY, !!process.stdout.isTTY);
  if (git("status", "--porcelain"))
    throw new Error("Commit and review the frozen candidate first");
  const frozen: Freeze = JSON.parse(
    readFileSync(`${DIRECTORY}/frozen.json`, "utf8"),
  );
  verifyFreeze(frozen);
  const auth = validateAuthorization(
    JSON.parse(readFileSync(args[1], "utf8")),
    frozen,
    git("rev-parse", "HEAD"),
  );
  const config = localConfiguration();
  if (quotaSnapshot(config).some((n, i) => n > proposal.applicationCeilings[i]))
    throw new Error(
      "Application limits exceed frozen ceilings; never raise existing limits",
    );
  Object.assign(process.env, config);
  const store = durableStore(auth);
  const remaining = (await store("inspect")) as number[];
  if (remaining[0] < 1 || remaining[1] < 1)
    throw new Error("No existing allowance");
  const preflight = await collectPreflight();
  const blockers = preflight.blockers.filter(
    (b) =>
      !b.includes("six workflows") &&
      !b.includes("shared application allowance is insufficient"),
  );
  if (
    blockers.length ||
    !preflight.deployment ||
    !preflight.prices ||
    (preflight.application.remainingWorkflows ?? 0) < 1 ||
    (preflight.application.remainingAttempts ?? 0) < 1
  )
    throw new Error(
      "Current deployment, prices or durable allowance unverified",
    );
  if (
    config.FOUNDRY_DEPLOYMENT !== proposal.deployment ||
    config.FOUNDRY_ENDPOINT !== "https://josh-5098-resource.openai.azure.com" ||
    !config.FOUNDRY_API_KEY
  )
    throw new Error("Existing local Foundry configuration required");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (
      (await rl.question(
        `Separately authorized ${STUDY}: type ${auth.manifest} to spend at most $${auth.maxNanoUsd / 1e9} in at most ${auth.maxAttempts} HTTP attempts: `,
      )) !== auth.manifest
    )
      throw new Error("Not authorized");
  } finally {
    rl.close();
  }
  const output = `artifacts/${STUDY}-execution`;
  mkdirSync("artifacts", { recursive: true });
  mkdirSync(output); // exclusive, never resume or overwrite
  mkdirSync(join(output, "private"), { mode: 0o700 });
  const write = (name: string, value: unknown) =>
    writeFileSync(
      join(output, `private/${name}.json`),
      JSON.stringify(value, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  write("preflight", preflight);
  write("identity", {
    study: STUDY,
    manifest: auth.manifest,
    commit: auth.commit,
    maxAttempts: auth.maxAttempts,
    maxNanoUsd: auth.maxNanoUsd,
  });
  const fd = openSync(
    join(output, "private/transport-events.jsonl"),
    "wx",
    0o600,
  );
  const record = (event: Record<string, unknown>) => {
    const bytes = Buffer.from(
      JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n",
    );
    for (let offset = 0; offset < bytes.length;)
      offset += writeSync(fd, bytes, offset, bytes.length - offset);
    fsyncSync(fd);
  };
  const native = globalThis.fetch;
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    await store("claim", { manifest: auth.manifest, commit: auth.commit });
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "foundry";
    process.env.AI_PROACTIVE_ENABLED = "false";
    const report = await experiment(
      store,
      native,
      Math.min(auth.maxAttempts, remaining[1]),
      controller.signal,
      "recorded-model",
      record,
    );
    write("result", report);
    if (report.comparisons.length) writeReview(output, report.comparisons);
    console.log(
      JSON.stringify({
        output,
        status: report.status,
        paidCalls: report.paidCalls,
        humanReview: null,
      }),
    );
  } finally {
    closeSync(fd);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}
